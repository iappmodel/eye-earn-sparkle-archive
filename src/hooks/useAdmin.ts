import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRole } from '@/hooks/useUserRole';
import { toast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';
import { removeContent } from '@/services/moderation.service';

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
  severity?: string;
  source?: string;
  content_user_id?: string | null;
  moderator_notes?: string | null;
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
  severity?: string;
  moderator_notes?: string | null;
}

export interface ModerationAppeal {
  id: string;
  appealable_type: 'content_flag' | 'user_report';
  appealable_id: string;
  appealed_by: string;
  reason: string;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
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
  totalModerators: number;
  totalAdmins: number;
  pendingFlags: number;
  pendingReports: number;
  activeBans: number;
  totalTransactions: number;
  /** New user signups in the last 24 hours */
  newUsersToday: number;
  /** New user signups in the last 7 days */
  newUsers7d: number;
  /** New user signups in the last 30 days */
  newUsers30d: number;
  /** Total content items (user_content) */
  totalContent: number;
  /** Published (non-draft) content count */
  publishedContent: number;
  /** Draft content count */
  draftContent: number;
  /** Total reward logs count */
  totalRewardsCount: number;
  /** Sum of reward amounts issued (from reward_logs) */
  totalRewardsAmount: number;
}

export const useAdmin = () => {
  const { user } = useAuth();
  const { isAdmin, isModerator } = useUserRole();
  const [contentFlags, setContentFlags] = useState<ContentFlag[]>([]);
  const [userReports, setUserReports] = useState<UserReport[]>([]);
  const [adminActions, setAdminActions] = useState<AdminAction[]>([]);
  const [userBans, setUserBans] = useState<UserBan[]>([]);
  const [moderationAppeals, setModerationAppeals] = useState<ModerationAppeal[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalUsers: 0,
    totalCreators: 0,
    totalModerators: 0,
    totalAdmins: 0,
    pendingFlags: 0,
    pendingReports: 0,
    activeBans: 0,
    totalTransactions: 0,
    newUsersToday: 0,
    newUsers7d: 0,
    newUsers30d: 0,
    totalContent: 0,
    publishedContent: 0,
    draftContent: 0,
    totalRewardsCount: 0,
    totalRewardsAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const adminActionsOffsetRef = useRef(0);
  const ADMIN_ACTIONS_PAGE_SIZE = 50;
  const [hasMoreAdminActions, setHasMoreAdminActions] = useState(true);

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

  const fetchAdminActions = useCallback(async (reset = true) => {
    if (!isAdmin) return;
    if (reset) adminActionsOffsetRef.current = 0;
    const offset = adminActionsOffsetRef.current;
    const { data, error } = await supabase
      .from('admin_actions')
      .select('*')
      .order('created_at', { ascending: false })
      .range(offset, offset + ADMIN_ACTIONS_PAGE_SIZE - 1);

    if (error) {
      console.error('Error fetching admin actions:', error);
    } else {
      const list = (data || []) as AdminAction[];
      if (reset) {
        setAdminActions(list);
      } else {
        setAdminActions((prev) => [...prev, ...list]);
      }
      adminActionsOffsetRef.current = offset + list.length;
      setHasMoreAdminActions(list.length === ADMIN_ACTIONS_PAGE_SIZE);
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

  const fetchModerationAppeals = useCallback(async () => {
    if (!isAdmin && !isModerator) return;
    const { data, error } = await supabase
      .from('moderation_appeals')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching appeals:', error);
    } else {
      setModerationAppeals((data || []) as ModerationAppeal[]);
    }
  }, [isAdmin, isModerator]);

  const fetchStats = useCallback(async () => {
    if (!isAdmin && !isModerator) return;

    setStatsError(null);
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    try {
      const [
        totalUsersRes,
        newUsersTodayRes,
        newUsers7dRes,
        newUsers30dRes,
        totalCreatorsRes,
        totalModeratorsRes,
        totalAdminsRes,
        pendingFlagsRes,
        pendingReportsRes,
        activeBansRes,
        totalTransactionsRes,
        totalContentRes,
        publishedContentRes,
        draftContentRes,
        rewardCountRes,
        rewardAmountRes,
      ] = await Promise.all([
        supabase.from('public_profiles').select('*', { count: 'exact', head: true }),
        supabase.from('public_profiles').select('*', { count: 'exact', head: true }).gte('created_at', oneDayAgo),
        supabase.from('public_profiles').select('*', { count: 'exact', head: true }).gte('created_at', sevenDaysAgo),
        supabase.from('public_profiles').select('*', { count: 'exact', head: true }).gte('created_at', thirtyDaysAgo),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'creator'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'moderator'),
        supabase.from('user_roles').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
        supabase.from('content_flags').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('user_bans').select('*', { count: 'exact', head: true }),
        supabase.from('transactions').select('*', { count: 'exact', head: true }),
        supabase.from('user_content').select('*', { count: 'exact', head: true }),
        supabase.from('user_content').select('*', { count: 'exact', head: true }).eq('is_draft', false),
        supabase.from('user_content').select('*', { count: 'exact', head: true }).eq('is_draft', true),
        supabase.from('reward_logs').select('*', { count: 'exact', head: true }),
        supabase.from('reward_logs').select('amount'),
      ]);

      const rewardAmounts = (rewardAmountRes?.data || []) as { amount: number }[];
      const totalRewardsAmount = rewardAmounts.reduce((sum, r) => sum + r.amount, 0);
      const totalRewardsCount = rewardCountRes?.count ?? 0;

      setStats({
        totalUsers: totalUsersRes.count ?? 0,
        totalCreators: totalCreatorsRes.count ?? 0,
        totalModerators: totalModeratorsRes.count ?? 0,
        totalAdmins: totalAdminsRes.count ?? 0,
        pendingFlags: pendingFlagsRes.count ?? 0,
        pendingReports: pendingReportsRes.count ?? 0,
        activeBans: activeBansRes.count ?? 0,
        totalTransactions: totalTransactionsRes.count ?? 0,
        newUsersToday: newUsersTodayRes.count ?? 0,
        newUsers7d: newUsers7dRes.count ?? 0,
        newUsers30d: newUsers30dRes.count ?? 0,
        totalContent: totalContentRes.count ?? 0,
        publishedContent: publishedContentRes.count ?? 0,
        draftContent: draftContentRes.count ?? 0,
        totalRewardsCount,
        totalRewardsAmount,
      });
    } catch (e) {
      console.error('Error fetching admin stats:', e);
      setStatsError(e instanceof Error ? e.message : 'Failed to load stats');
    }
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
      details: details as Json,
    }]);

    if (error) {
      console.error('Error logging admin action:', error);
    }
  };

  const resolveFlag = async (
    flagId: string,
    action: string,
    options?: { removeContent?: boolean; contentId?: string; moderatorNote?: string }
  ) => {
    if (!user) return;

    const contentId = options?.contentId;
    if (options?.removeContent && contentId) {
      const result = await removeContent(contentId);
      if (!result.success) {
        toast({ title: 'Error', description: result.error ?? 'Failed to remove content', variant: 'destructive' });
        return;
      }
    }

    const updatePayload: Record<string, unknown> = {
      status: 'resolved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      action_taken: action,
    };
    if (options?.moderatorNote !== undefined) {
      updatePayload.moderator_notes = options.moderatorNote;
    }

    const { error } = await supabase
      .from('content_flags')
      .update(updatePayload)
      .eq('id', flagId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve flag', variant: 'destructive' });
    } else {
      await logAdminAction('resolve_flag', 'content_flag', flagId, { action, removeContent: options?.removeContent });
      await fetchContentFlags();
      toast({ title: 'Success', description: 'Flag resolved' });
    }
  };

  const resolveReport = async (reportId: string, action: string, options?: { moderatorNote?: string }) => {
    if (!user) return;

    const updatePayload: Record<string, unknown> = {
      status: 'resolved',
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      action_taken: action,
    };
    if (options?.moderatorNote !== undefined) {
      updatePayload.moderator_notes = options.moderatorNote;
    }

    const { error } = await supabase
      .from('user_reports')
      .update(updatePayload)
      .eq('id', reportId);

    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve report', variant: 'destructive' });
    } else {
      await logAdminAction('resolve_report', 'user_report', reportId, { action });
      await fetchUserReports();
      toast({ title: 'Success', description: 'Report resolved' });
    }
  };

  const resolveAppeal = async (appealId: string, outcome: 'upheld' | 'rejected', reviewNote?: string) => {
    if (!user) return;
    const { error } = await supabase
      .from('moderation_appeals')
      .update({
        status: outcome,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        review_note: reviewNote ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', appealId);
    if (error) {
      toast({ title: 'Error', description: 'Failed to resolve appeal', variant: 'destructive' });
    } else {
      await logAdminAction('resolve_appeal', 'moderation_appeal', appealId, { outcome });
      await fetchModerationAppeals();
      toast({ title: 'Success', description: `Appeal ${outcome}` });
    }
  };

  const updateFlagModeratorNotes = async (flagId: string, moderator_notes: string) => {
    const { error } = await supabase
      .from('content_flags')
      .update({ moderator_notes, updated_at: new Date().toISOString() })
      .eq('id', flagId);
    if (!error) await fetchContentFlags();
  };

  const updateReportModeratorNotes = async (reportId: string, moderator_notes: string) => {
    const { error } = await supabase
      .from('user_reports')
      .update({ moderator_notes, updated_at: new Date().toISOString() })
      .eq('id', reportId);
    if (!error) await fetchUserReports();
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
        fetchModerationAppeals(),
        fetchStats(),
      ]);
      setIsLoading(false);
    };

    loadData();
  }, [isAdmin, isModerator, fetchContentFlags, fetchUserReports, fetchAdminActions, fetchUserBans, fetchModerationAppeals, fetchStats]);

  const loadMoreAdminActions = useCallback(() => {
    if (!isAdmin || !hasMoreAdminActions) return;
    fetchAdminActions(false);
  }, [isAdmin, hasMoreAdminActions, fetchAdminActions]);

  return {
    contentFlags,
    userReports,
    adminActions,
    userBans,
    moderationAppeals,
    stats,
    statsError,
    isLoading,
    hasMoreAdminActions,
    resolveFlag,
    resolveReport,
    resolveAppeal,
    updateFlagModeratorNotes,
    updateReportModeratorNotes,
    banUser,
    unbanUser,
    updateUserRole,
    refresh: () => Promise.all([
      fetchContentFlags(),
      fetchUserReports(),
      fetchAdminActions(true),
      fetchUserBans(),
      fetchModerationAppeals(),
      fetchStats(),
    ]),
    refreshStats: fetchStats,
    refreshFlags: fetchContentFlags,
    refreshReports: fetchUserReports,
    refreshBans: fetchUserBans,
    refreshAppeals: fetchModerationAppeals,
    refreshAdminActions: () => fetchAdminActions(true),
    loadMoreAdminActions,
    logAdminAction,
  };
};
