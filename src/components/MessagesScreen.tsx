import React, { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { MessageCircle, Search, Plus, ArrowLeft, Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ChatScreen } from '@/components/ChatScreen';
import { GroupChatScreen } from '@/components/GroupChatScreen';
import { NewChatSheet } from '@/components/NewChatSheet';
import { CreateGroupChat } from '@/components/CreateGroupChat';
import { useConversations } from '@/hooks/useConversations';
import { useLocalization } from '@/contexts/LocalizationContext';
import { toggleConversationMute } from '@/services/conversation.service';
import { loadGroupMembers, type GroupMemberInfo } from '@/services/conversation.service';
import type { ConversationSummary } from '@/services/conversation.service';
import type { UserProfile } from '@/components/NewChatSheet';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface MessagesScreenProps {
  isOpen: boolean;
  onClose: () => void;
  openNewChat?: boolean;
}

type ViewState = 'list' | 'chat' | 'group';

export const MessagesScreen: React.FC<MessagesScreenProps> = ({
  isOpen,
  onClose,
  openNewChat = false,
}) => {
  const { t } = useLocalization();
  const { user } = useAuth();
  const {
    conversations,
    totalUnread,
    loading,
    refresh,
  } = useConversations(user?.id, isOpen);

  const [viewState, setViewState] = useState<ViewState>('list');
  const [selectedConversation, setSelectedConversation] = useState<ConversationSummary | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMemberInfo[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showNewChatSheet, setShowNewChatSheet] = useState(openNewChat);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (openNewChat) {
      setShowNewChatSheet(true);
    }
  }, [openNewChat]);

  const handlePullRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }, [refresh]);

  const handleSelectConversation = useCallback(
    async (conv: ConversationSummary) => {
      if (conv.type === 'group') {
        try {
          const members = await loadGroupMembers(conv.id);
          setGroupMembers(members);
          setSelectedConversation(conv);
          setViewState('group');
        } catch (err) {
          console.error('Error loading group members:', err);
          toast.error(t('errors.somethingWentWrong'));
        }
      } else {
        setSelectedConversation(conv);
        setViewState('chat');
      }
    },
    [t]
  );

  const handleBackFromChat = useCallback(() => {
    setViewState('list');
    setSelectedConversation(null);
    setGroupMembers([]);
    refresh();
  }, [refresh]);

  const handleSelectFromNewChat = useCallback(
    (conversationId: string, type: 'direct' | 'group', otherUser?: UserProfile) => {
      setShowNewChatSheet(false);
      if (type === 'direct' && otherUser) {
        const conv: ConversationSummary = {
          id: conversationId,
          type: 'direct',
          name: null,
          last_message: null,
          last_message_at: null,
          unread_count: 0,
          muted: false,
          other_user: {
            id: otherUser.user_id,
            username: otherUser.username,
            display_name: otherUser.display_name,
            avatar_url: otherUser.avatar_url,
          },
        };
        setSelectedConversation(conv);
        setViewState('chat');
      }
    },
    []
  );

  const handleGroupCreated = useCallback(
    async (conversationId: string, groupName?: string) => {
      setShowCreateGroup(false);
      try {
        const members = await loadGroupMembers(conversationId);
        setGroupMembers(members);
        setSelectedConversation({
          id: conversationId,
          type: 'group',
          name: groupName || 'New Group',
          last_message: null,
          last_message_at: null,
          unread_count: 0,
          muted: false,
        });
        setViewState('group');
        refresh();
      } catch (err) {
        console.error('Error loading new group:', err);
        toast.error(t('errors.somethingWentWrong'));
        refresh();
      }
    },
    [refresh, t]
  );

  const handleMuteToggle = useCallback(
    async (e: React.MouseEvent, conv: ConversationSummary) => {
      e.stopPropagation();
      if (!user) return;
      try {
        await toggleConversationMute(conv.id, user.id, !conv.muted);
        refresh();
      } catch (err) {
        toast.error(t('errors.somethingWentWrong'));
      }
    },
    [user, refresh, t]
  );

  const filteredConversations = conversations.filter((conv) => {
    const name =
      conv.other_user?.display_name ||
      conv.other_user?.username ||
      conv.name ||
      '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getDisplayName = (conv: ConversationSummary) => {
    if (conv.name) return conv.name;
    if (conv.other_user) {
      return conv.other_user.display_name || conv.other_user.username || 'Unknown';
    }
    return 'Unknown';
  };

  const getInitials = (conv: ConversationSummary) => {
    const name = getDisplayName(conv);
    return name.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  // Group chat view
  if (viewState === 'group' && selectedConversation && groupMembers.length > 0) {
    return (
      <GroupChatScreen
        conversationId={selectedConversation.id}
        groupName={selectedConversation.name || 'Group'}
        members={groupMembers}
        onBack={handleBackFromChat}
      />
    );
  }

  // Direct chat view
  if (viewState === 'chat' && selectedConversation) {
    return (
      <ChatScreen
        conversation={{
          id: selectedConversation.id,
          type: selectedConversation.type,
          name: selectedConversation.name,
          other_user: selectedConversation.other_user,
        }}
        onBack={handleBackFromChat}
      />
    );
  }

  // Main list view
  return (
    <>
      <div className="fixed inset-0 z-50 bg-background flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onClose} aria-label={t('common.back')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">{t('messages.title')}</h1>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowNewChatSheet(true)}
            aria-label={t('messages.newMessage')}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>

        {/* Search */}
        <div className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('messages.searchConversations')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Conversations List */}
        <div
          className="flex-1 overflow-y-auto pb-20"
          onTouchEnd={(e) => {
            const target = e.currentTarget;
            if (target.scrollTop === 0 && refreshing === false) {
              handlePullRefresh();
            }
          }}
        >
          {loading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3].map((i) => (
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
              <h3 className="font-semibold text-lg mb-1">{t('messages.noMessages')}</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {t('messages.tapToStart')}
              </p>
              <Button onClick={() => setShowNewChatSheet(true)}>
                <Plus className="w-4 h-4 mr-2" />
                {t('messages.newMessage')}
              </Button>
            </div>
          ) : (
            <div className="flex flex-col">
              {filteredConversations.map((conv) => (
                <div
                  key={conv.id}
                  className="flex items-center gap-3 group"
                >
                  <button
                    onClick={() => handleSelectConversation(conv)}
                    className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors text-left w-full border-b border-border/50 flex-1 min-w-0"
                  >
                    <div className="relative shrink-0">
                      {conv.type === 'group' ? (
                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
                          <MessageCircle className="w-6 h-6 text-primary" />
                        </div>
                      ) : (
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={conv.other_user?.avatar_url || undefined} />
                          <AvatarFallback>{getInitials(conv)}</AvatarFallback>
                        </Avatar>
                      )}
                      {conv.unread_count > 0 && !conv.muted && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 bg-primary text-primary-foreground text-xs rounded-full flex items-center justify-center">
                          {conv.unread_count > 9 ? '9+' : conv.unread_count}
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'font-medium truncate',
                            conv.unread_count > 0 && !conv.muted
                              ? 'text-foreground'
                              : 'text-foreground/80'
                          )}
                        >
                          {getDisplayName(conv)}
                        </span>
                        {conv.last_message_at && (
                          <span className="text-xs text-muted-foreground shrink-0">
                            {formatDistanceToNow(new Date(conv.last_message_at), {
                              addSuffix: false,
                            })}
                          </span>
                        )}
                      </div>
                      <p
                        className={cn(
                          'text-sm truncate',
                          conv.unread_count > 0 && !conv.muted
                            ? 'text-foreground font-medium'
                            : 'text-muted-foreground'
                        )}
                      >
                        {conv.last_message || t('messages.noMessages')}
                      </p>
                    </div>
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 opacity-0 group-hover:opacity-100 mr-2"
                    onClick={(e) => handleMuteToggle(e, conv)}
                    aria-label={conv.muted ? t('messages.unmute') : t('messages.mute')}
                  >
                    {conv.muted ? (
                      <Bell className="w-5 h-5" />
                    ) : (
                      <BellOff className="w-5 h-5" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* New Chat Sheet */}
      <NewChatSheet
        isOpen={showNewChatSheet}
        onClose={() => setShowNewChatSheet(false)}
        onSelectConversation={handleSelectFromNewChat}
        onStartGroupChat={() => {
          setShowNewChatSheet(false);
          setShowCreateGroup(true);
        }}
      />

      {/* Create Group Chat */}
      <CreateGroupChat
        isOpen={showCreateGroup}
        onClose={() => setShowCreateGroup(false)}
        onCreated={handleGroupCreated}
      />
    </>
  );
};

export default MessagesScreen;
