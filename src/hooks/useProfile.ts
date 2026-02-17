/**
 * useProfile – Load any profile by userId or username with optional refetch.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getProfileByUserId, getProfileByUsername, type ProfileRow } from '@/services/profile.service';

export interface UseProfileOptions {
  /** Load by user ID (takes precedence over username) */
  userId?: string | null;
  /** Load by username (used when userId is not set) */
  username?: string | null;
  /** Only fetch when this is true */
  enabled?: boolean;
}

export interface UseProfileResult {
  profile: ProfileRow | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  isOwnProfile: boolean;
}

export function useProfile(options: UseProfileOptions = {}): UseProfileResult {
  const { user, profile: authProfile } = useAuth();
  const { userId: targetUserId, username: targetUsername, enabled = true } = options;

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const currentUserId = user?.id ?? authProfile?.user_id;
  const isOwnProfile = !!currentUserId && !!targetUserId && currentUserId === targetUserId;

  const fetchProfile = useCallback(async () => {
    if (!enabled) {
      setProfile(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (targetUserId) {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getProfileByUserId(targetUserId);
        setProfile(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    if (targetUsername) {
      setIsLoading(true);
      setError(null);
      try {
        const data = await getProfileByUsername(targetUsername);
        setProfile(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load profile');
        setProfile(null);
      } finally {
        setIsLoading(false);
      }
      return;
    }

    setProfile(null);
    setError(null);
    setIsLoading(false);
  }, [enabled, targetUserId, targetUsername]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // When viewing own profile by userId, prefer auth profile and sync
  useEffect(() => {
    if (!enabled || !targetUserId || !isOwnProfile) return;
    if (authProfile && authProfile.user_id === targetUserId) {
      setProfile(authProfile as unknown as ProfileRow);
    }
  }, [enabled, targetUserId, isOwnProfile, authProfile]);

  return {
    profile,
    isLoading,
    error,
    refetch: fetchProfile,
    isOwnProfile,
  };
}
