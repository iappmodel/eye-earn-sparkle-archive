import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';

export interface ContentFlag {
  id: string;
  content_id: string;
  content_type: string;
  flagged_by: string;
  reason: string;
  description: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  created_at: string;
}

export interface UserReport {
  id: string;
  reported_user_id: string;
  reported_by: string;
  reason: string;
  description: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  action_taken: string | null;
  created_at: string;
}

export interface AdminAction {
  id: string;
  admin_id: string;
  action_type: string;
  target_type: string;
  target_id: string;
  details: unknown;
  created_at: string;
}

export interface UserBan {
  id: string;
  user_id: string;
  banned_by: string;
  reason: string;
  expires_at: string | null;
  is_permanent: boolean;
  created_at: string;
}

export interface AdminStats {
  totalUsers: number;
  totalCreators: number;
  pendingFlags: number;
  pendingReports: number;
  activeBans: number;
  totalTransactions: number;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const { isAdmin, isModerator } = useUserRole();
  const [contentFlags, setContentFlags] = useState<ContentFlag[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [userBans, setUserBans] = useState<UserBan[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalCreators: 0,
    pendingFlags: 0,
    pendingReports: 0,
    activeBans: 0,
    totalTransactions: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  const fetchContentFlags = useCallback(async () => {
    if (!isAdmin && !isModerator) return;
    
    const { data, error } = await supabase
      .from('content_flags')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching flags:', error);
    } else {
      setContentFlags(data || []);
    }
  }, [isAdmin, isModerator]);

  const fetchUserReports = useCallback(async () => {
    if (!isAdmin && !isModerator) return;
    
    const { data, error } = await supabase
      .from('user_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching reports:', error);
    } else {
      setUserReports(data || []);
    }
  }, [isAdmin, isModerator]);

  const fetchAdminActions = useCallback(async () => {
    if (!isAdmin) return;
    
    const { data, error } = await supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching admin actions:', error);
    } else {
      setAdminActions((data || []) as AdminAction[]);
    }
  }, [isAdmin]);

  const fetchUserBans = useCallback(async () => {
    if (!isAdmin && !isModerator) return;
    
    const { data, error } = await supabase
      .from('user_bans')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching bans:', error);
    } else {
      setUserBans(data || []);
    }
  }, [isAdmin, isModerator]);

  const fetchStats = useCallback(async () => {
    if (!isAdmin && !isModerator) return;

    // Get user counts
    const { count: totalUsers } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    const { count: totalCreators } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'creator');

    const { count: pendingFlags } = await supabase
      .from('content_flags')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: pendingReports } = await supabase
      .from('user_reports')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    const { count: activeBans } = await supabase
      .from('user_bans')
      .select('*', { count: 'exact', head: true });

    const { count: totalTransactions } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true });

    setStats({
      totalUsers: totalUsers || 0,
      totalCreators: totalCreators || 0,
      pendingFlags: pendingFlags || 0,
      pendingReports: pendingReports || 0,
      activeBans: activeBans || 0,
      totalTransactions: totalTransactions || 0,
    });
  }, [isAdmin, isModerator]);

  const logAdminAction = async (
    actionType: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown> = {}
  ) => {
    if (!user) return;

    const { error } = await supabase.from('admin_actions').insert([{
      admin_id: user.id,
      action_type: actionType,
      target_type: targetType,
      target_id: targetId,
      details,
    }]);

    if (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const resolveFlag = async (flagId: string, action: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('content_flags')
      .update({
        status: 'resolved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        action_taken: action,
      })
      .eq('id', flagId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve flag', variant: 'destructive' });
    } else {
      await logAdminAction('resolve_flag', 'content_flag', flagId, { action });
      await fetchContentFlags();
      toast({ title: 'Success', description: 'Flag resolved' });
    }
  };

  const resolveReport = async (reportId: string, action: string) => {
    if (!user) return;

    const { error } = await supabase
      .from('user_reports')
      .update({
        status: 'resolved',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        action_taken: action,
      })
      .eq('id', reportId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve report', variant: 'destructive' });
    } else {
      await logAdminAction('resolve_report', 'user_report', reportId, { action });
      await fetchUserReports();
      toast({ title: 'Success', description: 'Report resolved' });
    }
  };

  const banUser = async (userId: string, reason: string, isPermanent: boolean = false, expiresAt?: Date) => {
    if (!user) return;

    const { error } = await supabase.from('user_bans').insert({
      user_id: userId,
      banned_by: user.id,
      reason,
      is_permanent: isPermanent,
      expires_at: expiresAt?.toISOString() || null,
    });

    if (error) {
      if (error.code === '23505') {
        toast({ title: 'Error', description: 'User is already banned', variant: 'destructive' });
      } else {
        toast({ title: 'Error', description: 'Failed to ban user', variant: 'destructive' });
      }
    } else {
      await logAdminAction('ban_user', 'user', userId, { reason, isPermanent });
      await fetchUserBans();
      toast({ title: 'Success', description: 'User banned successfully' });
    }
  };

  const unbanUser = async (banId: string, userId: string) => {
    const { error } = await supabase.from('user_bans').delete().eq('id', banId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to unban user', variant: 'destructive' });
    } else {
      await logAdminAction('unban_user', 'user', userId);
      await fetchUserBans();
      toast({ title: 'Success', description: 'User unbanned successfully' });
    }
  };

  const updateUserRole = async (userId: string, newRole: 'user' | 'creator' | 'moderator' | 'admin') => {
    if (!isAdmin) {
      toast({ title: 'Error', description: 'Only admins can change roles', variant: 'destructive' });
      return;
    }

    const { error } = await supabase
      .from('user_roles')
      .update({ role: newRole })
      .eq('user_id', userId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to update role', variant: 'destructive' });
    } else {
      await logAdminAction('update_role', 'user', userId, { newRole });
      toast({ title: 'Success', description: `User role updated to ${newRole}` });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      if (!isAdmin && !isModerator) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      await Promise.all([
        fetchContentFlags(),
        fetchUserReports(),
        fetchAdminActions(),
        fetchUserBans(),
        fetchStats(),
      ]);
      setIsLoading(false);
    };

    loadData();
  }, [isAdmin, isModerator, fetchContentFlags, fetchUserReports, fetchAdminActions, fetchUserBans, fetchStats]);

  return {
    contentFlags,
    userReports,
    adminActions,
    userBans,
    stats,
    isLoading,
    resolveFlag,
    resolveReport,
    banUser,
    unbanUser,
    updateUserRole,
    refresh: () => Promise.all([
      fetchContentFlags(),
      fetchUserReports(),
      fetchAdminActions(),
      fetchUserBans(),
      fetchStats(),
    ]),
  };
};
