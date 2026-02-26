-- promotion_claims is currently not used by active reward verification flows.
-- Prevent clients from creating arbitrary claims that could become a future proof source.
DROP POLICY IF EXISTS "Users can create their own claims" ON public.promotion_claims;

