import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { ArrowLeft, MoreVertical, Users, Plus, Camera, Mic, Send, Image as ImageIcon, Settings, UserPlus, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface GroupMember {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  role: 'admin' | 'member';
}

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  content: string;
  type: 'text' | 'image' | 'video';
  createdAt: string;
}

interface GroupChatScreenProps {
  conversationId: string;
  groupName: string;
  members: GroupMember[];
  onBack: () => void;
}

export const GroupChatScreen: React.FC<GroupChatScreenProps> = ({
  conversationId,
  groupName,
  members,
  onBack,
}) => {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [showMembers, setShowMembers] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          id,
          sender_id,
          content,
          type,
          created_at
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Map messages with sender info
      const messagesWithSenders = (data || []).map(msg => {
        const sender = members.find(m => m.userId === msg.sender_id);
        return {
          id: msg.id,
          senderId: msg.sender_id,
          senderName: sender?.displayName || sender?.username || 'Unknown',
          senderAvatar: sender?.avatarUrl || undefined,
          content: msg.content || '',
          type: msg.type as 'text' | 'image' | 'video',
          createdAt: msg.created_at,
        };
      });

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, members]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`group:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newMsg = payload.new as any;
          const sender = members.find(m => m.userId === newMsg.sender_id);
          
          setMessages(prev => [...prev, {
            id: newMsg.id,
            senderId: newMsg.sender_id,
            senderName: sender?.displayName || sender?.username || 'Unknown',
            senderAvatar: sender?.avatarUrl || undefined,
            content: newMsg.content || '',
            type: newMsg.type,
            createdAt: newMsg.created_at,
          }]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, members]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!newMessage.trim() || !user) return;

    try {
      const { error } = await supabase.from('messages').insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: newMessage,
        type: 'text',
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error('Failed to send message');
    }
  };

  const handleLeaveGroup = async () => {
    toast.info('You left the group');
    onBack();
  };

  const getInitials = (name: string) => name.slice(0, 2).toUpperCase();

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold">{groupName}</h3>
              <p className="text-xs text-muted-foreground">{members.length} members</p>
            </div>
          </div>
        </div>

        <Sheet open={showMembers} onOpenChange={setShowMembers}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon">
              <MoreVertical className="w-5 h-5" />
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Group Settings</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Members ({members.length})</span>
                <Button variant="ghost" size="sm" className="gap-1">
                  <UserPlus className="w-4 h-4" />
                  Add
                </Button>
              </div>
              
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={member.avatarUrl || undefined} />
                      <AvatarFallback>{getInitials(member.displayName || member.username || 'U')}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{member.displayName || member.username}</p>
                      {member.role === 'admin' && (
                        <span className="text-xs text-primary">Admin</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border">
                <Button
                  variant="destructive"
                  className="w-full gap-2"
                  onClick={handleLeaveGroup}
                >
                  <LogOut className="w-4 h-4" />
                  Leave Group
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <Users className="w-16 h-16 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No messages yet</p>
            <p className="text-sm text-muted-foreground">Be the first to say hello!</p>
          </div>
        ) : (
          messages.map((message) => {
            const isOwnMessage = message.senderId === user?.id;
            
            return (
              <div
                key={message.id}
                className={cn(
                  "flex gap-2",
                  isOwnMessage ? "flex-row-reverse" : "flex-row"
                )}
              >
                {!isOwnMessage && (
                  <Avatar className="w-8 h-8">
                    <AvatarImage src={message.senderAvatar} />
                    <AvatarFallback>{getInitials(message.senderName)}</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn(
                  "max-w-[70%]",
                  isOwnMessage ? "items-end" : "items-start"
                )}>
                  {!isOwnMessage && (
                    <p className="text-xs text-muted-foreground mb-1 px-2">{message.senderName}</p>
                  )}
                  <div className={cn(
                    "px-4 py-2 rounded-2xl",
                    isOwnMessage
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  )}>
                    <p className="text-sm">{message.content}</p>
                  </div>
                  <p className={cn(
                    "text-[10px] text-muted-foreground mt-1 px-2",
                    isOwnMessage ? "text-right" : "text-left"
                  )}>
                    {formatDistanceToNow(new Date(message.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon">
            <Plus className="w-5 h-5" />
          </Button>
          <Button variant="ghost" size="icon">
            <Camera className="w-5 h-5" />
          </Button>
          <Input
            placeholder="Message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            className="flex-1"
          />
          <Button onClick={handleSend} size="icon" disabled={!newMessage.trim()}>
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};
