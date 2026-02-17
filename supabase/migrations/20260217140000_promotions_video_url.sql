-- Add video_url to promotions for full video ad support (thumbnail remains image_url)
ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS video_url text;

COMMENT ON COLUMN public.promotions.video_url IS 'Optional video asset URL for promo; when set, clients play video instead of static image.';
