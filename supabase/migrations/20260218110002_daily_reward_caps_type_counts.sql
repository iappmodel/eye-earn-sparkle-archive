-- Add type_counts to daily_reward_caps so per-type caps are enforced under the same lock.
ALTER TABLE public.daily_reward_caps
  ADD COLUMN IF NOT EXISTS type_counts JSONB NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.daily_reward_caps.type_counts IS 'Per reward_type count for today. Updated under same FOR UPDATE as icoin/vicoin/promo_views.';
