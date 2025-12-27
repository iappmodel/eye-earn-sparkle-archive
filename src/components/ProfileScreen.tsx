import React, { useState } from 'react';
import { X, CheckCircle2, Camera } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { CoinDisplay } from './CoinDisplay';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { OnboardingFlow } from './onboarding';
import { 
  EditProfileButton,
  KYCVerificationButton,
  SeeEarningsButton,
  InviteFriendsButton,
  SettingsButton,
  NotificationsButton,
  HelpCenterButton,
  LegalButton,
  LogOutButton
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
          <h1 className="font-display text-2xl font-bold">Profile</h1>
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
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-bold">{displayName}</h2>
            {isVerified && (
              <CheckCircle2 className="w-5 h-5 text-primary fill-primary" />
            )}
          </div>
          <p className="text-muted-foreground text-sm">@{username}</p>
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
          
          <EditProfileButton onClick={() => {}} />
          <KYCVerificationButton status={kycStatus} onClick={() => setShowKycFlow(true)} />
          <SeeEarningsButton todayEarnings={25} onClick={() => {}} />
          <InviteFriendsButton bonus={100} onClick={() => {}} />
          
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Preferences</p>
          
          <SettingsButton onClick={() => {}} />
          <NotificationsButton unreadCount={3} onClick={() => {}} />
          
          <p className="text-xs text-muted-foreground uppercase tracking-wider px-2 mt-6 mb-2">Support</p>
          
          <HelpCenterButton onClick={() => {}} />
          <LegalButton onClick={() => {}} />
          
          <div className="pt-4">
            <LogOutButton onClick={handleSignOut} />
          </div>
        </div>
      </div>

      {/* KYC Verification Flow */}
      <OnboardingFlow
        isOpen={showKycFlow}
        onClose={() => setShowKycFlow(false)}
        onComplete={() => setShowKycFlow(false)}
      />
    </div>
  );
};
