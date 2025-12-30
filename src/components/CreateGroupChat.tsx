import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { X, Search, Check, Users, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface User {
  id: string;
  userId: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface CreateGroupChatProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (conversationId: string) => void;
}

export const CreateGroupChat: React.FC<CreateGroupChatProps> = ({ isOpen, onClose, onCreated }) => {
  const { user } = useAuth();
  const [step, setStep] = useState<'select' | 'details'>('select');
  const [searchQuery, setSearchQuery] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    } else {
      // Reset state
      setStep('select');
      setSearchQuery('');
      setSelectedUsers([]);
      setGroupName('');
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, username, display_name, avatar_url')
        .neq('user_id', user?.id)
        .limit(50);

      if (error) throw error;

      setUsers((data || []).map(u => ({
        id: u.id,
        userId: u.user_id,
        username: u.username,
        displayName: u.display_name,
        avatarUrl: u.avatar_url,
      })));
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const toggleUserSelection = (selectedUser: User) => {
    setSelectedUsers(prev => {
      const isSelected = prev.some(u => u.userId === selectedUser.userId);
      if (isSelected) {
        return prev.filter(u => u.userId !== selectedUser.userId);
      }
      return [...prev, selectedUser];
    });
  };

  const handleCreateGroup = async () => {
    if (selectedUsers.length < 2) {
      toast.error('Select at least 2 members for a group');
      return;
    }

    if (!groupName.trim()) {
      toast.error('Please enter a group name');
      return;
    }

    setIsLoading(true);
    try {
      // Create conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'group',
          name: groupName,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add current user as admin
      await supabase.from('conversation_participants').insert({
        conversation_id: conversation.id,
        user_id: user!.id,
        role: 'admin',
      });

      // Add selected users as members
      await supabase.from('conversation_participants').insert(
        selectedUsers.map(u => ({
          conversation_id: conversation.id,
          user_id: u.userId,
          role: 'member',
        }))
      );

      toast.success('Group created!');
      onCreated(conversation.id);
      onClose();
    } catch (error) {
      console.error('Error creating group:', error);
      toast.error('Failed to create group');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const name = u.displayName || u.username || '';
    return name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getInitials = (user: User) => {
    const name = user.displayName || user.username || 'U';
    return name.slice(0, 2).toUpperCase();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <Button variant="ghost" onClick={onClose}>Cancel</Button>
        <h2 className="font-semibold">
          {step === 'select' ? 'New Group' : 'Group Details'}
        </h2>
        {step === 'select' ? (
          <Button
            onClick={() => setStep('details')}
            disabled={selectedUsers.length < 2}
          >
            Next
          </Button>
        ) : (
          <Button onClick={handleCreateGroup} disabled={isLoading}>
            {isLoading ? 'Creating...' : 'Create'}
          </Button>
        )}
      </div>

      {step === 'select' ? (
        <>
          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="flex gap-2 p-4 overflow-x-auto border-b border-border">
              {selectedUsers.map(u => (
                <button
                  key={u.userId}
                  onClick={() => toggleUserSelection(u)}
                  className="flex flex-col items-center gap-1 min-w-[60px]"
                >
                  <div className="relative">
                    <Avatar className="w-12 h-12">
                      <AvatarImage src={u.avatarUrl || undefined} />
                      <AvatarFallback>{getInitials(u)}</AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-destructive rounded-full flex items-center justify-center">
                      <X className="w-3 h-3 text-destructive-foreground" />
                    </div>
                  </div>
                  <span className="text-xs truncate max-w-[60px]">{u.displayName || u.username}</span>
                </button>
              ))}
            </div>
          )}

          {/* Search */}
          <div className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Users List */}
          <div className="flex-1 overflow-y-auto">
            {filteredUsers.map(u => {
              const isSelected = selectedUsers.some(s => s.userId === u.userId);
              
              return (
                <button
                  key={u.userId}
                  onClick={() => toggleUserSelection(u)}
                  className="flex items-center gap-3 w-full p-4 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="w-12 h-12">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback>{getInitials(u)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 text-left">
                    <p className="font-medium">{u.displayName || u.username}</p>
                    {u.username && u.displayName && (
                      <p className="text-sm text-muted-foreground">@{u.username}</p>
                    )}
                  </div>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 flex items-center justify-center",
                    isSelected ? "bg-primary border-primary" : "border-muted-foreground"
                  )}>
                    {isSelected && <Check className="w-4 h-4 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <div className="p-6 space-y-6">
          {/* Group Photo */}
          <div className="flex flex-col items-center gap-4">
            <button className="relative">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center">
                <Users className="w-10 h-10 text-muted-foreground" />
              </div>
              <div className="absolute bottom-0 right-0 w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <Camera className="w-4 h-4 text-primary-foreground" />
              </div>
            </button>
            <p className="text-sm text-muted-foreground">Add group photo</p>
          </div>

          {/* Group Name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Group Name</label>
            <Input
              placeholder="Enter group name..."
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
            />
          </div>

          {/* Members Preview */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Members ({selectedUsers.length + 1})</label>
            <div className="flex flex-wrap gap-2">
              {selectedUsers.map(u => (
                <div key={u.userId} className="flex items-center gap-2 bg-muted px-3 py-1.5 rounded-full">
                  <Avatar className="w-6 h-6">
                    <AvatarImage src={u.avatarUrl || undefined} />
                    <AvatarFallback className="text-xs">{getInitials(u)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm">{u.displayName || u.username}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
