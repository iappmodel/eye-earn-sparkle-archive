-- Create promotion_reviews table for user reviews
CREATE TABLE public.promotion_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  promotion_id UUID NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  photos TEXT[] DEFAULT '{}',
  helpful_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_promotion_reviews_promotion_id ON public.promotion_reviews(promotion_id);
CREATE INDEX idx_promotion_reviews_user_id ON public.promotion_reviews(user_id);

-- Enable RLS
ALTER TABLE public.promotion_reviews ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view reviews"
ON public.promotion_reviews FOR SELECT
USING (true);

CREATE POLICY "Users can create reviews"
ON public.promotion_reviews FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own reviews"
ON public.promotion_reviews FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reviews"
ON public.promotion_reviews FOR DELETE
USING (auth.uid() = user_id);

-- Add streak bonus columns to promotion_checkins if not exists
ALTER TABLE public.promotion_checkins 
ADD COLUMN IF NOT EXISTS streak_bonus INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS streak_day INTEGER DEFAULT 1;

-- Create trigger for updated_at
CREATE TRIGGER update_promotion_reviews_updated_at
BEFORE UPDATE ON public.promotion_reviews
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();