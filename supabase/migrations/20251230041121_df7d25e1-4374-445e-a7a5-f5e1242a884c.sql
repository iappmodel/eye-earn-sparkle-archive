-- Create favorite_locations table for saving preferred businesses
CREATE TABLE public.favorite_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  promotion_id uuid REFERENCES public.promotions(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  address text,
  category text,
  notes text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.favorite_locations ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own favorites"
ON public.favorite_locations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create favorites"
ON public.favorite_locations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
ON public.favorite_locations FOR DELETE
USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_favorite_locations_user ON public.favorite_locations(user_id);
CREATE INDEX idx_favorite_locations_promotion ON public.favorite_locations(promotion_id);