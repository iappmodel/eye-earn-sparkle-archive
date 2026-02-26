-- Atomically finalize a verified promotion check-in reward:
-- wallet credit (ledger-backed), XP/streak updates, and reward_claimed flag.
-- This makes verify-checkin recoverable on retry if post-insert reward processing fails.

CREATE OR REPLACE FUNCTION public.finalize_promotion_checkin_reward(
  p_user_id UUID,
  p_checkin_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_checkin public.promotion_checkins%ROWTYPE;
  v_reward_coin_type TEXT;
  v_balance_result JSONB;
  v_new_balance INTEGER;
  v_streak_day INTEGER;
  v_xp_reward INTEGER;
  v_level_current_xp INTEGER;
  v_level_total_xp INTEGER;
  v_level_level INTEGER;
  v_level_streak_days INTEGER;
  v_level_longest_streak INTEGER;
BEGIN
  IF p_user_id IS NULL OR p_checkin_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGS: user_id and checkin_id are required';
  END IF;

  SELECT *
  INTO v_checkin
  FROM public.promotion_checkins
  WHERE id = p_checkin_id
    AND user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CHECKIN_NOT_FOUND: Check-in not found';
  END IF;

  IF COALESCE(v_checkin.status, '') <> 'verified' THEN
    RAISE EXCEPTION 'CHECKIN_NOT_VERIFIED: Check-in is not verified';
  END IF;

  IF COALESCE(v_checkin.reward_claimed, false) THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'amount_added', COALESCE(v_checkin.reward_amount, 0),
      'coin_type', COALESCE(NULLIF(BTRIM(v_checkin.reward_type), ''), 'vicoin'),
      'streak_day', GREATEST(COALESCE(v_checkin.streak_day, 1), 1)
    );
  END IF;

  IF COALESCE(v_checkin.reward_amount, 0) <= 0 THEN
    RAISE EXCEPTION 'NO_REWARD: Check-in has no reward amount';
  END IF;

  v_reward_coin_type := CASE
    WHEN COALESCE(NULLIF(BTRIM(v_checkin.reward_type), ''), 'vicoin') = 'icoin' THEN 'icoin'
    ELSE 'vicoin'
  END;

  v_streak_day := GREATEST(COALESCE(v_checkin.streak_day, 1), 1);
  v_xp_reward := 25 + CASE WHEN v_streak_day >= 7 THEN 10 ELSE 0 END;

  INSERT INTO public.user_levels (
    user_id,
    streak_days,
    longest_streak,
    level,
    current_xp,
    total_xp
  )
  VALUES (p_user_id, 0, 0, 1, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  v_balance_result := public.atomic_update_balance(
    p_user_id,
    COALESCE(v_checkin.reward_amount, 0),
    v_reward_coin_type,
    'Check-in reward at ' || COALESCE(NULLIF(BTRIM(v_checkin.business_name), ''), 'Business'),
    v_checkin.id::TEXT
  );
  v_new_balance := NULLIF(v_balance_result->>'new_balance', '')::INTEGER;

  UPDATE public.user_levels
  SET
    streak_days = GREATEST(COALESCE(streak_days, 0), v_streak_day),
    longest_streak = GREATEST(COALESCE(longest_streak, 0), v_streak_day),
    last_active_date = CASE
      WHEN last_active_date IS NULL OR last_active_date < CURRENT_DATE THEN CURRENT_DATE
      ELSE last_active_date
    END,
    current_xp = COALESCE(current_xp, 0) + v_xp_reward,
    total_xp = COALESCE(total_xp, 0) + v_xp_reward,
    updated_at = now()
  WHERE user_id = p_user_id
  RETURNING current_xp, total_xp, level, streak_days, longest_streak
  INTO v_level_current_xp, v_level_total_xp, v_level_level, v_level_streak_days, v_level_longest_streak;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'LEVEL_NOT_FOUND: Failed to update user level row';
  END IF;

  UPDATE public.promotion_checkins
  SET reward_claimed = true,
      reward_claimed_at = now()
  WHERE id = p_checkin_id
    AND user_id = p_user_id
    AND reward_claimed = false;

  IF NOT FOUND THEN
    -- Row was claimed concurrently after lock release (unexpected) or state changed.
    RETURN jsonb_build_object(
      'success', true,
      'already_claimed', true,
      'amount_added', COALESCE(v_checkin.reward_amount, 0),
      'coin_type', v_reward_coin_type,
      'streak_day', v_streak_day
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'already_claimed', false,
    'amount_added', COALESCE(v_checkin.reward_amount, 0),
    'coin_type', v_reward_coin_type,
    'new_balance', v_new_balance,
    'xp_added', v_xp_reward,
    'streak_day', v_streak_day,
    'level', v_level_level,
    'current_xp', v_level_current_xp,
    'total_xp', v_level_total_xp,
    'streak_days', v_level_streak_days,
    'longest_streak', v_level_longest_streak
  );
END;
$$;

COMMENT ON FUNCTION public.finalize_promotion_checkin_reward(UUID, UUID)
  IS 'Atomically finalizes a verified promotion_checkins reward (wallet credit + XP/streak + reward_claimed). Service-role only.';

REVOKE EXECUTE ON FUNCTION public.finalize_promotion_checkin_reward(UUID, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.finalize_promotion_checkin_reward(UUID, UUID)
  TO service_role;

