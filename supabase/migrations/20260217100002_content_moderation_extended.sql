-- Content moderation: extended schema for severity, source, appeals, and mod actions on content
-- Requires: content_flags, user_reports, admin_actions, user_bans, user_content, has_role(), update_updated_at_column()

-- 1) Extend content_flags
ALTER TABLE public.content_flags
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'user_report' CHECK (source IN ('user_report', 'automod', 'admin')),
  ADD COLUMN IF NOT EXISTS content_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS moderator_notes TEXT;

COMMENT ON COLUMN public.content_flags.severity IS 'Priority for review queue';
COMMENT ON COLUMN public.content_flags.source IS 'Who/what raised the flag';
COMMENT ON COLUMN public.content_flags.content_user_id IS 'Owner of the content (denormalized for quick access)';
COMMENT ON COLUMN public.content_flags.moderator_notes IS 'Internal notes visible only to mods';

-- 2) Extend user_reports
ALTER TABLE public.user_reports
  ADD COLUMN IF NOT EXISTS severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  ADD COLUMN IF NOT EXISTS moderator_notes TEXT;

COMMENT ON COLUMN public.user_reports.moderator_notes IS 'Internal notes visible only to mods';

-- 3) Moderation appeals (user can appeal a resolved flag or report)
CREATE TABLE IF NOT EXISTS public.moderation_appeals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  appealable_type TEXT NOT NULL CHECK (appealable_type IN ('content_flag', 'user_report')),
  appealable_id UUID NOT NULL,
  appealed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'upheld', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  review_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(appealable_type, appealable_id)
);

ALTER TABLE public.moderation_appeals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create appeals for their own content/decisions"
  ON public.moderation_appeals FOR INSERT
  WITH CHECK (auth.uid() = appealed_by);

CREATE POLICY "Users can view their own appeals"
  ON public.moderation_appeals FOR SELECT
  USING (auth.uid() = appealed_by);

CREATE POLICY "Moderators can view all appeals"
  ON public.moderation_appeals FOR SELECT
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Moderators can update appeals"
  ON public.moderation_appeals FOR UPDATE
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

CREATE INDEX idx_moderation_appeals_status ON public.moderation_appeals(status);
CREATE INDEX idx_moderation_appeals_appealable ON public.moderation_appeals(appealable_type, appealable_id);
CREATE INDEX idx_moderation_appeals_created ON public.moderation_appeals(created_at DESC);

CREATE TRIGGER update_moderation_appeals_updated_at
  BEFORE UPDATE ON public.moderation_appeals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4) Allow moderators to update user_content for moderation (e.g. set status to deleted/rejected)
DROP POLICY IF EXISTS "Moderators can update content for moderation" ON public.user_content;
CREATE POLICY "Moderators can update content for moderation"
  ON public.user_content FOR UPDATE
  USING (has_role(auth.uid(), 'moderator') OR has_role(auth.uid(), 'admin'));

-- 5) Indexes for moderation queues
CREATE INDEX IF NOT EXISTS idx_content_flags_severity_status ON public.content_flags(severity, status);
CREATE INDEX IF NOT EXISTS idx_user_reports_severity_status ON public.user_reports(severity, status);
