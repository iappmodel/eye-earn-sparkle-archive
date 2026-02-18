-- Rate limiting (per user + per IP) and idempotency for reward endpoints
-- Reduces exploit surface: replay protection and request throttling.

-- 1. Rate limit buckets: fixed 1-minute window per (scope, key)
-- key = 'user:<uuid>' or 'ip:<normalized_ip>' for scope 'reward'
CREATE TABLE public.rate_limit_buckets (
  scope TEXT NOT NULL,
  bucket_key TEXT NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (scope, bucket_key)
);

CREATE INDEX idx_rate_limit_buckets_scope_window ON public.rate_limit_buckets(scope, window_start);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access rate_limit_buckets"
ON public.rate_limit_buckets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.rate_limit_buckets IS 'Per-user and per-IP rate limit state for reward endpoints; 1-minute fixed windows.';

-- RPC: check and increment reward rate limit in one atomic step
CREATE OR REPLACE FUNCTION public.check_reward_rate_limit(
  p_scope TEXT,
  p_user_key TEXT,
  p_ip_key TEXT,
  p_max_per_user INT DEFAULT 60,
  p_max_per_ip INT DEFAULT 120,
  p_window_seconds INT DEFAULT 60
)
RETURNS TABLE(allowed BOOLEAN, retry_after_seconds INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_now TIMESTAMPTZ := now();
  v_window_start TIMESTAMPTZ := date_trunc('minute', v_now);
  v_user_count INT;
  v_ip_count INT;
  v_user_window TIMESTAMPTZ;
  v_ip_window TIMESTAMPTZ;
BEGIN
  -- User bucket: get or init
  SELECT request_count, window_start INTO v_user_count, v_user_window
  FROM rate_limit_buckets
  WHERE scope = p_scope AND bucket_key = p_user_key
  FOR UPDATE;

  IF NOT FOUND OR v_user_window < v_window_start THEN
    INSERT INTO rate_limit_buckets (scope, bucket_key, request_count, window_start)
    VALUES (p_scope, p_user_key, 1, v_window_start)
    ON CONFLICT (scope, bucket_key) DO UPDATE SET
      request_count = 1,
      window_start = v_window_start
    WHERE rate_limit_buckets.window_start < v_window_start;
    v_user_count := 1;
  ELSE
    IF COALESCE(v_user_count, 0) >= p_max_per_user THEN
      allowed := false;
      retry_after_seconds := GREATEST(1, p_window_seconds - EXTRACT(EPOCH FROM (v_now - v_user_window))::INT);
      RETURN NEXT;
      RETURN;
    END IF;
    UPDATE rate_limit_buckets
    SET request_count = request_count + 1
    WHERE scope = p_scope AND bucket_key = p_user_key;
  END IF;

  -- IP bucket
  SELECT request_count, window_start INTO v_ip_count, v_ip_window
  FROM rate_limit_buckets
  WHERE scope = p_scope AND bucket_key = p_ip_key
  FOR UPDATE;

  IF NOT FOUND OR v_ip_window < v_window_start THEN
    INSERT INTO rate_limit_buckets (scope, bucket_key, request_count, window_start)
    VALUES (p_scope, p_ip_key, 1, v_window_start)
    ON CONFLICT (scope, bucket_key) DO UPDATE SET
      request_count = 1,
      window_start = v_window_start
    WHERE rate_limit_buckets.window_start < v_window_start;
    v_ip_count := 1;
  ELSE
    IF COALESCE(v_ip_count, 0) >= p_max_per_ip THEN
      allowed := false;
      retry_after_seconds := GREATEST(1, p_window_seconds - EXTRACT(EPOCH FROM (v_now - v_ip_window))::INT);
      RETURN NEXT;
      RETURN;
    END IF;
    UPDATE rate_limit_buckets
    SET request_count = request_count + 1
    WHERE scope = p_scope AND bucket_key = p_ip_key;
  END IF;

  allowed := true;
  retry_after_seconds := NULL;
  RETURN NEXT;
END;
$$;

-- 2. Reward idempotency: cache response by (key, user_id, scope) for replay protection
-- TTL 24h; cleanup via cron or on next insert (optional job)
CREATE TABLE public.reward_idempotency (
  idempotency_key TEXT NOT NULL,
  user_id UUID NOT NULL,
  scope TEXT NOT NULL CHECK (scope IN ('issue_reward', 'validate_attention', 'verify_checkin')),
  response_status INTEGER NOT NULL,
  response_body JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (idempotency_key, user_id, scope)
);

CREATE INDEX idx_reward_idempotency_created ON public.reward_idempotency(created_at);

ALTER TABLE public.reward_idempotency ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access reward_idempotency"
ON public.reward_idempotency
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.reward_idempotency IS 'Replay protection: cached response per Idempotency-Key for reward endpoints; 24h TTL.';
