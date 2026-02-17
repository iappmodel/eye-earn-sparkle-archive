-- Allow status 'scheduled' for user_content (scheduling feature; index already references it)
ALTER TABLE public.user_content
  DROP CONSTRAINT IF EXISTS user_content_status_check;

ALTER TABLE public.user_content
  ADD CONSTRAINT user_content_status_check
  CHECK (status IN ('draft', 'pending', 'active', 'scheduled', 'expired', 'rejected', 'deleted'));

COMMENT ON COLUMN public.user_content.scheduled_at IS 'When to auto-publish; used with status = scheduled';

-- Function for cron/edge function: activate scheduled posts whose scheduled_at has passed
CREATE OR REPLACE FUNCTION public.activate_scheduled_content()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer;
BEGIN
  WITH updated AS (
    UPDATE public.user_content
    SET status = 'active',
        published_at = COALESCE(scheduled_at, now()),
        is_draft = false,
        updated_at = now()
    WHERE status = 'scheduled'
      AND scheduled_at IS NOT NULL
      AND scheduled_at <= now()
    RETURNING id
  )
  SELECT COUNT(*)::integer INTO updated_count FROM updated;
  RETURN updated_count;
END;
$$;

COMMENT ON FUNCTION public.activate_scheduled_content() IS 'Call from cron or edge function to publish scheduled user_content when scheduled_at has passed. Returns number of rows activated.';
