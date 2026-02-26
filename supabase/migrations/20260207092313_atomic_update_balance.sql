-- atomic_update_balance: Generic balance addition with advisory lock (for rewards/checkins)
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
