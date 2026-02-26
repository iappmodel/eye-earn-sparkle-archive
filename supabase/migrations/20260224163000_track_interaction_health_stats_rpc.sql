-- Admin/ops visibility for track-interaction anti-replay infrastructure.
-- Returns aggregate stats for interaction_event_nonces and cooldown timestamp coverage on content_interactions.
-- Service-role only (exposed via admin edge function).

CREATE OR REPLACE FUNCTION public.get_track_interaction_health_stats(
  p_retention_days INTEGER DEFAULT 14
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_retention_days INTEGER := LEAST(GREATEST(COALESCE(p_retention_days, 14), 1), 365);
  v_cutoff TIMESTAMPTZ := now() - make_interval(days => LEAST(GREATEST(COALESCE(p_retention_days, 14), 1), 365));
  v_nonce_total BIGINT := 0;
  v_nonce_stale BIGINT := 0;
  v_nonce_last_24h BIGINT := 0;
  v_nonce_oldest TIMESTAMPTZ;
  v_nonce_newest TIMESTAMPTZ;
  v_nonce_action_counts JSONB := '{}'::JSONB;
  v_rows_with_last_share BIGINT := 0;
  v_rows_with_last_view_complete BIGINT := 0;
  v_legacy_share_missing_ts BIGINT := 0;
  v_legacy_view_complete_missing_ts BIGINT := 0;
BEGIN
  SELECT
    COUNT(*)::BIGINT,
    COUNT(*) FILTER (WHERE created_at < v_cutoff)::BIGINT,
    COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours')::BIGINT,
    MIN(created_at),
    MAX(created_at)
  INTO
    v_nonce_total,
    v_nonce_stale,
    v_nonce_last_24h,
    v_nonce_oldest,
    v_nonce_newest
  FROM public.interaction_event_nonces;

  SELECT COALESCE(jsonb_object_agg(action, cnt), '{}'::JSONB)
  INTO v_nonce_action_counts
  FROM (
    SELECT action, COUNT(*)::BIGINT AS cnt
    FROM public.interaction_event_nonces
    WHERE created_at >= now() - interval '24 hours'
    GROUP BY action
  ) s;

  SELECT
    COUNT(*) FILTER (WHERE last_share_at IS NOT NULL)::BIGINT,
    COUNT(*) FILTER (WHERE last_view_complete_at IS NOT NULL)::BIGINT,
    COUNT(*) FILTER (
      WHERE lower(COALESCE(last_event_type, '')) = 'share'
        AND last_share_at IS NULL
    )::BIGINT,
    COUNT(*) FILTER (
      WHERE lower(COALESCE(last_event_type, '')) = 'view_complete'
        AND last_view_complete_at IS NULL
    )::BIGINT
  INTO
    v_rows_with_last_share,
    v_rows_with_last_view_complete,
    v_legacy_share_missing_ts,
    v_legacy_view_complete_missing_ts
  FROM public.content_interactions;

  RETURN jsonb_build_object(
    'success', true,
    'retention_days', v_retention_days,
    'retention_cutoff', v_cutoff,
    'nonce_table', jsonb_build_object(
      'total_rows', v_nonce_total,
      'rows_older_than_retention', v_nonce_stale,
      'rows_last_24h', v_nonce_last_24h,
      'oldest_created_at', v_nonce_oldest,
      'newest_created_at', v_nonce_newest,
      'action_counts_last_24h', v_nonce_action_counts
    ),
    'cooldown_columns', jsonb_build_object(
      'rows_with_last_share_at', v_rows_with_last_share,
      'rows_with_last_view_complete_at', v_rows_with_last_view_complete,
      'legacy_share_rows_missing_timestamp', v_legacy_share_missing_ts,
      'legacy_view_complete_rows_missing_timestamp', v_legacy_view_complete_missing_ts
    )
  );
END;
$$;

COMMENT ON FUNCTION public.get_track_interaction_health_stats(INTEGER)
  IS 'Returns aggregate health stats for track-interaction anti-replay/cooldown infrastructure. Service-role only.';

REVOKE EXECUTE ON FUNCTION public.get_track_interaction_health_stats(INTEGER)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_track_interaction_health_stats(INTEGER)
  TO service_role;

