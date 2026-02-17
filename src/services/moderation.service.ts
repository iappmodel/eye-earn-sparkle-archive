/**
 * Content moderation service – remove/hide content, notify users, and fetch content for review.
 * Used by admin/moderation UI and useAdmin when resolving flags and reports.
 */
import { supabase } from '@/integrations/supabase/client';

export type ModerationContentStatus = 'active' | 'draft' | 'pending' | 'expired' | 'rejected' | 'deleted';

export interface ContentPreview {
  id: string;
  user_id: string;
  content_type: string;
  title: string | null;
  caption: string | null;
  media_url: string | null;
  media_type: string | null;
  thumbnail_url: string | null;
  status: string;
  created_at: string;
  creator?: { username: string | null; display_name: string | null; avatar_url: string | null };
}

export interface RemoveContentResult {
  success: boolean;
  error?: string;
}

export interface NotifyModerationResult {
  success: boolean;
  notificationId?: string;
  error?: string;
}

/**
 * Fetch content by id for moderation preview. Joins with profiles when content is from user_content.
 */
export async function getContentForModeration(contentId: string): Promise<ContentPreview | null> {
  const { data, error } = await supabase
    .from('user_content')
    .select('id, user_id, content_type, title, caption, media_url, media_type, thumbnail_url, status, created_at')
    .eq('id', contentId)
    .maybeSingle();

  if (error) {
    console.error('getContentForModeration error:', error);
    return null;
  }
  if (!data) return null;

  return data as ContentPreview;
}

/**
 * Remove content (set status to 'deleted'). Caller must be moderator/admin (RLS handles this).
 */
export async function removeContent(contentId: string, _reason?: string): Promise<RemoveContentResult> {
  const { error } = await supabase
    .from('user_content')
    .update({
      status: 'deleted',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId);

  if (error) {
    console.error('removeContent error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Reject content (e.g. before publish or after review). Sets status to 'rejected'.
 */
export async function rejectContent(contentId: string, _reason?: string): Promise<RemoveContentResult> {
  const { error } = await supabase
    .from('user_content')
    .update({
      status: 'rejected',
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId);

  if (error) {
    console.error('rejectContent error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Restore content that was removed or rejected (set back to 'active' or 'draft').
 */
export async function restoreContent(contentId: string, status: 'active' | 'draft' = 'active'): Promise<RemoveContentResult> {
  const { error } = await supabase
    .from('user_content')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contentId);

  if (error) {
    console.error('restoreContent error:', error);
    return { success: false, error: error.message };
  }
  return { success: true };
}

/**
 * Notify a user about a moderation action (content removed, warning, etc.).
 * Inserts into notifications table; RLS must allow the caller (e.g. service role or moderator) to insert for any user, or use an edge function.
 */
export async function notifyUserAboutModeration(
  userId: string,
  title: string,
  body: string | null,
  type: string = 'moderation',
  data?: Record<string, unknown>
): Promise<NotifyModerationResult> {
  const { data: row, error } = await supabase
    .from('notifications')
    .insert({
      user_id: userId,
      title,
      body: body ?? null,
      type,
      data: data ?? null,
      seen: false,
    })
    .select('id')
    .single();

  if (error) {
    console.error('notifyUserAboutModeration error:', error);
    return { success: false, error: error.message };
  }
  return { success: true, notificationId: row?.id };
}

/**
 * Set content_user_id on a content_flag (e.g. after fetching content for preview).
 * Helps moderation UI show content owner without extra lookups.
 */
export async function setContentFlagOwner(flagId: string, contentUserId: string): Promise<void> {
  await supabase
    .from('content_flags')
    .update({ content_user_id: contentUserId, updated_at: new Date().toISOString() })
    .eq('id', flagId);
}

/**
 * Derive severity from report reason for queue ordering.
 */
export function severityFromReason(reason: string): 'low' | 'medium' | 'high' | 'critical' {
  const r = reason.toLowerCase();
  if (['violence', 'hate_speech', 'nudity'].some((x) => r.includes(x))) return 'high';
  if (['harassment', 'threats'].some((x) => r.includes(x))) return 'high';
  if (['spam', 'misinformation', 'copyright'].some((x) => r.includes(x))) return 'medium';
  return 'low';
}
