-- Optional reward_amount for user_content (e.g. user posts with reward_type = promotion).
-- When null, feed/mappers use default amount 10 for display and reward logic.
ALTER TABLE public.user_content
  ADD COLUMN IF NOT EXISTS reward_amount integer DEFAULT NULL;

COMMENT ON COLUMN public.user_content.reward_amount IS 'Optional per-post reward amount; used when reward_type is set. Null falls back to default 10 in feed.';
