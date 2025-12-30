import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Search, Plus, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatScreen } from '@/components/ChatScreen';
import { formatDistanceToNow } from 'date-fns';

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  other_user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface MessagesScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Mock conversations for testing
const mockConversations: Conversation[] = [
  {
    id: 'mock-1',
    type: 'direct',
    name: null,
    last_message: 'Hey! Check out this new iMoji feature 🎨',
    last_message_at: new Date().toISOString(),
    unread_count: 2,
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
    other_user: {
      id: 'user-3',
      username: 'maya_art',
      display_name: 'Maya Thompson',
      avatar_url: null,
    },
  },
];

export const MessagesScreen: React.FC<MessagesScreenProps> = ({ isOpen, onClose }) => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);

  const loadConversations = useCallback(async () => {
    if (!user) {
      // Use mock data when not logged in
      setConversations(mockConversations);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      // Get user's conversations with participant info
      const { data: participations, error } = await supabase
        .from('conversation_participants')
        .select(`
          conversation_id,
          unread_count,
          conversations:conversation_id (
            id,
            type,
            name,
            last_message,
            last_message_at
          )
        `)
        .eq('user_id', user.id)
        .order('conversations(updated_at)', { ascending: false });

      if (error) throw error;

      // For each conversation, get the other participant's profile
      const conversationsWithUsers = await Promise.all(
        (participations || []).map(async (p: any) => {
          const conv = p.conversations;
          if (!conv) return null;

          // Get other participants
          const { data: otherParticipants } = await supabase
            .from('conversation_participants')
            .select('user_id')
            .eq('conversation_id', conv.id)
            .neq('user_id', user.id)
            .limit(1);

          let otherUser = null;
          if (otherParticipants && otherParticipants.length > 0) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('user_id, username, display_name, avatar_url')
              .eq('user_id', otherParticipants[0].user_id)
              .single();
            
            if (profile) {
              otherUser = {
                id: profile.user_id,
                username: profile.username,
                display_name: profile.display_name,
                avatar_url: profile.avatar_url,
              };
            }
          }

          return {
            ...conv,
            unread_count: p.unread_count,
            other_user: otherUser,
          };
        })
      );

      const realConvos = conversationsWithUsers.filter(Boolean) as Conversation[];
      // If no real conversations, use mock data
      setConversations(realConvos.length > 0 ? realConvos : mockConversations);
    } catch (error) {
      console.error('Error loading conversations:', error);
      // Fallback to mock data on error
      setConversations(mockConversations);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isOpen && user) {
      loadConversations();
    }
  }, [isOpen, user, loadConversations]);

  // Real-time subscription for new messages
  useEffect(() => {
    if (!isOpen || !user) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [isOpen, user, loadConversations]);

  const filteredConversations = conversations.filter(conv => {
    const name = conv.other_user?.display_name || conv.other_user?.username || conv.name || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getDisplayName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.other_user) {
      return conv.other_user.display_name || conv.other_user.username || 'Unknown';
    }
    return 'Unknown';
  };

  const getInitials = (conv: Conversation) => {
    const name = getDisplayName(conv);
    return name.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  if (selectedConversation) {
    return (
      <ChatScreen
        conversation={selectedConversation}
        onBack={() => {
          setSelectedConversation(null);
          loadConversations(); // Refresh to update unread counts
        }}
      />
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Messages</h1>
        </div>
        <Button variant="ghost" size="icon">
          <Plus className="w-5 h-5" />
        </Button>
      </div>

      {/* Search */}
      <div className="p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto pb-20">
        {loading ? (
          <div className="flex flex-col gap-2 p-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1">
                  <div className="h-4 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredConversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageCircle className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No messages yet</h3>
            <p className="text-sm text-muted-foreground">
              Start a conversation by tapping the + button
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredConversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => setSelectedConversation(conv)}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left w-full border-b border-border/50"
              >
                <div className="relative">
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                    <AvatarFallback>{getInitials(conv)}</AvatarFallback>
                  </Avatar>
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`font-medium truncate ${conv.unread_count > 0 ? 'text-foreground' : 'text-foreground/80'}`}>
                      {getDisplayName(conv)}
                    </span>
                    {conv.last_message_at && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false })}
                      </span>
                    )}
                  </div>
                  <p className={`text-sm truncate ${conv.unread_count > 0 ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {conv.last_message || 'No messages yet'}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesScreen;
