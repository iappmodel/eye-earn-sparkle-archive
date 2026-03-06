-- Merchant checkout V1 hardening: idempotency + payment/tip status persistence

CREATE TABLE IF NOT EXISTS public.merchant_checkout_idempotency (
  id bigserial PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('confirm', 'tip')),
  checkout_session_id text,
  idempotency_key text NOT NULL,
  response_status integer NOT NULL,
  response_body jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mc_idempotency_user_scope_created
  ON public.merchant_checkout_idempotency (user_id, scope, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_checkout_payments (
  payment_id text PRIMARY KEY,
  checkout_session_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  merchant_id text,
  status text NOT NULL CHECK (status IN ('SUCCEEDED', 'PENDING', 'FAILED')),
  receipt jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_payments_user_created
  ON public.merchant_checkout_payments (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_payments_session_created
  ON public.merchant_checkout_payments (checkout_session_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.merchant_checkout_tips (
  tip_id text PRIMARY KEY,
  checkout_session_id text NOT NULL,
  payment_id text,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('SUCCEEDED', 'FAILED')),
  tip_amount_minor bigint NOT NULL,
  currency_code text NOT NULL,
  response jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mc_tips_user_created
  ON public.merchant_checkout_tips (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_mc_tips_payment_created
  ON public.merchant_checkout_tips (payment_id, created_at DESC);

ALTER TABLE public.merchant_checkout_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_checkout_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_checkout_tips ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.merchant_checkout_idempotency FROM anon, authenticated;
REVOKE ALL ON public.merchant_checkout_payments FROM anon, authenticated;
REVOKE ALL ON public.merchant_checkout_tips FROM anon, authenticated;

DROP TRIGGER IF EXISTS update_merchant_checkout_idempotency_updated_at
  ON public.merchant_checkout_idempotency;
CREATE TRIGGER update_merchant_checkout_idempotency_updated_at
BEFORE UPDATE ON public.merchant_checkout_idempotency
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchant_checkout_payments_updated_at
  ON public.merchant_checkout_payments;
CREATE TRIGGER update_merchant_checkout_payments_updated_at
BEFORE UPDATE ON public.merchant_checkout_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchant_checkout_tips_updated_at
  ON public.merchant_checkout_tips;
CREATE TRIGGER update_merchant_checkout_tips_updated_at
BEFORE UPDATE ON public.merchant_checkout_tips
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
