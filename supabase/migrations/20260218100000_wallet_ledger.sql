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

-- atomic_update_balance: ledger-first credit (rewards, checkins). ref_id = idempotency key.
CREATE OR REPLACE FUNCTION public.atomic_update_balance(
  p_user_id UUID,
  p_amount INTEGER,
  p_coin_type TEXT,
  p_description TEXT,
  p_reference_id TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
  v_applied BOOLEAN;
  v_new_balance INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Amount must be positive';
  END IF;

  v_result := public.ledger_append(
    p_user_id,
    'reward',
    p_amount,
    p_coin_type,
    p_reference_id
  );

  v_applied := (v_result->>'applied')::boolean;
  v_new_balance := (v_result->>'new_balance')::integer;

  -- Optional: keep transactions table in sync for wallet UI (display only)
  IF v_applied THEN
    INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
    VALUES (p_user_id, 'earned', p_coin_type, p_amount, COALESCE(p_description, 'Reward'), p_reference_id);
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_added', p_amount,
    'coin_type', p_coin_type,
    'idempotent', NOT v_applied
  );
END;
$$;

-- atomic_tip_creator: ledger-first; two ledger rows (tip_out, tip_in) with unique ref_ids
CREATE OR REPLACE FUNCTION public.atomic_tip_creator(
  p_tipper_id UUID,
  p_creator_id UUID,
  p_amount INTEGER,
  p_coin_type TEXT,
  p_content_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tip_id TEXT;
  v_lock_first UUID;
  v_lock_second UUID;
  v_result_out JSONB;
  v_result_in JSONB;
  v_tipper_balance INTEGER;
  v_tipper_new_balance INTEGER;
BEGIN
  IF p_tipper_id < p_creator_id THEN
    v_lock_first := p_tipper_id;
    v_lock_second := p_creator_id;
  ELSE
    v_lock_first := p_creator_id;
    v_lock_second := p_tipper_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('balance_' || v_lock_first::text));
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || v_lock_second::text));

  IF p_coin_type = 'vicoin' THEN
    SELECT COALESCE(vicoin_balance, 0) INTO v_tipper_balance FROM public.profiles WHERE user_id = p_tipper_id;
  ELSE
    SELECT COALESCE(icoin_balance, 0) INTO v_tipper_balance FROM public.profiles WHERE user_id = p_tipper_id;
  END IF;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TIPPER_NOT_FOUND: Tipper profile not found';
  END IF;
  IF v_tipper_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance. Current: %, Requested: %', p_coin_type, v_tipper_balance, p_amount;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_creator_id) THEN
    RAISE EXCEPTION 'CREATOR_NOT_FOUND: Creator profile not found';
  END IF;

  v_tip_id := 'tip_' || gen_random_uuid()::text;

  -- Debit tipper (ref_id unique for idempotency)
  v_result_out := public.ledger_append(p_tipper_id, 'tip_out', -p_amount, p_coin_type, v_tip_id || '_out');
  v_tipper_new_balance := (v_result_out->>'new_balance')::integer;

  IF NOT (v_result_out->>'applied')::boolean THEN
    -- Idempotent replay: return same result
    RETURN jsonb_build_object(
      'success', true,
      'tip_id', v_tip_id,
      'amount', p_amount,
      'coin_type', p_coin_type,
      'new_balance', v_tipper_new_balance
    );
  END IF;

  -- Credit creator
  v_result_in := public.ledger_append(p_creator_id, 'tip_in', p_amount, p_coin_type, v_tip_id || '_in');
  IF NOT (v_result_in->>'applied')::boolean THEN
    RAISE EXCEPTION 'TIP_LEDGER_INCONSISTENT: Creator ledger insert failed (duplicate ref?)';
  END IF;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES
    (p_tipper_id, 'spent', p_coin_type, p_amount, 'Tip to creator for content', v_tip_id),
    (p_creator_id, 'earned', p_coin_type, p_amount, 'Tip received from viewer', v_tip_id);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_creator_id,
    'earnings',
    'You received a tip!',
    'Someone tipped you ' || p_amount || ' ' || CASE WHEN p_coin_type = 'vicoin' THEN 'Vicoins' ELSE 'Icoins' END,
    jsonb_build_object('tipId', v_tip_id, 'amount', p_amount, 'coinType', p_coin_type, 'contentId', p_content_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'tip_id', v_tip_id,
    'amount', p_amount,
    'coin_type', p_coin_type,
    'new_balance', v_tipper_new_balance
  );
