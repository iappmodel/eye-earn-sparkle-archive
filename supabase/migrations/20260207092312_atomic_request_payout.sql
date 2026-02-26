-- atomic_request_payout: Withdrawal with KYC check and advisory lock
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
  v_current_balance INTEGER;
  v_kyc_status TEXT;
  v_new_balance INTEGER;
  v_tx_id UUID;
  v_reference_id TEXT;
BEGIN
  -- Acquire advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  -- Read profile with KYC status and balance
  IF p_coin_type = 'vicoin' THEN
    SELECT COALESCE(vicoin_balance, 0), kyc_status INTO v_current_balance, v_kyc_status
    FROM public.profiles WHERE user_id = p_user_id;
  ELSE
    SELECT COALESCE(icoin_balance, 0), kyc_status INTO v_current_balance, v_kyc_status
    FROM public.profiles WHERE user_id = p_user_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;

  -- Check KYC
  IF v_kyc_status IS NULL OR v_kyc_status != 'verified' THEN
    RAISE EXCEPTION 'KYC_REQUIRED: KYC verification required before payout. Status: %', COALESCE(v_kyc_status, 'none');
  END IF;

  -- Check sufficient balance
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient balance. Current: %, Requested: %', v_current_balance, p_amount;
  END IF;

  v_new_balance := v_current_balance - p_amount;
  v_reference_id := 'payout_' || extract(epoch from now())::bigint::text;

  -- Deduct balance
  IF p_coin_type = 'vicoin' THEN
    UPDATE public.profiles SET vicoin_balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;
  ELSE
    UPDATE public.profiles SET icoin_balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;
  END IF;

  -- Create transaction record
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
