-- Sync profiles.kyc_status when kyc_submissions.status changes (approved -> verified, rejected -> rejected)
CREATE OR REPLACE FUNCTION public.sync_kyc_status_to_profile()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.profiles
    SET kyc_status = 'verified', updated_at = now()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.profiles
    SET kyc_status = 'rejected', updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_kyc_status_trigger ON public.kyc_submissions;
CREATE TRIGGER sync_kyc_status_trigger
  AFTER UPDATE OF status ON public.kyc_submissions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.sync_kyc_status_to_profile();
