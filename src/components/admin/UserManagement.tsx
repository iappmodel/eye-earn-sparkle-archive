import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useUserRole } from '@/hooks/useUserRole';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { 
  Users, 
  Search, 
  Shield, 
  Ban,
  UserCheck,
  Crown,
  Loader2
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface UserWithRole {
  id: string;
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean | null;
  kyc_status: string | null;
  created_at: string;
  role?: string;
  isBanned?: boolean;
}

const UserManagement: React.FC = () => {
  const { userBans, banUser, unbanUser, updateUserRole } = useAdmin();
  const { isAdmin } = useUserRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [banReason, setBanReason] = useState('');
  const [newRole, setNewRole] = useState<string>('');
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, [userBans]);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    // Fetch profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (profilesError) {
      console.error('Error fetching profiles:', profilesError);
      setIsLoading(false);
      return;
    }

    // Fetch roles
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role');

    if (rolesError) {
      console.error('Error fetching roles:', rolesError);
    }

    // Combine data
    const usersWithRoles: UserWithRole[] = (profiles || []).map(profile => {
      const userRole = roles?.find(r => r.user_id === profile.user_id);
      const isBanned = userBans.some(b => b.user_id === profile.user_id);
      return {
        ...profile,
        role: userRole?.role || 'user',
        isBanned,
      };
    });

    setUsers(usersWithRoles);
    setIsLoading(false);
  };

  const filteredUsers = users.filter(user => {
    const query = searchQuery.toLowerCase();
    return (
      user.username?.toLowerCase().includes(query) ||
      user.display_name?.toLowerCase().includes(query) ||
      user.user_id.toLowerCase().includes(query)
    );
  });

  const handleBanUser = async () => {
    if (!selectedUser || !banReason) return;
    await banUser(selectedUser.user_id, banReason, true);
    setShowBanDialog(false);
    setBanReason('');
    setSelectedUser(null);
  };

  const handleUnbanUser = async (userId: string) => {
    const ban = userBans.find(b => b.user_id === userId);
    if (ban) {
      await unbanUser(ban.id, userId);
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;
    await updateUserRole(selectedUser.user_id, newRole as 'user' | 'creator' | 'moderator' | 'admin');
    setShowRoleDialog(false);
    setNewRole('');
    setSelectedUser(null);
    await fetchUsers();
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin':
        return <Badge className="bg-primary"><Crown className="w-3 h-3 mr-1" /> Admin</Badge>;
      case 'moderator':
        return <Badge className="bg-accent"><Shield className="w-3 h-3 mr-1" /> Mod</Badge>;
      case 'creator':
        return <Badge variant="secondary"><UserCheck className="w-3 h-3 mr-1" /> Creator</Badge>;
      default:
        return <Badge variant="outline">User</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username, display name, or ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* User List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin" />
            </div>
          ) : filteredUsers.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found</p>
          ) : (
            <div className="space-y-3">
              {filteredUsers.map((user) => (
                <div 
                  key={user.id} 
                  className={`flex items-center justify-between p-4 border rounded-lg ${
                    user.isBanned ? 'bg-destructive/10 border-destructive/30' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      {user.avatar_url ? (
                        <img 
                          src={user.avatar_url} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <Users className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {user.display_name || user.username || 'Unknown'}
                        </span>
                        {user.is_verified && (
                          <Badge variant="outline" className="text-primary border-primary text-xs">
                            Verified
                          </Badge>
                        )}
                        {user.isBanned && (
                          <Badge variant="destructive" className="text-xs">
                            <Ban className="w-3 h-3 mr-1" /> Banned
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">
                        @{user.username || 'no-username'} • Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getRoleBadge(user.role || 'user')}
                    <div className="flex gap-1">
                      {isAdmin && (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setNewRole(user.role || 'user');
                            setShowRoleDialog(true);
                          }}
                        >
                          <Shield className="w-4 h-4" />
                        </Button>
                      )}
                      {user.isBanned ? (
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleUnbanUser(user.user_id)}
                        >
                          Unban
                        </Button>
                      ) : (
                        <Button 
                          variant="destructive" 
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowBanDialog(true);
                          }}
                        >
                          <Ban className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Banned Users */}
      {userBans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Ban className="w-5 h-5" />
              Banned Users ({userBans.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {userBans.map((ban) => (
                <div 
                  key={ban.id}
                  className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg bg-destructive/5"
                >
                  <div>
                    <p className="font-medium">User: {ban.user_id.slice(0, 8)}...</p>
                    <p className="text-sm text-muted-foreground">
                      Reason: {ban.reason}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ban.is_permanent ? 'Permanent' : `Expires: ${ban.expires_at}`}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => unbanUser(ban.id, ban.user_id)}
                  >
                    Unban
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ban Dialog */}
      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ban User</DialogTitle>
            <DialogDescription>
              This will prevent the user from accessing the platform.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p>
              Banning: <strong>{selectedUser?.display_name || selectedUser?.username}</strong>
            </p>
            <Textarea
              placeholder="Reason for ban..."
              value={banReason}
              onChange={(e) => setBanReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleBanUser} disabled={!banReason}>
              Ban User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Role Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update User Role</DialogTitle>
            <DialogDescription>
              Change the role for {selectedUser?.display_name || selectedUser?.username}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateRole}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserManagement;
