import React, { useState } from 'react';
import { X, Camera, Upload, Video, BarChart3, Shield, Wifi, Globe, Crown, Gift, QrCode, UserX, History } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { CoinDisplay } from './CoinDisplay';
import { VerificationBadge, RoleBadge, KycStatusBadge } from './VerificationBadge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { OnboardingFlow } from './onboarding';
import { useUserRole } from '@/hooks/useUserRole';
import { useNotifications } from '@/hooks/useNotifications';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useSubscription } from '@/hooks/useSubscription';
import { NotificationCenter } from './NotificationCenter';
import { NotificationPreferences } from './NotificationPreferences';
import { SettingsScreen } from './SettingsScreen';
import { PremiumScreen } from './PremiumScreen';
import { ProfileEditScreen } from './ProfileEditScreen';
import { ProfileQRCode } from './ProfileQRCode';
import { BlockMuteManager } from './BlockMuteManager';
import { AccountActivityLog } from './AccountActivityLog';
import ConnectionStatusDot from './ConnectionStatusDot';
import SyncStatusPanel from './SyncStatusPanel';
import { 
  EditProfileButton,
  KYCVerificationButton,
  SeeEarningsButton,
  InviteFriendsButton,
  SettingsButton,
  NotificationsButton,
  HelpCenterButton,
  LegalButton,
  LogOutButton,
  MenuButton
} from './ProfileButtons';

