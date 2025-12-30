import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, Send, Sparkles, MoreVertical, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useTypingIndicator } from '@/hooks/useTypingIndicator';
import { useVoiceRecorder } from '@/hooks/useVoiceRecorder';
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
} from '@/components/chat';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<File | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [longPressMessageId, setLongPressMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Typing indicator
  const { typingUsers, startTyping, stopTyping } = useTypingIndicator(conversation.id);

  // Voice recording
  const { isRecording, recordingDuration, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();

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

  const loadMessages = useCallback(async () => {
    // Check if this is a mock conversation
    if (conversation.id.startsWith('mock-')) {
      setMessages(getMockMessages());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversation.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      // Load reactions for messages
      const messagesWithReactions = await Promise.all(
        (data || []).map(async (msg) => {
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
            reactions: Array.from(reactionMap.entries()).map(([emoji, data]) => ({
              emoji,
              ...data,
            })),
          };
        })
      );

      // Use mock messages if no real messages exist
      setMessages(messagesWithReactions.length > 0 ? messagesWithReactions : getMockMessages());

      // Mark messages as read
      if (user) {
        await supabase
          .from('conversation_participants')
          .update({ unread_count: 0, last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversation.id)
          .eq('user_id', user.id);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      // Fallback to mock messages on error
      setMessages(getMockMessages());
    } finally {
      setLoading(false);
    }
  }, [conversation.id, user]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Real-time subscription for new messages
  useEffect(() => {
    const channel = supabase
      .channel(`messages-${conversation.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversation.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => [...prev, { ...newMsg, reactions: [] }]);
          
          if (newMsg.sender_id !== user?.id) {
            supabase
              .from('conversation_participants')
              .update({ unread_count: 0, last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversation.id)
              .eq('user_id', user?.id);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'message_reactions',
        },
        () => {
          // Reload reactions
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversation.id, user?.id, loadMessages]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    startTyping();
  };

  const sendMessage = async (type: string = 'text', mediaUrl?: string) => {
    if ((!newMessage.trim() && !mediaUrl) || !user || sending) return;

    setSending(true);
    stopTyping();
    const messageContent = newMessage.trim();
    setNewMessage('');
    setShowSuggestions(false);
    setSelectedMedia(null);

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
      setNewMessage(messageContent);
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

  const handleVoiceSend = async () => {
    const audioBlob = await stopRecording();
    if (!audioBlob || !user) return;

    setSending(true);
    try {
      const fileName = `${user.id}/${Date.now()}-voice.webm`;
      const { data, error } = await supabase.storage
        .from('content-uploads')
        .upload(fileName, audioBlob);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('content-uploads')
        .getPublicUrl(data.path);

      await sendMessage('voice', publicUrl);
    } catch (error) {
      console.error('Error uploading voice message:', error);
    } finally {
      setSending(false);
    }
  };

  const addReaction = async (messageId: string, emoji: string) => {
    if (!user) return;
    
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
    if (!user) return;
    
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
    longPressTimerRef.current = setTimeout(() => {
      setLongPressMessageId(messageId);
    }, 500);
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
    }
  };

  const generateAiSuggestions = async () => {
    const lastMessage = messages.filter(m => m.sender_id !== user?.id).slice(-1)[0];
    if (!lastMessage?.content) return;

    setLoadingSuggestions(true);
    setShowSuggestions(true);

    try {
      const { data, error } = await supabase.functions.invoke('generate-reply', {
        body: { message: lastMessage.content, tone: 'friendly' },
      });

      if (error) throw error;
      if (data?.suggestions) {
        setAiSuggestions(data.suggestions);
      }
    } catch (error) {
      console.error('Error generating suggestions:', error);
      setShowSuggestions(false);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const useSuggestion = (suggestion: string) => {
    setNewMessage(suggestion);
    setShowSuggestions(false);
    inputRef.current?.focus();
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
    if (msg.read_by && msg.read_by.some(id => id !== user?.id)) return 'read';
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
      return <VoiceMessage src={msg.media_url} />;
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
        <div className="flex-1">
          <h2 className="font-semibold">{getDisplayName()}</h2>
          {typingUsers.length > 0 ? (
            <p className="text-xs text-primary">typing...</p>
          ) : (
            <p className="text-xs text-muted-foreground">● Online</p>
          )}
        </div>
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
      <div className="flex-1 overflow-y-auto p-4">
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
                        {/* Quick reaction picker */}
                        {longPressMessageId === msg.id && (
                          <div className={`absolute ${isOwn ? 'right-0' : 'left-0'} -top-12 z-10`}>
                            <QuickReactionPicker
                              onSelect={(emoji) => addReaction(msg.id, emoji)}
                              onClose={() => setLongPressMessageId(null)}
                            />
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
        <div className="px-4 py-2 border-t border-border bg-muted/50">
          {loadingSuggestions ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 animate-pulse" />
              <span>Generating suggestions...</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> AI Suggestions
                </span>
                <button onClick={() => setShowSuggestions(false)} className="text-xs text-muted-foreground hover:text-foreground">✕</button>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiSuggestions.map((suggestion, idx) => (
                  <button
                    key={idx}
                    onClick={() => useSuggestion(suggestion)}
                    className="text-sm bg-background border border-border rounded-full px-3 py-1 hover:bg-muted transition-colors text-left"
                  >
                    {suggestion.length > 50 ? suggestion.slice(0, 50) + '...' : suggestion}
                  </button>
                ))}
              </div>
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
              duration={recordingDuration}
              onStart={startRecording}
              onStop={stopRecording}
              onCancel={cancelRecording}
              onSend={handleVoiceSend}
            />
          ) : (
            <>
              <MediaPicker onSelect={handleMediaSelect} disabled={sending} />
              <VoiceRecorder
                isRecording={isRecording}
                duration={recordingDuration}
                onStart={startRecording}
                onStop={stopRecording}
                onCancel={cancelRecording}
                onSend={handleVoiceSend}
                disabled={sending}
              />
              <Button 
                variant="ghost" 
                size="icon" 
                className="shrink-0"
                onClick={generateAiSuggestions}
                disabled={loadingSuggestions}
              >
                <Sparkles className={`w-5 h-5 ${loadingSuggestions ? 'animate-pulse' : ''}`} />
              </Button>
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
