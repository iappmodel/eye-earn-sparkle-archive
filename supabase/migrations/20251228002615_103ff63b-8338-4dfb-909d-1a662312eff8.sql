-- Feature flags table for release management
CREATE TABLE public.feature_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  rollout_percentage INTEGER DEFAULT 100 CHECK (rollout_percentage >= 0 AND rollout_percentage <= 100),
  target_roles TEXT[] DEFAULT ARRAY['user', 'creator', 'moderator', 'admin'],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Anyone can read feature flags (needed for client-side checks)
CREATE POLICY "Feature flags are readable by everyone" 
ON public.feature_flags 
FOR SELECT 
USING (true);

-- Only admins can modify feature flags (correct argument order)
CREATE POLICY "Admins can manage feature flags" 
ON public.feature_flags 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- App versions table for tracking releases
CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  release_notes TEXT,
  is_stable BOOLEAN DEFAULT false,
  is_deprecated BOOLEAN DEFAULT false,
  min_supported_version TEXT,
  released_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Anyone can read app versions
CREATE POLICY "App versions are readable by everyone" 
ON public.app_versions 
FOR SELECT 
USING (true);

-- Only admins can manage versions
CREATE POLICY "Admins can manage app versions" 
ON public.app_versions 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Error logs for crash tracking
CREATE TABLE public.error_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  error_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  stack_trace TEXT,
  component TEXT,
  user_agent TEXT,
  url TEXT,
  metadata JSONB DEFAULT '{}',
  app_version TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

-- Users can insert their own error logs
CREATE POLICY "Users can log errors" 
ON public.error_logs 
FOR INSERT 
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admins can view all error logs
CREATE POLICY "Admins can view all error logs" 
ON public.error_logs 
FOR SELECT 
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'moderator'::app_role));

-- Create updated_at trigger for feature_flags
CREATE TRIGGER update_feature_flags_updated_at
BEFORE UPDATE ON public.feature_flags
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some default feature flags
INSERT INTO public.feature_flags (name, description, is_enabled, rollout_percentage) VALUES
('eye_tracking_rewards', 'Enable eye-tracking based attention rewards', true, 100),
('ai_reply_suggestions', 'Enable AI-powered reply suggestions in chat', true, 100),
('discovery_map_3d', 'Enable 3D markers on discovery map', false, 25),
('voice_commands', 'Enable voice command navigation', false, 10),
('dark_mode_auto', 'Auto-switch dark mode based on time', true, 100),
('canary_features', 'Enable canary/beta features for VIP users', false, 5);