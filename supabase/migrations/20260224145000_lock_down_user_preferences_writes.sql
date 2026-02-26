-- user_preferences should be derived from server-side interaction processing.
-- Client direct writes let users poison personalization/trust signals.
DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;

