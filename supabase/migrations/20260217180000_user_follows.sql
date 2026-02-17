-- user_follows: persist follow relationships with RLS and count triggers
CREATE TABLE IF NOT EXISTS public.user_follows (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON public.user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON public.user_follows(following_id);

ALTER TABLE public.user_follows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view follow relationships" ON public.user_follows;
CREATE POLICY "Users can view follow relationships"
  ON public.user_follows FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can manage own follows" ON public.user_follows;
CREATE POLICY "Users can manage own follows"
  ON public.user_follows FOR ALL
  USING (auth.uid() = follower_id)
  WITH CHECK (auth.uid() = follower_id);

-- Trigger: update followers_count and following_count on profiles
CREATE OR REPLACE FUNCTION public.update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment following_count for follower, followers_count for followed
    UPDATE profiles SET following_count = COALESCE(following_count, 0) + 1
    WHERE user_id = NEW.follower_id;
    UPDATE profiles SET followers_count = COALESCE(followers_count, 0) + 1
    WHERE user_id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET following_count = GREATEST(COALESCE(following_count, 0) - 1, 0)
    WHERE user_id = OLD.follower_id;
    UPDATE profiles SET followers_count = GREATEST(COALESCE(followers_count, 0) - 1, 0)
    WHERE user_id = OLD.following_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_follow_counts ON public.user_follows;
CREATE TRIGGER trigger_update_follow_counts
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.update_follow_counts();
