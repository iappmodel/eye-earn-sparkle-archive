-- Create transactions table for logging all coin movements
CREATE TABLE public.transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earned', 'spent', 'received', 'sent', 'withdrawn')),
  coin_type TEXT NOT NULL CHECK (coin_type IN ('vicoin', 'icoin')),
  amount INTEGER NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reward_logs table to prevent replay attacks
CREATE TABLE public.reward_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('promo_view', 'task_complete', 'referral', 'milestone', 'daily_bonus')),
  coin_type TEXT NOT NULL CHECK (coin_type IN ('vicoin', 'icoin')),
  amount INTEGER NOT NULL,
  attention_score NUMERIC,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id, reward_type)
);

-- Create daily_reward_caps table for tracking limits
CREATE TABLE public.daily_reward_caps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  icoin_earned INTEGER NOT NULL DEFAULT 0,
  vicoin_earned INTEGER NOT NULL DEFAULT 0,
  promo_views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);

-- Enable RLS on all tables
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reward_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_reward_caps ENABLE ROW LEVEL SECURITY;

-- Transactions policies
CREATE POLICY "Users can view their own transactions"
ON public.transactions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert transactions"
ON public.transactions
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Reward logs policies
CREATE POLICY "Users can view their own reward logs"
ON public.reward_logs
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert reward logs"
ON public.reward_logs
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Daily caps policies
CREATE POLICY "Users can view their own daily caps"
ON public.daily_reward_caps
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own daily caps"
ON public.daily_reward_caps
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own daily caps"
ON public.daily_reward_caps
FOR UPDATE
USING (auth.uid() = user_id);

-- Add indexes for performance
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at DESC);
CREATE INDEX idx_reward_logs_user_content ON public.reward_logs(user_id, content_id);
CREATE INDEX idx_daily_caps_user_date ON public.daily_reward_caps(user_id, date);

-- Create trigger for daily caps updated_at
CREATE TRIGGER update_daily_reward_caps_updated_at
BEFORE UPDATE ON public.daily_reward_caps
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();