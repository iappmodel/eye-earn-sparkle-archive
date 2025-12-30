-- Create table for linked social media accounts
CREATE TABLE public.linked_social_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  platform TEXT NOT NULL, -- instagram, tiktok, youtube, snapchat, facebook, twitch, twitter, etc.
  username TEXT,
  profile_url TEXT,
  display_name TEXT,
  avatar_url TEXT,
  followers_count INTEGER,
  is_verified BOOLEAN DEFAULT false,
  linked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Create table for imported media from social platforms
CREATE TABLE public.imported_media (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  linked_account_id UUID REFERENCES public.linked_social_accounts(id) ON DELETE SET NULL,
  platform TEXT NOT NULL,
  original_url TEXT NOT NULL,
  media_type TEXT NOT NULL DEFAULT 'video', -- video, image, reel, story, etc.
  title TEXT,
  description TEXT,
  thumbnail_url TEXT,
  duration INTEGER, -- in seconds for videos
  original_views INTEGER,
  original_likes INTEGER,
  imported_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processed, published, failed
  local_media_url TEXT, -- URL after downloading/processing
  edited_media_url TEXT, -- URL after editing in studio
  published_content_id UUID, -- Reference to user_content if published
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Enable RLS
ALTER TABLE public.linked_social_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imported_media ENABLE ROW LEVEL SECURITY;

-- Policies for linked_social_accounts
CREATE POLICY "Users can view their own linked accounts"
  ON public.linked_social_accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own linked accounts"
  ON public.linked_social_accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own linked accounts"
  ON public.linked_social_accounts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own linked accounts"
  ON public.linked_social_accounts FOR DELETE
  USING (auth.uid() = user_id);

-- Policies for imported_media
CREATE POLICY "Users can view their own imported media"
  ON public.imported_media FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own imported media"
  ON public.imported_media FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own imported media"
  ON public.imported_media FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own imported media"
  ON public.imported_media FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_linked_social_accounts_updated_at
  BEFORE UPDATE ON public.linked_social_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();