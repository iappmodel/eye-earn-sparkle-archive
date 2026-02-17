import React, { useState, useEffect, useCallback } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import {
  X,
  MessageCircle,
  UserPlus,
  UserMinus,
  Share2,
  MoreHorizontal,
  Calendar,
  Instagram,
  Twitter,
  Link2,
  ExternalLink,
  Loader2,
  Ban,
  Flag,
} from 'lucide-react';
import { NeuButton } from './NeuButton';
import { VerificationBadge, RoleBadge, KycStatusBadge } from './VerificationBadge';
import { UserReportFlow } from './UserReportFlow';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFollow } from '@/hooks/useFollow';
import { getFollowerIds, getFollowingIds } from '@/services/follow.service';
import { getProfileByUserId, type ProfileRow, type ProfileSocialLinks } from '@/services/profile.service';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PublicProfileProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  onMessage?: (userId: string) => void;
}

interface UserRole {
  role: 'user' | 'creator' | 'moderator' | 'admin';
}

const TikTokIcon = ({ className }: { className?: string }) => (
  <span className={cn('font-bold text-sm', className)}>TT</span>
);

const socialLinkConfig: { key: keyof ProfileSocialLinks; label: string; baseUrl: string; Icon: React.ElementType }[] = [
  { key: 'instagram', label: 'Instagram', baseUrl: 'https://instagram.com/', Icon: Instagram },
  { key: 'twitter', label: 'X', baseUrl: 'https://x.com/', Icon: Twitter },
  { key: 'tiktok', label: 'TikTok', baseUrl: 'https://tiktok.com/@', Icon: TikTokIcon },
  { key: 'youtube', label: 'YouTube', baseUrl: 'https://youtube.com/', Icon: ExternalLink },
  { key: 'website', label: 'Website', baseUrl: '', Icon: Link2 },
];

