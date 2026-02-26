-- Best-effort pg_cron schedule for global interaction_event_nonces cleanup.
-- Safe to apply on projects without pg_cron: migration emits NOTICE and skips.

DO $$
DECLARE
  v_job_name TEXT := 'cleanup-interaction-event-nonces-global-hourly';
  v_schedule TEXT := '13 * * * *'; -- run hourly, staggered
  v_command TEXT := 'SELECT public.cleanup_interaction_event_nonces_global(now() - interval ''14 days'', 5000);';
  v_has_cron_schema BOOLEAN := FALSE;
  v_has_jobname_column BOOLEAN := FALSE;
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron;
  EXCEPTION
    WHEN insufficient_privilege OR undefined_file THEN
      RAISE NOTICE 'Skipping pg_cron schedule setup (extension unavailable or insufficient privilege).';
  END;

  SELECT EXISTS (
    SELECT 1 FROM pg_namespace WHERE nspname = 'cron'
  ) INTO v_has_cron_schema;

  IF NOT v_has_cron_schema THEN
    RAISE NOTICE 'Skipping pg_cron schedule setup (cron schema not available).';
    RETURN;
  END IF;

  BEGIN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'cron'
        AND table_name = 'job'
        AND column_name = 'jobname'
    ) INTO v_has_jobname_column;
  EXCEPTION
    WHEN undefined_table THEN
      RAISE NOTICE 'Skipping pg_cron schedule setup (cron.job not available).';
      RETURN;
  END;

  BEGIN
    IF v_has_jobname_column THEN
      IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = v_job_name) THEN
        PERFORM cron.schedule(v_job_name, v_schedule, v_command);
      END IF;
    ELSE
      IF NOT EXISTS (SELECT 1 FROM cron.job WHERE command = v_command) THEN
        PERFORM cron.schedule(v_schedule, v_command);
      END IF;
    END IF;
  EXCEPTION
    WHEN undefined_function THEN
      RAISE NOTICE 'Skipping pg_cron schedule setup (cron.schedule not available).';
  END;
END;
$$;

