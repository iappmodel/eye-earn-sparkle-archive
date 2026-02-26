/**
 * Admin analytics service: bounded queries and aggregated metrics
 * for the AnalyticsPanel. Uses count-only and date-filtered queries
 * to avoid loading full tables.
 */

import { supabase } from '@/integrations/supabase/client';
import { startOfDay, subDays, format, eachDayOfInterval } from 'date-fns';

export type AnalyticsTimeRange = '7d' | '30d' | '90d';

export interface DailyDataPoint {
  date: string;
  label: string;
  users?: number;
  transactions?: number;
  transactionsVolume?: number;
  rewards?: number;
  rewardsAmount?: number;
  content?: number;
  views?: number;
  likes?: number;
  interactions?: number;
  checkins?: number;
  notifications?: number;
}

export interface RoleDistribution {
  name: string;
  value: number;
}

export interface TransactionTypeBreakdown {
  type: string;
  count: number;
  volume: number;
}

export interface AdminAnalyticsOverview {
  totals: {
    totalUsers: number;
    totalContent: number;
    totalTransactions: number;
    totalRewardsAmount: number;
    totalRewardsCount: number;
    totalCheckins: number;
    totalPromotions: number;
    totalViews: number;
    totalLikes: number;
    avgEngagement: number;
  };
  period: {
    newUsers: number;
    newContent: number;
    transactionsCount: number;
    transactionsVolume: number;
    rewardsCount: number;
    rewardsAmount: number;
    interactions: number;
    checkins: number;
  };
  daily: DailyDataPoint[];
  roleDistribution: RoleDistribution[];
  transactionBreakdown: TransactionTypeBreakdown[];
}

export interface TrackInteractionHealthStats {
  success?: boolean;
  retention_days: number;
  retention_cutoff: string;
  nonce_table: {
    total_rows: number;
    rows_older_than_retention: number;
    rows_last_24h: number;
    oldest_created_at: string | null;
    newest_created_at: string | null;
    action_counts_last_24h: Record<string, number>;
  };
  cooldown_columns: {
    rows_with_last_share_at: number;
    rows_with_last_view_complete_at: number;
    legacy_share_rows_missing_timestamp: number;
    legacy_view_complete_missing_timestamp: number;
    legacy_view_complete_rows_missing_timestamp?: number;
  };
}

export interface TrackInteractionHealthWarning {
  code: string;
  severity: 'info' | 'warn';
  metric: string;
  count: number;
  actual: number;
  threshold: number;
  message: string;
}

export interface TrackInteractionHealthAssessment {
  status: 'ok' | 'warn';
  warning_count: number;
  summary: {
    warn_count: number;
    info_count: number;
    top_warning_code: string | null;
    top_warning_severity: 'warn' | 'info' | null;
  };
  warnings: TrackInteractionHealthWarning[];
}

export interface TrackInteractionCleanupHistoryEntry {
  id: string;
  admin_id: string;
  admin_display_name: string | null;
  admin_username: string | null;
  admin_label: string | null;
  created_at: string;
  outcome: 'success' | 'error' | 'unknown';
  rows_deleted: number;
  retention_days: number | null;
  cleanup_limit: number | null;
  assessment_status: string | null;
  assessment_warning_count: number | null;
  cleanup_error: string | null;
}

export type TrackInteractionCleanupHistoryOutcomeFilter = 'all' | 'success' | 'error' | 'unknown';

export interface TrackInteractionHealthHistoryOptions {
  history_limit?: number;
  history_outcome?: TrackInteractionCleanupHistoryOutcomeFilter;
  history_since_days?: number | null;
  history_before_created_at?: string | null;
  history_after_created_at?: string | null;
}

export interface TrackInteractionHealthResponse {
  success: boolean;
  generated_at: string;
  action?: 'stats' | 'cleanup';
  requested_retention_days: number;
  cleanup?: {
    attempted: boolean;
    before: string;
    limit: number;
    result: {
      success?: boolean;
      rows_deleted?: number;
      [key: string]: unknown;
    } | null;
  } | null;
  audit_log?: {
    attempted: boolean;
    logged: boolean;
    error?: string;
  } | null;
  cleanup_history?: TrackInteractionCleanupHistoryEntry[];
  cleanup_history_meta?: {
    limit: number;
    returned_count?: number;
    has_more?: boolean;
    has_older?: boolean;
    has_newer?: boolean;
    next_before_created_at?: string | null;
    next_after_created_at?: string | null;
    paging_direction?: 'latest' | 'older' | 'newer';
    filters?: {
      outcome: TrackInteractionCleanupHistoryOutcomeFilter;
      since_days: number | null;
      before_created_at?: string | null;
      after_created_at?: string | null;
    };
    error: string | null;
    profile_error?: string | null;
  };
  assessment?: TrackInteractionHealthAssessment;
  stats: TrackInteractionHealthStats | null;
}

