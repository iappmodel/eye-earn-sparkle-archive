-- user_levels is used for XP/level/streak gating and must be server-authoritative.
-- Client-side writes allow spoofing level/streak achievements and progression.
DROP POLICY IF EXISTS "Users can insert their own level" ON public.user_levels;
DROP POLICY IF EXISTS "Users can update their own level" ON public.user_levels;

