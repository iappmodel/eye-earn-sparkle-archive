-- Wallet ledger: immutable append-only source of truth for balance changes.
-- Balance is derived from SUM(amount) per user/currency; we also maintain cached balance on profiles
-- updated in the same transaction for read performance. ref_id is UNIQUE for idempotency.
--
-- For issue-reward: use atomic_update_balance(p_user_id, amount, coin_type, description, ref_id)
-- with ref_id = content_id (non-promo) or attention_session_id (promo_view) so each claim is idempotent.
-- Implement issue_reward_atomic / redeem_attention_reward to call atomic_update_balance (or ledger_append)
-- after validating caps/duplicates so all balance updates go through the ledger.

CREATE TABLE public.wallet_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'reward', 'checkin', 'promo_view', 'tip_in', 'tip_out', 'payout',
    'convert_in', 'convert_out', 'transfer_in', 'transfer_out'
  )),
  amount INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency IN ('vicoin', 'icoin')),
  ref_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(ref_id)
);

COMMENT ON TABLE public.wallet_ledger IS 'Immutable ledger of all balance changes; ref_id unique for idempotency.';
COMMENT ON COLUMN public.wallet_ledger.amount IS 'Signed: positive = credit, negative = debit.';
COMMENT ON COLUMN public.wallet_ledger.ref_id IS 'Unique idempotency key; duplicate ref_id is ignored (no double-credit).';

ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own ledger rows"
  ON public.wallet_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- Only service role / SECURITY DEFINER functions insert; no direct user INSERT policy needed for app.
CREATE POLICY "Service role can insert ledger"
  ON public.wallet_ledger FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_wallet_ledger_user_currency_created
  ON public.wallet_ledger (user_id, currency, created_at DESC);

CREATE INDEX idx_wallet_ledger_ref_id ON public.wallet_ledger (ref_id);

-- Core: append one ledger row and update cached balance in same TX. Idempotent on ref_id.
-- p_amount: signed (positive = credit, negative = debit).
CREATE OR REPLACE FUNCTION public.ledger_append(
  p_user_id UUID,
  p_type TEXT,
  p_amount INTEGER,
  p_currency TEXT,
  p_ref_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id UUID;
  v_new_balance INTEGER;
  v_current_balance INTEGER;
BEGIN
  IF p_amount = 0 THEN
    SELECT COALESCE(
      CASE WHEN p_currency = 'vicoin' THEN vicoin_balance ELSE icoin_balance END,
      0
    ) INTO v_current_balance
    FROM public.profiles WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'applied', false,
      'new_balance', v_current_balance,
      'reason', 'zero_amount'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  INSERT INTO public.wallet_ledger (user_id, type, amount, currency, ref_id)
  VALUES (p_user_id, p_type, p_amount, p_currency, p_ref_id)
  ON CONFLICT (ref_id) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    -- Idempotent: ref_id already exists, return current balance without changing
    IF p_currency = 'vicoin' THEN
      SELECT COALESCE(vicoin_balance, 0) INTO v_new_balance FROM public.profiles WHERE user_id = p_user_id;
    ELSE
      SELECT COALESCE(icoin_balance, 0) INTO v_new_balance FROM public.profiles WHERE user_id = p_user_id;
    END IF;
    RETURN jsonb_build_object(
      'applied', false,
      'new_balance', v_new_balance,
      'reason', 'duplicate_ref_id'
    );
  END IF;

  -- Ledger row inserted; update cached balance
  IF p_currency = 'vicoin' THEN
    UPDATE public.profiles
    SET vicoin_balance = COALESCE(vicoin_balance, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING COALESCE(vicoin_balance, 0) INTO v_new_balance;
  ELSE
    UPDATE public.profiles
    SET icoin_balance = COALESCE(icoin_balance, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING COALESCE(icoin_balance, 0) INTO v_new_balance;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;

  RETURN jsonb_build_object(
    'applied', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
END;
$$;
