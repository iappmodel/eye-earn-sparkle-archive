-- Security & Privacy Tables

-- Abuse detection logs
CREATE TABLE public.abuse_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  abuse_type TEXT NOT NULL, -- 'duplicate_device', 'vpn_detected', 'reward_manipulation', 'attention_fraud', 'rate_limit', 'suspicious_pattern'
  severity TEXT NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
  details JSONB DEFAULT '{}'::jsonb,
  device_fingerprint TEXT,
  ip_address TEXT,
  user_agent TEXT,
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Device fingerprints for duplicate detection
CREATE TABLE public.device_fingerprints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  fingerprint_hash TEXT NOT NULL,
  device_info JSONB DEFAULT '{}'::jsonb,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_trusted BOOLEAN DEFAULT true,
  trust_score INTEGER DEFAULT 100,
  flagged BOOLEAN DEFAULT false,
  flag_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, fingerprint_hash)
);

-- Privacy consent records for GDPR/CCPA compliance
CREATE TABLE public.privacy_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL, -- 'analytics', 'personalized_ads', 'data_sharing', 'marketing_emails', 'location_tracking'
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  user_agent TEXT,
  version TEXT DEFAULT '1.0', -- consent version for policy updates
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, consent_type)
);

-- Data export requests for GDPR
CREATE TABLE public.data_export_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed', 'expired'
  request_type TEXT NOT NULL DEFAULT 'export', -- 'export', 'delete'
  file_url TEXT,
  expires_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Account deletion requests with cooling off period
CREATE TABLE public.account_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  reason TEXT,
  scheduled_deletion_at TIMESTAMPTZ NOT NULL,
  cancelled_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'cancelled', 'executed'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.abuse_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.privacy_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.data_export_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletion_requests ENABLE ROW LEVEL SECURITY;

-- Abuse logs: Admins/Mods can view and manage, system can insert
CREATE POLICY "System can insert abuse logs" ON public.abuse_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Admins can view abuse logs" ON public.abuse_logs
  FOR SELECT USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'moderator'));

CREATE POLICY "Admins can update abuse logs" ON public.abuse_logs
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Device fingerprints: Users can view their own, system can manage
CREATE POLICY "Users can view their own devices" ON public.device_fingerprints
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert fingerprints" ON public.device_fingerprints
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update fingerprints" ON public.device_fingerprints
  FOR UPDATE USING (auth.uid() = user_id);

-- Privacy consents: Users can manage their own
CREATE POLICY "Users can view their own consents" ON public.privacy_consents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consents" ON public.privacy_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consents" ON public.privacy_consents
  FOR UPDATE USING (auth.uid() = user_id);

-- Data export requests: Users can view and create their own
CREATE POLICY "Users can view their own export requests" ON public.data_export_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create export requests" ON public.data_export_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Account deletion: Users can manage their own deletion request
CREATE POLICY "Users can view their deletion request" ON public.account_deletion_requests
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create deletion request" ON public.account_deletion_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their deletion request" ON public.account_deletion_requests
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Add updated_at triggers
CREATE TRIGGER update_privacy_consents_updated_at
  BEFORE UPDATE ON public.privacy_consents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_data_export_requests_updated_at
  BEFORE UPDATE ON public.data_export_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_abuse_logs_user_id ON public.abuse_logs(user_id);
CREATE INDEX idx_abuse_logs_created_at ON public.abuse_logs(created_at DESC);
CREATE INDEX idx_abuse_logs_severity ON public.abuse_logs(severity) WHERE NOT resolved;
CREATE INDEX idx_device_fingerprints_hash ON public.device_fingerprints(fingerprint_hash);
CREATE INDEX idx_privacy_consents_user ON public.privacy_consents(user_id);