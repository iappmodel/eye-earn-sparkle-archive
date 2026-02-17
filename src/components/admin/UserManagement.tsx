import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAdmin } from '@/hooks/useAdmin';
import { useUserRole } from '@/hooks/useUserRole';
import { useAdminUsers } from '@/hooks/useAdminUsers';
import { adminUsersService, type AdminUserListItem, type AppRole } from '@/services/adminUsers.service';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Users,
  Search,
  Shield,
  Ban,
  UserCheck,
  Crown,
  Loader2,
  ExternalLink,
  MoreHorizontal,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Calendar,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import { Link } from 'react-router-dom';
import { toast } from '@/hooks/use-toast';

function getRoleBadge(role: string) {
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
}

const UserManagement: React.FC = () => {
  const { userBans, banUser, unbanUser, updateUserRole, refresh: refreshAdmin } = useAdmin();
  const { isAdmin } = useUserRole();
  const [useApi, setUseApi] = useState<boolean | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<AdminUserListItem | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banPermanent, setBanPermanent] = useState(true);
  const [banExpiresAt, setBanExpiresAt] = useState('');
  const [newRole, setNewRole] = useState<string>('');
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showDetailSheet, setShowDetailSheet] = useState(false);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);
  const [localFilters, setLocalFilters] = useState<{ role?: AppRole; kyc_status?: string; banned?: boolean; sort?: string; order?: 'asc' | 'desc' }>({});

  const apiHook = useAdminUsers({ initialPageSize: 25, includeAuth: true });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    if (useApi === null) return;
    if (useApi) {
      apiHook.updateFilters({
        search: debouncedSearch,
        role: apiHook.filters.role,
        kyc_status: apiHook.filters.kyc_status,
        banned: apiHook.filters.banned,
      });
    }
  }, [debouncedSearch, useApi]);

  const [fallbackUsers, setFallbackUsers] = useState<AdminUserListItem[]>([]);
  const [fallbackLoading, setFallbackLoading] = useState(false);
  const [fallbackPage, setFallbackPage] = useState(0);
  const FALLBACK_PAGE_SIZE = 25;

  const fetchWithApi = useCallback(async () => {
    try {
      await apiHook.fetchUsers(1, { search: debouncedSearch });
      setUseApi(true);
    } catch {
      setUseApi(false);
      fetchFallback();
    }
  }, [debouncedSearch]);

  const fetchFallback = useCallback(async () => {
    setFallbackLoading(true);
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, user_id, username, display_name, avatar_url, bio, is_verified, kyc_status, vicoin_balance, icoin_balance, followers_count, following_count, total_views, total_likes, created_at, updated_at')
      .order('created_at', { ascending: false })
      .limit(500);
    const { data: roles } = await supabase.from('user_roles').select('user_id, role');
    const rolesMap = new Map((roles || []).map((r) => [r.user_id, r.role]));
    const banMap = new Set((userBans || []).map((b) => b.user_id));
    const list: AdminUserListItem[] = (profiles || []).map((p) => {
      const q = debouncedSearch.toLowerCase();
      if (q && !p.username?.toLowerCase().includes(q) && !p.display_name?.toLowerCase().includes(q) && !p.user_id.toLowerCase().includes(q)) return null;
      const banRec = userBans?.find((b) => b.user_id === p.user_id);
      return {
        ...p,
        role: rolesMap.get(p.user_id) || 'user',
        isBanned: !!banRec,
        ban: banRec ? { id: banRec.id, reason: banRec.reason, is_permanent: banRec.is_permanent, expires_at: banRec.expires_at, created_at: banRec.created_at } : null,
      };
    }).filter(Boolean) as AdminUserListItem[];
    setFallbackUsers(list);
    setFallbackLoading(false);
  }, [debouncedSearch, userBans]);

  useEffect(() => {
    fetchWithApi();
  }, []);

  useEffect(() => {
    if (useApi === false) {
      setFallbackPage(0);
      fetchFallback();
    }
  }, [useApi, debouncedSearch, userBans]);

  const fallbackFiltered = fallbackUsers.filter((u) => {
    if (localFilters.role && u.role !== localFilters.role) return false;
    if (localFilters.banned === true && !u.isBanned) return false;
    if (localFilters.banned === false && u.isBanned) return false;
    if (localFilters.kyc_status && u.kyc_status !== localFilters.kyc_status) return false;
    return true;
  });
  const fallbackPaginated = fallbackFiltered.slice(fallbackPage * FALLBACK_PAGE_SIZE, (fallbackPage + 1) * FALLBACK_PAGE_SIZE);
  const fallbackTotalPages = Math.max(1, Math.ceil(fallbackFiltered.length / FALLBACK_PAGE_SIZE));

  const users = useApi ? apiHook.users : fallbackPaginated;
  const isLoading = useApi ? apiHook.isLoading : fallbackLoading;
  const error = useApi ? apiHook.error : null;
  const totalPages = useApi ? apiHook.totalPages : fallbackTotalPages;
  const page = useApi ? apiHook.page : fallbackPage + 1;
  const total = useApi ? apiHook.total : fallbackFiltered.length;

  const handleBanUser = async () => {
    if (!selectedUser || !banReason) return;
    const expiresAt = !banPermanent && banExpiresAt ? new Date(banExpiresAt) : undefined;
    await banUser(selectedUser.user_id, banReason, banPermanent, expiresAt);
    setShowBanDialog(false);
    setBanReason('');
    setBanPermanent(true);
    setBanExpiresAt('');
    setSelectedUser(null);
    refreshAdmin();
    if (useApi) apiHook.refresh();
  };

  const handleUnbanUser = async (userId: string) => {
    const ban = userBans.find(b => b.user_id === userId);
    if (ban) {
      await unbanUser(ban.id, userId);
      refreshAdmin();
      if (useApi) apiHook.refresh();
    }
  };

  const handleUpdateRole = async () => {
    if (!selectedUser || !newRole) return;
    await updateUserRole(selectedUser.user_id, newRole as AppRole);
    setShowRoleDialog(false);
    setNewRole('');
    setSelectedUser(null);
    refreshAdmin();
    if (useApi) apiHook.refresh();
  };

  const toggleSelect = (userId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === users.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(users.map(u => u.user_id)));
  };

  const handleBulkBan = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await adminUsersService.bulkBan([...selectedIds], {
        reason: banReason || 'Bulk ban by admin',
        is_permanent: banPermanent,
        expires_at: !banPermanent && banExpiresAt ? new Date(banExpiresAt).toISOString() : undefined,
      });
      toast({ title: 'Bulk ban', description: `${res.success_count} of ${res.total} users banned` });
      setSelectedIds(new Set());
      setShowBanDialog(false);
      setBanReason('');
      refreshAdmin();
      if (useApi) apiHook.refresh();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Bulk ban failed', variant: 'destructive' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkUnban = async () => {
    if (selectedIds.size === 0) return;
    setBulkActionLoading(true);
    try {
      const res = await adminUsersService.bulkUnban([...selectedIds]);
      toast({ title: 'Bulk unban', description: `${res.success_count} of ${res.total} users unbanned` });
      setSelectedIds(new Set());
      refreshAdmin();
      if (useApi) apiHook.refresh();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Bulk unban failed', variant: 'destructive' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkRole = async () => {
    if (selectedIds.size === 0 || !newRole) return;
    setBulkActionLoading(true);
    try {
      const res = await adminUsersService.bulkUpdateRole([...selectedIds], newRole as AppRole);
      toast({ title: 'Bulk role update', description: `${res.success_count} of ${res.total} roles updated` });
      setSelectedIds(new Set());
      setShowRoleDialog(false);
      setNewRole('');
      refreshAdmin();
      if (useApi) apiHook.refresh();
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Bulk role update failed', variant: 'destructive' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const exportCsv = () => {
    const rows = users.map(u => [
      u.user_id,
      u.username ?? '',
      u.display_name ?? '',
      u.role,
      u.kyc_status ?? '',
      u.isBanned ? 'yes' : 'no',
      u.email ?? '',
      u.created_at,
    ]);
    const header = ['User ID', 'Username', 'Display Name', 'Role', 'KYC', 'Banned', 'Email', 'Created'];
    const csv = [header, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `users-export-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: 'Exported', description: `${users.length} users exported to CSV` });
  };

  const openDetail = (user: AdminUserListItem) => {
    setDetailUserId(user.user_id);
    setShowDetailSheet(true);
  };

  const isBulkBanMode = selectedIds.size > 0 && users.some(u => selectedIds.has(u.user_id) && !u.isBanned);
  const isBulkUnbanMode = selectedIds.size > 0 && users.some(u => selectedIds.has(u.user_id) && u.isBanned);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            User Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by username, display name, or ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-10"
              />
            </div>
            {useApi !== null && (
              <>
                <Select
                  value={(useApi ? apiHook.filters.role : localFilters.role) ?? 'all'}
                  onValueChange={(v) => {
                    const val = v === 'all' ? undefined : (v as AppRole);
                    if (useApi) apiHook.updateFilters({ role: val });
                    else setLocalFilters((f) => ({ ...f, role: val }));
                  }}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All roles</SelectItem>
                    <SelectItem value="user">User</SelectItem>
                    <SelectItem value="creator">Creator</SelectItem>
                    <SelectItem value="moderator">Moderator</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={(useApi ? apiHook.filters.kyc_status : localFilters.kyc_status) ?? 'all'}
                  onValueChange={(v) => {
                    const val = v === 'all' ? undefined : (v as 'pending' | 'submitted' | 'verified' | 'rejected');
                    if (useApi) apiHook.updateFilters({ kyc_status: val });
                    else setLocalFilters((f) => ({ ...f, kyc_status: val }));
                  }}
                >
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="KYC" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All KYC</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="submitted">Submitted</SelectItem>
                    <SelectItem value="verified">Verified</SelectItem>
                    <SelectItem value="rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={(useApi ? apiHook.filters.banned : localFilters.banned) === undefined ? 'all' : (useApi ? apiHook.filters.banned : localFilters.banned) ? 'banned' : 'active'}
                  onValueChange={(v) => {
                    const val = v === 'all' ? undefined : v === 'banned';
                    if (useApi) apiHook.updateFilters({ banned: val });
                    else setLocalFilters((f) => ({ ...f, banned: val }));
                  }}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                  </SelectContent>
                </Select>
                <Select
                  value={useApi
                    ? `${apiHook.filters.sort ?? 'created_at'}:${apiHook.filters.order ?? 'desc'}`
                    : `${localFilters.sort ?? 'created_at'}:${localFilters.order ?? 'desc'}`}
                  onValueChange={(v) => {
                    const [sort, order] = v.split(':') as [string, 'asc' | 'desc'];
                    if (useApi) apiHook.updateFilters({ sort: sort as 'created_at' | 'username' | 'followers_count' | 'total_views', order });
                    else setLocalFilters((f) => ({ ...f, sort, order }));
                  }}
                >
                  <SelectTrigger className="w-[160px]">
                    <SelectValue placeholder="Sort" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="created_at:desc">Newest first</SelectItem>
                    <SelectItem value="created_at:asc">Oldest first</SelectItem>
                    <SelectItem value="username:asc">Username A–Z</SelectItem>
                    <SelectItem value="followers_count:desc">Most followers</SelectItem>
                    <SelectItem value="total_views:desc">Most views</SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={users.length === 0}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
          {error}
        </div>
      )}

      {selectedIds.size > 0 && (
        <Card className="border-primary/50 bg-primary/5">
          <CardContent className="py-3 flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">{selectedIds.size} selected</span>
            {isAdmin && (
              <>
                {isBulkUnbanMode && (
                  <Button variant="outline" size="sm" onClick={handleBulkUnban} disabled={bulkActionLoading}>
                    Unban selected
                  </Button>
                )}
                {isBulkBanMode && (
                  <Button variant="destructive" size="sm" onClick={() => { setSelectedUser(null); setBanReason(''); setShowBanDialog(true); }} disabled={bulkActionLoading}>
                    Ban selected
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => { setSelectedUser(null); setNewRole('user'); setShowRoleDialog(true); }} disabled={bulkActionLoading}>
                  Change role
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : !useApi ? (
            <p className="text-muted-foreground text-center py-8">Loading…</p>
          ) : users.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No users found</p>
          ) : (
            <>
              <div className="space-y-2">
                {users.map((user) => (
                  <div
                    key={user.user_id}
                    className={`flex items-center gap-3 p-4 border rounded-lg transition-colors ${
                      user.isBanned ? 'bg-destructive/10 border-destructive/30' : 'hover:bg-muted/50'
                    }`}
                  >
                    {isAdmin && (
                      <Checkbox
                        checked={selectedIds.has(user.user_id)}
                        onCheckedChange={() => toggleSelect(user.user_id)}
                      />
                    )}
                    <div
                      className="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
                      onClick={() => openDetail(user)}
                    >
                      <div className="w-10 h-10 shrink-0 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                        {user.avatar_url ? (
                          <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-5 h-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            to={`/profile/${user.username || user.user_id}`}
                            className="font-medium hover:underline truncate"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {user.display_name || user.username || 'Unknown'}
                          </Link>
                          <a
                            href={`/profile/${user.username || user.user_id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground shrink-0"
                            aria-label="Open in new tab"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                          {user.is_verified && (
                            <Badge variant="outline" className="text-primary border-primary text-xs">Verified</Badge>
                          )}
                          {user.isBanned && (
                            <Badge variant="destructive" className="text-xs"><Ban className="w-3 h-3 mr-1" /> Banned</Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          @{user.username || 'no-username'} • Joined {formatDistanceToNow(new Date(user.created_at), { addSuffix: true })}
                          {user.email && ` • ${user.email}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {getRoleBadge(user.role)}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openDetail(user)}>
                            View details
                          </DropdownMenuItem>
                          {isAdmin && (
                            <>
                              <DropdownMenuItem onClick={() => { setSelectedUser(user); setSelectedIds(new Set()); setNewRole(user.role); setShowRoleDialog(true); }}>
                                Change role
                              </DropdownMenuItem>
                              {user.isBanned ? (
                                <DropdownMenuItem onClick={() => handleUnbanUser(user.user_id)}>
                                  Unban
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem className="text-destructive" onClick={() => { setSelectedUser(user); setSelectedIds(new Set()); setShowBanDialog(true); }}>
                                  Ban user
                                </DropdownMenuItem>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 mt-4 border-t">
                  <p className="text-sm text-muted-foreground">
                    {total} users • page {page} of {totalPages}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (useApi ? apiHook.goToPage(page - 1) : setFallbackPage((p) => Math.max(0, p - 1)))}
                      disabled={page <= 1}
                    >
                      <ChevronLeft className="w-4 h-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => (useApi ? apiHook.goToPage(page + 1) : setFallbackPage((p) => Math.min(fallbackTotalPages - 1, p + 1)))}
                      disabled={page >= totalPages}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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
              {userBans.slice(0, 10).map((ban) => (
                <div key={ban.id} className="flex items-center justify-between p-3 border border-destructive/30 rounded-lg bg-destructive/5">
                  <div>
                    <p className="font-medium">User: {ban.user_id.slice(0, 8)}...</p>
                    <p className="text-sm text-muted-foreground">Reason: {ban.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {ban.is_permanent ? 'Permanent' : `Expires: ${ban.expires_at}`}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => unbanUser(ban.id, ban.user_id)}>
                    Unban
                  </Button>
                </div>
              ))}
              {userBans.length > 10 && <p className="text-sm text-muted-foreground">…and {userBans.length - 10} more</p>}
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedIds.size > 0 ? 'Bulk Ban Users' : 'Ban User'}</DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0
                ? `This will ban ${selectedIds.size} selected users.`
                : `Banning: ${selectedUser?.display_name || selectedUser?.username}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Reason</Label>
              <Textarea placeholder="Reason for ban..." value={banReason} onChange={(e) => setBanReason(e.target.value)} />
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox id="permanent-ban" checked={banPermanent} onCheckedChange={(v) => setBanPermanent(!!v)} />
              <Label htmlFor="permanent-ban" className="text-sm font-normal cursor-pointer">Permanent ban</Label>
            </div>
            {!banPermanent && (
              <div className="space-y-2">
                <Label>Expires at</Label>
                <Input type="datetime-local" value={banExpiresAt} onChange={(e) => setBanExpiresAt(e.target.value)} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBanDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={selectedIds.size > 0 ? handleBulkBan : handleBanUser}
              disabled={!banReason || bulkActionLoading}
            >
              {selectedIds.size > 0 ? `Ban ${selectedIds.size} users` : 'Ban User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedIds.size > 0 ? 'Bulk Update Role' : 'Update User Role'}</DialogTitle>
            <DialogDescription>
              {selectedIds.size > 0
                ? `Change role for ${selectedIds.size} selected users`
                : `Change role for ${selectedUser?.display_name || selectedUser?.username}`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newRole} onValueChange={setNewRole}>
              <SelectTrigger><SelectValue placeholder="Select role" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="user">User</SelectItem>
                <SelectItem value="creator">Creator</SelectItem>
                <SelectItem value="moderator">Moderator</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRoleDialog(false)}>Cancel</Button>
            <Button onClick={selectedIds.size > 0 ? handleBulkRole : handleUpdateRole} disabled={!newRole || bulkActionLoading}>
              Update Role
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UserDetailSheet
        userId={detailUserId}
        open={showDetailSheet}
        onOpenChange={setShowDetailSheet}
        onBan={() => {
          const u = users.find(x => x.user_id === detailUserId);
          if (u) { setSelectedUser(u); setShowBanDialog(true); }
        }}
        onUnban={() => detailUserId && handleUnbanUser(detailUserId)}
        onRoleChange={() => {
          const u = users.find(x => x.user_id === detailUserId);
          if (u) { setSelectedUser(u); setNewRole(u.role); setShowRoleDialog(true); }
        }}
        isAdmin={isAdmin}
      />
    </div>
  );
};

function UserDetailSheet({
  userId,
  open,
  onOpenChange,
  onBan,
  onUnban,
  onRoleChange,
  isAdmin,
}: {
  userId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onBan: () => void;
  onUnban: () => void;
  onRoleChange: () => void;
  isAdmin: boolean;
}) {
  const [detail, setDetail] = useState<Awaited<ReturnType<typeof adminUsersService.getUserDetail>> | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!userId || !open) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    adminUsersService.getUserDetail(userId).then((d) => {
      if (!cancelled) setDetail(d);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [userId, open]);

  const profile = detail?.profile;
  if (!userId) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>User details</SheetTitle>
        </SheetHeader>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : detail ? (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Users className="w-8 h-8 text-muted-foreground" />
                )}
              </div>
              <div>
                <h3 className="font-semibold text-lg">{profile?.display_name || profile?.username || 'Unknown'}</h3>
                <p className="text-muted-foreground">@{profile?.username || 'no-username'}</p>
                {getRoleBadge(detail.role)}
              </div>
            </div>
            <div className="space-y-2 text-sm">
              {detail.email && (
                <p className="flex items-center gap-2"><Mail className="w-4 h-4" /> {detail.email}</p>
              )}
              <p className="flex items-center gap-2"><Calendar className="w-4 h-4" /> Joined {profile?.created_at && format(new Date(profile.created_at), 'PPP')}</p>
              {detail.last_sign_in_at && (
                <p className="text-muted-foreground">Last sign-in: {formatDistanceToNow(new Date(detail.last_sign_in_at), { addSuffix: true })}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Content</p>
                <p className="font-medium">{detail.content_count}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Transactions</p>
                <p className="font-medium">{detail.transaction_count}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">Balance (V/I)</p>
                <p className="font-medium">{profile?.vicoin_balance ?? 0} / {profile?.icoin_balance ?? 0}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs text-muted-foreground">KYC</p>
                <p className="font-medium capitalize">{profile?.kyc_status ?? 'pending'}</p>
              </div>
            </div>
            {detail.ban && (
              <div className="p-3 rounded-lg border border-destructive/30 bg-destructive/10">
                <p className="font-medium text-destructive">Banned</p>
                <p className="text-sm">{detail.ban.reason}</p>
                <p className="text-xs text-muted-foreground">
                  {detail.ban.is_permanent ? 'Permanent' : `Expires: ${detail.ban.expires_at}`}
                </p>
              </div>
            )}
            {isAdmin && (
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={onRoleChange}>Change role</Button>
                {detail.ban ? (
                  <Button variant="outline" size="sm" onClick={onUnban}>Unban</Button>
                ) : (
                  <Button variant="destructive" size="sm" onClick={onBan}>Ban user</Button>
                )}
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-center py-8">Failed to load user</p>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default UserManagement;
