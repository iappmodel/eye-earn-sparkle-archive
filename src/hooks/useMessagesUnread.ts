import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getTotalUnreadCount } from '@/services/conversation.service';

/**
 * Lightweight hook to get total unread message count for nav badge.
 * Subscribes to conversation_participants changes for real-time updates.
 */
export function useMessagesUnread(userId: string | undefined): number {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      return;
    }
    try {
      const total = await getTotalUnreadCount(userId);
      setCount(total);
    } catch {
      setCount(0);
    }
  }, [userId]);

  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('unread-count')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants' },
        () => fetchCount()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        () => fetchCount()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchCount]);

  return count;
}
