/**
 * useFriendsFeed – Friends feed from backend.
 * Returns posts from people you follow (user_content for followed users) with refresh support.
 */
import { useState, useCallback, useEffect } from 'react';
import type { VideoTheme } from '@/components/ui/Neu3DButton';
import { useAuth } from '@/contexts/AuthContext';
import { fetchFriendsFeed } from '@/services/friendsFeed.service';

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

export function useFriendsFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<FriendPost[]>([]);
  const [followingCount, setFollowingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
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
    fromBackend: true,
  };
}
