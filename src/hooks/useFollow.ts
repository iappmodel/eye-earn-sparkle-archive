/**
 * useFollow – Follow/unfollow creators with Supabase persistence and offline support.
 * Shell mode for mock content (non-UUID creator IDs); full persistence for real users.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useOffline } from '@/contexts/OfflineContext';
import {
  checkFollowStatus,
  checkFollowStatusBatch,
  toggleFollow as toggleFollowService,
  isValidFollowTarget,
} from '@/services/follow.service';
import { toast } from 'sonner';


export interface UseFollowOptions {
  /** Optional creator ID for single-creator mode */
  creatorId?: string | null;
  /** Optional list of creator IDs for batch status */
  creatorIds?: string[];
  /** Called after successful follow/unfollow */
  onToggle?: (creatorId: string, isFollowing: boolean) => void;
  /** Skip fetching initial status (e.g. for mock data) */
  skipFetch?: boolean;
}

export interface UseFollowResult {
  /** Whether current user follows the creator (or map for batch) */
  isFollowing: boolean | Record<string, boolean>;
  /** Toggle follow for a creator */
  toggleFollow: (creatorId: string) => Promise<void>;
  /** Check if a creator ID supports persistence */
  isPersistable: (creatorId: string) => boolean;
  /** Loading state for initial fetch */
  isLoading: boolean;
  /** Refetch follow status */
  refetch: () => Promise<void>;
}

/**
 * Hook for following a single creator.
 */
export function useFollow(options: UseFollowOptions = {}): UseFollowResult {
  const { user, profile, refreshProfile } = useAuth();
  const currentUserId = user?.id ?? profile?.user_id;
  const { isOnline, queueAction } = useOffline();

  const { creatorId, onToggle, skipFetch = false } = options;
  const [dbFollowing, setDbFollowing] = useState(false);
  const [shellFollows, setShellFollows] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(!skipFetch);
  const isFollowing = creatorId && !isValidFollowTarget(creatorId)
    ? (shellFollows[creatorId] ?? false)
    : dbFollowing;

  const isPersistable = useCallback((id: string) => isValidFollowTarget(id), []);

  const refetch = useCallback(async () => {
    if (!creatorId || !currentUserId || !isPersistable(creatorId)) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const { isFollowing: status } = await checkFollowStatus(currentUserId, creatorId);
    setDbFollowing(status);
    setIsLoading(false);
  }, [creatorId, currentUserId, isPersistable]);

  useEffect(() => {
    if (skipFetch || !creatorId || !currentUserId || !isPersistable(creatorId)) {
      setIsLoading(false);
      return;
    }
    refetch();
  }, [creatorId, currentUserId, skipFetch, isPersistable, refetch]);

  const toggleFollow = useCallback(
    async (targetCreatorId: string) => {
      if (!currentUserId) {
        toast.error('Sign in to follow creators');
        return;
      }

      if (!isPersistable(targetCreatorId)) {
        // Shell mode: persist in local map across creator switches
        const next = !(shellFollows[targetCreatorId] ?? false);
        setShellFollows(prev => ({ ...prev, [targetCreatorId]: next }));
        if (navigator.vibrate) navigator.vibrate(10);
        toast.success(next ? 'Followed!' : 'Unfollowed');
        onToggle?.(targetCreatorId, next);
        return;
      }

      if (targetCreatorId === currentUserId) {
        toast.info("You can't follow yourself");
        return;
      }

      const prevState = targetCreatorId === creatorId ? dbFollowing : false;
      const nextState = !prevState;
      setDbFollowing(prev => (targetCreatorId === creatorId ? nextState : prev));

      if (!isOnline) {
        queueAction('follow', {
          action: nextState ? 'follow' : 'unfollow',
          follower_id: currentUserId,
          following_id: targetCreatorId,
        });
        toast.success(nextState ? 'Followed! (syncing when online)' : 'Unfollowed (syncing when online)');
        onToggle?.(targetCreatorId, nextState);
        return;
      }

      const result = await toggleFollowService(currentUserId, targetCreatorId, prevState);

      if (result.success) {
        if (targetCreatorId === creatorId) {
          setDbFollowing(result.isFollowing ?? nextState);
        }
        if (navigator.vibrate) navigator.vibrate(10);
        toast.success(result.isFollowing ? 'Followed!' : 'Unfollowed');
        await refreshProfile();
        onToggle?.(targetCreatorId, result.isFollowing ?? nextState);
      } else {
        if (targetCreatorId === creatorId) setDbFollowing(prevState);
        toast.error(result.error ?? 'Failed to update follow');
      }
    },
    [currentUserId, creatorId, dbFollowing, shellFollows, isOnline, queueAction, refreshProfile, onToggle, isPersistable]
  );

  return {
    isFollowing,
    toggleFollow,
    isPersistable,
    isLoading,
    refetch,
  };
}

