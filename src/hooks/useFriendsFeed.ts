/**
 * useFriendsFeed – Friends feed from backend.
 * Returns posts from people you follow (user_content for followed users) with refresh support.
 * In demo mode, returns 10 PEOPLE mockup videos.
 */
import { useState, useCallback, useEffect } from 'react';
import type { VideoTheme } from '@/components/ui/Neu3DButton';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFriendsFeed } from '@/services/friendsFeed.service';
import { isDemoMode } from '@/lib/appMode';
import { FRIENDS_VIDEOS } from '@/lib/mockupVideos';

export interface FriendPost {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  avatar: string;
  videoUrl: string;
  thumbnail: string;
  caption: string;
  likes: number;
  comments: number;
  duration: number;
  isLiked: boolean;
  isSaved: boolean;
  isFollowing: boolean;
  theme: VideoTheme;
  /** ISO date string for "2h ago" display */
  createdAt: string;
  /** Location or label, optional */
  location?: string;
}

const THEMES: VideoTheme[] = ['rose', 'emerald', 'gold', 'cyan', 'purple', 'magenta'];
const PEOPLE_NAMES = ['Alex', 'Jordan', 'Sam', 'Morgan', 'Riley', 'Casey', 'Jamie', 'Quinn', 'Avery', 'Taylor'];

function getDemoFriendsPosts(): FriendPost[] {
  return FRIENDS_VIDEOS.map((videoUrl, i) => ({
    id: `demo-friends-${i + 1}`,
    userId: `demo-user-${i + 1}`,
    username: PEOPLE_NAMES[i]?.toLowerCase() ?? `friend_${i + 1}`,
    displayName: PEOPLE_NAMES[i] ?? `Friend ${i + 1}`,
    avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 1}`,
    videoUrl,
    thumbnail: videoUrl,
    caption: `People moment #${i + 1}`,
    likes: 100 + i * 50,
    comments: 5 + i,
    duration: 15,
    isLiked: false,
    isSaved: false,
    isFollowing: true,
    theme: THEMES[i % THEMES.length],
    createdAt: new Date(Date.now() - i * 3600000).toISOString(),
  }));
}

export function useFriendsFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<FriendPost[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    if (isDemoMode) {
      setItems(getDemoFriendsPosts());
      setFollowingCount(5);
      setIsLoading(false);
      return;
    }
    if (!user?.id) {
      setItems([]);
      setFollowingCount(0);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const { posts, followingCount: count } = await fetchFriendsFeed(user.id);
      setItems(posts);
      setFollowingCount(count);
    } catch (err) {
      console.error('[useFriendsFeed] fetch error:', err);
      setItems([]);
      setFollowingCount(0);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = useCallback(async () => {
    if (isDemoMode) {
      setItems(getDemoFriendsPosts());
      return;
    }
    if (!user?.id) return;
    setIsLoading(true);
    try {
      const { posts, followingCount: count } = await fetchFriendsFeed(user.id);
      setItems(posts);
      setFollowingCount(count);
    } catch (err) {
      console.error('[useFriendsFeed] refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  return {
    items,
    isLoading,
    refresh,
    /** Number of users the current user follows. Used for empty-state UX. */
    followingCount,
    /** True when data comes from backend. */
    fromBackend: !isDemoMode,
  };
}
