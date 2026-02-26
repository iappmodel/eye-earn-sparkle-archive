-- issue_reward_atomic: lock daily cap row + session row, check caps, then ledger + update in one TX.
CREATE OR REPLACE FUNCTION public.issue_reward_atomic(
  p_user_id UUID,
  p_session_id UUID,
  p_reward_type TEXT,
  p_coin_type TEXT,
  p_amount INTEGER,
  p_attention_score NUMERIC,
  p_is_promo_view BOOLEAN,
  p_type_cap INTEGER,
  p_daily_icoin_limit INTEGER,
  p_daily_vicoin_limit INTEGER,
  p_daily_promo_limit INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cap RECORD;
  v_session RECORD;
  v_ledger_result JSONB;
  v_new_balance INTEGER;
  v_type_count INTEGER;
BEGIN
  IF p_is_promo_view THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_call');
  END IF;

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
      'code', 'cap_row_missing',
      'daily_remaining_icoin', p_daily_icoin_limit,
      'daily_remaining_vicoin', p_daily_vicoin_limit,
      'daily_remaining_promo_views', p_daily_promo_limit
    );
  END IF;

  SELECT id, redeemed_at INTO v_session
  FROM public.reward_sessions
  WHERE id = p_session_id AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_session.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'reward_already_claimed',
      'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
      'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned),
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views)
    );
  END IF;

  IF p_coin_type = 'icoin' AND (v_cap.icoin_earned + p_amount > p_daily_icoin_limit) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'daily_limit_reached',
      'daily_remaining_icoin', 0,
      'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned),
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views)
    );
  END IF;
  IF p_coin_type = 'vicoin' AND (v_cap.vicoin_earned + p_amount > p_daily_vicoin_limit) THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'daily_limit_reached',
      'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
      'daily_remaining_vicoin', 0,
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views)
    );
  END IF;

  IF p_type_cap IS NOT NULL THEN
    v_type_count := COALESCE((v_cap.type_counts->>p_reward_type)::INTEGER, 0);
    IF v_type_count + 1 > p_type_cap THEN
      RETURN jsonb_build_object(
        'success', false,
        'code', 'daily_type_cap',
        'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
        'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned),
        'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views)
      );
    END IF;
  END IF;

  v_ledger_result := public.ledger_append(
    p_user_id,
    'reward',
    p_amount,
    p_coin_type,
    'reward_session_' || p_session_id::text
  );

  v_new_balance := (v_ledger_result->>'new_balance')::INTEGER;

  IF NOT (v_ledger_result->>'applied')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'reward_already_claimed',
      'amount', p_amount,
      'new_balance', v_new_balance,
      'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned),
      'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned),
      'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views)
    );
  END IF;

  IF p_coin_type = 'icoin' THEN
    UPDATE public.daily_reward_caps
    SET
      icoin_earned = icoin_earned + p_amount,
      type_counts = jsonb_set(
        COALESCE(type_counts, '{}'::jsonb),
        ARRAY[p_reward_type],
        to_jsonb((COALESCE((type_counts->>p_reward_type)::INTEGER, 0) + 1)::TEXT)
      ),
      updated_at = now()
    WHERE user_id = p_user_id AND date = current_date;
  ELSE
    UPDATE public.daily_reward_caps
    SET
      vicoin_earned = vicoin_earned + p_amount,
      type_counts = jsonb_set(
        COALESCE(type_counts, '{}'::jsonb),
        ARRAY[p_reward_type],
        to_jsonb((COALESCE((type_counts->>p_reward_type)::INTEGER, 0) + 1)::TEXT)
      ),
      updated_at = now()
    WHERE user_id = p_user_id AND date = current_date;
  END IF;

  UPDATE public.reward_sessions
  SET redeemed_at = now()
  WHERE id = p_session_id;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES (p_user_id, 'earned', p_coin_type, p_amount, 'Reward: ' || p_reward_type, 'reward_session_' || p_session_id::text);

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'new_balance', v_new_balance,
    'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_cap.icoin_earned - CASE WHEN p_coin_type = 'icoin' THEN p_amount ELSE 0 END),
    'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_cap.vicoin_earned - CASE WHEN p_coin_type = 'vicoin' THEN p_amount ELSE 0 END),
    'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_cap.promo_views)
  );
END;
$$;
