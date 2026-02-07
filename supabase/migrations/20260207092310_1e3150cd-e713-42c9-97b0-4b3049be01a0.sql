
-- 1. atomic_convert_coins: Icoin-to-Vicoin conversion with advisory lock
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
  v_current_icoin INTEGER;
  v_current_vicoin INTEGER;
  v_new_icoin INTEGER;
  v_new_vicoin INTEGER;
  v_transfer_id TEXT;
BEGIN
  -- Acquire advisory lock for this user's balance
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  -- Read current balances (now locked, no race condition)
  SELECT COALESCE(icoin_balance, 0), COALESCE(vicoin_balance, 0)
  INTO v_current_icoin, v_current_vicoin
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;

  -- Check sufficient balance
  IF v_current_icoin < p_icoin_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient Icoin balance. Current: %, Requested: %', v_current_icoin, p_icoin_amount;
  END IF;

  -- Calculate conversion
  v_vicoin_amount := p_icoin_amount / p_exchange_rate;
  v_new_icoin := v_current_icoin - p_icoin_amount;
  v_new_vicoin := v_current_vicoin + v_vicoin_amount;
  v_transfer_id := 'transfer_' || extract(epoch from now())::bigint::text;

  -- Update balances atomically
  UPDATE public.profiles
  SET icoin_balance = v_new_icoin,
      vicoin_balance = v_new_vicoin,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Insert both transaction records
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

-- 2. atomic_tip_creator: Peer-to-peer tipping with deadlock prevention
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
  v_tipper_balance INTEGER;
  v_creator_balance INTEGER;
  v_tip_id TEXT;
  v_balance_column TEXT;
  v_lock_first UUID;
  v_lock_second UUID;
BEGIN
  -- Acquire locks in deterministic order to prevent deadlocks
  IF p_tipper_id < p_creator_id THEN
    v_lock_first := p_tipper_id;
    v_lock_second := p_creator_id;
  ELSE
    v_lock_first := p_creator_id;
    v_lock_second := p_tipper_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('balance_' || v_lock_first::text));
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || v_lock_second::text));

  v_balance_column := CASE WHEN p_coin_type = 'vicoin' THEN 'vicoin_balance' ELSE 'icoin_balance' END;

  -- Read tipper's balance
  IF p_coin_type = 'vicoin' THEN
    SELECT COALESCE(vicoin_balance, 0) INTO v_tipper_balance FROM public.profiles WHERE user_id = p_tipper_id;
  ELSE
    SELECT COALESCE(icoin_balance, 0) INTO v_tipper_balance FROM public.profiles WHERE user_id = p_tipper_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TIPPER_NOT_FOUND: Tipper profile not found';
  END IF;

  -- Check sufficient balance
  IF v_tipper_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance. Current: %, Requested: %', p_coin_type, v_tipper_balance, p_amount;
  END IF;

  -- Read creator's balance to verify they exist
  IF p_coin_type = 'vicoin' THEN
    SELECT COALESCE(vicoin_balance, 0) INTO v_creator_balance FROM public.profiles WHERE user_id = p_creator_id;
  ELSE
    SELECT COALESCE(icoin_balance, 0) INTO v_creator_balance FROM public.profiles WHERE user_id = p_creator_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CREATOR_NOT_FOUND: Creator profile not found';
  END IF;

  v_tip_id := 'tip_' || extract(epoch from now())::bigint::text;

  -- Deduct from tipper
  IF p_coin_type = 'vicoin' THEN
    UPDATE public.profiles SET vicoin_balance = v_tipper_balance - p_amount, updated_at = now() WHERE user_id = p_tipper_id;
  ELSE
    UPDATE public.profiles SET icoin_balance = v_tipper_balance - p_amount, updated_at = now() WHERE user_id = p_tipper_id;
  END IF;

  -- Add to creator
  IF p_coin_type = 'vicoin' THEN
    UPDATE public.profiles SET vicoin_balance = v_creator_balance + p_amount, updated_at = now() WHERE user_id = p_creator_id;
  ELSE
    UPDATE public.profiles SET icoin_balance = v_creator_balance + p_amount, updated_at = now() WHERE user_id = p_creator_id;
  END IF;

  -- Insert transaction records
  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES
    (p_tipper_id, 'spent', p_coin_type, p_amount, 'Tip to creator for content', v_tip_id),
    (p_creator_id, 'earned', p_coin_type, p_amount, 'Tip received from viewer', v_tip_id);

  -- Create notification for creator
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
    'new_balance', v_tipper_balance - p_amount
  );
END;
$$;

-- 3. atomic_request_payout: Withdrawal with KYC check and advisory lock
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

-- 4. atomic_update_balance: Generic balance addition with advisory lock (for rewards/checkins)
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
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Acquire advisory lock
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  -- Read current balance
  IF p_coin_type = 'vicoin' THEN
    SELECT COALESCE(vicoin_balance, 0) INTO v_current_balance FROM public.profiles WHERE user_id = p_user_id;
  ELSE
    SELECT COALESCE(icoin_balance, 0) INTO v_current_balance FROM public.profiles WHERE user_id = p_user_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  -- Update balance
  IF p_coin_type = 'vicoin' THEN
    UPDATE public.profiles SET vicoin_balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;
  ELSE
    UPDATE public.profiles SET icoin_balance = v_new_balance, updated_at = now() WHERE user_id = p_user_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'amount_added', p_amount,
    'coin_type', p_coin_type
  );
END;
$$;
