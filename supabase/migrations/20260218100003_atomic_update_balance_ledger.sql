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
