-- Create user_preferences table for AI personalization
CREATE TABLE public.user_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  liked_tags TEXT[] DEFAULT '{}',
  disliked_tags TEXT[] DEFAULT '{}',
  avg_watch_time NUMERIC DEFAULT 0,
  focus_score NUMERIC DEFAULT 0,
  total_content_views INTEGER DEFAULT 0,
  engagement_score NUMERIC DEFAULT 0,
  last_seen_content TEXT[] DEFAULT '{}',
  preferred_categories TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own preferences"
ON public.user_preferences FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
ON public.user_preferences FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
ON public.user_preferences FOR UPDATE
USING (auth.uid() = user_id);

-- Create content_interactions table for tracking user behavior
CREATE TABLE public.content_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'video',
  watch_duration NUMERIC DEFAULT 0,
  total_duration NUMERIC DEFAULT 0,
  watch_completion_rate NUMERIC DEFAULT 0,
  attention_score NUMERIC DEFAULT 0,
  liked BOOLEAN DEFAULT false,
  shared BOOLEAN DEFAULT false,
  skipped BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE public.content_interactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own interactions"
ON public.content_interactions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
ON public.content_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own interactions"
ON public.content_interactions FOR UPDATE
USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX idx_user_preferences_user_id ON public.user_preferences(user_id);
CREATE INDEX idx_content_interactions_user_id ON public.content_interactions(user_id);
CREATE INDEX idx_content_interactions_content_id ON public.content_interactions(content_id);
CREATE INDEX idx_content_interactions_created_at ON public.content_interactions(created_at DESC);

-- Add trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
BEFORE UPDATE ON public.user_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();