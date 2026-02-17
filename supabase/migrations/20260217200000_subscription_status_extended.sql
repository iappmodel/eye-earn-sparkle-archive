-- Extend subscription_status for trials, period dates, and cancel-at-period-end
ALTER TABLE public.subscription_status
  ADD COLUMN IF NOT EXISTS reward_multiplier NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

COMMENT ON COLUMN public.subscription_status.reward_multiplier IS 'Reward multiplier for this tier (1=free, 2=pro, 3=creator)';
COMMENT ON COLUMN public.subscription_status.trial_end IS 'When the trial ends (if in trial)';
COMMENT ON COLUMN public.subscription_status.cancel_at_period_end IS 'Subscription will not renew';
COMMENT ON COLUMN public.subscription_status.current_period_start IS 'Start of current billing period';
COMMENT ON COLUMN public.subscription_status.stripe_subscription_id IS 'Stripe subscription ID for support and webhooks';
