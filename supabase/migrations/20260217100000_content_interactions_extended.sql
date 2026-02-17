-- Extend content_interactions for full interaction tracking
-- Adds: updated_at, saved (bookmark), last_event_type, metadata, content_owner_id, view_count

-- Add new columns (IF NOT EXISTS for safe re-runs)
ALTER TABLE public.content_interactions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ADD COLUMN IF NOT EXISTS saved BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_event_type TEXT DEFAULT 'view',
  ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS content_owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill updated_at from created_at where null
UPDATE public.content_interactions SET updated_at = created_at WHERE updated_at IS NULL;

-- Trigger for updated_at
DROP TRIGGER IF EXISTS update_content_interactions_updated_at ON public.content_interactions;
CREATE TRIGGER update_content_interactions_updated_at
  BEFORE UPDATE ON public.content_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for creator analytics: list interactions on content I own
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_owner_id
  ON public.content_interactions(content_owner_id)
  WHERE content_owner_id IS NOT NULL;

-- Index for last_event_type / analytics queries
CREATE INDEX IF NOT EXISTS idx_content_interactions_last_event_type
  ON public.content_interactions(last_event_type);

-- Index for saved/bookmarks per user
CREATE INDEX IF NOT EXISTS idx_content_interactions_user_saved
  ON public.content_interactions(user_id)
  WHERE saved = true;

-- Composite for recent activity per content
CREATE INDEX IF NOT EXISTS idx_content_interactions_content_updated
  ON public.content_interactions(content_id, updated_at DESC);

-- RLS: creators can SELECT interactions on their own content (for analytics)
CREATE POLICY "Creators can view interactions on their content"
  ON public.content_interactions FOR SELECT
  USING (
    auth.uid() = user_id
    OR content_owner_id = auth.uid()
  );

-- Ensure content_id can match user_content.id (uuid); table allows TEXT so we support both uuid and non-uuid content_id
COMMENT ON COLUMN public.content_interactions.last_event_type IS 'One of: view_start, view_progress, view_complete, like, unlike, share, save, unsave, feedback, skip';
COMMENT ON COLUMN public.content_interactions.metadata IS 'Optional: device_type, session_id, referrer, etc.';
