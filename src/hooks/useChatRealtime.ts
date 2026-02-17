import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  media_url: string | null;
  is_ai_generated: boolean;
  read_by: string[] | null;
  created_at: string;
  updated_at: string;
  reply_to_id?: string | null;
}

export interface ParticipantRow {
  conversation_id: string;
  user_id: string;
  unread_count: number;
  last_read_at: string | null;
}

export type ConnectionStatus = 'connected' | 'reconnecting' | 'disconnected' | 'closed';

export interface UseChatRealtimeCallbacks {
  currentUserId: string | undefined;
  /** Ref to set of message IDs in this conversation (used to filter reaction events). Keep updated when messages change. */
  messageIdsRef: React.MutableRefObject<Set<string>>;
  onMessageInsert?: (message: MessageRow) => void;
  onMessageUpdate?: (message: MessageRow) => void;
  onMessageDelete?: (messageId: string) => void;
  onReactionAdd?: (messageId: string, emoji: string, userId: string) => void;
  onReactionRemove?: (messageId: string, emoji: string, userId: string) => void;
  onParticipantUpdate?: (participant: ParticipantRow) => void;
  onConnectionStatus?: (status: ConnectionStatus) => void;
}

/**
 * Single subscription to all realtime events for a conversation: messages (insert/update/delete),
 * message_reactions (insert/delete with incremental merge), conversation_participants (read receipts),
 * and connection status.
 */
export function useChatRealtime(
  conversationId: string | undefined,
  callbacks: UseChatRealtimeCallbacks
) {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    if (!conversationId) return;

    const {
      messageIdsRef,
      onMessageInsert,
      onMessageUpdate,
      onMessageDelete,
      onReactionAdd,
      onReactionRemove,
      onParticipantUpdate,
      onConnectionStatus,
    } = callbacksRef.current;

    const channel = supabase
      .channel(`chat:${conversationId}`, { config: { broadcast: { self: true } } });

    channelRef.current = channel;

    // ---- Messages ----
    channel
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as MessageRow;
          callbacksRef.current.onMessageInsert?.(msg);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as MessageRow;
          callbacksRef.current.onMessageUpdate?.(msg);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const id = (payload.old as { id: string }).id;
          callbacksRef.current.onMessageDelete?.(id);
        }
      );

    // ---- Message reactions (no filter; filter by messageIdsRef) ----
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const { message_id, emoji, user_id } = payload.new as {
            message_id: string;
            emoji: string;
            user_id: string;
          };
          if (!messageIdsRef.current.has(message_id)) return;
          callbacksRef.current.onReactionAdd?.(message_id, emoji, user_id);
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_reactions' },
        (payload) => {
          const { message_id, emoji, user_id } = payload.old as {
            message_id: string;
            emoji: string;
            user_id: string;
          };
          if (!messageIdsRef.current.has(message_id)) return;
          callbacksRef.current.onReactionRemove?.(message_id, emoji, user_id);
        }
      );

    // ---- Conversation participants (read receipts, unread) ----
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = (payload.new || payload.old) as ParticipantRow;
          if (row) callbacksRef.current.onParticipantUpdate?.(row);
        }
      );

    // ---- Connection status ----
    channel.subscribe((status, err) => {
      if (status === 'SUBSCRIBED') {
        callbacksRef.current.onConnectionStatus?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        callbacksRef.current.onConnectionStatus?.('disconnected');
      } else if (status === 'CLOSED') {
        callbacksRef.current.onConnectionStatus?.('closed');
      }
    });

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
      callbacksRef.current.onConnectionStatus?.('closed');
    };
  }, [conversationId]);
}
