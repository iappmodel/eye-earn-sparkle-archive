/**
 * Follow Service – Persist follow/unfollow actions via Supabase user_follows table.
 * Handles validation, RLS, and count updates via triggers.
 */
import { supabase } from '@/integrations/supabase/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidFollowTarget(creatorId: string): boolean {
  return UUID_REGEX.test(creatorId);
}

export interface FollowResult {
  success: boolean;
  isFollowing?: boolean;
  error?: string;
}

/**
 * Check if the current user follows a creator.
 */
export async function checkFollowStatus(
  followerId: string,
  followingId: string
): Promise<{ isFollowing: boolean; error?: string }> {
  if (!isValidFollowTarget(followerId) || !isValidFollowTarget(followingId)) {
    return { isFollowing: false };
  }

  const { data, error } = await supabase
    .from('user_follows')
    .select('id')
    .eq('follower_id', followerId)
    .eq('following_id', followingId)
    .maybeSingle();

  if (error) {
    console.error('[FollowService] checkFollowStatus error:', error);
    return { isFollowing: false, error: error.message };
  }

  return { isFollowing: !!data };
}

/**
 * Batch check follow status for multiple creators.
 */
export async function checkFollowStatusBatch(
  followerId: string,
  followingIds: string[]
): Promise<Record<string, boolean>> {
  const validIds = followingIds.filter(id => isValidFollowTarget(id));
  if (validIds.length === 0) return {};

  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', followerId)
    .in('following_id', validIds);

  if (error) {
    console.error('[FollowService] checkFollowStatusBatch error:', error);
    return {};
  }

  const set = new Set((data ?? []).map((r: { following_id: string }) => r.following_id));
  return Object.fromEntries(validIds.map(id => [id, set.has(id)]));
}

/**
 * Follow a creator.
 */
export async function followCreator(
  followerId: string,
  followingId: string
): Promise<FollowResult> {
  if (!isValidFollowTarget(followerId) || !isValidFollowTarget(followingId)) {
    return { success: false, error: 'Invalid user ID' };
  }

  if (followerId === followingId) {
    return { success: false, error: "You can't follow yourself" };
  }

  const { error } = await supabase
    .from('user_follows')
    .insert({
      follower_id: followerId,
      following_id: followingId,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      // Unique violation - already following
      return { success: true, isFollowing: true };
    }
    console.error('[FollowService] follow error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, isFollowing: true };
}

/**
 * Unfollow a creator.
 */
export async function unfollowCreator(
  followerId: string,
  followingId: string
): Promise<FollowResult> {
  if (!isValidFollowTarget(followerId) || !isValidFollowTarget(followingId)) {
    return { success: false, error: 'Invalid user ID' };
  }

  const { error } = await supabase
    .from('user_follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);

  if (error) {
    console.error('[FollowService] unfollow error:', error);
    return { success: false, error: error.message };
  }

  return { success: true, isFollowing: false };
}

/**
 * Toggle follow state.
 */
export async function toggleFollow(
  followerId: string,
  followingId: string,
  currentState: boolean
): Promise<FollowResult> {
  if (currentState) {
    return unfollowCreator(followerId, followingId);
  }
  return followCreator(followerId, followingId);
}

/**
 * Get user IDs that follow the given user (followers).
 */
export async function getFollowerIds(userId: string, limit = 50): Promise<string[]> {
  if (!isValidFollowTarget(userId)) return [];
  const { data, error } = await supabase
    .from('user_follows')
    .select('follower_id')
    .eq('following_id', userId)
    .limit(limit);
  if (error) {
    console.error('[FollowService] getFollowerIds error:', error);
    return [];
  }
  return (data ?? []).map((r: { follower_id: string }) => r.follower_id);
}

/**
 * Get user IDs that the given user follows (following).
 */
export async function getFollowingIds(userId: string, limit = 50): Promise<string[]> {
  if (!isValidFollowTarget(userId)) return [];
  const { data, error } = await supabase
    .from('user_follows')
    .select('following_id')
    .eq('follower_id', userId)
    .limit(limit);
  if (error) {
    console.error('[FollowService] getFollowingIds error:', error);
    return [];
  }
  return (data ?? []).map((r: { following_id: string }) => r.following_id);
}
