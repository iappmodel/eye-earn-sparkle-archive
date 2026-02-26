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
