import { useEffect, useRef } from 'react';
import { joinStream, leaveStream } from '@/services/live.service';

/**
 * Join a stream when the viewer opens it and leave when they close.
 * Updates viewer count via live_stream_viewers table (trigger on live_streams).
 */
export function useLiveStreamViewer(
  streamId: string | undefined,
  userId: string | undefined,
  enabled: boolean
) {
  const joinedRef = useRef(false);

  useEffect(() => {
    if (!streamId || !userId || !enabled) return;

    let mounted = true;
    joinStream(streamId, userId).then(({ error }) => {
      if (error) {
        console.warn('[useLiveStreamViewer] joinStream error:', error);
        return;
      }
      if (mounted) joinedRef.current = true;
    });

    return () => {
      mounted = false;
      if (joinedRef.current) {
        leaveStream(streamId, userId);
        joinedRef.current = false;
      }
    };
  }, [streamId, userId, enabled]);
}