/**
 * Hook for following multiple creators (e.g. feed with many posts).
 */
export function useFollowBatch(options: UseFollowOptions = {}): Omit<UseFollowResult, 'isFollowing'> & { isFollowing: Record<string, boolean> } {
  const { user, profile, refreshProfile } = useAuth();
  const currentUserId = user?.id ?? profile?.user_id;
  const { isOnline, queueAction } = useOffline();

  const { creatorIds = [], onToggle, skipFetch = false } = options;
  const [isFollowing, setIsFollowing] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(!skipFetch);

  const isPersistable = useCallback((id: string) => isValidFollowTarget(id), []);

  const refetch = useCallback(async () => {
    if (!currentUserId || creatorIds.length === 0) {
      setIsLoading(false);
      return;
    }
    const validIds = creatorIds.filter(isPersistable);
    if (validIds.length === 0) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const statuses = await checkFollowStatusBatch(currentUserId, validIds);
    setIsFollowing(statuses);
    setIsLoading(false);
  }, [currentUserId, creatorIds, isPersistable]);

  useEffect(() => {
    if (skipFetch || !currentUserId || creatorIds.length === 0) {
      setIsLoading(false);
      return;
    }
    refetch();
  }, [currentUserId, creatorIds.join(','), skipFetch, refetch]);

  const toggleFollow = useCallback(
    async (targetCreatorId: string) => {
      if (!currentUserId) {
        toast.error('Sign in to follow creators');
        return;
      }

      if (!isPersistable(targetCreatorId)) {
        setIsFollowing(prev => ({ ...prev, [targetCreatorId]: !(prev[targetCreatorId] ?? false) }));
        if (navigator.vibrate) navigator.vibrate(10);
        toast.success(isFollowing[targetCreatorId] ? 'Unfollowed' : 'Followed!');
        onToggle?.(targetCreatorId, !(isFollowing[targetCreatorId] ?? false));
        return;
      }

      if (targetCreatorId === currentUserId) {
        toast.info("You can't follow yourself");
        return;
      }

      const current = isFollowing[targetCreatorId] ?? false;
      const nextState = !current;
      setIsFollowing(prev => ({ ...prev, [targetCreatorId]: nextState }));

      if (!isOnline) {
        queueAction('follow', {
          action: nextState ? 'follow' : 'unfollow',
          follower_id: currentUserId,
          following_id: targetCreatorId,
        });
        toast.success(nextState ? 'Followed! (syncing when online)' : 'Unfollowed (syncing when online)');
        onToggle?.(targetCreatorId, nextState);
        return;
      }

      const result = await toggleFollowService(currentUserId, targetCreatorId, current);

      if (result.success) {
        setIsFollowing(prev => ({ ...prev, [targetCreatorId]: result.isFollowing ?? nextState }));
        if (navigator.vibrate) navigator.vibrate(10);
        toast.success(result.isFollowing ? 'Followed!' : 'Unfollowed');
        await refreshProfile();
        onToggle?.(targetCreatorId, result.isFollowing ?? nextState);
      } else {
        setIsFollowing(prev => ({ ...prev, [targetCreatorId]: current }));
        toast.error(result.error ?? 'Failed to update follow');
      }
    },
    [currentUserId, isFollowing, isOnline, queueAction, refreshProfile, onToggle, isPersistable]
  );

  return {
    isFollowing,
    toggleFollow,
    isPersistable,
    isLoading,
    refetch,
  };
}
