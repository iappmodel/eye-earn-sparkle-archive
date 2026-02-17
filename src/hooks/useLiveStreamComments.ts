import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  fetchStreamComments,
  postStreamComment,
  type LiveStreamCommentWithUser,
} from '@/services/live.service';
import type { Database } from '@/integrations/supabase/types';

type CommentRow = Database['public']['Tables']['live_stream_comments']['Row'];

export function useLiveStreamComments(streamId: string | undefined, userId: string | undefined) {
  const [comments, setComments] = useState<LiveStreamCommentWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    if (!streamId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchStreamComments(streamId);
      setComments(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load comments'));
    } finally {
      setLoading(false);
    }
  }, [streamId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: new comments for this stream
  useEffect(() => {
    if (!streamId) return;

    const channel = supabase
      .channel(`live-stream-comments:${streamId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'live_stream_comments',
          filter: `stream_id=eq.${streamId}`,
        },
        async (payload) => {
          const row = payload.new as CommentRow;
          // Fetch commenter profile for display
          const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('user_id', row.user_id)
            .maybeSingle();
          setComments((prev) => [
            ...prev,
            {
              ...row,
              username: profile?.username ?? null,
              avatar_url: profile?.avatar_url ?? null,
            } as LiveStreamCommentWithUser,
          ]);
        }
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [streamId]);

  const sendComment = useCallback(
    async (message: string, options?: { isGift?: boolean; giftAmount?: number }) => {
      if (!streamId || !userId?.trim() || !message.trim()) return;
      setSending(true);
      setError(null);
      try {
        const { error: err } = await postStreamComment(streamId, userId, {
          message: message.trim(),
          isGift: options?.isGift,
          giftAmount: options?.giftAmount,
        });
        if (err) setError(err);
      } finally {
        setSending(false);
      }
    },
    [streamId, userId]
  );

  return { comments, loading, sending, error, refetch: load, sendComment };
}
