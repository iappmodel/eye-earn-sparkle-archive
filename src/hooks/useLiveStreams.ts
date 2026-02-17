import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import {
  fetchLiveStreams,
  type LiveStreamWithHost,
} from '@/services/live.service';

export function useLiveStreams(options?: { subscribeRealtime?: boolean }) {
  const subscribeRealtime = options?.subscribeRealtime ?? true;
  const [streams, setStreams] = useState<LiveStreamWithHost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await fetchLiveStreams();
      setStreams(list);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Failed to load live streams'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: new streams going live, stream ended, viewer_count updates
  useEffect(() => {
    if (!subscribeRealtime) return;

    const channel = supabase
      .channel('live-streams-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'live_streams' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'live_streams' },
        () => load()
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'live_streams' },
        () => load()
      )
      .subscribe();

    channelRef.current = channel;
    return () => {
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [subscribeRealtime, load]);

  return { streams, loading, error, refetch: load };
}