export const PublicProfile: React.FC<PublicProfileProps> = ({
  userId,
  isOpen,
  onClose,
  onMessage,
}) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [listMode, setListMode] = useState<'followers' | 'following' | null>(null);
  const [listUsers, setListUsers] = useState<ProfileRow[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [showReportFlow, setShowReportFlow] = useState(false);
  const [showBlockConfirm, setShowBlockConfirm] = useState(false);
  const [showBlockAndReportConfirm, setShowBlockAndReportConfirm] = useState(false);
  const [blockLoading, setBlockLoading] = useState(false);

  const follow = useFollow({
    creatorId: userId,
    onToggle: (_creatorId, isFollowing) => {
      setProfile(prev => prev ? {
        ...prev,
        followers_count: isFollowing ? (prev.followers_count ?? 0) + 1 : Math.max(0, (prev.followers_count ?? 0) - 1),
      } : null);
    },
  });

  const loadProfile = useCallback(async () => {
    if (!userId || !isOpen) return;
    setIsLoading(true);
    setIsOwnProfile(user?.id === userId);
    try {
      const [profileData, roleRes] = await Promise.all([
        getProfileByUserId(userId),
        supabase.from('user_roles').select('role').eq('user_id', userId).maybeSingle(),
      ]);
      if (profileData) setProfile(profileData);
      if (roleRes.data) setUserRole(roleRes.data as UserRole);
    } catch {
      toast.error('Failed to load profile');
    } finally {
      setIsLoading(false);
    }
  }, [userId, isOpen, user?.id]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const loadList = useCallback(async (mode: 'followers' | 'following') => {
    setListMode(mode);
    setListLoading(true);
    setListUsers([]);
    try {
      const ids = mode === 'followers'
        ? await getFollowerIds(userId)
        : await getFollowingIds(userId);
      if (ids.length === 0) {
        setListLoading(false);
        return;
      }
      const profiles = await Promise.all(ids.map(id => getProfileByUserId(id)));
      setListUsers(profiles.filter((p): p is ProfileRow => p != null));
    } catch {
      toast.error('Failed to load list');
    } finally {
      setListLoading(false);
    }
  }, [userId]);

  const handleFollow = () => {
    follow.toggleFollow(userId);
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: profile?.display_name || profile?.username || 'Profile',
        url: `${window.location.origin}/profile/${encodeURIComponent(profile?.username || '')}`,
      });
    } catch {
      await navigator.clipboard.writeText(`${window.location.origin}/profile/${encodeURIComponent(profile?.username || '')}`);
      toast.success('Profile link copied!');
    }
  };

  const handleReport = () => {
    setShowReportFlow(true);
  };

  const handleBlockClick = () => {
    setShowBlockConfirm(true);
  };

  const performBlock = async (): Promise<boolean> => {
    if (!user) return false;
    setBlockLoading(true);
    try {
      const { error } = await supabase.from('blocked_users').insert({
        user_id: user.id,
        blocked_user_id: userId,
        block_type: 'block',
      });
      if (error) throw error;
      toast.success('User blocked. They can no longer see your content or message you.');
      return true;
    } catch (e: unknown) {
      console.error(e);
      const msg = (e as { message?: string })?.message ?? '';
      if (msg.includes('duplicate') || msg.includes('unique')) {
        toast.info('You have already blocked this user.');
        return true;
      }
      toast.error('Failed to block user');
      return false;
    } finally {
      setBlockLoading(false);
    }
  };

  const handleBlockConfirm = async () => {
    const ok = await performBlock();
    if (ok) {
      setShowBlockConfirm(false);
      onClose();
    }
  };

  const handleBlockAndReportClick = () => {
    setShowBlockAndReportConfirm(true);
  };

  const handleBlockAndReportConfirm = async () => {
    const ok = await performBlock();
    setShowBlockAndReportConfirm(false);
    if (ok) {
      setShowReportFlow(true);
    }
  };

  const openSocialLink = (key: keyof ProfileSocialLinks, value: string) => {
    const config = socialLinkConfig.find(c => c.key === key);
    if (!config) return;
    let url = value;
    if (key === 'website') {
      url = value.startsWith('http') ? value : `https://${value}`;
    } else if (config.baseUrl) {
      const handle = value.replace(/^@/, '').replace(/^https?:\/\/[^/]+\//, '');
      url = config.baseUrl + handle;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const displayName = profile?.display_name || profile?.username || 'User';
  const username = profile?.username || 'user';
  const avatarUrl = profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${username}`;
  const coverUrl = profile?.cover_photo_url || null;
  const isVerified = profile?.is_verified || false;
  const kycStatus = (profile?.kyc_status as 'pending' | 'submitted' | 'verified' | 'rejected') || 'pending';
  const role = userRole?.role || 'user';
  const socialLinks = (profile?.social_links || {}) as ProfileSocialLinks;
  const hasSocialLinks = Object.values(socialLinks).some(Boolean);

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col overflow-hidden">
        <div className="relative">
          {/* Banner - use cover if available */}
          <div className="h-32 bg-gradient-to-br from-primary/30 via-icoin/20 to-primary/10 overflow-hidden">
            {coverUrl && (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            )}
          </div>

          <NeuButton onClick={onClose} size="sm" className="absolute top-4 left-4">
            <X className="w-5 h-5" />
          </NeuButton>

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
              {!isOwnProfile && user && (
                <>
                  <DropdownMenuItem onClick={handleBlockClick}>
                    <Ban className="w-4 h-4 mr-2" />
                    Block User
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleReport} className="text-destructive">
                    <Flag className="w-4 h-4 mr-2" />
                    Report User
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleBlockAndReportClick} className="text-destructive">
                    <Ban className="w-4 h-4 mr-2" />
                    Block and Report
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="absolute -bottom-16 left-1/2 -translate-x-1/2">
            <div className="relative">
              <div className="w-32 h-32 rounded-full neu-card overflow-hidden border-4 border-background">
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              </div>
              {isVerified && (
                <div className="absolute bottom-2 right-2 w-8 h-8 rounded-full bg-background flex items-center justify-center">
                  <VerificationBadge type="verified" size="md" />
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pt-20 pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>
          ) : (
            <>
              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 mb-1 flex-wrap">
                  <h1 className="font-display text-2xl font-bold">{displayName}</h1>
                  {isVerified && <VerificationBadge type="verified" size="lg" />}
                  {role === 'creator' && <VerificationBadge type="creator" size="lg" />}
                  {role === 'admin' && <VerificationBadge type="admin" size="lg" />}
                  {role === 'moderator' && <VerificationBadge type="moderator" size="lg" />}
                </div>
                <p className="text-muted-foreground mb-2">@{username}</p>
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <RoleBadge role={role} />
                  {kycStatus === 'verified' && <KycStatusBadge status="verified" />}
                </div>
              </div>

              {profile?.bio && (
                <p className="text-center text-sm text-foreground/80 mb-4 max-w-xs mx-auto">
                  {profile.bio}
                </p>
              )}

              {/* Social links */}
              {hasSocialLinks && (
                <div className="flex items-center justify-center gap-3 mb-6 flex-wrap">
                  {socialLinkConfig.map(({ key, label, Icon }) => {
                    const value = socialLinks[key];
                    if (!value) return null;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => openSocialLink(key, value)}
                        className="w-10 h-10 rounded-full bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                        title={label}
                      >
                        <Icon className="w-5 h-5 text-foreground" />
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Stats - tappable to open lists */}
              <div className="grid grid-cols-4 gap-2 mb-6">
                <button
                  type="button"
                  onClick={() => loadList('followers')}
                  className="neu-inset rounded-xl p-3 text-center hover:opacity-90 transition-opacity"
                >
                  <p className="text-lg font-bold text-foreground">{profile?.followers_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Followers</p>
                </button>
                <button
                  type="button"
                  onClick={() => loadList('following')}
                  className="neu-inset rounded-xl p-3 text-center hover:opacity-90 transition-opacity"
                >
                  <p className="text-lg font-bold text-foreground">{profile?.following_count ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Following</p>
                </button>
                <div className="neu-inset rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{profile?.total_likes ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Likes</p>
                </div>
                <div className="neu-inset rounded-xl p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{profile?.total_views ?? 0}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
              </div>

              {!isOwnProfile && (
                <div className="flex gap-3 mb-6">
                  <Button
                    onClick={handleFollow}
                    disabled={follow.isLoading}
                    className={cn(
                      'flex-1 gap-2',
                      follow.isFollowing ? 'bg-muted text-foreground' : 'bg-primary text-primary-foreground'
                    )}
                  >
                    {follow.isFollowing ? (
                      <>
                        <UserMinus className="w-4 h-4" />
                        Unfollow
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        Follow
                      </>
                    )}
                  </Button>
                  <Button onClick={() => onMessage?.(userId)} variant="outline" className="flex-1 gap-2">
                    <MessageCircle className="w-4 h-4" />
                    Message
                  </Button>
                </div>
              )}

              {role === 'creator' && (
                <div className="neu-card rounded-2xl p-4 mb-4">
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <VerificationBadge type="creator" size="sm" showTooltip={false} />
                    Creator Stats
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-icoin">{profile?.total_views ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Total Views</p>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <p className="text-lg font-bold text-primary">{profile?.total_likes ?? 0}</p>
                      <p className="text-xs text-muted-foreground">Total Likes</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Calendar className="w-4 h-4 shrink-0" />
                <span>Joined {new Date(profile?.created_at || '').toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
              </div>
            </>
          )}
        </div>

        {/* Followers / Following list modal */}
        {listMode && (
          <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h2 className="font-display text-lg font-bold capitalize">{listMode}</h2>
              <NeuButton onClick={() => setListMode(null)} size="sm">
                <X className="w-5 h-5" />
              </NeuButton>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {listLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
              ) : listUsers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No {listMode} yet.</p>
              ) : (
                <ul className="space-y-2">
                  {listUsers.map((p) => {
                    const name = p.display_name || p.username || 'User';
                    const uname = p.username || 'user';
                    const av = p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uname}`;
                    return (
                      <li
                        key={p.user_id}
                        className="flex items-center gap-3 p-3 rounded-xl neu-inset"
                      >
                        <img
                          src={av}
                          alt={name}
                          className="w-10 h-10 rounded-full object-cover shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{name}</p>
                          <p className="text-sm text-muted-foreground truncate">@{uname}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}

        <UserReportFlow
          isOpen={showReportFlow}
          onClose={() => setShowReportFlow(false)}
          reportedUserId={userId}
          reportedUsername={profile?.username ?? undefined}
          onReportSubmitted={onClose}
        />

        <AlertDialog open={showBlockConfirm} onOpenChange={setShowBlockConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Block {displayName}?</AlertDialogTitle>
              <AlertDialogDescription>
                They won't be able to see your content, find your profile, or message you. You can unblock them later from Settings.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={blockLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleBlockConfirm();
                }}
                disabled={blockLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {blockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                {blockLoading ? 'Blocking…' : 'Block'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={showBlockAndReportConfirm} onOpenChange={setShowBlockAndReportConfirm}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Block and report {displayName}?</AlertDialogTitle>
              <AlertDialogDescription>
                They will be blocked and you can submit a report so we can review. You can add details in the next step.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={blockLoading}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  handleBlockAndReportConfirm();
                }}
                disabled={blockLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {blockLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flag className="w-4 h-4" />}
                {blockLoading ? 'Blocking…' : 'Block and continue to report'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </SwipeDismissOverlay>
  );
};
