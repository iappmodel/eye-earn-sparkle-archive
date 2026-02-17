/**
 * Profile Service – CRUD, avatar/cover uploads, and profile lookup by username.
 */
import { supabase } from '@/integrations/supabase/client';

const AVATAR_PATH_PREFIX = 'avatars';
const COVER_PATH_PREFIX = 'covers';
const BUCKET = 'content-uploads';

export interface ProfileSocialLinks {
  instagram?: string;
  twitter?: string;
  tiktok?: string;
  website?: string;
  youtube?: string;
  linkedin?: string;
}

export interface ProfileRow {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  cover_photo_url: string | null;
  bio: string | null;
  phone_number: string | null;
  phone_verified: boolean | null;
  calibration_data?: Record<string, unknown> | null;
  vicoin_balance: number | null;
  icoin_balance: number | null;
  total_views: number | null;
  total_likes: number | null;
  followers_count: number | null;
  following_count: number | null;
  is_verified: boolean | null;
  kyc_status: string | null;
  social_links: ProfileSocialLinks | null;
  show_contributor_badges: boolean | null;
  show_timed_interactions: boolean | null;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProfileUpdateInput {
  display_name?: string | null;
  username?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  cover_photo_url?: string | null;
  social_links?: ProfileSocialLinks | null;
  phone_number?: string | null;
  show_contributor_badges?: boolean | null;
  show_timed_interactions?: boolean | null;
}

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export function isValidUsername(username: string): boolean {
  return USERNAME_REGEX.test(username);
}

/**
 * Get profile by user_id.
 */
export async function getProfileByUserId(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    console.error('[ProfileService] getProfileByUserId error:', error);
    return null;
  }
  return data as ProfileRow | null;
}

/**
 * Get profile by username (case-insensitive lookup).
 */
export async function getProfileByUsername(username: string): Promise<ProfileRow | null> {
  if (!username.trim()) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .ilike('username', username.trim())
    .maybeSingle();

  if (error) {
    console.error('[ProfileService] getProfileByUsername error:', error);
    return null;
  }
  return data as ProfileRow | null;
}

/**
 * Check if a username is available (or belongs to the given user).
 */
export async function isUsernameAvailable(
  username: string,
  currentUserId?: string
): Promise<{ available: boolean; error?: string }> {
  if (!isValidUsername(username)) {
    return { available: false, error: 'Username must be 3–30 characters, letters, numbers, and underscores only.' };
  }

  const existing = await getProfileByUsername(username);
  if (!existing) return { available: true };
  if (currentUserId && existing.user_id === currentUserId) return { available: true };
  return { available: false, error: 'This username is already taken.' };
}

/**
 * Update profile (only provided fields).
 */
export async function updateProfile(
  userId: string,
  input: ProfileUpdateInput
): Promise<{ success: boolean; error?: string }> {
  const payload: Record<string, unknown> = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from('profiles')
    .update(payload)
    .eq('user_id', userId);

  if (error) {
    console.error('[ProfileService] updateProfile error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Upload avatar image to storage and return public URL.
 */
export async function uploadAvatar(userId: string, file: File): Promise<{ url: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${AVATAR_PATH_PREFIX}/${userId}/avatar.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    console.error('[ProfileService] uploadAvatar error:', error);
    return { error: error.message };
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

/**
 * Upload cover image to storage and return public URL.
 */
export async function uploadCover(userId: string, file: File): Promise<{ url: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${COVER_PATH_PREFIX}/${userId}/cover.${ext}`;

  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: true,
    contentType: file.type,
  });

  if (error) {
    console.error('[ProfileService] uploadCover error:', error);
    return { error: error.message };
  }

  const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return { url: publicUrl };
}

/**
 * Log profile update to account_activity_logs.
 */
export async function logProfileUpdate(
  userId: string,
  updatedFields: string[]
): Promise<void> {
  await supabase.from('account_activity_logs').insert({
    user_id: userId,
    activity_type: 'profile_update',
    status: 'success',
    details: { updated_fields: updatedFields },
  });
}
