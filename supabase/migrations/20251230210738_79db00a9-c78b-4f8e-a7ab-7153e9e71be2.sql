-- Create timed_interactions table for comments, likes, rewards at specific video timestamps
CREATE TABLE public.timed_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  user_id UUID NOT NULL,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('comment', 'like', 'reward')),
  timestamp_seconds NUMERIC NOT NULL,
  message TEXT,
  coin_type TEXT,
  amount NUMERIC,
  is_visible BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create top_contributors view/tracking
CREATE TABLE public.content_contributors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  content_id UUID NOT NULL,
  user_id UUID NOT NULL,
  total_icoin_contributed NUMERIC DEFAULT 0,
  total_vicoin_contributed NUMERIC DEFAULT 0,
  interaction_count INTEGER DEFAULT 0,
  last_interaction_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(content_id, user_id)
);

-- User setting for timed interactions visibility
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS show_timed_interactions BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_contributor_badges BOOLEAN DEFAULT true;

-- Enable RLS
ALTER TABLE public.timed_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_contributors ENABLE ROW LEVEL SECURITY;

-- RLS policies for timed_interactions
CREATE POLICY "Anyone can view visible timed interactions"
ON public.timed_interactions FOR SELECT
USING (is_visible = true);

CREATE POLICY "Users can create their own timed interactions"
ON public.timed_interactions FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own timed interactions"
ON public.timed_interactions FOR UPDATE
USING (auth.uid() = user_id);

-- RLS policies for content_contributors
CREATE POLICY "Anyone can view content contributors"
ON public.content_contributors FOR SELECT
USING (true);

CREATE POLICY "System can manage contributors"
ON public.content_contributors FOR ALL
USING (true);

-- Function to update contributor stats
CREATE OR REPLACE FUNCTION public.update_contributor_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.content_contributors (content_id, user_id, total_icoin_contributed, total_vicoin_contributed, interaction_count)
  VALUES (
    NEW.content_id,
    NEW.user_id,
    CASE WHEN NEW.coin_type = 'icoin' THEN COALESCE(NEW.amount, 0) ELSE 0 END,
    CASE WHEN NEW.coin_type = 'vicoin' THEN COALESCE(NEW.amount, 0) ELSE 0 END,
    1
  )
  ON CONFLICT (content_id, user_id) DO UPDATE SET
    total_icoin_contributed = content_contributors.total_icoin_contributed + 
      CASE WHEN NEW.coin_type = 'icoin' THEN COALESCE(NEW.amount, 0) ELSE 0 END,
    total_vicoin_contributed = content_contributors.total_vicoin_contributed + 
      CASE WHEN NEW.coin_type = 'vicoin' THEN COALESCE(NEW.amount, 0) ELSE 0 END,
    interaction_count = content_contributors.interaction_count + 1,
    last_interaction_at = now(),
    updated_at = now();
  
  RETURN NEW;
END;
$$;

-- Trigger to auto-update contributor stats
CREATE TRIGGER on_timed_interaction_created
  AFTER INSERT ON public.timed_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_contributor_stats();

-- Enable realtime for timed interactions
ALTER PUBLICATION supabase_realtime ADD TABLE public.timed_interactions;