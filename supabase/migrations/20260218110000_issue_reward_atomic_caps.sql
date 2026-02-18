-- Enforce daily caps inside a single SQL transaction using SELECT ... FOR UPDATE
-- on the per-user daily bucket row (daily_reward_caps). Avoids raceable "sum today"
-- aggregate queries under concurrency.

-- 1. Add type_counts to daily_reward_caps so per-type caps are enforced under the same lock.
ALTER TABLE public.daily_reward_caps
  ADD COLUMN IF NOT EXISTS type_counts JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.daily_reward_caps.type_counts IS 'Per reward_type count for today; e.g. {"like": 5, "login": 1}. Updated under same FOR UPDATE as icoin/vicoin/promo_views.';

-- 2. issue_reward_atomic: lock daily cap row + session row, check caps, then ledger + update in one TX.
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

  -- Ensure daily cap row exists for today, then lock it (serializes all rewards for this user/day).
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

  -- Lock reward session and ensure unredeemed.
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

  -- Check daily coin caps (using locked cap row).
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

  -- Per-type daily cap (using locked cap row type_counts).
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

  -- Credit via ledger (ref_id = reward_session_<id> for idempotency; match existing issue_reward_atomic).
  v_ledger_result := public.ledger_append(
    p_user_id,
    'reward',
    p_amount,
    p_coin_type,
    'reward_session_' || p_session_id::text
  );

  v_new_balance := (v_ledger_result->>'new_balance')::INTEGER;

  -- If duplicate ref_id (idempotent), session may already be redeemed; treat as already claimed.
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

  -- Update daily cap row (same TX, still locked): increment coin and type count.
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

  -- Mark session as redeemed.
  UPDATE public.reward_sessions
  SET redeemed_at = now()
  WHERE id = p_session_id;

  -- Sync transactions for wallet UI (optional display).
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

-- 3. redeem_attention_reward: lock attention session + daily cap row, check caps, ledger + update in one TX.
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
  -- Lock attention session and validate.
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

  -- Resolve amount/currency from campaign (promotions by campaign_id; promo_campaigns if present can be added).
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

  -- Ensure and lock daily cap row.
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

  -- Check promo_views cap then icoin/vicoin caps.
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

  -- Credit via ledger (ref_id = attention_session_<id> for idempotency; match existing redeem_attention_reward).
  v_ledger_result := public.ledger_append(
    p_user_id,
    'promo_view',
    v_amount,
    v_currency,
    'attention_session_' || p_session_id::text
  );

  v_new_balance := (v_ledger_result->>'new_balance')::INTEGER;

  IF NOT (v_ledger_result->>'applied')::BOOLEAN THEN
    -- Idempotent: already redeemed (duplicate ref_id).
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

  -- Update daily cap: increment promo_views and coin.
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

  -- Sync transactions for wallet UI (optional display).
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

COMMENT ON FUNCTION public.issue_reward_atomic(UUID, UUID, TEXT, TEXT, INTEGER, NUMERIC, BOOLEAN, INTEGER, INTEGER, INTEGER, INTEGER)
  IS 'Issue non-promo reward: locks daily_reward_caps row FOR UPDATE, checks caps, ledger_append, updates cap and session. Concurrency-safe.';
COMMENT ON FUNCTION public.redeem_attention_reward(UUID, UUID, INTEGER, INTEGER, INTEGER)
  IS 'Redeem promo attention session: locks attention_sessions + daily_reward_caps FOR UPDATE, checks caps, ledger_append, updates cap and session. Concurrency-safe.';
