import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { X, Search, UserPlus, Users, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { createOrGetDirectConversation } from '@/services/conversation.service';
import { toast } from 'sonner';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

export interface UserProfile {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
}

interface NewChatSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string, type: 'direct' | 'group', otherUser?: UserProfile) => void;
  onStartGroupChat: () => void;
}

export const NewChatSheet: React.FC<NewChatSheetProps> = ({
  isOpen,
  onClose,
  onSelectConversation,
  onStartGroupChat,
}) => {
  const { t } = useLocalization();
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const searchUsers = useCallback(async (query: string) => {
    if (!user || !query.trim()) {
      setUsers([]);
      return;
    }

    setSearchLoading(true);
    try {
      const { data, error } = await supabase
        .from('public_profiles')
        .select('id, user_id, username, display_name, avatar_url')
        .neq('user_id', user.id)
        .or(`username.ilike.%${query}%,display_name.ilike.%${query}%`)
        .limit(20);

      if (error) throw error;
      setUsers((data || []) as UserProfile[]);
    } catch (err) {
      console.error('Error searching users:', err);
      toast.error(t('messages.searchError'));
    } finally {
      setSearchLoading(false);
    }
  }, [user, t]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setUsers([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim()) {
        searchUsers(searchQuery);
      } else {
        setUsers([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchUsers]);

  const handleSelectUser = async (selectedUser: UserProfile) => {
    if (!user) {
      toast.error(t('messages.signInRequired'));
      return;
    }

    setLoading(true);
    try {
      const { conversationId } = await createOrGetDirectConversation(user.id, selectedUser.user_id);
      onSelectConversation(conversationId, 'direct', selectedUser);
      onClose();
    } catch (err) {
      console.error('Error creating conversation:', err);
      toast.error(t('messages.createError'));
    } finally {
      setLoading(false);
    }
  };

  const getDisplayName = (u: UserProfile) => u.display_name || u.username || 'Unknown';
  const getInitials = (u: UserProfile) => getDisplayName(u).slice(0, 2).toUpperCase();

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl">
        <SheetHeader className="text-left pb-4">
          <SheetTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            {t('messages.newMessage')}
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={t('messages.searchUsers')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              autoFocus
            />
          </div>

          {/* Start group chat option */}
          <button
            onClick={() => {
              onClose();
              onStartGroupChat();
            }}
            className={cn(
              'flex items-center gap-3 w-full p-4 rounded-xl',
              'bg-muted/50 hover:bg-muted transition-colors text-left'
            )}
          >
            <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-primary" />
            </div>
            <div>
              <p className="font-medium">{t('messages.newGroup')}</p>
              <p className="text-sm text-muted-foreground">
                {t('messages.createGroupHint')}
              </p>
            </div>
          </button>

          {/* User search results */}
          <div className="flex-1 overflow-y-auto max-h-[50vh]">
            {searchLoading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            ) : searchQuery.trim() && users.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                {t('messages.noUsersFound')}
              </p>
            ) : (
              <div className="space-y-1">
                {users.map((u) => (
                  <button
                    key={u.user_id}
                    onClick={() => handleSelectUser(u)}
                    disabled={loading}
                    className={cn(
                      'flex items-center gap-3 w-full p-3 rounded-xl',
                      'hover:bg-muted/50 transition-colors text-left',
                      loading && 'opacity-60 pointer-events-none'
                    )}
                  >
                    <Avatar className="w-11 h-11">
                      <AvatarImage src={u.avatar_url || undefined} />
                      <AvatarFallback>{getInitials(u)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0 text-left">
                      <p className="font-medium truncate">{getDisplayName(u)}</p>
                      {u.username && (
                        <p className="text-sm text-muted-foreground truncate">@{u.username}</p>
                      )}
                    </div>
                    <UserPlus className="w-5 h-5 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default NewChatSheet;
