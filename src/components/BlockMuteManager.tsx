import React, { useState, useEffect } from 'react';
import { X, Ban, VolumeX, Trash2, Search, UserX, AlertCircle, Loader2 } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from './ui/alert-dialog';

interface BlockMuteManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

interface BlockedUser {
  id: string;
  blocked_user_id: string;
  block_type: 'block' | 'mute';
  reason: string | null;
  created_at: string;
  blocked_profile?: {
    display_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export const BlockMuteManager: React.FC<BlockMuteManagerProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'blocked' | 'muted'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [unblockDialog, setUnblockDialog] = useState<{ open: boolean; user: BlockedUser | null }>({
    open: false,
    user: null,
  });

  useEffect(() => {
    if (isOpen && user) {
      fetchBlockedUsers();
    }
  }, [isOpen, user]);

  const fetchBlockedUsers = async () => {
    if (!user) return;
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase
        .from('blocked_users')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Fetch profile info for blocked users
      if (data && data.length > 0) {
        const blockedUserIds = data.map(b => b.blocked_user_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, display_name, username, avatar_url')
          .in('user_id', blockedUserIds);

        const profileMap = new Map(profiles?.map(p => [p.user_id, p]) || []);
        
        const enrichedData = data.map(block => ({
          ...block,
          block_type: block.block_type as 'block' | 'mute',
          blocked_profile: profileMap.get(block.blocked_user_id) || undefined,
        }));
        
        setBlockedUsers(enrichedData);
      } else {
        setBlockedUsers([]);
      }
    } catch (error: any) {
      toast.error('Failed to load blocked users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnblock = async (blockedUser: BlockedUser) => {
    try {
      const { error } = await supabase
        .from('blocked_users')
        .delete()
        .eq('id', blockedUser.id);

      if (error) throw error;

      setBlockedUsers(prev => prev.filter(b => b.id !== blockedUser.id));
      toast.success(
        blockedUser.block_type === 'block' 
          ? 'User unblocked' 
          : 'User unmuted'
      );
      setUnblockDialog({ open: false, user: null });
    } catch (error: any) {
      toast.error('Failed to unblock user');
    }
  };

  if (!isOpen) return null;

  const filteredUsers = blockedUsers.filter(b => {
    if (filter === 'blocked' && b.block_type !== 'block') return false;
    if (filter === 'muted' && b.block_type !== 'mute') return false;
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const name = b.blocked_profile?.display_name?.toLowerCase() || '';
      const username = b.blocked_profile?.username?.toLowerCase() || '';
      return name.includes(query) || username.includes(query);
    }
    
    return true;
  });

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border/50">
          <h1 className="font-display text-lg font-bold">Blocked & Muted</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        {/* Filters */}
        <div className="p-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search users..."
              className="pl-10 neu-inset"
            />
          </div>
          
          <div className="flex gap-2">
            {(['all', 'blocked', 'muted'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "flex-1 py-2 px-4 rounded-xl text-sm font-medium transition-all",
                  filter === f
                    ? "bg-primary text-primary-foreground"
                    : "neu-button hover:bg-secondary"
                )}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Users List */}
        <div className="flex-1 overflow-y-auto px-4 pb-24">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center mb-4">
                <UserX className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">
                {filter === 'all' ? 'No Blocked or Muted Users' : `No ${filter} users`}
              </h3>
              <p className="text-sm text-muted-foreground">
                Users you block or mute will appear here
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((blockedUser) => (
                <div
                  key={blockedUser.id}
                  className="neu-card rounded-xl p-4 flex items-center gap-3"
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden bg-secondary">
                    <img
                      src={blockedUser.blocked_profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${blockedUser.blocked_user_id}`}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">
                        {blockedUser.blocked_profile?.display_name || 'Unknown User'}
                      </p>
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-xs font-medium",
                        blockedUser.block_type === 'block'
                          ? "bg-destructive/20 text-destructive"
                          : "bg-amber-500/20 text-amber-500"
                      )}>
                        {blockedUser.block_type === 'block' ? (
                          <span className="flex items-center gap-1">
                            <Ban className="w-3 h-3" /> Blocked
                          </span>
                        ) : (
                          <span className="flex items-center gap-1">
                            <VolumeX className="w-3 h-3" /> Muted
                          </span>
                        )}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground truncate">
                      @{blockedUser.blocked_profile?.username || 'unknown'}
                    </p>
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUnblockDialog({ open: true, user: blockedUser })}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Banner */}
        <div className="p-4 border-t border-border/50">
          <div className="flex items-start gap-3 p-3 rounded-xl bg-secondary/50">
            <AlertCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p><strong>Blocked users</strong> can't see your content or message you.</p>
              <p className="mt-1"><strong>Muted users</strong> won't appear in your feeds.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Unblock Confirmation Dialog */}
      <AlertDialog 
        open={unblockDialog.open} 
        onOpenChange={(open) => setUnblockDialog({ open, user: unblockDialog.user })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {unblockDialog.user?.block_type === 'block' ? 'Unblock' : 'Unmute'} User?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {unblockDialog.user?.block_type === 'block' 
                ? 'This user will be able to see your content and message you again.'
                : 'This user\'s content will appear in your feeds again.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unblockDialog.user && handleUnblock(unblockDialog.user)}
            >
              {unblockDialog.user?.block_type === 'block' ? 'Unblock' : 'Unmute'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// Hook for blocking/muting users from anywhere in the app
export const useBlockMute = () => {
  const { user } = useAuth();

  const blockUser = async (targetUserId: string, reason?: string) => {
    if (!user) {
      toast.error('Please sign in to block users');
      return false;
    }

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          user_id: user.id,
          blocked_user_id: targetUserId,
          block_type: 'block',
          reason,
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('User is already blocked');
          return false;
        }
        throw error;
      }

      toast.success('User blocked');
      return true;
    } catch (error) {
      toast.error('Failed to block user');
      return false;
    }
  };

  const muteUser = async (targetUserId: string, reason?: string) => {
    if (!user) {
      toast.error('Please sign in to mute users');
      return false;
    }

    try {
      const { error } = await supabase
        .from('blocked_users')
        .insert({
          user_id: user.id,
          blocked_user_id: targetUserId,
          block_type: 'mute',
          reason,
        });

      if (error) {
        if (error.code === '23505') {
          toast.info('User is already muted');
          return false;
        }
        throw error;
      }

      toast.success('User muted');
      return true;
    } catch (error) {
      toast.error('Failed to mute user');
      return false;
    }
  };

  const isBlocked = async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;

    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('blocked_user_id', targetUserId)
      .eq('block_type', 'block')
      .single();

    return !!data;
  };

  const isMuted = async (targetUserId: string): Promise<boolean> => {
    if (!user) return false;

    const { data } = await supabase
      .from('blocked_users')
      .select('id')
      .eq('user_id', user.id)
      .eq('blocked_user_id', targetUserId)
      .eq('block_type', 'mute')
      .single();

    return !!data;
  };

  return { blockUser, muteUser, isBlocked, isMuted };
};
