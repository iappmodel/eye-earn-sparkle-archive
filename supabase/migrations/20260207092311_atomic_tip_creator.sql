-- atomic_tip_creator: Peer-to-peer tipping with deadlock prevention
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
