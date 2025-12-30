import React, { useState, useEffect } from 'react';
import { X, MessageCircle, UserPlus, UserMinus, Share2, MoreHorizontal, Calendar } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { VerificationBadge, RoleBadge, KycStatusBadge } from './VerificationBadge';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFollow } from '@/hooks/useFollow';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface PublicProfileProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onMessage?: (userId: string) => void;
}

interface ProfileData {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  kyc_status: string | null;
  followers_count: number | null;
  following_count: number | null;
  total_likes: number | null;
  total_views: number | null;
  created_at: string;
}

interface UserRole {
  role: 'user' | 'creator' | 'moderator' | 'admin';
}

export const PublicProfile: React.FC<PublicProfileProps> = ({
  userId,
  isOpen,
  onClose,
  onMessage,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const { isFollowing, isLoading: followLoading, followersCount, toggleFollow } = useFollow(userId);

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId || !isOpen) return;
      
      setIsLoading(true);
      setIsOwnProfile(user?.id === userId);

      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (profileError) {
        console.error('Error loading profile:', profileError);
        toast.error('Failed to load profile');
        setIsLoading(false);
        return;
      }

      setProfile(profileData);

      // Fetch user role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId)
        .single();

      if (roleData) {
        setUserRole(roleData as UserRole);
      }

      setIsLoading(false);
    };

    loadProfile();
  }, [userId, isOpen, user?.id]);

  const handleFollow = async () => {
    await toggleFollow();
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: profile?.display_name || profile?.username || 'Profile',
        url: `${window.location.origin}/profile/${profile?.username}`,
      });
    } catch {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${profile?.username}`);
      toast.success('Profile link copied!');
    }
  };

  const handleBlock = () => {
    toast.info('Block functionality coming soon');
  };

  const handleReport = () => {
    toast.info('Report functionality coming soon');
  };

  if (!isOpen) return null;

  const displayName = profile?.display_name || profile?.username || 'User';
  const username = profile?.username || 'user';
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const isVerified = profile?.is_verified || false;
  const kycStatus = (profile?.kyc_status as 'pending' | 'submitted' | 'verified' | 'rejected') || 'pending';
  const role = userRole?.role || 'user';

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="relative">
          {/* Banner */}
          <div className="h-32 bg-gradient-to-br from-primary/30 via-icoin/20 to-primary/10" />
          
          {/* Close button */}
          <NeuButton 
            onClick={onClose} 
            size="sm"
            className="absolute top-4 left-4"
          >
            <X className="w-5 h-5" />
          </NeuButton>

          {/* More options */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="absolute top-4 right-4 neu-button">
                <MoreHorizontal className="w-5 h-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share Profile
              </DropdownMenuItem>
              {!isOwnProfile && (
                <>
                  <DropdownMenuItem onClick={handleBlock}>
                    Block User
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleReport} className="text-destructive">
                    Report User
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar - positioned to overlap banner */}
          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="w-32 h-32 rounded-full neu-card overflow-hidden border-4 border-background">
                <img 
                  src={avatarUrl} 
                  alt={displayName}
                  className="w-full h-full object-cover"
                />
              </div>
              {/* Verification badge on avatar */}
              {isVerified && (
                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-background flex items-center justify-center">
                  <VerificationBadge type="verified" size="md" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pt-20 pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Name and badges */}
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h1 className="font-display text-2xl font-bold">{displayName}</h1>
                  {isVerified && <VerificationBadge type="verified" size="lg" />}
                  {role === 'creator' && <VerificationBadge type="creator" size="lg" />}
                  {role === 'admin' && <VerificationBadge type="admin" size="lg" />}
                  {role === 'moderator' && <VerificationBadge type="moderator" size="lg" />}
                </div>
                <p className="text-muted-foreground mb-2">@{username}</p>
                <div className="flex items-center justify-center gap-2">
                  <RoleBadge role={role} />
                  {kycStatus === 'verified' && <KycStatusBadge status="verified" />}
                </div>
              </div>

              {/* Bio */}
              {profile?.bio && (
                <p className="text-center text-sm text-foreground/80 mb-6 max-w-xs mx-auto">
                  {profile.bio}
                </p>
              )}

              {/* Stats */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                <div className="neu-inset rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{followersCount}</p>
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
                <div className="neu-inset rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{profile?.total_views || 0}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </div>

              {/* Action Buttons */}
              {!isOwnProfile && (
                <div className="flex gap-3 mb-6">
                  <Button
                    onClick={handleFollow}
                    disabled={followLoading}
                    className={cn(
                      'flex-1 gap-2',
                      isFollowing ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Following
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => onMessage?.(userId)}
                    variant="outline"
                    className="flex-1 gap-2"
                  >
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </Button>
                </div>
              )}

              {/* Role-specific content */}
              {role === 'creator' && (
                <div className="neu-card rounded-2xl p-4 mb-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <VerificationBadge type="creator" size="sm" showTooltip={false} />
                    Creator Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-icoin">{profile?.total_views || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Views</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{profile?.total_likes || 0}</p>
                      <p className="text-xs text-muted-foreground">Total Likes</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Member since */}
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4" />
                <span>Joined {new Date(profile?.created_at || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
