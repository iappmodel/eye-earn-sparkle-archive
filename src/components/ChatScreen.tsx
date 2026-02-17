import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useLocalization } from '@/contexts/LocalizationContext';
import { ArrowLeft, Send, Sparkles, MoreVertical, Search, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { formatDistanceToNow } from 'date-fns';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
import { uploadVoiceMessage } from '@/services/voiceMessage.service';
import { parseVoiceDuration } from '@/services/voiceMessage.service';
import { useAiSuggestions, type SuggestionTone } from '@/hooks/useAiSuggestions';
import { useChatRealtime } from '@/hooks/useChatRealtime';
import {
  TypingIndicator,
  MessageReactions,
  QuickReactionPicker,
  ReadReceipt,
  VoiceRecorder,
  MediaPicker,
  MediaPreview,
  ChatSearch,
  VoiceMessage,
  ConnectionStatus,
} from '@/components/chat';
import type { ConnectionStatus as RealtimeConnectionStatus } from '@/hooks/useChatRealtime';

interface MessageReaction {
  emoji: string;
  count: number;
  userReacted: boolean;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  type: string;
  media_url: string | null;
  is_ai_generated: boolean;
  read_by: string[];
  created_at: string;
  reactions?: MessageReaction[];
  /** Optimistic message: not yet confirmed by server */
  _pending?: boolean;
  _tempId?: string;
}

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  other_user?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface ChatScreenProps {
  conversation: Conversation;
  onBack: () => void;
}

export const ChatScreen: React.FC<ChatScreenProps> = ({ conversation, onBack }) => {
  const { user } = useAuth();
  const { t } = useLocalization();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestionTone, setSuggestionTone] = useState<SuggestionTone>('friendly');

  const {
    suggestions: aiSuggestions,
    isLoading: loadingSuggestions,
    generateSuggestions,
    clearSuggestions,
    retry,
  } = useAiSuggestions({
    onSuccess: () => setShowSuggestions(true),
  });
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [longPressMessageId, setLongPressMessageId] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<RealtimeConnectionStatus>('closed');
  const [otherUserLastReadAt, setOtherUserLastReadAt] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const messageIdsRef = useRef<Set<string>>(new Set());
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const PAGE_SIZE = 50;
  const [pendingVoiceMessage, setPendingVoiceMessage] = useState<{ blob: Blob; durationSeconds: number } | null>(null);

  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversation.id);

  // Voice recording
  const {
    isRecording,
    isPaused,
    recordingDuration,
    audioLevel,
    startRecording,
    stopRecording,
    cancelRecording,
    pauseRecording,
    resumeRecording,
  } = useVoiceRecorder({ maxDuration: 300 });

  const handleVoiceStop = useCallback(async () => {
    const result = await stopRecording();
    if (result) setPendingVoiceMessage(result);
  }, [stopRecording]);

  const handleVoiceCancel = useCallback(() => {
    cancelRecording();
    setPendingVoiceMessage(null);
  }, [cancelRecording]);

  const handleVoiceStart = useCallback(async () => {
    setPendingVoiceMessage(null);
    await startRecording();
  }, [startRecording]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const scrollToMessage = (messageId: string) => {
    const element = messageRefs.current.get(messageId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedMessageId(messageId);
      setTimeout(() => setHighlightedMessageId(null), 2000);
    }
  };

  // Mock messages for testing
  const getMockMessages = (): Message[] => {
    const now = Date.now();
    const otherId = conversation.other_user?.id || 'other-user';
    return [
      {
        id: 'mock-msg-1',
        conversation_id: conversation.id,
        sender_id: otherId,
        content: 'Hey! Have you tried the new iMoji feature? 🎨',
        type: 'text',
        media_url: null,
        is_ai_generated: false,
        read_by: [],
        created_at: new Date(now - 3600000).toISOString(),
        reactions: [{ emoji: '❤️', count: 1, userReacted: false }],
      },
      {
        id: 'mock-msg-2',
        conversation_id: conversation.id,
        sender_id: 'current-user',
        content: 'Not yet! What is it?',
        type: 'text',
        media_url: null,
        is_ai_generated: false,
        read_by: [otherId],
        created_at: new Date(now - 3500000).toISOString(),
        reactions: [],
      },
      {
        id: 'mock-msg-3',
        conversation_id: conversation.id,
        sender_id: otherId,
        content: 'You can create personalized emojis from your face! Try the + button and select iMoji 😎',
        type: 'text',
        media_url: null,
        is_ai_generated: false,
        read_by: [],
        created_at: new Date(now - 3400000).toISOString(),
        reactions: [],
      },
      {
        id: 'mock-msg-4',
        conversation_id: conversation.id,
        sender_id: otherId,
        content: 'You can choose different styles like manga, Disney, cartoon and more!',
        type: 'text',
        media_url: null,
        is_ai_generated: false,
        read_by: [],
        created_at: new Date(now - 3300000).toISOString(),
        reactions: [{ emoji: '🔥', count: 2, userReacted: true }],
      },
      {
        id: 'mock-msg-5',
        conversation_id: conversation.id,
        sender_id: 'current-user',
        content: 'That sounds awesome! Let me try it now 🚀',
        type: 'text',
        media_url: null,
        is_ai_generated: false,
        read_by: [otherId],
        created_at: new Date(now - 60000).toISOString(),
        reactions: [],
      },
    ];
  };

  const loadReactionsForMessages = useCallback(
    async (msgs: Message[]): Promise<Message[]> => {
      if (msgs.length === 0) return msgs;
      return Promise.all(
        msgs.map(async (msg) => {
          const { data: reactions } = await supabase
            .from('message_reactions')
            .select('emoji, user_id')
            .eq('message_id', msg.id);
          const reactionMap = new Map<string, { count: number; userReacted: boolean }>();
          reactions?.forEach((r: { emoji: string; user_id: string }) => {
            const existing = reactionMap.get(r.emoji) || { count: 0, userReacted: false };
            reactionMap.set(r.emoji, {
              count: existing.count + 1,
              userReacted: existing.userReacted || r.user_id === user?.id,
            });
          });
          return {
            ...msg,
            reactions: Array.from(reactionMap.entries()).map(([emoji, data]) => ({ emoji, ...data })),
          };
        })
      );
    },
    [user?.id]
  );

  const loadMessages = useCallback(
    async (olderThan?: string) => {
      if (conversation.id.startsWith('mock-')) {
        setMessages(getMockMessages());
        setLoading(false);
        return;
      }

      if (!olderThan) setLoading(true);
      else setLoadingMore(true);

      try {
        let query = supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversation.id)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);

        if (olderThan) {
          query = query.lt('created_at', olderThan);
        }

        const { data, error } = await query;
        if (error) throw error;

        const raw = (data || []) as Message[];
        const chronological = raw.reverse();
        const withReactions = await loadReactionsForMessages(chronological);

        if (!olderThan) {
          setMessages(withReactions.length > 0 ? withReactions : getMockMessages());
          setHasMore(raw.length === PAGE_SIZE);
        } else {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const newOnes = withReactions.filter((m) => !existingIds.has(m.id));
            return [...newOnes, ...prev];
          });
          setHasMore(raw.length === PAGE_SIZE);
        }

        if (!olderThan && user) {
          await supabase
            .from('conversation_participants')
            .update({ unread_count: 0, last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversation.id)
            .eq('user_id', user.id);
          const { data: participants } = await supabase
            .from('conversation_participants')
            .select('user_id, last_read_at')
            .eq('conversation_id', conversation.id)
            .neq('user_id', user.id);
          const other = participants?.[0] as { last_read_at: string | null } | undefined;
          if (other) setOtherUserLastReadAt(other.last_read_at ?? null);
        }
      } catch (error) {
        console.error('Error loading messages:', error);
        if (!olderThan) setMessages(getMockMessages());
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [conversation.id, user, loadReactionsForMessages]
  );

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const msgs = messages.filter((m) => !m._pending);
    const oldest = msgs[0]?.created_at;
    if (oldest) loadMessages(oldest);
  }, [loadMessages, loadingMore, hasMore, messages]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Keep messageIdsRef in sync for realtime reaction filtering
  useEffect(() => {
    messageIdsRef.current = new Set(messages.filter((m) => !m._pending).map((m) => m.id));
  }, [messages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time: messages, reactions (incremental), read receipts, connection status
  useChatRealtime(conversation.id.startsWith('mock-') ? undefined : conversation.id, {
    currentUserId: user?.id,
    messageIdsRef,
    onMessageInsert: useCallback(
      (msg) => {
        setMessages((prev) => {
          const asMessage: Message = {
            ...msg,
            read_by: msg.read_by ?? [],
            reactions: [],
          };
          if (prev.some((m) => m.id === msg.id)) return prev;
          const fromMe = msg.sender_id === user?.id;
          if (fromMe) {
            const idx = prev.findIndex((m) => m._pending);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = { ...asMessage, reactions: next[idx].reactions ?? [] };
              return next;
            }
          }
          return [...prev, asMessage];
        });
        if (msg.sender_id !== user?.id) {
          supabase
            .from('conversation_participants')
            .update({ unread_count: 0, last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversation.id)
            .eq('user_id', user?.id);
        }
      },
      [conversation.id, user?.id]
    ),
    onMessageUpdate: useCallback((msg) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, ...msg, read_by: msg.read_by ?? m.read_by } : m))
      );
    }, []),
    onMessageDelete: useCallback((messageId) => {
      setMessages((prev) => prev.filter((m) => m.id !== messageId));
    }, []),
    onReactionAdd: useCallback(
      (messageId, emoji, userId) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = m.reactions ?? [];
            const existing = reactions.find((r) => r.emoji === emoji);
            if (existing)
              return {
                ...m,
                reactions: reactions.map((r) =>
                  r.emoji === emoji
                    ? { ...r, count: r.count + 1, userReacted: r.userReacted || userId === user?.id }
                    : r
                ),
              };
            return {
              ...m,
              reactions: [
                ...reactions,
                { emoji, count: 1, userReacted: userId === user?.id },
              ],
            };
          })
        );
      },
      [user?.id]
    ),
    onReactionRemove: useCallback(
      (messageId, emoji, userId) => {
        setMessages((prev) =>
          prev.map((m) => {
            if (m.id !== messageId) return m;
            const reactions = (m.reactions ?? []).map((r) =>
              r.emoji === emoji
                ? { ...r, count: Math.max(0, r.count - 1), userReacted: r.userReacted && userId !== user?.id }
                : r
            ).filter((r) => r.count > 0);
            return { ...m, reactions };
          })
        );
      },
      [user?.id]
    ),
    onParticipantUpdate: useCallback(
      (participant) => {
        if (participant.user_id !== user?.id)
          setOtherUserLastReadAt(participant.last_read_at ?? null);
      },
      [user?.id]
    ),
    onConnectionStatus: setConnectionStatus,
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    startTyping();
  };

  const sendMessage = async (type: string = 'text', mediaUrl?: string, contentOverride?: string) => {
    if ((!newMessage.trim() && !mediaUrl) || !user || sending) return;
    if (conversation.id.startsWith('mock-')) return; // Mock convos: read-only demo

    setSending(true);
    stopTyping();
    const messageContent = contentOverride ?? newMessage.trim();
    setNewMessage('');
    setShowSuggestions(false);
    clearSuggestions();
    setSelectedMedia(null);

    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversation_id: conversation.id,
      sender_id: user.id,
      content: messageContent || null,
      type,
      media_url: mediaUrl || null,
      is_ai_generated: false,
      read_by: [],
      created_at: new Date().toISOString(),
      reactions: [],
      _pending: true,
      _tempId: tempId,
    };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversation.id,
        sender_id: user.id,
        content: messageContent || null,
        type,
        media_url: mediaUrl || null,
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => prev.filter((m) => m._tempId !== tempId));
      if (type === 'text') setNewMessage(messageContent);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const handleMediaSelect = async (file: File) => {
    setSelectedMedia(file);
  };

  const uploadAndSendMedia = async () => {
    if (!selectedMedia || !user) return;

    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}-${selectedMedia.name}`;
      const { data, error } = await supabase.storage
        .from('content-uploads')
        .upload(fileName, selectedMedia);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('content-uploads')
        .getPublicUrl(data.path);

      const type = selectedMedia.type.startsWith('image/') ? 'image' : 
                   selectedMedia.type.startsWith('video/') ? 'video' : 'file';
      
      await sendMessage(type, publicUrl);
    } catch (error) {
      console.error('Error uploading media:', error);
    } finally {
      setSending(false);
      setSelectedMedia(null);
    }
  };

  const handleVoiceSend = useCallback(async () => {
    let blob: Blob;
    let durationSeconds: number;

    if (pendingVoiceMessage) {
      blob = pendingVoiceMessage.blob;
      durationSeconds = pendingVoiceMessage.durationSeconds;
      setPendingVoiceMessage(null);
    } else {
      const result = await stopRecording();
      if (!result || !user) return;
      blob = result.blob;
      durationSeconds = result.durationSeconds;
    }

    if (!user) return;

    setSending(true);
    try {
      const publicUrl = await uploadVoiceMessage({
        userId: user.id,
        conversationId: conversation.id,
        blob,
        durationSeconds,
      });

      await sendMessage('voice', publicUrl, String(durationSeconds));
    } catch (error) {
      console.error('Error uploading voice message:', error);
      toast.error(t('messages.voiceUploadFailed') || 'Failed to send voice message');
      setPendingVoiceMessage({ blob, durationSeconds });
    } finally {
      setSending(false);
    }
  }, [pendingVoiceMessage, stopRecording, user, conversation.id, t]);

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user || messageId.startsWith('temp-')) return;
    
    try {
      await supabase.from('message_reactions').insert({
        message_id: messageId,
        user_id: user.id,
        emoji,
      });
    } catch (error) {
      console.error('Error adding reaction:', error);
    }
    setLongPressMessageId(null);
  };

  const removeReaction = async (messageId: string, emoji: string) => {
    if (!user || messageId.startsWith('temp-')) return;
    
    try {
      await supabase
        .from('message_reactions')
        .delete()
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji);
    } catch (error) {
      console.error('Error removing reaction:', error);
    }
  };

  const handleMessageLongPress = (messageId: string) => {
    if (messageId.startsWith('temp-')) return; // No reactions on optimistic messages
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMessageId(messageId);
    }, 500);
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const getLastIncomingMessage = useCallback(() => {
    return messages.filter((m) => m.sender_id !== user?.id).slice(-1)[0];
  }, [messages, user?.id]);

  const buildConversationContext = useCallback(() => {
    return messages.slice(-12).map((m) => ({
      role: m.sender_id === user?.id ? 'user' : 'assistant',
      content: m.content ?? (m.type !== 'text' ? `[${m.type}]` : ''),
    }));
  }, [messages, user?.id]);

  const generateAiSuggestions = useCallback(async () => {
    const lastMessage = getLastIncomingMessage();
    if (!lastMessage?.content?.trim()) {
      toast.info(t('messages.aiSuggestionsNoMessage'));
      return;
    }

    setShowSuggestions(true);
    const history = buildConversationContext();
    await generateSuggestions(lastMessage.content, {
      tone: suggestionTone,
      conversationHistory: history,
      recipientName: conversation.other_user?.display_name ?? conversation.other_user?.username ?? undefined,
    });
  }, [getLastIncomingMessage, buildConversationContext, generateSuggestions, suggestionTone, conversation, t]);

  const useSuggestion = (suggestion: string) => {
    setNewMessage(suggestion);
    setShowSuggestions(false);
    clearSuggestions();
    inputRef.current?.focus();
  };

  const handleCloseSuggestions = () => {
    setShowSuggestions(false);
    clearSuggestions();
  };

  const getDisplayName = () => {
    if (conversation.name) return conversation.name;
    if (conversation.other_user) {
      return conversation.other_user.display_name || conversation.other_user.username || 'Unknown';
    }
    return 'Unknown';
  };

  const getInitials = () => {
    const name = getDisplayName();
    return name.slice(0, 2).toUpperCase();
  };

  const getMessageStatus = (msg: Message): 'sending' | 'sent' | 'delivered' | 'read' => {
    if (msg.sender_id !== user?.id) return 'sent';
    if (msg._pending) return 'sending';
    if (msg.read_by?.length) return 'read';
    if (otherUserLastReadAt && new Date(otherUserLastReadAt).getTime() >= new Date(msg.created_at).getTime())
      return 'read';
    return 'delivered';
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';

    msgs.forEach(msg => {
      const msgDate = new Date(msg.created_at).toDateString();
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const renderMessageContent = (msg: Message) => {
    if (msg.type === 'voice' && msg.media_url) {
      const duration = parseVoiceDuration(msg.content);
      return <VoiceMessage src={msg.media_url} duration={duration} />;
    }
    
    if (msg.type === 'image' && msg.media_url) {
      return (
        <img 
          src={msg.media_url} 
          alt="Shared image" 
          className="max-w-full rounded-lg max-h-64 object-cover"
        />
      );
    }
    
    if (msg.type === 'video' && msg.media_url) {
      return (
        <video 
          src={msg.media_url} 
          controls 
          className="max-w-full rounded-lg max-h-64"
        />
      );
    }
    
    return <p className="text-sm whitespace-pre-wrap">{msg.content}</p>;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-background">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <Avatar className="w-10 h-10">
          <AvatarImage src={conversation.other_user?.avatar_url || undefined} />
          <AvatarFallback>{getInitials()}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{getDisplayName()}</h2>
          {typingUsers.length > 0 ? (
            <p className="text-xs text-primary">typing...</p>
          ) : (
            <p className="text-xs text-muted-foreground">● Online</p>
          )}
        </div>
        <ConnectionStatus status={connectionStatus} className="shrink-0" />
        <Button variant="ghost" size="icon" onClick={() => setShowSearch(!showSearch)}>
          <Search className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Search Bar */}
      {showSearch && (
        <ChatSearch
          conversationId={conversation.id}
          onResultSelect={scrollToMessage}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto p-4"
        onScroll={(e) => {
          const el = e.currentTarget;
          if (el.scrollTop < 80 && hasMore && !loadingMore && !loading) loadMore();
        }}
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="text-xs text-muted-foreground">Loading older messages…</span>
          </div>
        )}
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">Send a message to start the conversation</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {groupMessagesByDate(messages).map(group => (
              <div key={group.date}>
                <div className="flex items-center justify-center mb-4">
                  <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full">
                    {new Date(group.date).toLocaleDateString(undefined, { 
                      weekday: 'long', month: 'short', day: 'numeric' 
                    })}
                  </span>
                </div>
                <div className="flex flex-col gap-2">
                  {group.messages.map(msg => {
                    const isOwn = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        ref={(el) => el && messageRefs.current.set(msg.id, el)}
                        className={`flex ${isOwn ? 'justify-end' : 'justify-start'} relative`}
                        onTouchStart={() => handleMessageLongPress(msg.id)}
                        onTouchEnd={handleMessageTouchEnd}
                        onMouseDown={() => handleMessageLongPress(msg.id)}
                        onMouseUp={handleMessageTouchEnd}
                        onMouseLeave={handleMessageTouchEnd}
                      >
                        {/* Quick reaction picker + Suggest reply (for incoming messages) */}
                        {longPressMessageId === msg.id && (
                          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 z-10 flex items-center gap-1`}>
                            <QuickReactionPicker
                              onSelect={(emoji) => addReaction(msg.id, emoji)}
                              onClose={() => setLongPressMessageId(null)}
                            />
                            {!isOwn && msg.content?.trim() && (
                              <TooltipProvider delayDuration={200}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="secondary"
                                      size="icon"
                                      className="h-9 w-9 rounded-full"
                                      onClick={() => {
                                        setLongPressMessageId(null);
                                        setShowSuggestions(true);
                                        generateSuggestions(msg.content!, {
                                          tone: suggestionTone,
                                          conversationHistory: buildConversationContext(),
                                          recipientName: conversation.other_user?.display_name ?? conversation.other_user?.username ?? undefined,
                                        });
                                      }}
                                    >
                                      <Sparkles className="w-4 h-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">
                                    <p>{t('messages.aiSuggestions')}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                          </div>
                        )}
                        
                        <div className="flex flex-col gap-1 max-w-[75%]">
                          <div
                            className={`px-4 py-2 rounded-2xl transition-colors ${
                              isOwn
                                ? 'bg-primary text-primary-foreground rounded-br-md'
                                : 'bg-muted text-foreground rounded-bl-md'
                            } ${highlightedMessageId === msg.id ? 'ring-2 ring-primary' : ''}`}
                          >
                            {renderMessageContent(msg)}
                            <div className={`flex items-center gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                              <span className={`text-[10px] ${isOwn ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                {formatDistanceToNow(new Date(msg.created_at), { addSuffix: false })}
                              </span>
                              {msg.is_ai_generated && (
                                <Sparkles className="w-3 h-3 text-yellow-400" />
                              )}
                              {isOwn && <ReadReceipt status={getMessageStatus(msg)} />}
                            </div>
                          </div>
                          
                          {/* Reactions */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <MessageReactions
                              reactions={msg.reactions}
                              onAddReaction={(emoji) => addReaction(msg.id, emoji)}
                              onRemoveReaction={(emoji) => removeReaction(msg.id, emoji)}
                              className={isOwn ? 'justify-end' : 'justify-start'}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Typing Indicator */}
      {typingUsers.length > 0 && (
        <TypingIndicator users={typingUsers} />
      )}

      {/* AI Suggestions */}
      {showSuggestions && (
        <div className="px-4 py-3 border-t border-border bg-muted/50">
          {loadingSuggestions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>{t('messages.aiSuggestionsGenerating')}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                    <Sparkles className="w-3 h-3" /> {t('messages.aiSuggestions')}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                        {t(`messages.aiTone${suggestionTone.charAt(0).toUpperCase() + suggestionTone.slice(1)}`)}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                      {(['friendly', 'professional', 'enthusiastic', 'concise'] as const).map((tone) => (
                        <DropdownMenuItem
                          key={tone}
                          onClick={() => {
                            setSuggestionTone(tone);
                            const last = getLastIncomingMessage();
                            if (last?.content?.trim()) {
                              setShowSuggestions(true);
                              generateSuggestions(last.content, {
                                tone,
                                conversationHistory: buildConversationContext(),
                                recipientName: conversation.other_user?.display_name ?? conversation.other_user?.username ?? undefined,
                              });
                            }
                          }}
                        >
                          {t(`messages.aiTone${tone.charAt(0).toUpperCase() + tone.slice(1)}`)}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <button onClick={handleCloseSuggestions} className="text-xs text-muted-foreground hover:text-foreground shrink-0">✕</button>
              </div>
              {aiSuggestions.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {aiSuggestions.map((suggestion, idx) => (
                    <button
                      key={idx}
                      onClick={() => useSuggestion(suggestion)}
                      className="text-sm bg-background border border-border rounded-full px-3 py-1.5 hover:bg-muted transition-colors text-left max-w-full truncate"
                    >
                      {suggestion.length > 60 ? suggestion.slice(0, 60) + '…' : suggestion}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>{t('messages.aiSuggestionsEmpty')}</span>
                  <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={retry}>
                    <RotateCcw className="w-3.5 h-3.5" />
                    {t('messages.aiSuggestionsRetry')}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Media Preview */}
      {selectedMedia && (
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          <div className="flex items-center gap-2">
            <MediaPreview file={selectedMedia} onRemove={() => setSelectedMedia(null)} />
            <Button onClick={uploadAndSendMedia} disabled={sending}>
              {sending ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-border bg-background">
        <div className="flex items-center gap-2">
          {isRecording ? (
            <VoiceRecorder
              isRecording={isRecording}
              isPaused={isPaused}
              duration={recordingDuration}
              audioLevel={audioLevel}
              onStart={handleVoiceStart}
              onStop={handleVoiceStop}
              onCancel={handleVoiceCancel}
              onSend={handleVoiceSend}
              onPause={pauseRecording}
              onResume={resumeRecording}
            />
          ) : pendingVoiceMessage ? (
            <div className="flex items-center gap-3 flex-1 px-1">
              <span className="text-sm text-muted-foreground shrink-0">
                {Math.floor(pendingVoiceMessage.durationSeconds / 60)}:{(pendingVoiceMessage.durationSeconds % 60).toString().padStart(2, '0')}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPendingVoiceMessage(null)}
                className="shrink-0 text-muted-foreground"
              >
                Discard
              </Button>
              <Button size="sm" onClick={handleVoiceSend} disabled={sending} className="shrink-0">
                {sending ? 'Sending...' : 'Send'}
              </Button>
            </div>
          ) : (
            <>
              <MediaPicker onSelect={handleMediaSelect} disabled={sending} />
              <VoiceRecorder
                isRecording={isRecording}
                isPaused={isPaused}
                duration={recordingDuration}
                audioLevel={audioLevel}
                onStart={handleVoiceStart}
                onStop={handleVoiceStop}
                onCancel={handleVoiceCancel}
                onSend={handleVoiceSend}
                onPause={pauseRecording}
                onResume={resumeRecording}
                disabled={sending}
              />
              <TooltipProvider delayDuration={300}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0"
                      onClick={generateAiSuggestions}
                      disabled={loadingSuggestions}
                    >
                      <Sparkles className={`w-5 h-5 ${loadingSuggestions ? 'animate-pulse' : ''}`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <p>{t('messages.aiSuggestions')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Input
                ref={inputRef}
                placeholder="Type a message..."
                value={newMessage}
                onChange={handleInputChange}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                onBlur={stopTyping}
                className="flex-1"
              />
              <Button 
                size="icon" 
                onClick={() => sendMessage()}
                disabled={!newMessage.trim() || sending}
              >
                <Send className="w-5 h-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatScreen;
