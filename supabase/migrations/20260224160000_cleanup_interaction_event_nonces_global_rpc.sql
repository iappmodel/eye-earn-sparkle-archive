-- Global bounded cleanup helper for interaction_event_nonces retention.
-- Intended for scheduled/cron use (service-role only). Complements the per-user opportunistic cleanup.

CREATE OR REPLACE FUNCTION public.cleanup_interaction_event_nonces_global(
  p_before TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 5000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 5000), 0);
  v_deleted_count INTEGER := 0;
BEGIN
  WITH doomed AS (
    SELECT id
    FROM public.interaction_event_nonces
    WHERE created_at < COALESCE(p_before, now())
    ORDER BY created_at ASC
    LIMIT v_limit
  ),
  deleted AS (
    DELETE FROM public.interaction_event_nonces n
    USING doomed d
    WHERE n.id = d.id
    RETURNING 1
  )
  SELECT COUNT(*)::INTEGER INTO v_deleted_count
  FROM deleted;

  RETURN jsonb_build_object(
    'success', true,
    'rows_deleted', v_deleted_count
  );
END;
$$;

COMMENT ON FUNCTION public.cleanup_interaction_event_nonces_global(TIMESTAMPTZ, INTEGER)
  IS 'Deletes up to p_limit old interaction_event_nonces rows before p_before. Service-role only; cron-ready.';

REVOKE EXECUTE ON FUNCTION public.cleanup_interaction_event_nonces_global(TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_interaction_event_nonces_global(TIMESTAMPTZ, INTEGER)
  TO service_role;

