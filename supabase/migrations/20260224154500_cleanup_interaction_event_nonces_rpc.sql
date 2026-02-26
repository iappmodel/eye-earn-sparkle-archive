-- Bounded cleanup helper for interaction_event_nonces retention.
-- Service-role only; used opportunistically by track-interaction to avoid unbounded per-request deletes.

CREATE OR REPLACE FUNCTION public.cleanup_interaction_event_nonces(
  p_user_id UUID,
  p_before TIMESTAMPTZ,
  p_limit INTEGER DEFAULT 250
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 250), 0);
  v_deleted_count INTEGER := 0;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'INVALID_ARGS: p_user_id is required';
  END IF;

  WITH doomed AS (
    SELECT id
    FROM public.interaction_event_nonces
    WHERE user_id = p_user_id
      AND created_at < COALESCE(p_before, now())
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

COMMENT ON FUNCTION public.cleanup_interaction_event_nonces(UUID, TIMESTAMPTZ, INTEGER)
  IS 'Deletes up to p_limit old interaction_event_nonces rows for a user before p_before. Service-role only.';

REVOKE EXECUTE ON FUNCTION public.cleanup_interaction_event_nonces(UUID, TIMESTAMPTZ, INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_interaction_event_nonces(UUID, TIMESTAMPTZ, INTEGER)
  TO service_role;

