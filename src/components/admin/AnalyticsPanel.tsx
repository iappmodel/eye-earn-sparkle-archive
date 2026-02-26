import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
  Legend,
} from 'recharts';
import {
  TrendingUp,
  Users,
  UserPlus,
  Coins,
  Activity,
  Loader2,
  RefreshCw,
  FileText,
  MapPin,
  Gift,
  BarChart3,
  ArrowUpRight,
  AlertCircle,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { format } from 'date-fns';
import {
  fetchAdminAnalytics,
  fetchTrackInteractionHealth,
  runTrackInteractionNonceCleanup,
  type AdminAnalyticsOverview,
  type AnalyticsTimeRange,
  type TrackInteractionCleanupHistoryOutcomeFilter,
  type TrackInteractionHealthResponse,
} from '@/services/adminAnalytics.service';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--accent))',
  'hsl(var(--secondary))',
  'hsl(var(--muted))',
  'hsl(270 70% 55%)',
  'hsl(180 60% 45%)',
];

const tooltipContentStyle = {
  backgroundColor: 'hsl(var(--card))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '8px',
};

function StatCard({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold tabular-nums">{value}</p>
              <p className="text-sm text-muted-foreground">{title}</p>
              {subValue && (
                <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>
              )}
            </div>
          </div>
          {trend !== undefined && (
            <span
              className={
                trend === 'up'
                  ? 'text-green-600 dark:text-green-400'
                  : trend === 'down'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground'
              }
            >
              {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : null}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

const AnalyticsPanel: React.FC = () => {
  const [range, setRange] = useState<AnalyticsTimeRange>('30d');
  const [data, setData] = useState<AdminAnalyticsOverview | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [trackInteractionHealth, setTrackInteractionHealth] = useState<TrackInteractionHealthResponse | null>(null);
  const [trackInteractionHealthError, setTrackInteractionHealthError] = useState<string | null>(null);
  const [isRunningTrackInteractionCleanup, setIsRunningTrackInteractionCleanup] = useState(false);
  const [trackInteractionCleanupNotice, setTrackInteractionCleanupNotice] = useState<string | null>(null);
  const [cleanupHistoryOutcome, setCleanupHistoryOutcome] =
    useState<TrackInteractionCleanupHistoryOutcomeFilter>('all');
  const [cleanupHistorySince, setCleanupHistorySince] = useState<'all' | '1' | '7' | '30'>('all');
  const [cleanupHistoryBeforeCreatedAt, setCleanupHistoryBeforeCreatedAt] = useState<string | null>(null);
  const [cleanupHistoryAfterCreatedAt, setCleanupHistoryAfterCreatedAt] = useState<string | null>(null);
  const [cleanupHistoryCursorStack, setCleanupHistoryCursorStack] = useState<Array<string | null>>([]);
  const cleanupHistorySinceDays = cleanupHistorySince === 'all' ? null : Number(cleanupHistorySince);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsResult, trackHealthResult] = await Promise.allSettled([
        fetchAdminAnalytics(range),
        fetchTrackInteractionHealth(14, {
          history_limit: 8,
          history_outcome: cleanupHistoryOutcome,
          history_since_days: cleanupHistorySinceDays,
          history_before_created_at: cleanupHistoryBeforeCreatedAt,
          history_after_created_at: cleanupHistoryAfterCreatedAt,
        }),
      ]);

      if (analyticsResult.status === 'rejected') {
        throw analyticsResult.reason;
      }

      setData(analyticsResult.value);

      if (trackHealthResult.status === 'fulfilled') {
        setTrackInteractionHealth(trackHealthResult.value);
        setTrackInteractionHealthError(null);
      } else {
        setTrackInteractionHealthError(
          trackHealthResult.reason instanceof Error
            ? trackHealthResult.reason.message
            : 'Failed to load interaction anti-fraud health'
        );
      }

      setLastUpdated(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [range, cleanupHistoryOutcome, cleanupHistorySinceDays, cleanupHistoryBeforeCreatedAt, cleanupHistoryAfterCreatedAt]);

  useEffect(() => {
    load();
  }, [load]);

  const runInteractionNonceCleanup = useCallback(async () => {
    setIsRunningTrackInteractionCleanup(true);
    setTrackInteractionCleanupNotice(null);
    try {
      const result = await runTrackInteractionNonceCleanup(14, 5000, {
        history_limit: 8,
        history_outcome: cleanupHistoryOutcome,
        history_since_days: cleanupHistorySinceDays,
        history_before_created_at: null,
        history_after_created_at: null,
      });
      setCleanupHistoryCursorStack([]);
      setCleanupHistoryBeforeCreatedAt(null);
      setCleanupHistoryAfterCreatedAt(null);
      setTrackInteractionHealth(result);
      setTrackInteractionHealthError(null);
      const rowsDeleted = Number(result.cleanup?.result?.rows_deleted ?? 0);
      const auditSuffix =
        result.audit_log && result.audit_log.logged === false
          ? ` Audit log failed: ${result.audit_log.error ?? 'unknown error'}.`
          : '';
      setTrackInteractionCleanupNotice(
        `Cleanup completed: deleted ${rowsDeleted.toLocaleString()} nonce rows.${auditSuffix}`
      );
      setLastUpdated(new Date());
    } catch (e) {
      setTrackInteractionHealthError(
        e instanceof Error ? e.message : 'Failed to run interaction nonce cleanup'
      );
    } finally {
      setIsRunningTrackInteractionCleanup(false);
    }
  }, [cleanupHistoryOutcome, cleanupHistorySinceDays]);

  if (error && !data) {
    return (
      <Card className="border-destructive/50">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertCircle className="h-10 w-10 text-destructive" />
          <p className="text-muted-foreground text-center">{error}</p>
          <Button variant="outline" onClick={load}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const antiFraudStats = trackInteractionHealth?.stats;
  const antiFraudAssessment = trackInteractionHealth?.assessment;
  const antiFraudSummary = antiFraudAssessment?.summary;
  const cleanupHistory = trackInteractionHealth?.cleanup_history ?? [];
  const cleanupHistoryMeta = trackInteractionHealth?.cleanup_history_meta;
  const nonceStats = antiFraudStats?.nonce_table;
  const cooldownStats = antiFraudStats?.cooldown_columns;
  const nonceActionCounts = nonceStats?.action_counts_last_24h ?? {};
  const legacyViewCompleteMissingTs = Number(
    cooldownStats?.legacy_view_complete_missing_timestamp ??
      cooldownStats?.legacy_view_complete_rows_missing_timestamp ??
      0
  );
  const hasTrackInteractionIssues = antiFraudAssessment?.status === 'warn';
  const isCleanupHistoryErrorsOnly = cleanupHistoryOutcome === 'error' && cleanupHistorySince === 'all';
  const cleanupHistoryPageNumber = cleanupHistoryCursorStack.length + 1;
  const cleanupHistoryAppliedBeforeCursor = cleanupHistoryMeta?.filters?.before_created_at ?? cleanupHistoryBeforeCreatedAt;
  const cleanupHistoryAppliedAfterCursor = cleanupHistoryMeta?.filters?.after_created_at ?? cleanupHistoryAfterCreatedAt;
  const cleanupHistoryPageMode =
    cleanupHistoryMeta?.paging_direction ??
    (cleanupHistoryAppliedAfterCursor
      ? 'newer'
      : cleanupHistoryAppliedBeforeCursor
        ? 'older'
        : 'latest');
  const cleanupHistoryAppliedCursor =
    cleanupHistoryAppliedAfterCursor ??
    cleanupHistoryAppliedBeforeCursor;

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Select
            value={range}
            onValueChange={(v) => setRange(v as AnalyticsTimeRange)}
            disabled={isLoading}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="ghost" size="icon" onClick={load} disabled={isLoading}>
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
          {lastUpdated && (
            <span className="text-xs text-muted-foreground">
              Updated {format(lastUpdated, 'HH:mm')}
            </span>
          )}
        </div>
      </div>

      {isLoading && !data ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : data ? (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="flex flex-wrap h-auto gap-1 p-1">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="content">Content & engagement</TabsTrigger>
            <TabsTrigger value="revenue">Revenue & coins</TabsTrigger>
            <TabsTrigger value="promotions">Promotions</TabsTrigger>
          </TabsList>

          {/* Overview */}
          <TabsContent value="overview" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Total users"
                value={data.totals.totalUsers.toLocaleString()}
                subValue={`+${data.period.newUsers} in period`}
                icon={Users}
              />
              <StatCard
                title="Transactions"
                value={data.totals.totalTransactions.toLocaleString()}
                subValue={`${data.period.transactionsCount} (${range})`}
                icon={Activity}
              />
              <StatCard
                title="Rewards issued"
                value={data.totals.totalRewardsAmount.toLocaleString()}
                subValue={`${data.period.rewardsCount} events`}
                icon={Coins}
              />
              <StatCard
                title="Avg engagement"
                value={data.totals.avgEngagement}
                subValue="Tx + rewards per user"
                icon={TrendingUp}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>User signups</CardTitle>
                  <CardDescription>New profiles in selected period</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={data.daily.map((d) => ({ ...d, name: d.label }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipContentStyle} />
                      <Bar dataKey="users" name="Signups" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Activity (transactions & rewards)</CardTitle>
                  <CardDescription>Daily counts</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={data.daily.map((d) => ({ ...d, name: d.label }))}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipContentStyle} />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="transactions"
                        name="Transactions"
                        stroke={CHART_COLORS[0]}
                        strokeWidth={2}
                        dot={{ fill: CHART_COLORS[0], r: 3 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="rewards"
                        name="Rewards"
                        stroke={CHART_COLORS[1]}
                        strokeWidth={2}
                        dot={{ fill: CHART_COLORS[1], r: 3 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Role distribution</CardTitle>
                </CardHeader>
                <CardContent>
                  {data.roleDistribution.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Pie
                          data={data.roleDistribution}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={2}
                          dataKey="value"
                          nameKey="name"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {data.roleDistribution.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={tooltipContentStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <p className="text-sm text-muted-foreground py-8 text-center">No role data</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Platform health</CardTitle>
                  <CardDescription>Snapshot</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Published content</span>
                      <span className="font-semibold">{data.totals.totalContent.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total views</span>
                      <span className="font-semibold">{data.totals.totalViews.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Total likes</span>
                      <span className="font-semibold">{data.totals.totalLikes.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Promotions</span>
                      <span className="font-semibold">{data.totals.totalPromotions}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Check-ins (all time)</span>
                      <span className="font-semibold">{data.totals.totalCheckins.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Interactions ({range})</span>
                      <span className="font-semibold">{data.period.interactions.toLocaleString()}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className={hasTrackInteractionIssues ? 'border-amber-500/30' : 'border-green-500/20'}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>Interaction anti-fraud</CardTitle>
                      <CardDescription>Nonce dedup + cooldown coverage</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={runInteractionNonceCleanup}
                        disabled={isLoading || isRunningTrackInteractionCleanup}
                      >
                        {isRunningTrackInteractionCleanup ? (
                          <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-3.5 w-3.5" />
                        )}
                        Run cleanup
                      </Button>
                      {antiFraudStats ? (
                        hasTrackInteractionIssues ? (
                          <ShieldAlert className="h-5 w-5 text-amber-500" />
                        ) : (
                          <ShieldCheck className="h-5 w-5 text-green-600" />
                        )
                      ) : null}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {antiFraudStats && nonceStats && cooldownStats ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Nonce rows (total)</p>
                          <p className="text-lg font-semibold tabular-nums">
                            {Number(nonceStats.total_rows ?? 0).toLocaleString()}
                          </p>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs text-muted-foreground">Nonce rows (24h)</p>
                          <p className="text-lg font-semibold tabular-nums">
                            {Number(nonceStats.rows_last_24h ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">
                            Older than retention ({antiFraudStats.retention_days}d)
                          </span>
                          <span
                            className={
                              (nonceStats.rows_older_than_retention ?? 0) > 0
                                ? 'font-semibold text-amber-600'
                                : 'font-semibold text-green-600'
                            }
                          >
                            {Number(nonceStats.rows_older_than_retention ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Share nonces (24h)</span>
                          <span className="font-semibold">
                            {Number(nonceActionCounts.share ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">View-complete nonces (24h)</span>
                          <span className="font-semibold">
                            {Number(nonceActionCounts.view_complete ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Legacy share rows missing `last_share_at`</span>
                          <span
                            className={
                              (cooldownStats.legacy_share_rows_missing_timestamp ?? 0) > 0
                                ? 'font-semibold text-amber-600'
                                : 'font-semibold text-green-600'
                            }
                          >
                            {Number(cooldownStats.legacy_share_rows_missing_timestamp ?? 0).toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">Legacy view rows missing `last_view_complete_at`</span>
                          <span
                            className={
                              legacyViewCompleteMissingTs > 0
                                ? 'font-semibold text-amber-600'
                                : 'font-semibold text-green-600'
                            }
                          >
                            {legacyViewCompleteMissingTs.toLocaleString()}
                          </span>
                        </div>
                      </div>

                      {antiFraudAssessment?.warnings?.length ? (
                        <div className="rounded-md border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-xs font-medium text-amber-700">
                              Backend warnings ({antiFraudAssessment.warning_count})
                            </p>
                            {antiFraudSummary ? (
                              <p className="text-xs text-amber-700">
                                warn {antiFraudSummary.warn_count} • info {antiFraudSummary.info_count}
                              </p>
                            ) : null}
                          </div>
                          {antiFraudSummary?.top_warning_code ? (
                            <p className="text-xs text-amber-700/90">
                              Top warning: <code>{antiFraudSummary.top_warning_code}</code>
                            </p>
                          ) : null}
                          {antiFraudAssessment.warnings.slice(0, 3).map((warning) => (
                            <div key={warning.code} className="text-xs">
                              <p
                                className={
                                  warning.severity === 'warn'
                                    ? 'text-amber-700 font-medium'
                                    : 'text-slate-700'
                                }
                              >
                                [{warning.severity.toUpperCase()}] {warning.message}
                              </p>
                              <p className="text-muted-foreground">
                                Metric: <code>{warning.metric}</code> | actual: {warning.actual} | threshold: {warning.threshold}
                              </p>
                            </div>
                          ))}
                          {antiFraudAssessment.warnings.length > 3 ? (
                            <p className="text-xs text-amber-700">
                              +{antiFraudAssessment.warnings.length - 3} more warnings
                            </p>
                          ) : null}
                        </div>
                      ) : null}

                      {trackInteractionHealthError ? (
                        <p className="text-xs text-amber-600">
                          Interaction health refresh failed: {trackInteractionHealthError}
                        </p>
                      ) : null}
                      {trackInteractionCleanupNotice ? (
                        <p className="text-xs text-green-600">
                          {trackInteractionCleanupNotice}
                        </p>
                      ) : null}
                      <div className="rounded-md border p-3 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-medium">Recent cleanup runs</p>
                          {cleanupHistoryMeta?.error ? (
                            <p className="text-xs text-amber-600">History unavailable</p>
                          ) : (
                            <p className="text-xs text-muted-foreground">
                              Showing {cleanupHistoryMeta?.returned_count ?? cleanupHistory.length}
                              {cleanupHistoryMeta?.has_more
                                ? ` of ${cleanupHistoryMeta?.limit ?? cleanupHistory.length}+`
                                : ''}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant={isCleanupHistoryErrorsOnly ? 'default' : 'outline'}
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setCleanupHistoryCursorStack([]);
                              setCleanupHistoryBeforeCreatedAt(null);
                              setCleanupHistoryAfterCreatedAt(null);
                              setCleanupHistoryOutcome('error');
                              setCleanupHistorySince('all');
                            }}
                            disabled={isLoading || isRunningTrackInteractionCleanup}
                          >
                            Errors only
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setCleanupHistoryCursorStack([]);
                              setCleanupHistoryBeforeCreatedAt(null);
                              setCleanupHistoryAfterCreatedAt(null);
                              setCleanupHistoryOutcome('all');
                              setCleanupHistorySince('all');
                            }}
                            disabled={
                              isLoading ||
                              isRunningTrackInteractionCleanup ||
                              (cleanupHistoryOutcome === 'all' && cleanupHistorySince === 'all')
                            }
                          >
                            Clear filters
                          </Button>
                          <Select
                            value={cleanupHistoryOutcome}
                            onValueChange={(v) => {
                              setCleanupHistoryCursorStack([]);
                              setCleanupHistoryBeforeCreatedAt(null);
                              setCleanupHistoryAfterCreatedAt(null);
                              setCleanupHistoryOutcome(v as TrackInteractionCleanupHistoryOutcomeFilter);
                            }}
                            disabled={isLoading || isRunningTrackInteractionCleanup}
                          >
                            <SelectTrigger className="h-8 w-[130px] text-xs">
                              <SelectValue placeholder="Outcome" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All outcomes</SelectItem>
                              <SelectItem value="success">Success</SelectItem>
                              <SelectItem value="error">Error</SelectItem>
                              <SelectItem value="unknown">Unknown</SelectItem>
                            </SelectContent>
                          </Select>
                          <Select
                            value={cleanupHistorySince}
                            onValueChange={(v) => {
                              setCleanupHistoryCursorStack([]);
                              setCleanupHistoryBeforeCreatedAt(null);
                              setCleanupHistoryAfterCreatedAt(null);
                              setCleanupHistorySince(v as 'all' | '1' | '7' | '30');
                            }}
                            disabled={isLoading || isRunningTrackInteractionCleanup}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs">
                              <SelectValue placeholder="Since" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All time</SelectItem>
                              <SelectItem value="1">1 day</SelectItem>
                              <SelectItem value="7">7 days</SelectItem>
                              <SelectItem value="30">30 days</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {cleanupHistoryMeta?.filters ? (
                          <div className="space-y-1">
                            <p className="text-xs text-muted-foreground">
                              Applied: outcome <code>{cleanupHistoryMeta.filters.outcome}</code>
                              {' '}| since{' '}
                              <code>
                                {cleanupHistoryMeta.filters.since_days === null
                                  ? 'all'
                                  : `${cleanupHistoryMeta.filters.since_days}d`}
                              </code>
                              {' '}| page{' '}
                              <code>
                                {cleanupHistoryPageMode}
                              </code>
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Page <code>{cleanupHistoryPageNumber}</code>
                              {' '}| cursor{' '}
                              <code>
                                {cleanupHistoryAppliedCursor
                                  ? format(new Date(cleanupHistoryAppliedCursor), 'MM/dd HH:mm:ss')
                                  : 'latest'}
                              </code>
                            </p>
                          </div>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              setCleanupHistoryCursorStack([]);
                              setCleanupHistoryBeforeCreatedAt(null);
                              setCleanupHistoryAfterCreatedAt(null);
                            }}
                            disabled={
                              isLoading ||
                              isRunningTrackInteractionCleanup ||
                              (cleanupHistoryBeforeCreatedAt === null && cleanupHistoryAfterCreatedAt === null)
                            }
                          >
                            Newest
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              const newerCursor = cleanupHistoryMeta?.next_after_created_at ?? null;
                              if (!newerCursor) return;
                              setCleanupHistoryCursorStack((prev) => {
                                if (prev.length === 0) return prev;
                                return prev.slice(0, -1);
                              });
                              setCleanupHistoryBeforeCreatedAt(null);
                              setCleanupHistoryAfterCreatedAt(newerCursor);
                            }}
                            disabled={
                              isLoading ||
                              isRunningTrackInteractionCleanup ||
                              cleanupHistoryCursorStack.length === 0 ||
                              cleanupHistoryMeta?.has_newer !== true ||
                              !cleanupHistoryMeta?.next_after_created_at
                            }
                          >
                            Newer
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => {
                              if (cleanupHistoryMeta?.next_before_created_at) {
                                setCleanupHistoryCursorStack((prev) => [
                                  ...prev,
                                  cleanupHistoryBeforeCreatedAt,
                                ]);
                                setCleanupHistoryAfterCreatedAt(null);
                                setCleanupHistoryBeforeCreatedAt(cleanupHistoryMeta.next_before_created_at);
                              }
                            }}
                            disabled={
                              isLoading ||
                              isRunningTrackInteractionCleanup ||
                              cleanupHistoryMeta?.has_older !== true ||
                              !cleanupHistoryMeta?.next_before_created_at
                            }
                          >
                            Older
                          </Button>
                        </div>
                        {cleanupHistoryMeta?.profile_error ? (
                          <p className="text-xs text-amber-600">
                            Admin names unavailable: {cleanupHistoryMeta.profile_error}
                          </p>
                        ) : null}
                        {cleanupHistoryMeta?.error ? (
                          <p className="text-xs text-amber-600">{cleanupHistoryMeta.error}</p>
                        ) : cleanupHistory.length > 0 ? (
                          <div className="space-y-1">
                            {cleanupHistory.map((entry) => (
                              <div key={entry.id} className="flex items-start justify-between gap-3 text-xs">
                                <div className="min-w-0">
                                  {(() => {
                                    const isWarnRun =
                                      entry.outcome === 'success' &&
                                      (entry.assessment_status === 'warn' || (entry.assessment_warning_count ?? 0) > 0);
                                    const outcomeClass =
                                      entry.outcome === 'error'
                                        ? 'text-amber-700 font-medium'
                                        : isWarnRun
                                          ? 'text-yellow-700 font-medium'
                                          : entry.outcome === 'success'
                                            ? 'text-green-700 font-medium'
                                            : 'text-slate-700 font-medium';
                                    const detailLabel = entry.cleanup_error
                                      ? entry.cleanup_error
                                      : `retention ${entry.retention_days ?? '-'}d • warnings ${entry.assessment_warning_count ?? 0}`;

                                    return (
                                      <>
                                        <p className={outcomeClass}>
                                          {entry.outcome.toUpperCase()} • deleted {Number(entry.rows_deleted ?? 0).toLocaleString()}
                                          {isWarnRun ? ' • WARNINGS' : ''}
                                        </p>
                                        <p className="text-muted-foreground truncate">{detailLabel}</p>
                                      </>
                                    );
                                  })()}
                                </div>
                                <div className="text-right text-muted-foreground shrink-0">
                                  <p>{entry.created_at ? format(new Date(entry.created_at), 'MM/dd HH:mm') : '-'}</p>
                                  <p>{entry.admin_label || (entry.admin_id ? entry.admin_id.slice(0, 8) : '-')}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">No cleanup history yet.</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        {trackInteractionHealthError ?? 'Interaction anti-fraud health is unavailable.'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Confirm `track-interaction-health` is deployed and the admin origin is in
                        `ADMIN_CORS_ORIGINS`.
                      </p>
                      {trackInteractionCleanupNotice ? (
                        <p className="text-xs text-green-600">
                          {trackInteractionCleanupNotice}
                        </p>
                      ) : null}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users */}
          <TabsContent value="users" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <StatCard title="Total users" value={data.totals.totalUsers.toLocaleString()} icon={Users} />
              <StatCard
                title="New in period"
                value={data.period.newUsers.toLocaleString()}
                subValue={range}
                icon={UserPlus}
              />
              <StatCard
                title="Avg engagement"
                value={data.totals.avgEngagement}
                subValue="Tx + rewards / user"
                icon={TrendingUp}
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>User signups over time</CardTitle>
                <CardDescription>Daily new profiles</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={data.daily.map((d) => ({ ...d, name: d.label }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Area
                      type="monotone"
                      dataKey="users"
                      name="Signups"
                      stroke={CHART_COLORS[0]}
                      fill={CHART_COLORS[0]}
                      fillOpacity={0.4}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Role distribution</CardTitle>
              </CardHeader>
              <CardContent>
                {data.roleDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={data.roleDistribution}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        dataKey="value"
                        nameKey="name"
                        label={({ name, value }) => `${name}: ${value}`}
                      >
                        {data.roleDistribution.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={tooltipContentStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-center py-8">No role data</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content & engagement */}
          <TabsContent value="content" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Published content" value={data.totals.totalContent.toLocaleString()} icon={FileText} />
              <StatCard
                title="New in period"
                value={data.period.newContent.toLocaleString()}
                subValue={range}
                icon={FileText}
              />
              <StatCard
                title="Interactions"
                value={data.period.interactions.toLocaleString()}
                subValue={range}
                icon={Activity}
              />
              <StatCard title="Check-ins (all time)" value={data.totals.totalCheckins.toLocaleString()} icon={MapPin} />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Content & engagement</CardTitle>
                <CardDescription>New content and interactions per day</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.daily.map((d) => ({ ...d, name: d.label }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="content"
                      name="New content"
                      stroke={CHART_COLORS[0]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="interactions"
                      name="Interactions"
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revenue & coins */}
          <TabsContent value="revenue" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard
                title="Transactions (period)"
                value={data.period.transactionsCount.toLocaleString()}
                subValue={`Vol: ${data.period.transactionsVolume.toLocaleString()}`}
                icon={Activity}
              />
              <StatCard
                title="Rewards (period)"
                value={data.period.rewardsAmount.toLocaleString()}
                subValue={`${data.period.rewardsCount} events`}
                icon={Coins}
              />
              <StatCard title="All-time rewards" value={data.totals.totalRewardsAmount.toLocaleString()} icon={Gift} />
              <StatCard title="All-time reward events" value={data.totals.totalRewardsCount.toLocaleString()} icon={BarChart3} />
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle>Transaction volume by day</CardTitle>
                  <CardDescription>Coin amount per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart
                      data={data.daily.map((d) => ({
                        name: d.label,
                        volume: d.transactionsVolume ?? 0,
                        count: d.transactions ?? 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipContentStyle} />
                      <Bar dataKey="volume" name="Volume" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>Rewards by day</CardTitle>
                  <CardDescription>Reward amount per day</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart
                      data={data.daily.map((d) => ({
                        name: d.label,
                        amount: d.rewardsAmount ?? 0,
                        count: d.rewards ?? 0,
                      }))}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={tooltipContentStyle} />
                      <Area
                        type="monotone"
                        dataKey="amount"
                        name="Amount"
                        stroke={CHART_COLORS[1]}
                        fill={CHART_COLORS[1]}
                        fillOpacity={0.4}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
            {data.transactionBreakdown.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Transactions by type</CardTitle>
                  <CardDescription>Count and volume in period</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 font-medium">Type</th>
                          <th className="text-right py-2 font-medium">Count</th>
                          <th className="text-right py-2 font-medium">Volume</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.transactionBreakdown.map((row) => (
                          <tr key={row.type} className="border-b border-muted/50">
                            <td className="py-2 capitalize">{row.type}</td>
                            <td className="text-right tabular-nums">{row.count.toLocaleString()}</td>
                            <td className="text-right tabular-nums">{row.volume.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Promotions */}
          <TabsContent value="promotions" className="space-y-6 mt-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Total promotions" value={data.totals.totalPromotions.toLocaleString()} icon={MapPin} />
              <StatCard title="Check-ins (all time)" value={data.totals.totalCheckins.toLocaleString()} icon={MapPin} />
              <StatCard
                title="Check-ins (period)"
                value={data.period.checkins.toLocaleString()}
                subValue={range}
                icon={Activity}
              />
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Check-ins over time</CardTitle>
                <CardDescription>Daily promotion check-ins</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.daily.map((d) => ({ name: d.label, checkins: d.checkins ?? 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Bar dataKey="checkins" name="Check-ins" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Notifications sent</CardTitle>
                <CardDescription>Daily notifications in period</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={data.daily.map((d) => ({ name: d.label, notifications: d.notifications ?? 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={tooltipContentStyle} />
                    <Line
                      type="monotone"
                      dataKey="notifications"
                      name="Notifications"
                      stroke={CHART_COLORS[1]}
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
};

export default AnalyticsPanel;
