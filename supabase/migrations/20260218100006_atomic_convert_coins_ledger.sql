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
