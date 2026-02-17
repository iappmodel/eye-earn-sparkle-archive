import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Eye, Heart, Share2, Users, Play,
  BarChart3, Clock, ArrowUp, ArrowDown, Minus, DollarSign, Bell,
  RefreshCw, Bookmark, AlertCircle, FileQuestion
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AudienceInsights } from './AudienceInsights';
import { BestPostingTimes } from './BestPostingTimes';
import { ContentComparison } from './ContentComparison';
import { SmartPostScheduler } from './SmartPostScheduler';
import { RevenueAnalytics } from './RevenueAnalytics';
import { FollowerGrowth } from './FollowerGrowth';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalSaves: number;
  totalFollowers: number;
  avgEngagement: number;
  avgCompletionRate: number;
  viewsTrend: number;
  likesTrend: number;
  sharesTrend: number;
  followersTrend: number;
}

interface ChartDataPoint {
  date: string;
  views: number;
  engagement: number;
}

interface TopContentItem {
  id: string;
  title: string | null;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  shares_count: number;
  created_at: string;
}

/** RLS-safe: only interactions where current user is the content owner (creator analytics). */
const CREATOR_INTERACTIONS_SELECT = 'created_at, liked, shared, saved, watch_duration, watch_completion_rate, content_id, last_event_type';

