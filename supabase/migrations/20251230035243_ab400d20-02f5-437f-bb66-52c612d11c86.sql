-- Payment methods for payouts
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  method_type text NOT NULL, -- 'bank', 'paypal', 'crypto'
  is_default boolean DEFAULT false,
  nickname text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb, -- encrypted/masked details
  verified boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payment methods"
ON public.payment_methods FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payment methods"
ON public.payment_methods FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
ON public.payment_methods FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own payment methods"
ON public.payment_methods FOR DELETE
USING (auth.uid() = user_id);

-- Payout requests table
CREATE TABLE public.payout_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  payment_method_id uuid REFERENCES public.payment_methods(id),
  amount integer NOT NULL,
  coin_type text NOT NULL, -- 'vicoin' or 'icoin'
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  fee integer DEFAULT 0,
  net_amount integer,
  reference_id text,
  failure_reason text,
  processed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.payout_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payout requests"
ON public.payout_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own payout requests"
ON public.payout_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Coin gifts table
CREATE TABLE public.coin_gifts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  amount integer NOT NULL,
  coin_type text NOT NULL, -- 'vicoin' or 'icoin'
  message text,
  status text NOT NULL DEFAULT 'completed', -- 'completed', 'refunded'
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.coin_gifts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view gifts they sent or received"
ON public.coin_gifts FOR SELECT
USING (auth.uid() = sender_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can send gifts"
ON public.coin_gifts FOR INSERT
WITH CHECK (auth.uid() = sender_id);

-- Earning goals table
CREATE TABLE public.earning_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal_type text NOT NULL, -- 'daily', 'weekly', 'monthly'
  target_amount integer NOT NULL,
  coin_type text NOT NULL DEFAULT 'vicoin',
  current_progress integer DEFAULT 0,
  period_start date NOT NULL,
  period_end date NOT NULL,
  is_active boolean DEFAULT true,
  achieved boolean DEFAULT false,
  achieved_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.earning_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own goals"
ON public.earning_goals FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own goals"
ON public.earning_goals FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own goals"
ON public.earning_goals FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own goals"
ON public.earning_goals FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_payment_methods_user ON public.payment_methods(user_id);
CREATE INDEX idx_payout_requests_user ON public.payout_requests(user_id, created_at DESC);
CREATE INDEX idx_coin_gifts_sender ON public.coin_gifts(sender_id, created_at DESC);
CREATE INDEX idx_coin_gifts_recipient ON public.coin_gifts(recipient_id, created_at DESC);
CREATE INDEX idx_earning_goals_user ON public.earning_goals(user_id, is_active);

-- Triggers for updated_at
CREATE TRIGGER update_payment_methods_updated_at
BEFORE UPDATE ON public.payment_methods
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payout_requests_updated_at
BEFORE UPDATE ON public.payout_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_earning_goals_updated_at
BEFORE UPDATE ON public.earning_goals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();