END;
$$;

-- atomic_request_payout: ledger-first debit; ref_id for idempotency
CREATE OR REPLACE FUNCTION public.atomic_request_payout(
  p_user_id UUID,
  p_amount INTEGER,
  p_coin_type TEXT,
  p_method TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_kyc_status TEXT;
  v_reference_id TEXT;
  v_result JSONB;
  v_new_balance INTEGER;
  v_tx_id UUID;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  SELECT kyc_status INTO v_kyc_status FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;
  IF v_kyc_status IS NULL OR v_kyc_status != 'verified' THEN
    RAISE EXCEPTION 'KYC_REQUIRED: KYC verification required before payout. Status: %', COALESCE(v_kyc_status, 'none');
  END IF;

  v_reference_id := 'payout_' || extract(epoch from now())::bigint::text || '_' || substr(md5(gen_random_uuid()::text), 1, 8);

  v_result := public.ledger_append(p_user_id, 'payout', -p_amount, p_coin_type, v_reference_id);
  v_new_balance := (v_result->>'new_balance')::integer;

  IF NOT (v_result->>'applied')::boolean THEN
    RETURN jsonb_build_object(
      'success', true,
      'transaction_id', NULL,
      'amount', p_amount,
      'coin_type', p_coin_type,
      'method', p_method,
      'new_balance', v_new_balance,
      'reference_id', v_reference_id,
      'idempotent', true
    );
  END IF;

  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient balance. Requested: %', p_amount;
  END IF;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES (p_user_id, 'withdrawn', p_coin_type, p_amount, 'Payout via ' || p_method, v_reference_id)
  RETURNING id INTO v_tx_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'amount', p_amount,
    'coin_type', p_coin_type,
    'method', p_method,
    'new_balance', v_new_balance,
    'reference_id', v_reference_id
  );
END;
$$;

