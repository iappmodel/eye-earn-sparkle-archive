-- 2-step reward flow: (1) validate-attention creates attention_sessions with status validated
-- (2) issue-reward requires attention_session_id and redeems atomically.
-- No client can claim promo_view without a valid, unredeemed attention session.

-- attention_sessions: created by validate-attention when validation passes.
-- Single-use: redeemed_at set atomically when issue-reward redeems.
CREATE TABLE IF NOT EXISTS public.attention_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id UUID NOT NULL,
  campaign_id UUID,
  media_id UUID,
  validated BOOLEAN NOT NULL DEFAULT false,
  validation_score NUMERIC(5,2),
  reward_multiplier NUMERIC(3,2),
  samples_hash TEXT,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attention_sessions_user ON public.attention_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_attention_sessions_redeemed ON public.attention_sessions(redeemed_at) WHERE redeemed_at IS NULL;

COMMENT ON TABLE public.attention_sessions IS 'Single-use attention verification artifacts; redeem via issue-reward with attention_session_id.';

-- reward_sessions: for non-promo rewards (like, share, etc); one per (user, content, type).
CREATE TABLE IF NOT EXISTS public.reward_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_id TEXT NOT NULL,
  reward_type TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, reward_type)
);

CREATE INDEX IF NOT EXISTS idx_reward_sessions_user ON public.reward_sessions(user_id);

-- redeem_attention_reward: atomically redeem one attention session, credit wallet, mark redeemed.
-- ref_id = session_id ensures idempotency (no double-credit on retry).
CREATE OR REPLACE FUNCTION public.redeem_attention_reward(
  p_user_id UUID,
  p_session_id UUID,
  p_daily_promo_limit INTEGER DEFAULT 20,
  p_daily_icoin_limit INTEGER DEFAULT 80,
  p_daily_vicoin_limit INTEGER DEFAULT 120
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_amount INTEGER;
  v_currency TEXT;
  v_base_amount INTEGER;
  v_multiplier NUMERIC;
  v_promo_id UUID;
  v_promo RECORD;
  v_uc RECORD;
  v_ledger_result JSONB;
  v_new_balance INTEGER;
  v_today DATE;
  v_promo_count INTEGER;
  v_icoin_earned INTEGER;
  v_vicoin_earned INTEGER;
BEGIN
  v_today := CURRENT_DATE;

  -- Lock and fetch session (FOR UPDATE prevents double redemption)
  SELECT id, user_id, content_id, campaign_id, media_id, validated, validation_score, reward_multiplier, redeemed_at
  INTO v_session
  FROM public.attention_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  IF v_session.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  IF NOT COALESCE(v_session.validated, false) THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  IF v_session.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  -- Resolve reward from promotions or user_content
  v_promo_id := COALESCE(v_session.campaign_id, v_session.content_id);

  SELECT reward_amount, reward_type INTO v_promo
  FROM public.promotions
  WHERE id = v_promo_id
  LIMIT 1;

  IF FOUND THEN
    v_base_amount := v_promo.reward_amount;
    v_currency := CASE v_promo.reward_type
      WHEN 'vicoin' THEN 'vicoin'
      WHEN 'icoin' THEN 'icoin'
      ELSE 'icoin'
    END;
  ELSE
    SELECT COALESCE(reward_amount, 10) AS amt INTO v_uc
    FROM public.user_content
    WHERE id = v_promo_id
    LIMIT 1;
    IF FOUND THEN
      v_base_amount := v_uc.amt;
      v_currency := 'icoin';
    ELSE
      RETURN jsonb_build_object('success', false, 'code', 'promotion_not_found');
    END IF;
  END IF;

  v_multiplier := COALESCE(v_session.reward_multiplier, 1);
  v_amount := GREATEST(1, FLOOR(v_base_amount * v_multiplier)::INTEGER);

  -- Daily caps
  SELECT COALESCE(SUM(CASE WHEN type = 'promo_view' THEN 1 ELSE 0 END), 0) INTO v_promo_count
  FROM public.wallet_ledger wl
  WHERE wl.user_id = p_user_id
    AND wl.created_at >= v_today
    AND wl.amount > 0;

  IF v_promo_count >= p_daily_promo_limit THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'daily_limit_reached', 'limit_type', 'promo_views'
    );
  END IF;

  SELECT
    COALESCE(SUM(CASE WHEN currency = 'icoin' AND amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN currency = 'vicoin' AND amount > 0 THEN amount ELSE 0 END), 0)
  INTO v_icoin_earned, v_vicoin_earned
  FROM public.wallet_ledger
  WHERE user_id = p_user_id AND created_at >= v_today;

  IF v_currency = 'icoin' AND (v_icoin_earned + v_amount) > p_daily_icoin_limit THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'daily_limit_reached', 'limit_type', 'icoin'
    );
  END IF;
  IF v_currency = 'vicoin' AND (v_vicoin_earned + v_amount) > p_daily_vicoin_limit THEN
    RETURN jsonb_build_object(
      'success', false, 'code', 'daily_limit_reached', 'limit_type', 'vicoin'
    );
  END IF;

  -- Credit via ledger (ref_id = session id for idempotency)
  v_ledger_result := public.ledger_append(
    p_user_id,
    'promo_view',
    v_amount,
    v_currency,
    'attention_session_' || p_session_id::TEXT
  );

  v_new_balance := (v_ledger_result->>'new_balance')::INTEGER;

  -- Mark session redeemed (atomic with ledger)
  UPDATE public.attention_sessions
  SET redeemed_at = now()
  WHERE id = p_session_id;

  -- Sync transactions for wallet UI
  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES (p_user_id, 'earned', v_currency, v_amount, 'Promo view reward', 'attention_session_' || p_session_id::TEXT);

  RETURN jsonb_build_object(
    'success', true,
    'amount', v_amount,
    'coin_type', v_currency,
    'new_balance', v_new_balance,
    'daily_remaining_promo_views', GREATEST(0, p_daily_promo_limit - v_promo_count - 1),
    'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_icoin_earned - CASE WHEN v_currency = 'icoin' THEN v_amount ELSE 0 END),
    'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_vicoin_earned - CASE WHEN v_currency = 'vicoin' THEN v_amount ELSE 0 END)
  );
