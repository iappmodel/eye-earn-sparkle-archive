-- Create user_content table for posts, stories, promotions, campaigns
CREATE TABLE public.user_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('post', 'story', 'promotion', 'campaign')),
  title TEXT,
  caption TEXT,
  media_url TEXT,
  media_type TEXT CHECK (media_type IN ('image', 'video', 'carousel')),
  thumbnail_url TEXT,
  tags TEXT[] DEFAULT '{}'::TEXT[],
  location_lat DOUBLE PRECISION,
  location_lng DOUBLE PRECISION,
  location_address TEXT,
  
  -- Engagement metrics (for rewards calculation)
  views_count INTEGER DEFAULT 0,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  shares_count INTEGER DEFAULT 0,
  
  -- Reward tracking
  total_rewards_earned INTEGER DEFAULT 0,
  reward_type TEXT DEFAULT 'vicoin',
  
  -- Campaign/Promotion specific
  budget INTEGER,
  target_audience TEXT,
  call_to_action TEXT,
  external_link TEXT,
  
  -- Story specific
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'active', 'expired', 'rejected', 'deleted')),
  is_public BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.user_content ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view all public active content
CREATE POLICY "Anyone can view public active content"
ON public.user_content
FOR SELECT
USING (is_public = true AND status = 'active');

-- Policy: Users can view their own content
CREATE POLICY "Users can view their own content"
ON public.user_content
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Users can create their own content
CREATE POLICY "Users can create their own content"
ON public.user_content
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own content
CREATE POLICY "Users can update their own content"
ON public.user_content
FOR UPDATE
USING (auth.uid() = user_id);

-- Policy: Users can delete their own content
CREATE POLICY "Users can delete their own content"
ON public.user_content
FOR DELETE
USING (auth.uid() = user_id);

-- Create index for better query performance
CREATE INDEX idx_user_content_user_id ON public.user_content(user_id);
CREATE INDEX idx_user_content_type ON public.user_content(content_type);
CREATE INDEX idx_user_content_status ON public.user_content(status);
CREATE INDEX idx_user_content_created ON public.user_content(created_at DESC);

-- Enable realtime for content updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_content;

-- Create trigger for updated_at
CREATE TRIGGER update_user_content_updated_at
  BEFORE UPDATE ON public.user_content
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();