interface ProfileScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const { profile, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [showKycFlow, setShowKycFlow] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotificationPrefs, setShowNotificationPrefs] = useState(false);
  const [showSyncPanel, setShowSyncPanel] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPremium, setShowPremium] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [showQRCode, setShowQRCode] = useState(false);
  const [showBlockMute, setShowBlockMute] = useState(false);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const { role, isCreator, isAdmin, isModerator } = useUserRole();
  const { unreadCount } = useNotifications();
  const { t, localeConfig } = useLocalization();
  const { tier, tierName, rewardMultiplier } = useSubscription();

  if (!isOpen) return null;

  const handleSignOut = async () => {
    await signOut();
    onClose();
    navigate('/auth');
  };

  const displayName = profile?.display_name || profile?.username || 'User';
  const username = profile?.username || user?.email?.split('@')[0] || 'user';
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const isVerified = profile?.is_verified || false;
  const vicoins = profile?.vicoin_balance || 0;
  const icoins = profile?.icoin_balance || 0;
  const kycStatus = (profile?.kyc_status as 'pending' | 'submitted' | 'verified' | 'rejected') || 'pending';

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold">Profile</h1>
            <ConnectionStatusDot showLabel size="sm" />
          </div>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-6">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full neu-card overflow-hidden">
              <img 
                src={avatarUrl} 
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute bottom-0 right-0 w-8 h-8 rounded-full neu-button flex items-center justify-center">
              <Camera className="w-4 h-4 text-primary" />
            </button>
            {isVerified && (
              <div className="absolute -top-1 -right-1">
                <VerificationBadge type="verified" size="lg" />
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-bold">{displayName}</h2>
            {isCreator && <VerificationBadge type="creator" size="md" />}
            {isAdmin && <VerificationBadge type="admin" size="md" />}
            {isModerator && !isAdmin && <VerificationBadge type="moderator" size="md" />}
          </div>
          <p className="text-muted-foreground text-sm mb-2">@{username}</p>
          <div className="flex items-center gap-2">
            <RoleBadge role={role} />
            <KycStatusBadge status={kycStatus} />
          </div>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="neu-card rounded-2xl p-4">
            <CoinDisplay type="vicoin" amount={vicoins} size="md" />
          </div>
          <div className="neu-card rounded-2xl p-4">
            <CoinDisplay type="icoin" amount={icoins} size="md" />
          </div>
        </div>

        {/* Engagement Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{profile?.followers_count || 0}</p>
            <p className="text-xs text-muted-foreground">Followers</p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{profile?.following_count || 0}</p>
            <p className="text-xs text-muted-foreground">Following</p>
          </div>
          <div className="neu-inset rounded-xl p-3 text-center">
            <p className="text-lg font-bold text-foreground">{profile?.total_likes || 0}</p>
            <p className="text-xs text-muted-foreground">Likes</p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mb-2">Account</p>
          
          <EditProfileButton onClick={() => setShowEditProfile(true)} />
          <MenuButton 
            icon={<QrCode className="w-5 h-5 text-primary" />}
            label="Profile QR Code"
            description="Share your profile via QR"
            onClick={() => setShowQRCode(true)}
          />
          <KYCVerificationButton status={kycStatus} onClick={() => setShowKycFlow(true)} />
          <SeeEarningsButton todayEarnings={25} onClick={() => {}} />
          <InviteFriendsButton bonus={100} onClick={() => setShowPremium(true)} />

          {/* Privacy */}
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Privacy & Security</p>
          <MenuButton 
            icon={<UserX className="w-5 h-5 text-primary" />}
            label="Blocked & Muted"
            description="Manage blocked and muted users"
            onClick={() => setShowBlockMute(true)}
          />
          <MenuButton 
            icon={<History className="w-5 h-5 text-primary" />}
            label="Account Activity"
            description="View login history and security events"
            onClick={() => setShowActivityLog(true)}
          />

          {/* Premium/Subscription */}
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Premium</p>
          <MenuButton 
            icon={<Crown className="w-5 h-5 text-icoin" />}
            label={tier === 'free' ? 'Upgrade to Premium' : `${tierName} Plan`}
            description={tier === 'free' ? 'Get 2-3x reward multiplier' : `${rewardMultiplier}x reward multiplier active`}
            badge={tier !== 'free' ? tierName : undefined}
            onClick={() => setShowPremium(true)}
          />
          <MenuButton 
            icon={<Gift className="w-5 h-5 text-primary" />}
            label="Referral Program"
            description="Earn from friends' rewards"
            onClick={() => setShowPremium(true)}
          />

          {/* Creator-specific options */}
          {isCreator && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Creator Tools</p>
              <MenuButton 
                icon={<Upload className="w-5 h-5 text-icoin" />}
                label="Upload Content"
                description="Share videos, images, and reels"
                onClick={() => {}}
              />
              <MenuButton 
                icon={<BarChart3 className="w-5 h-5 text-primary" />}
                label="Analytics"
                description="Views, engagement, earnings"
                onClick={() => {}}
              />
            </>
          )}

          {/* Admin/Moderator options */}
          {(isAdmin || isModerator) && (
            <>
              <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Moderation</p>
              <MenuButton 
                icon={<Shield className="w-5 h-5 text-primary" />}
                label="Admin Dashboard"
                description="Manage users, content, analytics"
                badge={isAdmin ? 'Admin' : 'Mod'}
                onClick={() => {
                  onClose();
                  navigate('/admin');
                }}
              />
              <MenuButton 
                icon={<Video className="w-5 h-5 text-amber-500" />}
                label="Content Review"
                description="Review flagged content"
                onClick={() => {
                  onClose();
                  navigate('/admin');
                }}
              />
            </>
          )}
          
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Preferences</p>
          
          <SettingsButton onClick={() => setShowSettings(true)} />
          <MenuButton 
            icon={<Globe className="w-5 h-5 text-primary" />}
            label={t('settings.language')}
            description={localeConfig.nativeName}
            onClick={() => setShowSettings(true)}
          />
          <MenuButton 
            icon={<Wifi className="w-5 h-5 text-primary" />}
            label="Sync Status"
            description="View offline sync status"
            onClick={() => setShowSyncPanel(!showSyncPanel)}
          />
          
          {showSyncPanel && (
            <div className="mt-3">
              <SyncStatusPanel />
            </div>
          )}
          <NotificationsButton unreadCount={unreadCount} onClick={() => setShowNotifications(true)} />
          
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Support</p>
          
          <HelpCenterButton onClick={() => {}} />
          <LegalButton onClick={() => {}} />
          
          <div className="pt-4">
            <LogOutButton onClick={handleSignOut} />
          </div>
        </div>
      </div>

      <OnboardingFlow
        isOpen={showKycFlow}
        onClose={() => setShowKycFlow(false)}
        onComplete={() => setShowKycFlow(false)}
      />

      <NotificationCenter
        isOpen={showNotifications}
        onClose={() => setShowNotifications(false)}
        onOpenPreferences={() => {
          setShowNotifications(false);
          setShowNotificationPrefs(true);
        }}
      />

      <NotificationPreferences
        isOpen={showNotificationPrefs}
        onClose={() => setShowNotificationPrefs(false)}
      />

      <SettingsScreen
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <PremiumScreen
        isOpen={showPremium}
        onClose={() => setShowPremium(false)}
      />

      <ProfileEditScreen
        isOpen={showEditProfile}
        onClose={() => setShowEditProfile(false)}
      />

      <ProfileQRCode
        isOpen={showQRCode}
        onClose={() => setShowQRCode(false)}
      />

      <BlockMuteManager
        isOpen={showBlockMute}
        onClose={() => setShowBlockMute(false)}
      />

      <AccountActivityLog
        isOpen={showActivityLog}
        onClose={() => setShowActivityLog(false)}
      />
    </div>
  );
};
