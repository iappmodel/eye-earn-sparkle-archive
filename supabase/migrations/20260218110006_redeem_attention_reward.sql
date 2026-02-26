-- redeem_attention_reward: lock attention session + daily cap row, check caps, ledger + update in one TX.
CREATE OR REPLACE FUNCTION public.redeem_attention_reward(
  p_user_id UUID,
  p_session_id UUID,
  p_daily_promo_limit INTEGER,
  p_daily_icoin_limit INTEGER,
  p_daily_vicoin_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_campaign RECORD;
  v_cap RECORD;
  v_ledger_result JSONB;
  v_amount INTEGER;
  v_base_amount INTEGER;
  v_currency TEXT;
  v_new_balance INTEGER;
  v_multiplier NUMERIC;
BEGIN
  SELECT id, user_id, campaign_id, validated, redeemed_at, validation_score, reward_multiplier
  INTO v_session
  FROM public.attention_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;
  IF v_session.user_id IS DISTINCT FROM p_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;
  IF NOT v_session.validated OR v_session.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  IF v_session.campaign_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'promotion_not_found');
  END IF;
  SELECT reward_amount, COALESCE(reward_type, 'icoin') INTO v_campaign
  FROM public.promotions
  WHERE id = v_session.campaign_id
  LIMIT 1;
  IF NOT FOUND OR v_campaign.reward_amount IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'promotion_not_found');
  END IF;
  v_base_amount := v_campaign.reward_amount;
  v_currency := v_campaign.reward_type;
  IF v_currency NOT IN ('vicoin', 'icoin') THEN
    v_currency := 'icoin';
  END IF;
  v_multiplier := COALESCE(v_session.reward_multiplier, 1);
  v_amount := GREATEST(1, FLOOR(v_base_amount * v_multiplier)::INTEGER);

  INSERT INTO public.daily_reward_caps (user_id, date)
  VALUES (p_user_id, current_date)
  ON CONFLICT (user_id, date) DO NOTHING;

  SELECT * INTO v_cap
  FROM public.daily_reward_caps
  WHERE user_id = p_user_id AND date = current_date
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'daily_limit_reached',
      'limit_type', 'cap_row_missing',
      'daily_remaining_promo_views', p_daily_promo_limit,
      'daily_remaining_icoin', p_daily_icoin_limit,
      'daily_remaining_vicoin', p_daily_vicoin_limit
    );
  END IF;

  IF v_cap.promo_views + 1 > p_daily_promo_limit THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'daily_limit_reached',
      'limit_type', 'promo_views',
      'daily_remaining_promo_views', 0,
      'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
      'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned)
    );
  END IF;
  IF v_currency = 'icoin' AND (v_cap.icoin_earned + v_amount > p_daily_icoin_limit) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'daily_limit_reached',
      'limit_type', 'icoin',
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views),
      'daily_remaining_icoin', 0,
      'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned)
    );
  END IF;
  IF v_currency = 'vicoin' AND (v_cap.vicoin_earned + v_amount > p_daily_vicoin_limit) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'daily_limit_reached',
      'limit_type', 'vicoin',
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views),
      'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
      'daily_remaining_vicoin', 0
    );
  END IF;

  v_ledger_result := public.ledger_append(
    p_user_id,
    'promo_view',
    v_amount,
    v_currency,
    'attention_session_' || p_session_id::text
  );

  v_new_balance := (v_ledger_result->>'new_balance')::INTEGER;

  IF NOT (v_ledger_result->>'applied')::BOOLEAN THEN
    UPDATE public.attention_sessions SET redeemed_at = now() WHERE id = p_session_id;
    RETURN jsonb_build_object(
      'success', true,
      'amount', v_amount,
      'coin_type', v_currency,
      'new_balance', v_new_balance,
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views),
      'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
      'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned)
    );
  END IF;

  UPDATE public.daily_reward_caps
  SET
    promo_views = promo_views + 1,
    icoin_earned = icoin_earned + CASE WHEN v_currency = 'icoin' THEN v_amount ELSE 0 END,
    vicoin_earned = vicoin_earned + CASE WHEN v_currency = 'vicoin' THEN v_amount ELSE 0 END,
    updated_at = now()
  WHERE user_id = p_user_id AND date = current_date;

  UPDATE public.attention_sessions
  SET redeemed_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES (p_user_id, 'earned', v_currency, v_amount, 'Promo view reward', 'attention_session_' || p_session_id::text);

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_amount,
    'coin_type', v_currency,
    'new_balance', v_new_balance,
    'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views - 1),
    'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned - CASE WHEN v_currency = 'icoin' THEN v_amount ELSE 0 END),
    'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned - CASE WHEN v_currency = 'vicoin' THEN v_amount ELSE 0 END)
  );
END;
$$;
