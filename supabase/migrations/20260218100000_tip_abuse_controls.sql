-- Tip creator abuse controls: idempotency, audit trail, and rate-limit support
-- Atomic tip logic stays in atomic_tip_creator; edge function enforces limits and audit.

-- 1. Idempotency: claim key before processing to prevent double-spend
CREATE TABLE public.tip_idempotency (
  idempotency_key TEXT NOT NULL PRIMARY KEY,
  tipper_id UUID NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'complete')) DEFAULT 'processing',
  result JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Full audit trail: every tip attempt (success or rejected)
CREATE TABLE public.tip_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tipper_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  content_id UUID NOT NULL,
  amount INTEGER NOT NULL,
  coin_type TEXT NOT NULL CHECK (coin_type IN ('vicoin', 'icoin')),
  idempotency_key TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'success',
    'rejected_daily_count',
    'rejected_daily_amount',
    'rejected_velocity',
    'rejected_per_tip_max',
    'rejected_self_tip',
    'rejected_validation',
    'rejected_insufficient_balance',
    'rejected_other'
  )),
  error_message TEXT,
  tip_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tip_idempotency ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tip_audit_log ENABLE ROW LEVEL SECURITY;

-- Service role inserts/reads; no user-facing RLS policies (edge function uses service role)
CREATE POLICY "Service role full access tip_idempotency"
ON public.tip_idempotency
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE POLICY "Service role full access tip_audit_log"
ON public.tip_audit_log
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

CREATE INDEX idx_tip_audit_log_tipper_created ON public.tip_audit_log(tipper_id, created_at DESC);
CREATE INDEX idx_tip_audit_log_creator_created ON public.tip_audit_log(creator_id, created_at DESC);

-- 3. RPC for rate-limit checks: daily count, daily amount, tips in last 5 min
CREATE OR REPLACE FUNCTION public.get_tipper_tip_stats(p_tipper_id UUID)
RETURNS TABLE(daily_count BIGINT, daily_amount BIGINT, tips_5min_count BIGINT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_today_start TIMESTAMPTZ := date_trunc('day', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC';
  v_today_end TIMESTAMPTZ := v_today_start + interval '1 day';
  v_5min_ago TIMESTAMPTZ := now() - interval '5 minutes';
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::BIGINT FROM public.transactions
     WHERE user_id = p_tipper_id AND type = 'spent'
       AND description = 'Tip to creator for content' AND reference_id LIKE 'tip_%'
       AND created_at >= v_today_start AND created_at < v_today_end),
    (SELECT COALESCE(SUM(amount), 0)::BIGINT FROM public.transactions
     WHERE user_id = p_tipper_id AND type = 'spent'
       AND description = 'Tip to creator for content' AND reference_id LIKE 'tip_%'
       AND created_at >= v_today_start AND created_at < v_today_end),
    (SELECT COUNT(*)::BIGINT FROM public.transactions
     WHERE user_id = p_tipper_id AND type = 'spent'
       AND description = 'Tip to creator for content' AND reference_id LIKE 'tip_%'
       AND created_at >= v_5min_ago);
END;
$$;
