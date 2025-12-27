-- Create promotions table for location-based campaigns
CREATE TABLE public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id UUID,
  business_name TEXT NOT NULL,
  description TEXT,
  reward_type TEXT NOT NULL CHECK (reward_type IN ('vicoin', 'icoin', 'both')),
  reward_amount INTEGER NOT NULL CHECK (reward_amount > 0),
  required_action TEXT NOT NULL CHECK (required_action IN ('view', 'visit', 'purchase', 'scan')),
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  address TEXT,
  category TEXT,
  image_url TEXT,
  max_claims INTEGER,
  current_claims INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

-- Everyone can view active promotions
CREATE POLICY "Anyone can view active promotions"
ON public.promotions
FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

-- Create promotion claims table to track user interactions
CREATE TABLE public.promotion_claims (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'verified', 'rewarded', 'expired')),
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  verified_at TIMESTAMP WITH TIME ZONE,
  reward_amount INTEGER,
  UNIQUE(user_id, promotion_id)
);

-- Enable RLS
ALTER TABLE public.promotion_claims ENABLE ROW LEVEL SECURITY;

-- Users can view their own claims
CREATE POLICY "Users can view their own claims"
ON public.promotion_claims
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own claims
CREATE POLICY "Users can create their own claims"
ON public.promotion_claims
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create indexes for geo queries
CREATE INDEX idx_promotions_location ON public.promotions(latitude, longitude);
CREATE INDEX idx_promotions_active ON public.promotions(is_active, expires_at);
CREATE INDEX idx_promotion_claims_user ON public.promotion_claims(user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert sample promotions for testing
INSERT INTO public.promotions (business_name, description, reward_type, reward_amount, required_action, latitude, longitude, address, category) VALUES
('Joe''s Coffee', 'Watch our promo video for rewards!', 'icoin', 5, 'view', 40.7128, -74.0060, '123 Main St, New York', 'Food & Drink'),
('FitLife Gym', 'Visit us and earn Vicoins!', 'vicoin', 10, 'visit', 40.7148, -74.0035, '456 Broadway, New York', 'Fitness'),
('Tech Hub Store', 'Scan QR code for bonus!', 'both', 15, 'scan', 40.7108, -74.0080, '789 Tech Ave, New York', 'Electronics'),
('Pizza Palace', 'Order and earn rewards!', 'icoin', 3, 'purchase', 40.7138, -74.0045, '321 Food Lane, New York', 'Food & Drink'),
('Bookworm Cafe', 'Check in for Vicoins!', 'vicoin', 8, 'visit', 40.7158, -74.0025, '555 Reader Blvd, New York', 'Entertainment');