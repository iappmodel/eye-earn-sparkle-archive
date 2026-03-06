-- Merchant checkout analytics events
-- Captures checkout funnel events from edge functions and client-side tracking endpoint.

CREATE TABLE IF NOT EXISTS public.merchant_checkout_events (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  checkout_session_id text,
  payment_id text,
  entry_type text,
  merchant_id text,
  merchant_category text,
  checkout_mode text,
  mode_visibility text,
  tip_mode text,
  tip_timing text,
  auto_convert_used boolean,
  amount_minor bigint,
  tip_amount_minor bigint,
  currency_code text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_checkout_events_user_created
  ON public.merchant_checkout_events (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_checkout_events_name_created
  ON public.merchant_checkout_events (event_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_checkout_events_session_created
  ON public.merchant_checkout_events (checkout_session_id, created_at DESC);

ALTER TABLE public.merchant_checkout_events ENABLE ROW LEVEL SECURITY;

-- Events are server-written via service-role edge functions.
REVOKE ALL ON public.merchant_checkout_events FROM anon, authenticated;
