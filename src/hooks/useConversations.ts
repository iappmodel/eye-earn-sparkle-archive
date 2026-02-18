import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { ConversationSummary } from '@/services/conversation.service';

// Mock conversations for when not logged in or as fallback
export const MOCK_CONVERSATIONS: ConversationSummary[] = [
  {
    id: 'mock-1',
    type: 'direct',
    name: null,
    last_message: 'Hey! Check out this new iMoji feature 🎨',
    last_message_at: new Date().toISOString(),
    unread_count: 2,
    muted: false,
    other_user: {
      id: 'user-1',
      username: 'sarah_creates',
      display_name: 'Sarah Chen',
      avatar_url: null,
    },
  },
  {
    id: 'mock-2',
    type: 'direct',
    name: null,
    last_message: 'That video was amazing! 🔥',
    last_message_at: new Date(Date.now() - 3600000).toISOString(),
    unread_count: 0,
    muted: false,
    other_user: {
      id: 'user-2',
      username: 'alex_music',
      display_name: 'Alex Rivera',
      avatar_url: null,
    },
  },
  {
    id: 'mock-3',
    type: 'direct',
    name: null,
    last_message: 'Can you send me the link?',
    last_message_at: new Date(Date.now() - 86400000).toISOString(),
    unread_count: 1,
    muted: false,
    other_user: {
      id: 'user-3',
      username: 'maya_art',
      display_name: 'Maya Thompson',
      avatar_url: null,
    },
  },
];

export function useConversations(userId: string | undefined, isActive: boolean) {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalUnread, setTotalUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadConversations = useCallback(async () => {
    if (!userId) {
      setConversations(MOCK_CONVERSATIONS);
      setLoading(false);
      setTotalUnread(MOCK_CONVERSATIONS.reduce((s, c) => s + c.unread_count, 0));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Get user's participations with conversation data
      const { data: participations, error: partError } = await supabase
        .from('conversation_participants')
        .select(
          `
          conversation_id,
          unread_count,
          muted,
          conversations:conversation_id (
            id,
            type,
            name,
            last_message,
            last_message_at
          )
        `
        )
        .eq('user_id', userId);

      if (partError) throw partError;

      const participationsList = participations || [];
      if (participationsList.length === 0) {
        setConversations([]);
        setTotalUnread(0);
        setLoading(false);
        return;
      }

      const convIds = participationsList
        .map((p: any) => p.conversations?.id)
        .filter(Boolean) as string[];

      // 2. Get other participants for each conversation (batch)
      const { data: otherParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id, user_id')
        .in('conversation_id', convIds)
        .neq('user_id', userId);

      const otherUserIds = [...new Set((otherParticipants || []).map((p) => p.user_id))];

      // 3. Fetch profiles for other users (batch)
      let profilesMap: Record<string, { username: string | null; display_name: string | null; avatar_url: string | null }> = {};
      if (otherUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from('public_profiles')
          .select('user_id, username, display_name, avatar_url')
          .in('user_id', otherUserIds);

        profilesMap = (profiles || []).reduce(
          (acc, p) => ({
            ...acc,
            [p.user_id]: {
              username: p.username,
              display_name: p.display_name,
              avatar_url: p.avatar_url,
            },
          }),
          {}
        );
      }

      // Map conversation_id -> other user_id (for direct; for group, we take first other)
      const convToOtherUser: Record<string, string> = {};
      ;(otherParticipants || []).forEach((p: { conversation_id: string; user_id: string }) => {
        if (!convToOtherUser[p.conversation_id]) {
          convToOtherUser[p.conversation_id] = p.user_id;
        }
      });

      // Build conversation list
      const result: ConversationSummary[] = participationsList
        .map((p: any) => {
          const conv = p.conversations;
          if (!conv) return null;

          const otherUserId = convToOtherUser[conv.id];
          const profile = otherUserId ? profilesMap[otherUserId] : null;

          return {
            id: conv.id,
            type: conv.type,
            name: conv.name,
            last_message: conv.last_message,
            last_message_at: conv.last_message_at,
            unread_count: p.unread_count ?? 0,
            muted: p.muted ?? false,
            other_user:
              conv.type === 'direct' && otherUserId
                ? {
                    id: otherUserId,
                    username: profile?.username ?? null,
                    display_name: profile?.display_name ?? null,
                    avatar_url: profile?.avatar_url ?? null,
                  }
                : undefined,
          } as ConversationSummary;
        })
        .filter(Boolean) as ConversationSummary[];

      // Sort by last_message_at descending
      result.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });

      setConversations(result);
      setTotalUnread(result.reduce((s, c) => s + (c.muted ? 0 : c.unread_count), 0));
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
      // Never surface mock data to logged-in users (e.g. on transient errors in prod)
      if (!userId) {
        setConversations(MOCK_CONVERSATIONS);
        setTotalUnread(MOCK_CONVERSATIONS.reduce((s, c) => s + c.unread_count, 0));
      }
      // When userId is set, leave conversations/totalUnread unchanged so UI shows error + previous or empty list
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (isActive) {
      loadConversations();
    }
  }, [isActive, loadConversations]);

  // Real-time subscription
  useEffect(() => {
    if (!isActive || !userId) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversations' },
        loadConversations
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_participants' },
        () => loadConversations()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isActive, userId, loadConversations]);

  return {
    conversations,
    totalUnread,
    loading,
    error,
    refresh: loadConversations,
  };
}
