import React from 'react';
import { X, Shield, CheckCircle2, Camera, Mail, Calendar, LogOut, User } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { CoinDisplay } from './CoinDisplay';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Button } from './ui/button';

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
  const joinDate = profile?.created_at ? new Date(profile.created_at) : new Date();
  const vicoins = profile?.vicoin_balance || 0;
  const icoins = profile?.icoin_balance || 0;
  const kycStatus = profile?.kyc_status || 'pending';

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-2xl font-bold">Profile</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Avatar & Name */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-28 h-28 rounded-full neu-card overflow-hidden">
              <img 
                src={avatarUrl} 
                alt={displayName}
                className="w-full h-full object-cover"
              />
            </div>
            <button className="absolute bottom-0 right-0 w-10 h-10 rounded-full neu-button flex items-center justify-center">
              <Camera className="w-5 h-5 text-primary" />
            </button>
          </div>
          
          <div className="flex items-center gap-2 mb-1">
            <h2 className="font-display text-xl font-bold">{displayName}</h2>
            {isVerified && (
              <CheckCircle2 className="w-5 h-5 text-primary fill-primary" />
            )}
          </div>
          <p className="text-muted-foreground">@{username}</p>
        </div>

        {/* KYC/Verification Status */}
        <div className={cn(
          'flex items-center gap-3 p-4 rounded-2xl mb-6',
          isVerified ? 'neu-inset border border-primary/20' : 'neu-button cursor-pointer hover:scale-[1.02] transition-transform'
        )}>
          <Shield className={cn(
            'w-6 h-6',
            isVerified ? 'text-primary' : kycStatus === 'submitted' ? 'text-icoin' : 'text-muted-foreground'
          )} />
          <div className="flex-1">
            <p className="font-medium text-sm">
              {isVerified 
                ? 'Verified Account' 
                : kycStatus === 'submitted' 
                  ? 'Verification Pending'
                  : 'Verification Required'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isVerified 
                ? 'Your identity has been confirmed' 
                : kycStatus === 'submitted'
                  ? 'We are reviewing your documents'
                  : 'Complete KYC to unlock withdrawals'}
            </p>
          </div>
          {!isVerified && kycStatus !== 'submitted' && (
            <span className="text-xs text-primary font-medium">Start →</span>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
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

        {/* Info */}
        <div className="space-y-4 mb-8">
          <div className="flex items-center gap-4 p-4 neu-inset rounded-2xl">
            <Mail className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4 p-4 neu-inset rounded-2xl">
            <Calendar className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Member since</p>
              <p className="text-sm font-medium">
                {joinDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 p-4 neu-inset rounded-2xl">
            <User className="w-5 h-5 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">User ID</p>
              <p className="text-xs font-mono text-muted-foreground/80 truncate">
                {user?.id?.slice(0, 8)}...{user?.id?.slice(-4)}
              </p>
            </div>
          </div>
        </div>

        {/* Sign Out Button */}
        <Button
          onClick={handleSignOut}
          variant="outline"
          className="w-full h-12 border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
};
