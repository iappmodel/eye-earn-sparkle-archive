ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS calibration_data jsonb DEFAULT '{}'::jsonb;
