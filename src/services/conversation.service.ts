import { supabase } from '@/integrations/supabase/client';

export interface ConversationParticipant {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  role: string;
}

export interface ConversationSummary {
  id: string;
  type: string;
  name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  muted: boolean;
  other_user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
  participants?: ConversationParticipant[];
}

/**
 * Create or get existing direct conversation between two users.
 * Returns the conversation ID.
 */
export async function createOrGetDirectConversation(
  currentUserId: string,
  otherUserId: string
): Promise<{ conversationId: string; isNew: boolean }> {
  // Check for existing DM (direct conversation with exactly these 2 users)
  const { data: existingParticipations } = await supabase
    .from('conversation_participants')
    .select('conversation_id')
    .eq('user_id', currentUserId);

  if (existingParticipations?.length) {
    const convIds = existingParticipations.map((p) => p.conversation_id);

    // Get conversations that are direct type and have the other user
    const { data: matchingConvs } = await supabase
      .from('conversation_participants')
      .select('conversation_id')
      .eq('user_id', otherUserId)
      .in('conversation_id', convIds);

    if (matchingConvs?.length) {
      // Get conversation type for first match
      const { data: conv } = await supabase
        .from('conversations')
        .select('id, type')
        .eq('id', matchingConvs[0].conversation_id)
        .eq('type', 'direct')
        .single();

      if (conv) {
        return { conversationId: conv.id, isNew: false };
      }
    }
  }

  // Create new direct conversation
  const { data: newConv, error: convError } = await supabase
    .from('conversations')
    .insert({ type: 'direct' })
    .select('id')
    .single();

  if (convError) throw convError;

  // Add both participants
  await supabase.from('conversation_participants').insert([
    { conversation_id: newConv.id, user_id: currentUserId, role: 'member' },
    { conversation_id: newConv.id, user_id: otherUserId, role: 'member' },
  ]);

  return { conversationId: newConv.id, isNew: true };
}

/**
 * Toggle mute state for a conversation.
 */
export async function toggleConversationMute(
  conversationId: string,
  userId: string,
  muted: boolean
): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ muted })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) throw error;
}

/**
 * Mark all messages in a conversation as read.
 */
export async function markConversationRead(
  conversationId: string,
  userId: string
): Promise<void> {
  const { error } = await supabase
    .from('conversation_participants')
    .update({ unread_count: 0, last_read_at: new Date().toISOString() })
    .eq('conversation_id', conversationId)
    .eq('user_id', userId);

  if (error) throw error;
}

export interface GroupMemberInfo {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'member';
}

/**
 * Load group chat members for a conversation.
 */
export async function loadGroupMembers(
  conversationId: string
): Promise<GroupMemberInfo[]> {
  const { data: participants, error } = await supabase
    .from('conversation_participants')
    .select('user_id, role')
    .eq('conversation_id', conversationId);

  if (error) throw error;
  if (!participants?.length) return [];

  const userIds = participants.map((p) => p.user_id);
  const { data: profiles } = await supabase
    .from('public_profiles')
    .select('user_id, username, display_name, avatar_url')
    .in('user_id', userIds);

  const profileMap = (profiles || []).reduce(
    (acc, p) => ({ ...acc, [p.user_id]: p }),
    {} as Record<string, { user_id: string; username: string | null; display_name: string | null; avatar_url: string | null }>
  );

  return participants.map((p) => {
    const profile = profileMap[p.user_id];
    return {
      id: p.user_id,
      userId: p.user_id,
      username: profile?.username ?? null,
      displayName: profile?.display_name ?? null,
      avatarUrl: profile?.avatar_url ?? null,
      role: (p.role === 'admin' || p.role === 'owner' ? 'admin' : 'member') as 'admin' | 'member',
    };
  });
}

/**
 * Get total unread count across all conversations.
 */
export async function getTotalUnreadCount(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('conversation_participants')
    .select('unread_count')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).reduce((sum, p) => sum + (p.unread_count || 0), 0);
}
