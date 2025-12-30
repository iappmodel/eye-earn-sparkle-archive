-- Add cover photo and social links to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS cover_photo_url text,
ADD COLUMN IF NOT EXISTS social_links jsonb DEFAULT '{}'::jsonb;

-- Create blocked_users table for blocking/muting functionality
CREATE TABLE public.blocked_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  blocked_user_id uuid NOT NULL,
  block_type text NOT NULL DEFAULT 'block', -- 'block' or 'mute'
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, blocked_user_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
ON public.blocked_users FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create blocks"
ON public.blocked_users FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own blocks"
ON public.blocked_users FOR DELETE
USING (auth.uid() = user_id);

-- Create account_activity_logs table for security events
CREATE TABLE public.account_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  activity_type text NOT NULL, -- 'login', 'logout', 'password_change', 'profile_update', 'device_added', etc.
  ip_address text,
  user_agent text,
  device_info jsonb DEFAULT '{}'::jsonb,
  location text,
  status text NOT NULL DEFAULT 'success', -- 'success', 'failed'
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.account_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own activity logs"
ON public.account_activity_logs FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity logs"
ON public.account_activity_logs FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_activity_logs_user_created ON public.account_activity_logs(user_id, created_at DESC);
CREATE INDEX idx_blocked_users_user ON public.blocked_users(user_id);