function getRangeBounds(range: AnalyticsTimeRange): { start: Date; days: number } {
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  return { start: startOfDay(subDays(new Date(), days)), days };
}

async function safeCount(
  table: string,
  options?: { from?: Date; to?: Date; eq?: { column: string; value: string | number | boolean } }
): Promise<number> {
  try {
    let q = supabase.from(table).select('*', { count: 'exact', head: true });
    if (options?.from) q = q.gte('created_at', options.from.toISOString());
    if (options?.to) q = q.lte('created_at', options.to.toISOString());
    if (options?.eq) q = q.eq(options.eq.column, options.eq.value);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function fetchWithDateRange<T extends { created_at: string }>(
  table: string,
  start: Date,
  days: number,
  columns = 'created_at',
  limit = 5000
): Promise<T[]> {
  try {
    const end = new Date();
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

function aggregateByDay<T extends { created_at: string }>(
  rows: T[],
  dateLabels: { dateStr: string; label: string }[],
  getValue?: (row: T) => number
): number[] {
  const byDay: Record<string, number> = {};
  dateLabels.forEach(({ dateStr }) => (byDay[dateStr] = 0));
  rows.forEach((row) => {
    const dateStr = format(new Date(row.created_at), 'yyyy-MM-dd');
    if (dateStr in byDay) byDay[dateStr] += getValue ? getValue(row) : 1;
  });
  return dateLabels.map(({ dateStr }) => byDay[dateStr] ?? 0);
}

export async function fetchAdminAnalytics(range: AnalyticsTimeRange): Promise<AdminAnalyticsOverview> {
  const { start, days } = getRangeBounds(range);
  const end = new Date();
  const dateLabels = eachDayOfInterval({ start, end }).map((d) => ({
    dateStr: format(d, 'yyyy-MM-dd'),
    label: format(d, days > 14 ? 'MMM d' : 'EEE MM/d'),
  }));

  // Totals (all-time counts, no date filter)
  const [totalUsers, totalTransactions, totalRewardsCount, totalCheckins, totalPromotions, publishedContentCount, allTimeRewardsAmount] =
    await Promise.all([
      safeCount('profiles'),
      safeCount('transactions'),
      safeCount('reward_logs'),
      safeCount('promotion_checkins'),
      safeCount('promotions'),
      supabase.from('user_content').select('*', { count: 'exact', head: true }).eq('is_draft', false).then((r) => r.count ?? 0),
      fetchTotalRewardsAmountAllTime(),
    ]);
  const totalContent = publishedContentCount;

  // Period-bounded fetches for time series and period totals
  const [profilesInRange, transactionsInRange, rewardLogsInRange, contentInRange, interactionsInRange, checkinsInRange, notificationsInRange, roles, userContentForViews] =
    await Promise.all([
      fetchWithDateRange<{ created_at: string }>('profiles', start, days, 'created_at'),
      fetchWithDateRange<{ created_at: string; amount: number; type: string }>('transactions', start, days, 'created_at,amount,type'),
      fetchWithDateRange<{ created_at: string; amount: number }>('reward_logs', start, days, 'created_at,amount'),
      fetchWithDateRange<{ created_at: string; is_draft?: boolean }>('user_content', start, days, 'created_at,is_draft').then(
        (r) => r.filter((c) => c.is_draft !== true)
      ),
      fetchWithDateRange<{ created_at: string }>('content_interactions', start, days, 'created_at'),
      fetchWithDateRange<{ created_at: string }>('promotion_checkins', start, days, 'created_at'),
      fetchWithDateRange<{ created_at: string }>('notifications', start, days, 'created_at'),
      supabase.from('user_roles').select('role').then(({ data }) => data ?? []),
      supabase
        .from('user_content')
        .select('views_count, likes_count, comments_count')
        .eq('is_draft', false)
        .then(({ data }) => data ?? []),
    ]);

  // Role distribution
  const roleCounts: Record<string, number> = {};
  (roles as { role: string }[]).forEach((r) => {
    roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
  });
  const roleDistribution: RoleDistribution[] = Object.entries(roleCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
  }));

  // Transaction type breakdown
  const typeBreakdown: Record<string, { count: number; volume: number }> = {};
  transactionsInRange.forEach((t) => {
    const type = t.type || 'other';
    if (!typeBreakdown[type]) typeBreakdown[type] = { count: 0, volume: 0 };
    typeBreakdown[type].count += 1;
    typeBreakdown[type].volume += t.amount ?? 0;
  });
  const transactionBreakdown: TransactionTypeBreakdown[] = Object.entries(typeBreakdown).map(
    ([type, { count, volume }]) => ({ type, count, volume })
  );

  // Total rewards amount (all-time from reward_logs in range for period, or sum in range)
  const periodRewardsAmount = rewardLogsInRange.reduce((s, r) => s + (r.amount ?? 0), 0);
  const totalRewardsCountAll = totalRewardsCount;

  // Daily aggregates
  const daily: DailyDataPoint[] = dateLabels.map(({ dateStr, label }, i) => ({
    date: dateStr,
    label,
    users: aggregateByDay(profilesInRange, dateLabels)[i],
    transactions: aggregateByDay(transactionsInRange, dateLabels)[i],
    transactionsVolume: transactionsInRange.filter(
      (t) => format(new Date(t.created_at), 'yyyy-MM-dd') === dateStr
    ).reduce((s, t) => s + (t.amount ?? 0), 0),
    rewards: aggregateByDay(rewardLogsInRange, dateLabels)[i],
    rewardsAmount: rewardLogsInRange
      .filter((r) => format(new Date(r.created_at), 'yyyy-MM-dd') === dateStr)
      .reduce((s, r) => s + (r.amount ?? 0), 0),
    content: aggregateByDay(contentInRange, dateLabels)[i],
    interactions: aggregateByDay(interactionsInRange, dateLabels)[i],
    checkins: aggregateByDay(checkinsInRange, dateLabels)[i],
    notifications: aggregateByDay(notificationsInRange, dateLabels)[i],
  }));

  const periodTransactionsVolume = transactionsInRange.reduce((s, t) => s + (t.amount ?? 0), 0);

  const totalViews = (userContentForViews as { views_count?: number }[]).reduce((s, c) => s + (c.views_count ?? 0), 0);
  const totalLikes = (userContentForViews as { likes_count?: number }[]).reduce((s, c) => s + (c.likes_count ?? 0), 0);

  return {
    totals: {
      totalUsers,
      totalContent,
      totalTransactions,
      totalRewardsAmount: allTimeRewardsAmount,
      totalRewardsCount,
      totalCheckins,
      totalPromotions,
      totalViews,
      totalLikes,
      avgEngagement: totalUsers ? Math.round((totalTransactions + totalRewardsCount) / totalUsers) : 0,
    },
    period: {
      newUsers: profilesInRange.length,
      newContent: contentInRange.length,
      transactionsCount: transactionsInRange.length,
      transactionsVolume: periodTransactionsVolume,
      rewardsCount: rewardLogsInRange.length,
      rewardsAmount: periodRewardsAmount,
      interactions: interactionsInRange.length,
      checkins: checkinsInRange.length,
    },
    daily,
    roleDistribution,
    transactionBreakdown,
  };
}

/**
 * All-time reward amount (sum of all reward_logs). Optional heavy query.
 */
export async function fetchTotalRewardsAmountAllTime(): Promise<number> {
  try {
    const { data } = await supabase.from('reward_logs').select('amount').limit(10000);
    return (data ?? []).reduce((s, r) => s + (r.amount ?? 0), 0);
  } catch {
    return 0;
  }
}

export async function fetchTrackInteractionHealth(
  retentionDays = 14,
  options: TrackInteractionHealthHistoryOptions = {}
): Promise<TrackInteractionHealthResponse> {
  const { data, error } = await supabase.functions.invoke('track-interaction-health', {
    body: {
      retention_days: retentionDays,
      history_limit: options.history_limit,
      history_outcome: options.history_outcome,
      history_since_days: options.history_since_days,
      history_before_created_at: options.history_before_created_at,
      history_after_created_at: options.history_after_created_at,
    },
    headers: {
      'X-Admin-Client': 'analytics-panel',
    },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to load interaction health');
  }

  const payload = (data ?? {}) as Partial<TrackInteractionHealthResponse> & { error?: string };
  if (!payload.success) {
    throw new Error(payload.error ?? 'Failed to load interaction health');
  }

  return payload as TrackInteractionHealthResponse;
}

export async function runTrackInteractionNonceCleanup(
  retentionDays = 14,
  cleanupLimit = 5000,
  options: TrackInteractionHealthHistoryOptions = {}
): Promise<TrackInteractionHealthResponse> {
  const { data, error } = await supabase.functions.invoke('track-interaction-health', {
    body: {
      action: 'cleanup',
      retention_days: retentionDays,
      cleanup_limit: cleanupLimit,
      history_limit: options.history_limit,
      history_outcome: options.history_outcome,
      history_since_days: options.history_since_days,
      history_before_created_at: options.history_before_created_at,
      history_after_created_at: options.history_after_created_at,
    },
    headers: {
      'X-Admin-Client': 'analytics-panel',
    },
  });

  if (error) {
    throw new Error(error.message ?? 'Failed to run interaction nonce cleanup');
  }

  const payload = (data ?? {}) as Partial<TrackInteractionHealthResponse> & { error?: string };
  if (!payload.success) {
    throw new Error(payload.error ?? 'Failed to run interaction nonce cleanup');
  }

  return payload as TrackInteractionHealthResponse;
}
