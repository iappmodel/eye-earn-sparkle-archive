-- Follow/unfollow event ledger for exact follower growth analytics
-- Records immutable events whenever user_follows rows are inserted/deleted.

CREATE TABLE IF NOT EXISTS public.user_follow_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_follow_row_id uuid NOT NULL,
  follower_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('follow', 'unfollow')),
  event_at timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'user_follows_trigger',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_follow_events_unique_row_event
  ON public.user_follow_events(user_follow_row_id, event_type);

CREATE INDEX IF NOT EXISTS idx_user_follow_events_following_event_at
  ON public.user_follow_events(following_id, event_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_follow_events_follower_event_at
  ON public.user_follow_events(follower_id, event_at DESC);

ALTER TABLE public.user_follow_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view related follow events" ON public.user_follow_events;
CREATE POLICY "Users can view related follow events"
  ON public.user_follow_events
  FOR SELECT
  USING (auth.uid() = follower_id OR auth.uid() = following_id);

-- No direct client writes. Events are inserted by SECURITY DEFINER trigger.

CREATE OR REPLACE FUNCTION public.record_user_follow_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.user_follow_events (
      user_follow_row_id,
      follower_id,
      following_id,
      event_type,
      event_at,
      source
    )
    VALUES (
      NEW.id,
      NEW.follower_id,
      NEW.following_id,
      'follow',
      COALESCE(NEW.created_at, now()),
      'user_follows_trigger'
    )
    ON CONFLICT (user_follow_row_id, event_type) DO NOTHING;

    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.user_follow_events (
      user_follow_row_id,
      follower_id,
      following_id,
      event_type,
      event_at,
      source
    )
    VALUES (
      OLD.id,
      OLD.follower_id,
      OLD.following_id,
      'unfollow',
      now(),
      'user_follows_trigger'
    )
    ON CONFLICT (user_follow_row_id, event_type) DO NOTHING;

    RETURN OLD;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_record_user_follow_event ON public.user_follows;
CREATE TRIGGER trigger_record_user_follow_event
  AFTER INSERT OR DELETE ON public.user_follows
  FOR EACH ROW EXECUTE FUNCTION public.record_user_follow_event();

-- Backfill current active follows as historical follow events (best-effort seed).
INSERT INTO public.user_follow_events (
  user_follow_row_id,
  follower_id,
  following_id,
  event_type,
  event_at,
  source
)
SELECT
  uf.id,
  uf.follower_id,
  uf.following_id,
  'follow',
  COALESCE(uf.created_at, now()),
  'user_follows_backfill'
FROM public.user_follows uf
ON CONFLICT (user_follow_row_id, event_type) DO NOTHING;
