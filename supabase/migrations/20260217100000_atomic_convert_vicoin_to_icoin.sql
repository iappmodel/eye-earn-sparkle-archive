-- atomic_convert_vicoin_to_icoin: Vicoin-to-Icoin conversion (reverse of atomic_convert_coins)
-- Exchange: 1 Vicoin = 10 Icoins (same rate, opposite direction)
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
  v_current_icoin INTEGER;
  v_current_vicoin INTEGER;
  v_new_icoin INTEGER;
  v_new_vicoin INTEGER;
  v_transfer_id TEXT;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  SELECT COALESCE(icoin_balance, 0), COALESCE(vicoin_balance, 0)
  INTO v_current_icoin, v_current_vicoin
  FROM public.profiles
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;

  IF v_current_vicoin < p_vicoin_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient Vicoin balance. Current: %, Requested: %', v_current_vicoin, p_vicoin_amount;
  END IF;

  v_icoin_amount := p_vicoin_amount * p_exchange_rate;
  v_new_vicoin := v_current_vicoin - p_vicoin_amount;
  v_new_icoin := v_current_icoin + v_icoin_amount;
  v_transfer_id := 'transfer_' || extract(epoch from now())::bigint::text;

  UPDATE public.profiles
  SET vicoin_balance = v_new_vicoin,
      icoin_balance = v_new_icoin,
      updated_at = now()
  WHERE user_id = p_user_id;

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