export const CreatorDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalSaves: 0,
    totalFollowers: 0,
    avgEngagement: 0,
    avgCompletionRate: 0,
    viewsTrend: 0,
    likesTrend: 0,
    sharesTrend: 0,
    followersTrend: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [topContent, setTopContent] = useState<TopContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    setError(null);

    try {
      const daysBack = period === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);
      const previousStartDate = subDays(startDate, daysBack);

      // Load creator's content (owned by user)
      const { data: contentData, error: contentError } = await supabase
        .from('user_content')
        .select('id, title, thumbnail_url, views_count, likes_count, shares_count, created_at')
        .eq('user_id', user.id)
        .eq('status', 'active');

      if (contentError) throw contentError;

      const totalViews = contentData?.reduce((sum, c) => sum + (c.views_count || 0), 0) || 0;
      const totalLikes = contentData?.reduce((sum, c) => sum + (c.likes_count || 0), 0) || 0;
      const totalShares = contentData?.reduce((sum, c) => sum + (c.shares_count || 0), 0) || 0;

      // RLS-safe: only interactions on this creator's content (content_owner_id = auth.uid())
      const { data: currentInteractions, error: currentErr } = await supabase
        .from('content_interactions')
        .select(CREATOR_INTERACTIONS_SELECT)
        .eq('content_owner_id', user.id)
        .gte('created_at', startDate.toISOString());

      if (currentErr) throw currentErr;

      const { data: previousInteractions, error: prevErr } = await supabase
        .from('content_interactions')
        .select('created_at, liked, shared')
        .eq('content_owner_id', user.id)
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      if (prevErr) throw prevErr;

      const curr = currentInteractions ?? [];
      const prev = previousInteractions ?? [];

      const currentViews = curr.length;
      const previousViews = prev.length;
      const viewsTrend = previousViews > 0 ? ((currentViews - previousViews) / previousViews) * 100 : (currentViews > 0 ? 100 : 0);

      const currentLikes = curr.filter((i) => i.liked).length;
      const previousLikes = prev.filter((i) => i.liked).length;
      const likesTrend = previousLikes > 0 ? ((currentLikes - previousLikes) / previousLikes) * 100 : (currentLikes > 0 ? 100 : 0);

      const currentShares = curr.filter((i) => i.shared).length;
      const previousShares = prev.filter((i) => i.shared).length;
      const sharesTrend = previousShares > 0 ? ((currentShares - previousShares) / previousShares) * 100 : (currentShares > 0 ? 100 : 0);

      const totalSaves = curr.filter((i) => i.saved).length;
      const completionRates = curr.map((i) => i.watch_completion_rate).filter((r): r is number => typeof r === 'number' && r >= 0);
      const avgCompletionRate = completionRates.length > 0
        ? completionRates.reduce((a, b) => a + b, 0) / completionRates.length
        : 0;

      const days = eachDayOfInterval({ start: subDays(new Date(), daysBack - 1), end: new Date() });
      const chartPoints = days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayInteractions = curr.filter((i) => {
          const date = new Date(i.created_at);
          return date >= dayStart && date <= dayEnd;
        });
        return {
          date: format(day, period === '7d' ? 'EEE' : 'MMM d'),
          views: dayInteractions.length,
          engagement: dayInteractions.filter((i) => i.liked || i.shared).length,
        };
      });

      setChartData(chartPoints);
      setStats({
        totalViews,
        totalLikes,
        totalShares,
        totalSaves,
        totalFollowers: profile?.followers_count ?? 0,
        avgEngagement: totalViews > 0 ? ((totalLikes + totalShares) / totalViews) * 100 : 0,
        avgCompletionRate,
        viewsTrend,
        likesTrend,
        sharesTrend,
        followersTrend: 0,
      });

      // Top performing content (by views, then likes)
      const withEngagement = (contentData ?? []).map((c) => ({
        ...c,
        engagement: (c.views_count ?? 0) + (c.likes_count ?? 0) * 2 + (c.shares_count ?? 0) * 3,
      }));
      const sorted = withEngagement
        .sort((a, b) => (b.views_count ?? 0) - (a.views_count ?? 0))
        .slice(0, 5)
        .map((c) => ({
          id: c.id,
          title: c.title ?? null,
          thumbnail_url: c.thumbnail_url ?? null,
          views_count: c.views_count ?? 0,
          likes_count: c.likes_count ?? 0,
          shares_count: c.shares_count ?? 0,
          created_at: c.created_at,
        }));
      setTopContent(sorted);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id, profile?.followers_count, period]);

  useEffect(() => {
    if (user) loadDashboardData();
  }, [user, period, loadDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData();
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 0) return <ArrowUp className="w-3 h-3 text-green-500" />;
    if (trend < 0) return <ArrowDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const getTrendColor = (trend: number) => {
    if (trend > 0) return 'text-green-500';
    if (trend < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const isEmpty = !loading && !error && stats.totalViews === 0 && stats.totalLikes === 0 && topContent.length === 0;

  if (loading && !refreshing) {
    return (
      <div className="space-y-4 p-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-foreground">Creator Dashboard</h2>
          <p className="text-sm text-muted-foreground">Track your content performance</p>
        </div>
        <div className="flex items-center gap-2">
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <TabsList className="h-8">
              <TabsTrigger value="7d" className="text-xs px-3">7D</TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-3">30D</TabsTrigger>
            </TabsList>
          </Tabs>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleRefresh}>Retry</Button>
          </AlertDescription>
        </Alert>
      )}

      {isEmpty && !error && (
        <Alert className="mb-4 border-dashed">
          <FileQuestion className="h-4 w-4" />
          <AlertTitle>No data yet</AlertTitle>
          <AlertDescription>
            Publish content and ensure viewers interact with it (and that <code>content_owner_id</code> is set when tracking) to see analytics here.
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Eye className="w-4 h-4 text-blue-500" />
              </div>
              <div className={`flex items-center gap-1 text-xs ${getTrendColor(stats.viewsTrend)}`}>
                {getTrendIcon(stats.viewsTrend)}
                <span>{Math.abs(stats.viewsTrend).toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalViews.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Views</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
                <Heart className="w-4 h-4 text-red-500" />
              </div>
              <div className={`flex items-center gap-1 text-xs ${getTrendColor(stats.likesTrend)}`}>
                {getTrendIcon(stats.likesTrend)}
                <span>{Math.abs(stats.likesTrend).toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalLikes.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Likes</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                <Share2 className="w-4 h-4 text-green-500" />
              </div>
              <div className={`flex items-center gap-1 text-xs ${getTrendColor(stats.sharesTrend)}`}>
                {getTrendIcon(stats.sharesTrend)}
                <span>{Math.abs(stats.sharesTrend).toFixed(1)}%</span>
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalShares.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Shares</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                <Bookmark className="w-4 h-4 text-amber-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalSaves.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Saves (period)</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-purple-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.avgEngagement.toFixed(1)}%</p>
            <p className="text-xs text-muted-foreground">Engagement Rate</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center">
                <Play className="w-4 h-4 text-cyan-500" />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.avgCompletionRate.toFixed(0)}%</p>
            <p className="text-xs text-muted-foreground">Avg. Completion</p>
          </CardContent>
        </Card>
      </div>

      {/* Top performing content */}
      {topContent.length > 0 && (
        <Card className="neu-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Top performing content
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[120px] w-full rounded-md">
              <div className="flex gap-3 pb-2">
                {topContent.map((item) => (
                  <div
                    key={item.id}
                    className="flex-shrink-0 w-[140px] rounded-lg overflow-hidden border border-border bg-muted/50"
                  >
                    <div className="aspect-video bg-muted relative">
                      {item.thumbnail_url ? (
                        <img
                          src={item.thumbnail_url}
                          alt={item.title ?? 'Content'}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-8 h-8 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <div className="p-2">
                      <p className="text-xs font-medium truncate text-foreground" title={item.title ?? undefined}>
                        {item.title || 'Untitled'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.views_count} views · {item.likes_count} likes
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Performance Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Performance Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorEngagement" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--vicoin))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--vicoin))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis className="text-xs" tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="views"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorViews)"
                  name="Views"
                />
                <Area
                  type="monotone"
                  dataKey="engagement"
                  stroke="hsl(var(--vicoin))"
                  fillOpacity={1}
                  fill="url(#colorEngagement)"
                  name="Engagement"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Sub-sections */}
      <Tabs defaultValue="audience" className="w-full">
        <TabsList className="w-full grid grid-cols-6 h-auto p-1">
          <TabsTrigger value="audience" className="text-[10px] px-1 py-2 flex-col gap-0.5">
            <Users className="w-3 h-3" />
            Audience
          </TabsTrigger>
          <TabsTrigger value="growth" className="text-[10px] px-1 py-2 flex-col gap-0.5">
            <TrendingUp className="w-3 h-3" />
            Growth
          </TabsTrigger>
          <TabsTrigger value="revenue" className="text-[10px] px-1 py-2 flex-col gap-0.5">
            <DollarSign className="w-3 h-3" />
            Revenue
          </TabsTrigger>
          <TabsTrigger value="timing" className="text-[10px] px-1 py-2 flex-col gap-0.5">
            <Clock className="w-3 h-3" />
            Timing
          </TabsTrigger>
          <TabsTrigger value="schedule" className="text-[10px] px-1 py-2 flex-col gap-0.5">
            <Bell className="w-3 h-3" />
            Schedule
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-[10px] px-1 py-2 flex-col gap-0.5">
            <BarChart3 className="w-3 h-3" />
            Compare
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audience" className="mt-4">
          <AudienceInsights />
        </TabsContent>
        <TabsContent value="growth" className="mt-4">
          <FollowerGrowth />
        </TabsContent>
        <TabsContent value="revenue" className="mt-4">
          <RevenueAnalytics />
        </TabsContent>
        <TabsContent value="timing" className="mt-4">
          <BestPostingTimes />
        </TabsContent>
        <TabsContent value="schedule" className="mt-4">
          <SmartPostScheduler />
        </TabsContent>
        <TabsContent value="compare" className="mt-4">
          <ContentComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
};
