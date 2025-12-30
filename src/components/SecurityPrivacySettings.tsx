import React, { useState, useEffect } from 'react';
import { 
  Shield, Smartphone, EyeOff, Flag, UserX, 
  ChevronRight, Loader2, Lock, Key
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Card3D } from '@/components/ui/Card3D';
import { TwoFactorAuth } from './TwoFactorAuth';
import { ActiveSessionsManager } from './ActiveSessionsManager';
import { ContentReportFlow } from './ContentReportFlow';
import { BlockMuteManager } from './BlockMuteManager';
import { toast } from 'sonner';

interface SettingItemProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick?: () => void;
  toggle?: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    loading?: boolean;
  };
  badge?: string;
}

const SettingItem: React.FC<SettingItemProps> = ({
  icon,
  title,
  description,
  onClick,
  toggle,
  badge,
}) => (
  <button
    onClick={onClick}
    disabled={toggle?.loading}
    className={cn(
      "w-full flex items-center justify-between gap-4 py-4 px-4 rounded-xl transition-all",
      "border border-border/50 bg-card/50 hover:bg-card hover:border-primary/30",
      toggle?.loading && "opacity-50"
    )}
  >
    <div className="flex items-start gap-3">
      <div className="p-2 rounded-lg bg-primary/10 text-primary">{icon}</div>
      <div className="text-left">
        <div className="flex items-center gap-2">
          <h4 className="font-medium text-foreground">{title}</h4>
          {badge && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {badge}
            </span>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
    {toggle ? (
      <Switch 
        checked={toggle.checked} 
        onCheckedChange={toggle.onChange}
        disabled={toggle.loading}
        onClick={(e) => e.stopPropagation()}
      />
    ) : (
      <ChevronRight className="w-5 h-5 text-muted-foreground" />
    )}
  </button>
);

export const SecurityPrivacySettings: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [privacyMode, setPrivacyMode] = useState(false);
  const [updatingPrivacy, setUpdatingPrivacy] = useState(false);
  const [blockedCount, setBlockedCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(0);
  
  // Modal states
  const [show2FA, setShow2FA] = useState(false);
  const [showSessions, setShowSessions] = useState(false);
  const [showBlockedUsers, setShowBlockedUsers] = useState(false);
  const [showReportDemo, setShowReportDemo] = useState(false);

  useEffect(() => {
    if (user) {
      loadSettings();
    }
  }, [user]);

  const loadSettings = async () => {
    if (!user) return;
    setLoading(true);
    
    try {
      // Load privacy mode from profile (using social_links as storage for demo)
      const { data: profile } = await supabase
        .from('profiles')
        .select('social_links')
        .eq('user_id', user.id)
        .single();
      
      const socialLinks = profile?.social_links as Record<string, any> || {};
      setPrivacyMode(socialLinks.privacy_mode || false);

      // Get blocked users count
      const { count: blockedUsersCount } = await supabase
        .from('blocked_users')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setBlockedCount(blockedUsersCount || 0);

      // Get session count
      const { count: sessionsCount } = await supabase
        .from('device_fingerprints')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);
      
      setSessionCount(sessionsCount || 0);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrivacyModeToggle = async (enabled: boolean) => {
    if (!user) return;
    setUpdatingPrivacy(true);
    
    try {
      // Get current social_links
      const { data: profile } = await supabase
        .from('profiles')
        .select('social_links')
        .eq('user_id', user.id)
        .single();
      
      const currentLinks = (profile?.social_links as Record<string, any>) || {};
      
      // Update with privacy mode
      const { error } = await supabase
        .from('profiles')
        .update({
          social_links: { ...currentLinks, privacy_mode: enabled }
        })
        .eq('user_id', user.id);

      if (error) throw error;
      
      setPrivacyMode(enabled);
      toast.success(enabled ? 'Privacy mode enabled' : 'Privacy mode disabled');
    } catch (error) {
      toast.error('Failed to update privacy mode');
    } finally {
      setUpdatingPrivacy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 rounded-xl bg-primary/10">
            <Shield className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-foreground">
              Security & Privacy
            </h2>
            <p className="text-sm text-muted-foreground">
              Manage your account security
            </p>
          </div>
        </div>

        {/* Security Section */}
        <Card3D className="p-4" tiltEnabled={false}>
          <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
            Account Security
          </h3>
          
          <div className="space-y-3">
            <SettingItem
              icon={<Key className="w-5 h-5" />}
              title="Two-Factor Authentication"
              description="Add extra security to your account"
              onClick={() => setShow2FA(true)}
            />

            <SettingItem
              icon={<Smartphone className="w-5 h-5" />}
              title="Active Sessions"
              description="View and manage logged-in devices"
              onClick={() => setShowSessions(true)}
              badge={sessionCount > 0 ? `${sessionCount} device${sessionCount > 1 ? 's' : ''}` : undefined}
            />
          </div>
        </Card3D>

        {/* Privacy Section */}
        <Card3D className="p-4" tiltEnabled={false}>
          <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
            Privacy Controls
          </h3>
          
          <div className="space-y-3">
            <SettingItem
              icon={<EyeOff className="w-5 h-5" />}
              title="Privacy Mode"
              description="Hide your activity status from others"
              toggle={{
                checked: privacyMode,
                onChange: handlePrivacyModeToggle,
                loading: updatingPrivacy,
              }}
            />

            <SettingItem
              icon={<UserX className="w-5 h-5" />}
              title="Blocked Users"
              description="Manage accounts you've blocked"
              onClick={() => setShowBlockedUsers(true)}
              badge={blockedCount > 0 ? `${blockedCount}` : undefined}
            />

            <SettingItem
              icon={<Flag className="w-5 h-5" />}
              title="Report Content"
              description="Report inappropriate content"
              onClick={() => setShowReportDemo(true)}
            />
          </div>
        </Card3D>

        {/* Security Tips */}
        <Card3D className="p-4" tiltEnabled={false}>
          <h3 className="font-display text-lg font-semibold mb-4 gradient-text">
            Security Tips
          </h3>
          
          <div className="space-y-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-2">
              <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p>Use a strong, unique password for your account</p>
            </div>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p>Enable two-factor authentication for extra protection</p>
            </div>
            <div className="flex items-start gap-2">
              <Smartphone className="w-4 h-4 text-primary mt-0.5 shrink-0" />
              <p>Review your active sessions regularly</p>
            </div>
          </div>
        </Card3D>
      </div>

      {/* Modals */}
      <TwoFactorAuth isOpen={show2FA} onClose={() => setShow2FA(false)} />
      <ActiveSessionsManager isOpen={showSessions} onClose={() => setShowSessions(false)} />
      <BlockMuteManager isOpen={showBlockedUsers} onClose={() => setShowBlockedUsers(false)} />
      <ContentReportFlow isOpen={showReportDemo} onClose={() => setShowReportDemo(false)} />
    </>
  );
};
