-- Content likes: persist user likes for content (user_content, promotions, etc.)
-- content_id supports both UUID (user_content) and non-UUID (promotions)
CREATE TABLE IF NOT EXISTS public.content_likes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

CREATE INDEX IF NOT EXISTS idx_content_likes_user_id ON public.content_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_content_id ON public.content_likes(content_id);
CREATE INDEX IF NOT EXISTS idx_content_likes_created_at ON public.content_likes(created_at DESC);

ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own likes" ON public.content_likes;
CREATE POLICY "Users can view own likes"
ON public.content_likes FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own likes" ON public.content_likes;
CREATE POLICY "Users can insert own likes"
ON public.content_likes FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own likes" ON public.content_likes;
CREATE POLICY "Users can delete own likes"
ON public.content_likes FOR DELETE
USING (auth.uid() = user_id);

-- RPC to get public like counts (bypasses RLS for aggregation)
CREATE OR REPLACE FUNCTION public.get_content_like_counts(ids text[])
RETURNS TABLE(content_id text, like_count bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT content_id, COUNT(*)::bigint
  FROM content_likes
  WHERE content_id = ANY(ids)
  GROUP BY content_id;
$$;
