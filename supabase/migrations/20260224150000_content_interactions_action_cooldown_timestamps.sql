-- Per-action cooldown timestamps for reward-relevant interaction events.
-- Using dedicated columns avoids bypassing cooldowns by alternating actions (last_event_type/updated_at drift).

ALTER TABLE public.content_interactions
  ADD COLUMN IF NOT EXISTS last_share_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS last_view_complete_at TIMESTAMP WITH TIME ZONE;

-- Best-effort backfill from existing updated_at for recent rows where the last event matches.
UPDATE public.content_interactions
SET last_share_at = updated_at
WHERE last_share_at IS NULL
  AND lower(coalesce(last_event_type, '')) = 'share'
  AND updated_at IS NOT NULL;

UPDATE public.content_interactions
SET last_view_complete_at = updated_at
WHERE last_view_complete_at IS NULL
  AND lower(coalesce(last_event_type, '')) = 'view_complete'
  AND updated_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_interactions_user_last_share
  ON public.content_interactions(user_id, last_share_at DESC)
  WHERE last_share_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_content_interactions_user_last_view_complete
  ON public.content_interactions(user_id, last_view_complete_at DESC)
  WHERE last_view_complete_at IS NOT NULL;

