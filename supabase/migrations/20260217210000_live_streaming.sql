-- Live streaming: streams, comments, viewer count
-- live_streams: stream metadata and status
CREATE TABLE IF NOT EXISTS public.live_streams (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  host_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  thumbnail_url text,
  status text NOT NULL DEFAULT 'live' CHECK (status IN ('live', 'ended')),
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  viewer_count integer NOT NULL DEFAULT 0,
  allow_comments boolean NOT NULL DEFAULT true,
  allow_gifts boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_streams_host ON public.live_streams(host_id);
CREATE INDEX IF NOT EXISTS idx_live_streams_status ON public.live_streams(status);
CREATE INDEX IF NOT EXISTS idx_live_streams_started ON public.live_streams(started_at DESC);

-- live_stream_comments: chat messages and gifts during stream
CREATE TABLE IF NOT EXISTS public.live_stream_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL DEFAULT '',
  is_gift boolean NOT NULL DEFAULT false,
  gift_amount integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_live_stream_comments_stream ON public.live_stream_comments(stream_id);
CREATE INDEX IF NOT EXISTS idx_live_stream_comments_created ON public.live_stream_comments(stream_id, created_at DESC);

-- live_stream_viewers: presence for viewer count (join/leave)
CREATE TABLE IF NOT EXISTS public.live_stream_viewers (
  stream_id uuid NOT NULL REFERENCES public.live_streams(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (stream_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_stream_viewers_stream ON public.live_stream_viewers(stream_id);

-- Trigger: update live_streams.viewer_count when viewers join/leave
CREATE OR REPLACE FUNCTION public.update_live_stream_viewer_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE live_streams SET viewer_count = viewer_count + 1, updated_at = now()
    WHERE id = NEW.stream_id AND status = 'live';
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE live_streams SET viewer_count = GREATEST(viewer_count - 1, 0), updated_at = now()
    WHERE id = OLD.stream_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_live_stream_viewer_count ON public.live_stream_viewers;
CREATE TRIGGER trigger_live_stream_viewer_count
  AFTER INSERT OR DELETE ON public.live_stream_viewers
  FOR EACH ROW EXECUTE FUNCTION public.update_live_stream_viewer_count();

-- Trigger: keep updated_at on live_streams
CREATE OR REPLACE FUNCTION public.live_streams_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_live_streams_updated_at ON public.live_streams;
CREATE TRIGGER trigger_live_streams_updated_at
  BEFORE UPDATE ON public.live_streams
  FOR EACH ROW EXECUTE FUNCTION public.live_streams_updated_at();

-- RLS
ALTER TABLE public.live_streams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_viewers ENABLE ROW LEVEL SECURITY;

-- live_streams: anyone can read live streams; host can insert/update own
DROP POLICY IF EXISTS "Anyone can read live streams" ON public.live_streams;
CREATE POLICY "Anyone can read live streams"
  ON public.live_streams FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Host can create stream" ON public.live_streams;
CREATE POLICY "Host can create stream"
  ON public.live_streams FOR INSERT
  WITH CHECK (auth.uid() = host_id);

DROP POLICY IF EXISTS "Host can update own stream" ON public.live_streams;
CREATE POLICY "Host can update own stream"
  ON public.live_streams FOR UPDATE
  USING (auth.uid() = host_id)
  WITH CHECK (auth.uid() = host_id);

-- live_stream_comments: anyone can read for a stream; authenticated can insert
DROP POLICY IF EXISTS "Anyone can read stream comments" ON public.live_stream_comments;
CREATE POLICY "Anyone can read stream comments"
  ON public.live_stream_comments FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated can post comment" ON public.live_stream_comments;
CREATE POLICY "Authenticated can post comment"
  ON public.live_stream_comments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- live_stream_viewers: anyone can read; authenticated can insert/delete own row
DROP POLICY IF EXISTS "Anyone can read viewers" ON public.live_stream_viewers;
CREATE POLICY "Anyone can read viewers"
  ON public.live_stream_viewers FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can join stream" ON public.live_stream_viewers;
CREATE POLICY "Users can join stream"
  ON public.live_stream_viewers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave stream" ON public.live_stream_viewers;
CREATE POLICY "Users can leave stream"
  ON public.live_stream_viewers FOR DELETE
  USING (auth.uid() = user_id);

-- Realtime: enable in Supabase Dashboard > Database > Replication for
-- public.live_streams and public.live_stream_comments so viewer count and
-- comments update in real time.
