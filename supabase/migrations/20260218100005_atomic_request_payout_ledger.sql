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
