/**
 * Live streaming service: list streams, create/end stream, comments, viewer join/leave.
 */
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type LiveStreamRow = Database['public']['Tables']['live_streams']['Row'];
type LiveStreamInsert = Database['public']['Tables']['live_streams']['Insert'];
type LiveStreamCommentRow = Database['public']['Tables']['live_stream_comments']['Row'];
type LiveStreamCommentInsert = Database['public']['Tables']['live_stream_comments']['Insert'];

export interface LiveStreamWithHost extends LiveStreamRow {
  host_username: string | null;
  host_avatar_url: string | null;
}

export interface LiveStreamCommentWithUser extends LiveStreamCommentRow {
  username: string | null;
  avatar_url: string | null;
}

/**
 * Fetch all currently live streams with host profile (username, avatar).
 */
export async function fetchLiveStreams(): Promise<LiveStreamWithHost[]> {
  const { data: streams, error } = await supabase
    .from('live_streams')
    .select('*')
    .eq('status', 'live')
    .order('started_at', { ascending: false });

  if (error) {
    console.error('[LiveService] fetchLiveStreams error:', error);
    return [];
  }
  if (!streams?.length) return [];

  const hostIds = [...new Set(streams.map((s) => s.host_id))];
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('user_id, username, avatar_url')
    .in('user_id', hostIds);

  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  return streams.map((row) => {
    const p = profileByUserId.get(row.host_id);
    return {
      ...row,
      host_username: p?.username ?? null,
      host_avatar_url: p?.avatar_url ?? null,
    } as LiveStreamWithHost;
  });
}

/**
 * Fetch a single stream by id with host profile.
 */
export async function fetchStreamById(
  streamId: string
): Promise<LiveStreamWithHost | null> {
  const { data: stream, error } = await supabase
    .from('live_streams')
    .select('*')
    .eq('id', streamId)
    .maybeSingle();

  if (error) {
    console.error('[LiveService] fetchStreamById error:', error);
    return null;
  }
  if (!stream) return null;

  const { data: profile } = await supabase
    .from('public_profiles')
    .select('username, avatar_url')
    .eq('user_id', stream.host_id)
    .maybeSingle();

  return {
    ...stream,
    host_username: profile?.username ?? null,
    host_avatar_url: profile?.avatar_url ?? null,
  } as LiveStreamWithHost;
}

/**
 * Create a new live stream (host goes live).
 */
export async function createStream(
  hostId: string,
  params: {
    title: string;
    thumbnailUrl?: string | null;
    allowComments?: boolean;
    allowGifts?: boolean;
  }
): Promise<{ data: LiveStreamRow | null; error: Error | null }> {
  const insert: LiveStreamInsert = {
    host_id: hostId,
    title: params.title,
    thumbnail_url: params.thumbnailUrl ?? null,
    status: 'live',
    allow_comments: params.allowComments ?? true,
    allow_gifts: params.allowGifts ?? true,
  };
  const { data, error } = await supabase
    .from('live_streams')
    .insert(insert)
    .select()
    .single();

  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as LiveStreamRow, error: null };
}

/**
 * End a live stream (host ends broadcast).
 */
export async function endStream(
  streamId: string,
  hostId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('live_streams')
    .update({
      status: 'ended',
      ended_at: new Date().toISOString(),
    })
    .eq('id', streamId)
    .eq('host_id', hostId);

  return { error: error as unknown as Error };
}

/**
 * Fetch comments for a stream (with commenter profile).
 */
export async function fetchStreamComments(
  streamId: string,
  limit = 100
): Promise<LiveStreamCommentWithUser[]> {
  const { data: comments, error } = await supabase
    .from('live_stream_comments')
    .select('*')
    .eq('stream_id', streamId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('[LiveService] fetchStreamComments error:', error);
    return [];
  }
  if (!comments?.length) return [];

  const userIds = [...new Set(comments.map((c) => c.user_id))];
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('user_id, username, avatar_url')
    .in('user_id', userIds);

  const profileByUserId = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  );

  return comments.map((row) => {
    const p = profileByUserId.get(row.user_id);
    return {
      ...row,
      username: p?.username ?? null,
      avatar_url: p?.avatar_url ?? null,
    } as LiveStreamCommentWithUser[];
  });
}

/**
 * Post a comment (or gift) on a live stream.
 */
export async function postStreamComment(
  streamId: string,
  userId: string,
  params: {
    message: string;
    isGift?: boolean;
    giftAmount?: number;
  }
): Promise<{ data: LiveStreamCommentRow | null; error: Error | null }> {
  const insert: LiveStreamCommentInsert = {
    stream_id: streamId,
    user_id: userId,
    message: params.message ?? '',
    is_gift: params.isGift ?? false,
    gift_amount: params.giftAmount ?? null,
  };
  const { data, error } = await supabase
    .from('live_stream_comments')
    .insert(insert)
    .select()
    .single();

  if (error) return { data: null, error: error as unknown as Error };
  return { data: data as LiveStreamCommentRow, error: null };
}

/**
 * Join a stream as a viewer (increments viewer count).
 */
export async function joinStream(
  streamId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from('live_stream_viewers').upsert(
    { stream_id: streamId, user_id: userId },
    { onConflict: 'stream_id,user_id' }
  );
  return { error: error as unknown as Error };
}

/**
 * Leave a stream (decrements viewer count).
 */
export async function leaveStream(
  streamId: string,
  userId: string
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from('live_stream_viewers')
    .delete()
    .eq('stream_id', streamId)
    .eq('user_id', userId);
  return { error: error as unknown as Error };
}
