-- Merchant checkout V1: server-backed preferences + lightweight checkout session persistence
-- Used by edge functions:
--   - merchant-checkout-resolve
--   - merchant-checkout-draft
--   - merchant-checkout-confirm
--   - merchant-checkout-tip
--   - merchant-checkout-preferences

CREATE TABLE IF NOT EXISTS public.merchant_checkout_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  has_chosen_label_language boolean NOT NULL DEFAULT false,
  label_language text NOT NULL DEFAULT 'TRANSLATED_FALLBACK'
    CHECK (label_language IN ('MERCHANT_ORIGINAL', 'TRANSLATED_FALLBACK')),
  tip_prompt_layout_global text NOT NULL DEFAULT 'AUTO'
    CHECK (tip_prompt_layout_global IN ('AUTO', 'BOTTOM_SHEET', 'FULL_SCREEN')),
  tip_prompt_layout_by_category jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_convert_preference_enabled boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1 CHECK (version >= 1),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.merchant_checkout_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_data jsonb NOT NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_merchant_checkout_sessions_user_created
  ON public.merchant_checkout_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_merchant_checkout_sessions_expires
  ON public.merchant_checkout_sessions (expires_at);

ALTER TABLE public.merchant_checkout_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_checkout_sessions ENABLE ROW LEVEL SECURITY;

-- Edge functions use service role; block direct client reads/writes by default.
REVOKE ALL ON public.merchant_checkout_preferences FROM anon, authenticated;
REVOKE ALL ON public.merchant_checkout_sessions FROM anon, authenticated;

DROP TRIGGER IF EXISTS update_merchant_checkout_preferences_updated_at
  ON public.merchant_checkout_preferences;
CREATE TRIGGER update_merchant_checkout_preferences_updated_at
BEFORE UPDATE ON public.merchant_checkout_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_merchant_checkout_sessions_updated_at
  ON public.merchant_checkout_sessions;
CREATE TRIGGER update_merchant_checkout_sessions_updated_at
BEFORE UPDATE ON public.merchant_checkout_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

