-- atomic_convert_coins: Icoin-to-Vicoin conversion with advisory lock
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
