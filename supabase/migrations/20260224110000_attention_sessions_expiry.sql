-- Add short-lived expiry for validated attention sessions so rewards must be redeemed promptly.

ALTER TABLE public.attention_sessions
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill legacy rows. Old sessions become naturally expired; newer rows get a short grace window.
UPDATE public.attention_sessions
SET expires_at = COALESCE(created_at, now()) + INTERVAL '10 minutes'
WHERE expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_attention_sessions_expires_at
  ON public.attention_sessions(expires_at)
  WHERE redeemed_at IS NULL;
