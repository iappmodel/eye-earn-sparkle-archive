-- Create content likes table
CREATE TABLE public.content_likes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Create saved content table
CREATE TABLE public.saved_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, content_id)
);

-- Enable RLS
ALTER TABLE public.content_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_content ENABLE ROW LEVEL SECURITY;

-- Policies for likes
CREATE POLICY "Anyone can view likes" ON public.content_likes FOR SELECT USING (true);
CREATE POLICY "Users can like content" ON public.content_likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unlike content" ON public.content_likes FOR DELETE USING (auth.uid() = user_id);

-- Policies for saves
CREATE POLICY "Users can view their saves" ON public.saved_content FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can save content" ON public.saved_content FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unsave content" ON public.saved_content FOR DELETE USING (auth.uid() = user_id);

-- Function to update likes count on user_content
CREATE OR REPLACE FUNCTION public.update_content_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.user_content SET likes_count = COALESCE(likes_count, 0) + 1 WHERE id = NEW.content_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.user_content SET likes_count = GREATEST(COALESCE(likes_count, 0) - 1, 0) WHERE id = OLD.content_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Trigger for likes count
CREATE TRIGGER on_content_like_change
AFTER INSERT OR DELETE ON public.content_likes
FOR EACH ROW
EXECUTE FUNCTION public.update_content_likes_count();

-- Indexes
CREATE INDEX idx_content_likes_user ON public.content_likes(user_id);
CREATE INDEX idx_content_likes_content ON public.content_likes(content_id);
CREATE INDEX idx_saved_content_user ON public.saved_content(user_id);