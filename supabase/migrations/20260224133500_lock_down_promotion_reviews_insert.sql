-- Promotion reviews are now submitted through the server-side submit-promotion-review function.
-- This prevents users from fabricating review rows to farm review-based promo rewards.

DROP POLICY IF EXISTS "Users can create reviews"
  ON public.promotion_reviews;
