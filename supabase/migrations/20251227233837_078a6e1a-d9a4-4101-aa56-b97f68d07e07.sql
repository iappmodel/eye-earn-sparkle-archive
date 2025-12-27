-- Content flags table for reported content
CREATE TABLE public.content_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id TEXT NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'video',
  flagged_by UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  action_taken TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User reports table
CREATE TABLE public.user_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reported_user_id UUID NOT NULL,
  reported_by UUID NOT NULL,
  reason TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  action_taken TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Admin actions audit log
CREATE TABLE public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL,
  action_type TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  details JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User bans table
CREATE TABLE public.user_bans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  banned_by UUID NOT NULL,
  reason TEXT NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_permanent BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.content_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_bans ENABLE ROW LEVEL SECURITY;

-- Content flags policies
CREATE POLICY "Users can create flags" ON public.content_flags
  FOR INSERT WITH CHECK (auth.uid() = flagged_by);

CREATE POLICY "Users can view their own flags" ON public.content_flags
  FOR SELECT USING (auth.uid() = flagged_by);

CREATE POLICY "Moderators can view all flags" ON public.content_flags
  FOR SELECT USING (
    has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Moderators can update flags" ON public.content_flags
  FOR UPDATE USING (
    has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin')
  );

-- User reports policies
CREATE POLICY "Users can create reports" ON public.user_reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);

CREATE POLICY "Users can view their own reports" ON public.user_reports
  FOR SELECT USING (auth.uid() = reported_by);

CREATE POLICY "Moderators can view all reports" ON public.user_reports
  FOR SELECT USING (
    has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Moderators can update reports" ON public.user_reports
  FOR UPDATE USING (
    has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin')
  );

-- Admin actions policies (only admins can view/create)
CREATE POLICY "Admins can view admin actions" ON public.admin_actions
  FOR SELECT USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create admin actions" ON public.admin_actions
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator')
  );

-- User bans policies
CREATE POLICY "Moderators can view bans" ON public.user_bans
  FOR SELECT USING (
    has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Moderators can create bans" ON public.user_bans
  FOR INSERT WITH CHECK (
    has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can update bans" ON public.user_bans
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete bans" ON public.user_bans
  FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Indexes
CREATE INDEX idx_content_flags_status ON public.content_flags(status);
CREATE INDEX idx_content_flags_created ON public.content_flags(created_at DESC);
CREATE INDEX idx_user_reports_status ON public.user_reports(status);
CREATE INDEX idx_user_reports_created ON public.user_reports(created_at DESC);
CREATE INDEX idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX idx_admin_actions_created ON public.admin_actions(created_at DESC);
CREATE INDEX idx_user_bans_user ON public.user_bans(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_content_flags_updated_at
  BEFORE UPDATE ON public.content_flags
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_reports_updated_at
  BEFORE UPDATE ON public.user_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();