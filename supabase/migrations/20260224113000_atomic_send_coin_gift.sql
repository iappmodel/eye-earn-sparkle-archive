-- Secure server-side coin gifting (atomic debit/credit via wallet_ledger)

CREATE OR REPLACE FUNCTION public.atomic_send_coin_gift(
  p_sender_id UUID,
  p_recipient_id UUID,
  p_amount INTEGER,
  p_coin_type TEXT,
  p_message TEXT DEFAULT NULL,
  p_gift_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_gift_uuid UUID := COALESCE(p_gift_id, gen_random_uuid());
  v_ref_base TEXT := 'coin_gift_' || v_gift_uuid::TEXT;
  v_lock_first UUID;
  v_lock_second UUID;
  v_sender_balance INTEGER;
  v_result_out JSONB;
  v_result_in JSONB;
  v_sender_new_balance INTEGER;
BEGIN
  IF p_sender_id IS NULL OR p_recipient_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_USER_IDS: Sender and recipient are required';
  END IF;

  IF p_sender_id = p_recipient_id THEN
    RAISE EXCEPTION 'SELF_GIFT: Cannot gift coins to yourself';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'INVALID_AMOUNT: Amount must be positive';
  END IF;

  IF p_coin_type NOT IN ('vicoin', 'icoin') THEN
    RAISE EXCEPTION 'INVALID_COIN_TYPE: Unsupported coin type %', COALESCE(p_coin_type, 'null');
  END IF;

  IF p_sender_id < p_recipient_id THEN
    v_lock_first := p_sender_id;
    v_lock_second := p_recipient_id;
  ELSE
    v_lock_first := p_recipient_id;
    v_lock_second := p_sender_id;
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('balance_' || v_lock_first::TEXT));
  PERFORM pg_advisory_xact_lock(hashtext('balance_' || v_lock_second::TEXT));

  IF p_coin_type = 'vicoin' THEN
    SELECT COALESCE(vicoin_balance, 0) INTO v_sender_balance FROM public.profiles WHERE user_id = p_sender_id;
  ELSE
    SELECT COALESCE(icoin_balance, 0) INTO v_sender_balance FROM public.profiles WHERE user_id = p_sender_id;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SENDER_NOT_FOUND: Sender profile not found';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_recipient_id) THEN
    RAISE EXCEPTION 'RECIPIENT_NOT_FOUND: Recipient profile not found';
  END IF;

  IF v_sender_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_BALANCE: Insufficient % balance. Current: %, Requested: %', p_coin_type, v_sender_balance, p_amount;
  END IF;

  v_result_out := public.ledger_append(p_sender_id, 'transfer_out', -p_amount, p_coin_type, v_ref_base || '_out');
  v_sender_new_balance := (v_result_out->>'new_balance')::INTEGER;

  IF NOT (v_result_out->>'applied')::BOOLEAN THEN
    INSERT INTO public.coin_gifts (id, sender_id, recipient_id, amount, coin_type, message, status)
    VALUES (v_gift_uuid, p_sender_id, p_recipient_id, p_amount, p_coin_type, NULLIF(BTRIM(p_message), ''), 'completed')
    ON CONFLICT (id) DO NOTHING;

    RETURN jsonb_build_object(
      'success', true,
      'gift_id', v_gift_uuid,
      'amount', p_amount,
      'coin_type', p_coin_type,
      'new_balance', v_sender_new_balance,
      'idempotent', true
    );
  END IF;

  v_result_in := public.ledger_append(p_recipient_id, 'transfer_in', p_amount, p_coin_type, v_ref_base || '_in');
  IF NOT (v_result_in->>'applied')::BOOLEAN THEN
    RAISE EXCEPTION 'GIFT_LEDGER_INCONSISTENT: Recipient credit insert failed';
  END IF;

  INSERT INTO public.coin_gifts (id, sender_id, recipient_id, amount, coin_type, message, status)
  VALUES (v_gift_uuid, p_sender_id, p_recipient_id, p_amount, p_coin_type, NULLIF(BTRIM(p_message), ''), 'completed')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES
    (p_sender_id, 'sent', p_coin_type, p_amount, 'Coin gift sent', v_ref_base),
    (p_recipient_id, 'received', p_coin_type, p_amount, 'Coin gift received', v_ref_base);

  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (
    p_recipient_id,
    'engagement',
    'You received a coin gift!',
    'Someone sent you ' || p_amount || ' ' || CASE WHEN p_coin_type = 'vicoin' THEN 'Vicoins' ELSE 'Icoins' END,
    jsonb_build_object('giftId', v_gift_uuid, 'amount', p_amount, 'coinType', p_coin_type, 'senderId', p_sender_id)
  );

  RETURN jsonb_build_object(
    'success', true,
    'gift_id', v_gift_uuid,
    'amount', p_amount,
    'coin_type', p_coin_type,
    'new_balance', v_sender_new_balance,
    'idempotent', false
  );
END;
$$;

COMMENT ON FUNCTION public.atomic_send_coin_gift(UUID, UUID, INTEGER, TEXT, TEXT, UUID)
  IS 'Atomically sends a coin gift: debits sender and credits recipient via wallet_ledger, inserts coin_gifts row, writes transactions and notification. Service-role only.';

REVOKE EXECUTE ON FUNCTION public.atomic_send_coin_gift(UUID, UUID, INTEGER, TEXT, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.atomic_send_coin_gift(UUID, UUID, INTEGER, TEXT, TEXT, UUID)
  TO service_role;
