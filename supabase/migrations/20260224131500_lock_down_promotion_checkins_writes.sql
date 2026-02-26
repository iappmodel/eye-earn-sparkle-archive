-- Promotion check-ins are used as a trust signal for promo rewards (checkin/return_visit).
-- Creation and reward bookkeeping should only happen through server-side verify-checkin.

DROP POLICY IF EXISTS "Users can create check-ins"
  ON public.promotion_checkins;

DROP POLICY IF EXISTS "Users can update their own check-ins"
  ON public.promotion_checkins;
