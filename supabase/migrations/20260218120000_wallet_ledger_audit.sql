-- Wallet ledger audit enhancements: immutable rows, signed refs, metadata for "why money moved"
-- Run after 20260218100000_wallet_ledger.sql

-- Ensure pgcrypto for digest (Supabase has it)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Add metadata and row_hash columns
ALTER TABLE public.wallet_ledger
  ADD COLUMN IF NOT EXISTS metadata JSONB,
  ADD COLUMN IF NOT EXISTS row_hash TEXT;

COMMENT ON COLUMN public.wallet_ledger.metadata IS 'Audit context: why money moved (content_id, tip_id, session_id, etc.)';
COMMENT ON COLUMN public.wallet_ledger.row_hash IS 'SHA256 of row for tamper-evidence; computed on insert.';

-- Trigger: compute row_hash on insert (after id/created_at are set)
CREATE OR REPLACE FUNCTION public.wallet_ledger_row_hash_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.row_hash := encode(
    digest(
      COALESCE(NEW.id::text, '') || '|' ||
      COALESCE(NEW.user_id::text, '') || '|' ||
      COALESCE(NEW.type, '') || '|' ||
      COALESCE(NEW.amount::text, '') || '|' ||
      COALESCE(NEW.currency, '') || '|' ||
      COALESCE(NEW.ref_id, '') || '|' ||
      COALESCE(NEW.created_at::text, '') || '|' ||
      COALESCE(NEW.metadata::text, '{}'),
      'sha256'
    ),
    'hex'
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS wallet_ledger_row_hash ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_row_hash
  BEFORE INSERT ON public.wallet_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.wallet_ledger_row_hash_trigger();

-- Enforce immutability: no UPDATE or DELETE
CREATE OR REPLACE FUNCTION public.wallet_ledger_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'wallet_ledger is immutable; UPDATE and DELETE are not allowed';
END;
$$;

DROP TRIGGER IF EXISTS wallet_ledger_no_update ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_no_update
  BEFORE UPDATE ON public.wallet_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.wallet_ledger_immutable();

DROP TRIGGER IF EXISTS wallet_ledger_no_delete ON public.wallet_ledger;
CREATE TRIGGER wallet_ledger_no_delete
  BEFORE DELETE ON public.wallet_ledger
  FOR EACH ROW
  EXECUTE FUNCTION public.wallet_ledger_immutable();

-- Extend ledger_append to accept optional metadata (keeps backward compatibility)
CREATE OR REPLACE FUNCTION public.ledger_append(
  p_user_id UUID,
  p_type TEXT,
  p_amount INTEGER,
  p_currency TEXT,
  p_ref_id TEXT,
  p_metadata JSONB DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id UUID;
  v_new_balance INTEGER;
  v_current_balance INTEGER;
BEGIN
  IF p_amount = 0 THEN
    SELECT COALESCE(
      CASE WHEN p_currency = 'vicoin' THEN vicoin_balance ELSE icoin_balance END,
      0
    ) INTO v_current_balance
    FROM public.profiles WHERE user_id = p_user_id;
    RETURN jsonb_build_object(
      'applied', false,
      'new_balance', v_current_balance,
      'reason', 'zero_amount'
    );
  END IF;

  PERFORM pg_advisory_xact_lock(hashtext('balance_' || p_user_id::text));

  INSERT INTO public.wallet_ledger (user_id, type, amount, currency, ref_id, metadata)
  VALUES (p_user_id, p_type, p_amount, p_currency, p_ref_id, p_metadata)
  ON CONFLICT (ref_id) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    IF p_currency = 'vicoin' THEN
      SELECT COALESCE(vicoin_balance, 0) INTO v_new_balance FROM public.profiles WHERE user_id = p_user_id;
    ELSE
      SELECT COALESCE(icoin_balance, 0) INTO v_new_balance FROM public.profiles WHERE user_id = p_user_id;
    END IF;
    RETURN jsonb_build_object(
      'applied', false,
      'new_balance', v_new_balance,
      'reason', 'duplicate_ref_id'
    );
  END IF;

  IF p_currency = 'vicoin' THEN
    UPDATE public.profiles
    SET vicoin_balance = COALESCE(vicoin_balance, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING COALESCE(vicoin_balance, 0) INTO v_new_balance;
  ELSE
    UPDATE public.profiles
    SET icoin_balance = COALESCE(icoin_balance, 0) + p_amount,
        updated_at = now()
    WHERE user_id = p_user_id
    RETURNING COALESCE(icoin_balance, 0) INTO v_new_balance;
  END IF;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PROFILE_NOT_FOUND: User profile not found';
  END IF;

  RETURN jsonb_build_object(
    'applied', true,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
END;
$$;

-- RPC: get reconciliation data (admin only). Compares ledger sum vs profile cache.
CREATE OR REPLACE FUNCTION public.get_wallet_reconciliation(
  p_user_id_filter UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 500
)
RETURNS TABLE (
  user_id UUID,
  currency TEXT,
  ledger_sum BIGINT,
  profile_balance INTEGER,
  discrepancy BIGINT,
  ledger_count BIGINT,
  username TEXT,
  display_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := (SELECT public.has_role(auth.uid(), 'admin'));
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  WITH ledger_totals AS (
    SELECT
      wl.user_id,
      wl.currency,
      SUM(wl.amount)::BIGINT AS ledger_sum,
      COUNT(*)::BIGINT AS ledger_count
    FROM public.wallet_ledger wl
    WHERE (p_user_id_filter IS NULL OR wl.user_id = p_user_id_filter)
    GROUP BY wl.user_id, wl.currency
  ),
  combined AS (
    SELECT
      lt.user_id,
      lt.currency,
      lt.ledger_sum,
      lt.ledger_count,
      CASE lt.currency
        WHEN 'vicoin' THEN COALESCE(p.vicoin_balance, 0)::INTEGER
        ELSE COALESCE(p.icoin_balance, 0)::INTEGER
      END AS profile_balance,
      p.username,
      p.display_name
    FROM ledger_totals lt
    JOIN public.profiles p ON p.user_id = lt.user_id
    WHERE (p_user_id_filter IS NULL OR lt.user_id = p_user_id_filter)
  )
  SELECT
    c.user_id,
    c.currency,
    c.ledger_sum,
    c.profile_balance,
    (c.ledger_sum - c.profile_balance::BIGINT)::BIGINT AS discrepancy,
    c.ledger_count,
    c.username,
    c.display_name
  FROM combined c
  ORDER BY ABS(c.ledger_sum - c.profile_balance::BIGINT) DESC
  LIMIT p_limit;
END;
$$;

-- RPC: get paginated ledger entries for admin audit
CREATE OR REPLACE FUNCTION public.get_wallet_ledger_entries(
  p_user_id_filter UUID DEFAULT NULL,
  p_type_filter TEXT DEFAULT NULL,
  p_currency_filter TEXT DEFAULT NULL,
  p_since TIMESTAMPTZ DEFAULT NULL,
  p_until TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  type TEXT,
  amount INTEGER,
  currency TEXT,
  ref_id TEXT,
  metadata JSONB,
  row_hash TEXT,
  created_at TIMESTAMPTZ,
  username TEXT,
  display_name TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_total BIGINT;
BEGIN
  v_is_admin := (SELECT public.has_role(auth.uid(), 'admin'));
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  SELECT COUNT(*) INTO v_total
  FROM public.wallet_ledger wl
  JOIN public.profiles p ON p.user_id = wl.user_id
  WHERE (p_user_id_filter IS NULL OR wl.user_id = p_user_id_filter)
    AND (p_type_filter IS NULL OR wl.type = p_type_filter)
    AND (p_currency_filter IS NULL OR wl.currency = p_currency_filter)
    AND (p_since IS NULL OR wl.created_at >= p_since)
    AND (p_until IS NULL OR wl.created_at <= p_until);

  RETURN QUERY
  SELECT
    wl.id,
    wl.user_id,
    wl.type,
    wl.amount,
    wl.currency,
    wl.ref_id,
    wl.metadata,
    wl.row_hash,
    wl.created_at,
    p.username,
    p.display_name,
    v_total AS total_count
  FROM public.wallet_ledger wl
  JOIN public.profiles p ON p.user_id = wl.user_id
  WHERE (p_user_id_filter IS NULL OR wl.user_id = p_user_id_filter)
    AND (p_type_filter IS NULL OR wl.type = p_type_filter)
    AND (p_currency_filter IS NULL OR wl.currency = p_currency_filter)
    AND (p_since IS NULL OR wl.created_at >= p_since)
    AND (p_until IS NULL OR wl.created_at <= p_until)
  ORDER BY wl.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;