END;
$$;

-- issue_reward_atomic: for non-promo rewards (like, share, etc); uses reward_sessions.
CREATE OR REPLACE FUNCTION public.issue_reward_atomic(
  p_user_id UUID,
  p_session_id UUID,
  p_reward_type TEXT,
  p_coin_type TEXT,
  p_amount INTEGER,
  p_attention_score NUMERIC DEFAULT NULL,
  p_is_promo_view BOOLEAN DEFAULT false,
  p_type_cap INTEGER DEFAULT NULL,
  p_daily_icoin_limit INTEGER DEFAULT 80,
  p_daily_vicoin_limit INTEGER DEFAULT 120,
  p_daily_promo_limit INTEGER DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_session RECORD;
  v_ref_id TEXT;
  v_ledger_result JSONB;
  v_new_balance INTEGER;
  v_today DATE;
  v_icoin_earned INTEGER;
  v_vicoin_earned INTEGER;
  v_type_count INTEGER;
BEGIN
  v_today := CURRENT_DATE;
  v_ref_id := 'reward_session_' || p_session_id::TEXT;

  SELECT id, user_id, content_id, reward_type, redeemed_at
  INTO v_session
  FROM public.reward_sessions
  WHERE id = p_session_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  IF v_session.user_id != p_user_id THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_session');
  END IF;

  IF v_session.redeemed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'reward_already_claimed');
  END IF;

  -- Type cap (excluding current session)
  IF p_type_cap IS NOT NULL THEN
    SELECT COUNT(*) INTO v_type_count
    FROM public.reward_sessions
    WHERE user_id = p_user_id AND reward_type = p_reward_type
      AND id != p_session_id
      AND redeemed_at IS NOT NULL AND redeemed_at::DATE >= v_today;
    IF v_type_count >= p_type_cap THEN
      RETURN jsonb_build_object('success', false, 'code', 'daily_type_cap');
    END IF;
  END IF;

  -- Daily limits
  SELECT
    COALESCE(SUM(CASE WHEN currency = 'icoin' AND amount > 0 THEN amount ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN currency = 'vicoin' AND amount > 0 THEN amount ELSE 0 END), 0)
  INTO v_icoin_earned, v_vicoin_earned
  FROM public.wallet_ledger
  WHERE user_id = p_user_id AND created_at >= v_today;

  IF p_coin_type = 'icoin' AND (v_icoin_earned + p_amount) > p_daily_icoin_limit THEN
    RETURN jsonb_build_object('success', false, 'code', 'daily_limit_reached', 'limit_type', 'icoin');
  END IF;
  IF p_coin_type = 'vicoin' AND (v_vicoin_earned + p_amount) > p_daily_vicoin_limit THEN
    RETURN jsonb_build_object('success', false, 'code', 'daily_limit_reached', 'limit_type', 'vicoin');
  END IF;

  v_ledger_result := public.ledger_append(p_user_id, 'reward', p_amount, p_coin_type, v_ref_id);
  v_new_balance := (v_ledger_result->>'new_balance')::INTEGER;

  UPDATE public.reward_sessions SET redeemed_at = now() WHERE id = p_session_id;

  INSERT INTO public.transactions (user_id, type, coin_type, amount, description, reference_id)
  VALUES (p_user_id, 'earned', p_coin_type, p_amount, 'Reward: ' || p_reward_type, v_ref_id);

  RETURN jsonb_build_object(
    'success', true,
    'amount', p_amount,
    'new_balance', v_new_balance,
    'daily_remaining_icoin', GREATEST(0, p_daily_icoin_limit - v_icoin_earned - CASE WHEN p_coin_type = 'icoin' THEN p_amount ELSE 0 END),
    'daily_remaining_vicoin', GREATEST(0, p_daily_vicoin_limit - v_vicoin_earned - CASE WHEN p_coin_type = 'vicoin' THEN p_amount ELSE 0 END)
  );
END;
$$;
