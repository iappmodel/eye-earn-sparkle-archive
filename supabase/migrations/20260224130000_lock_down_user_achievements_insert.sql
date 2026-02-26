-- Achievement unlocks are now server-authoritative via Edge Functions.
-- Prevent clients from inserting arbitrary user_achievements rows (which could be used
-- to forge unlocks and then claim XP).

DROP POLICY IF EXISTS "Users can insert their own achievements"
  ON public.user_achievements;
