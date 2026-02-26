-- Sync user_content.likes_count from content_likes (source of truth)
-- content_likes stores per-user likes; user_content.likes_count is denormalized for feed performance.
-- This migration adds triggers to keep them in sync + one-time backfill.

-- 1. Trigger function: recalc user_content.likes_count when content_likes changes
CREATE OR REPLACE FUNCTION public.sync_user_content_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_id text;
  v_count integer;
  v_uuid uuid;
BEGIN
  v_content_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD.content_id
    ELSE NEW.content_id
  END;

  -- Only sync when content_id is a valid UUID (user_content uses UUID; promotions may use UUID too)
  BEGIN
    v_uuid := v_content_id::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN COALESCE(NEW, OLD); -- Non-UUID content_id (e.g. promo-xxx) - skip user_content sync
  END;

  -- Recalc count from content_likes (ensures consistency)
  SELECT COALESCE(COUNT(*)::integer, 0) INTO v_count
  FROM public.content_likes
  WHERE content_id = v_content_id;

  -- Update user_content only if this id exists in user_content
  UPDATE public.user_content
  SET likes_count = v_count, updated_at = now()
  WHERE id = v_uuid;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS content_likes_sync_user_content_count ON public.content_likes;
CREATE TRIGGER content_likes_sync_user_content_count
  AFTER INSERT OR DELETE ON public.content_likes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_content_likes_count();

-- 2. One-time backfill: sync all user_content.likes_count from content_likes
UPDATE public.user_content uc
SET likes_count = COALESCE((
  SELECT COUNT(*)::integer
  FROM public.content_likes cl
  WHERE cl.content_id = uc.id::text
), 0);

-- 3. Enable realtime for content_likes (optional: clients can subscribe for live like updates)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.content_likes;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already in publication
END;
$$;

-- 4. RPC: Get like counts (batch). ids = content_id values (TEXT); UUIDs and non-UUID promo IDs both supported.
-- Optional p_user_id for is_liked. Returns content_id, like_count, is_liked. When p_user_id is null, is_liked is false.
CREATE OR REPLACE FUNCTION public.get_content_like_counts(ids text[] DEFAULT '{}', p_user_id uuid DEFAULT NULL)
RETURNS TABLE(content_id text, like_count bigint, is_liked boolean)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    cl.content_id,
    COUNT(*)::bigint AS like_count,
    (p_user_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.content_likes ucl
      WHERE ucl.content_id = cl.content_id AND ucl.user_id = p_user_id
    )) AS is_liked
  FROM public.content_likes cl
  WHERE cl.content_id = ANY(ids)
  GROUP BY cl.content_id;
$$;

COMMENT ON FUNCTION public.get_content_like_counts(text[], uuid) IS 'Returns like counts and optional is_liked per content. Use for feeds. Source of truth: content_likes.';
