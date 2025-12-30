-- Create promotion_checkins table for tracking user check-ins
CREATE TABLE public.promotion_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  promotion_id uuid REFERENCES public.promotions(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  user_latitude double precision NOT NULL,
  user_longitude double precision NOT NULL,
  distance_meters double precision NOT NULL,
  status text NOT NULL DEFAULT 'verified', -- 'verified', 'pending', 'failed'
  reward_claimed boolean NOT NULL DEFAULT false,
  reward_amount integer,
  reward_type text,
  checked_in_at timestamp with time zone NOT NULL DEFAULT now(),
  reward_claimed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.promotion_checkins ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own check-ins"
ON public.promotion_checkins FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create check-ins"
ON public.promotion_checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own check-ins"
ON public.promotion_checkins FOR UPDATE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_promotion_checkins_user ON public.promotion_checkins(user_id);
CREATE INDEX idx_promotion_checkins_promotion ON public.promotion_checkins(promotion_id);
CREATE INDEX idx_promotion_checkins_status ON public.promotion_checkins(status);

-- Add category column to promotions if not exists
ALTER TABLE public.promotions
ADD COLUMN IF NOT EXISTS category text DEFAULT 'general';

-- Update existing promotions to have categories
UPDATE public.promotions SET category = 'food_drink' WHERE category IS NULL OR category = 'general';