-- atomic_convert_coins (Icoin -> Vicoin): ledger-first; two rows (convert_out icoin, convert_in vicoin)
CREATE OR REPLACE FUNCTION public.atomic_convert_coins(
  p_user_id UUID,
  p_icoin_amount INTEGER,
  p_exchange_rate INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vicoin_amount INTEGER;
  v_transfer_id TEXT;
  v_r_icoin JSONB;
  v_r_vicoin JSONB;
  v_new_icoin INTEGER;
  v_new_vicoin INTEGER;
  v_current_icoin INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  SELECT COALESCE(icoin_balance, 0) INTO v_current_icoin FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;
  IF v_current_icoin < p_icoin_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient Icoin balance. Current: %, Requested: %', v_current_icoin, p_icoin_amount;
  END IF;

  v_vicoin_amount := p_icoin_amount / p_exchange_rate;
  v_transfer_id := 'convert_icoin_vicoin_' || extract(epoch from now())::bigint::text || '_' || substr(md5(gen_random_uuid()::text), 1, 8);

  v_r_icoin := public.ledger_append(p_user_id, 'convert_out', -p_icoin_amount, 'icoin', v_transfer_id || '_out');
  IF NOT (v_r_icoin->>'applied')::boolean THEN
    v_new_icoin := (v_r_icoin->>'new_balance')::integer;
    v_new_vicoin := (SELECT COALESCE(vicoin_balance, 0) FROM public.profiles WHERE user_id = p_user_id);
    RETURN jsonb_build_object(
      'success', true,
      'icoin_spent', p_icoin_amount,
      'vicoin_received', v_vicoin_amount,
      'new_icoin_balance', v_new_icoin,
      'new_vicoin_balance', v_new_vicoin,
      'transfer_id', v_transfer_id,
      'idempotent', true
    );
  END IF;

  v_new_icoin := (v_r_icoin->>'new_balance')::integer;

  v_r_vicoin := public.ledger_append(p_user_id, 'convert_in', v_vicoin_amount, 'vicoin', v_transfer_id || '_in');
  IF NOT (v_r_vicoin->>'applied')::boolean THEN
    RAISE EXCEPTION 'CONVERT_LEDGER_INCONSISTENT: Vicoin ledger insert failed';
  END IF;
  v_new_vicoin := (v_r_vicoin->>'new_balance')::integer;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES
    (p_user_id, 'spent', 'icoin', p_icoin_amount, 'Converted to ' || v_vicoin_amount || ' Vicoins', v_transfer_id),
    (p_user_id, 'earned', 'vicoin', v_vicoin_amount, 'Converted from ' || p_icoin_amount || ' Icoins', v_transfer_id);

  RETURN jsonb_build_object(
    'success', true,
    'icoin_spent', p_icoin_amount,
    'vicoin_received', v_vicoin_amount,
    'new_icoin_balance', v_new_icoin,
    'new_vicoin_balance', v_new_vicoin,
    'transfer_id', v_transfer_id
  );
END;
$$;

-- atomic_convert_vicoin_to_icoin: ledger-first; two rows (convert_out vicoin, convert_in icoin)
CREATE OR REPLACE FUNCTION public.atomic_convert_vicoin_to_icoin(
  p_user_id UUID,
  p_vicoin_amount INTEGER,
  p_exchange_rate INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_icoin_amount INTEGER;
  v_transfer_id TEXT;
  v_r_vicoin JSONB;
  v_r_icoin JSONB;
  v_new_vicoin INTEGER;
  v_new_icoin INTEGER;
  v_current_vicoin INTEGER;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  SELECT COALESCE(vicoin_balance, 0) INTO v_current_vicoin FROM public.profiles WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;
  IF v_current_vicoin < p_vicoin_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient Vicoin balance. Current: %, Requested: %', v_current_vicoin, p_vicoin_amount;
  END IF;

  v_icoin_amount := p_vicoin_amount * p_exchange_rate;
  v_transfer_id := 'convert_vicoin_icoin_' || extract(epoch from now())::bigint::text || '_' || substr(md5(gen_random_uuid()::text), 1, 8);

  v_r_vicoin := public.ledger_append(p_user_id, 'convert_out', -p_vicoin_amount, 'vicoin', v_transfer_id || '_out');
  IF NOT (v_r_vicoin->>'applied')::boolean THEN
    v_new_vicoin := (v_r_vicoin->>'new_balance')::integer;
    v_new_icoin := (SELECT COALESCE(icoin_balance, 0) FROM public.profiles WHERE user_id = p_user_id);
    RETURN jsonb_build_object(
      'success', true,
      'vicoin_spent', p_vicoin_amount,
      'icoin_received', v_icoin_amount,
      'new_vicoin_balance', v_new_vicoin,
      'new_icoin_balance', v_new_icoin,
      'transfer_id', v_transfer_id,
      'idempotent', true
    );
  END IF;

  v_new_vicoin := (v_r_vicoin->>'new_balance')::integer;

  v_r_icoin := public.ledger_append(p_user_id, 'convert_in', v_icoin_amount, 'icoin', v_transfer_id || '_in');
  IF NOT (v_r_icoin->>'applied')::boolean THEN
    RAISE EXCEPTION 'CONVERT_LEDGER_INCONSISTENT: Icoin ledger insert failed';
  END IF;
  v_new_icoin := (v_r_icoin->>'new_balance')::integer;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES
    (p_user_id, 'spent', 'vicoin', p_vicoin_amount, 'Converted to ' || v_icoin_amount || ' Icoins', v_transfer_id),
    (p_user_id, 'earned', 'icoin', v_icoin_amount, 'Converted from ' || p_vicoin_amount || ' Vicoins', v_transfer_id);

  RETURN jsonb_build_object(
    'success', true,
    'vicoin_spent', p_vicoin_amount,
    'icoin_received', v_icoin_amount,
    'new_vicoin_balance', v_new_vicoin,
    'new_icoin_balance', v_new_icoin,
    'transfer_id', v_transfer_id
  );
END;
$$;
