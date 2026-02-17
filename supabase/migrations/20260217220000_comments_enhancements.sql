-- Comments enhancements: content_type, sync comments_count, realtime
-- Supports both user_content (UUID) and promotions (UUID) via content_id TEXT

-- 1. Add content_type to distinguish content source (user_content vs promotion)
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'user_content'
  CHECK (content_type IN ('user_content', 'promotion'));

COMMENT ON COLUMN public.comments.content_type IS 'Source of content: user_content or promotion. Enables correct comments_count sync for user_content.';

-- 2. Backfill content_type for existing rows (user_content IDs are UUID; promotions also UUID - default to user_content)
UPDATE public.comments
SET content_type = 'user_content'
WHERE content_type IS NULL;

-- 3. Sync user_content.comments_count when comments change
CREATE OR REPLACE FUNCTION public.sync_user_content_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_content_id uuid;
  v_count bigint;
BEGIN
  -- Get content_id; on DELETE use OLD
  v_content_id := CASE
    WHEN TG_OP = 'DELETE' THEN (OLD.content_id)::uuid
    ELSE (NEW.content_id)::uuid
  END;

  -- Only sync when content_type is user_content (or legacy null) and content_id is valid UUID
  IF (TG_OP = 'DELETE' AND (OLD.content_type IS NULL OR OLD.content_type = 'user_content'))
     OR (TG_OP IN ('INSERT','UPDATE') AND (NEW.content_type IS NULL OR NEW.content_type = 'user_content')) THEN
    BEGIN
      SELECT COUNT(*) INTO v_count
      FROM public.comments
      WHERE content_id = v_content_id::text
        AND (content_type IS NULL OR content_type = 'user_content');

      UPDATE public.user_content
      SET comments_count = v_count
      WHERE id = v_content_id;
    EXCEPTION WHEN invalid_text_representation THEN
      -- content_id is not a valid UUID (e.g. promo-xxx) - skip
      NULL;
    END;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS comments_sync_user_content_count ON public.comments;
CREATE TRIGGER comments_sync_user_content_count
  AFTER INSERT OR UPDATE OF content_id, content_type OR DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_content_comments_count();

-- 4. One-time recalc of all user_content comments_count
UPDATE public.user_content uc
SET comments_count = sub.cnt
FROM (
  SELECT content_id::uuid AS id, COUNT(*)::integer AS cnt
  FROM public.comments
  WHERE content_type IS NULL OR content_type = 'user_content'
  GROUP BY content_id
  HAVING content_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
) sub
WHERE uc.id = sub.id;

-- 5. Enable realtime for comments (live updates)
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
EXCEPTION WHEN duplicate_object THEN
  NULL; -- already in publication
END;
$$;
