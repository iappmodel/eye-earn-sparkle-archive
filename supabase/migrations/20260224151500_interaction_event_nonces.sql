-- Replay/dedup protection for reward-relevant interaction events (e.g., share, view_complete).
-- Used only by Edge Functions with service role; clients do not write this table.

CREATE TABLE IF NOT EXISTS public.interaction_event_nonces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_nonce UUID NOT NULL,
  action TEXT NOT NULL,
  content_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, event_nonce)
);

CREATE INDEX IF NOT EXISTS idx_interaction_event_nonces_created_at
  ON public.interaction_event_nonces(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_interaction_event_nonces_user_action_created
  ON public.interaction_event_nonces(user_id, action, created_at DESC);

ALTER TABLE public.interaction_event_nonces ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.interaction_event_nonces IS 'Server-side dedup receipts for reward-relevant track-interaction events.';

