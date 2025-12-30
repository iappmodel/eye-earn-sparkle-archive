import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, Eye, Heart, Share2, Users, Play, 
  BarChart3, Clock, ArrowUp, ArrowDown, Minus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AudienceInsights } from './AudienceInsights';
import { BestPostingTimes } from './BestPostingTimes';
import { ContentComparison } from './ContentComparison';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface DashboardStats {
  totalViews: number;
  totalLikes: number;
  totalShares: number;
  totalFollowers: number;
  avgEngagement: number;
  viewsTrend: number;
  likesTrend: number;
  followersTrend: number;
}

interface ChartDataPoint {
  date: string;
  views: number;
  engagement: number;
}

export const CreatorDashboard: React.FC = () => {
  const { user, profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalViews: 0,
    totalLikes: 0,
    totalShares: 0,
    totalFollowers: 0,
    avgEngagement: 0,
    viewsTrend: 0,
    likesTrend: 0,
    followersTrend: 0,
  });
  const [chartData, setChartData] = useState<ChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, period]);

  const loadDashboardData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const daysBack = period === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);
      const previousStartDate = subDays(startDate, daysBack);

      // Load user content stats
      const { data: contentData } = await supabase
        .from('user_content')
        .select('views_count, likes_count, shares_count, created_at')
        .eq('user_id', user.id);

      const totalViews = contentData?.reduce((sum, c) => sum + (c.views_count || 0), 0) || 0;
      const totalLikes = contentData?.reduce((sum, c) => sum + (c.likes_count || 0), 0) || 0;
      const totalShares = contentData?.reduce((sum, c) => sum + (c.shares_count || 0), 0) || 0;

      // Load interactions for trends
      const { data: currentInteractions } = await supabase
        .from('content_interactions')
        .select('created_at, liked, shared, watch_duration, content_id')
        .gte('created_at', startDate.toISOString());

      const { data: previousInteractions } = await supabase
        .from('content_interactions')
        .select('created_at, liked')
        .gte('created_at', previousStartDate.toISOString())
        .lt('created_at', startDate.toISOString());

      // Calculate trends
      const currentViews = currentInteractions?.length || 0;
      const previousViews = previousInteractions?.length || 0;
      const viewsTrend = previousViews > 0 ? ((currentViews - previousViews) / previousViews) * 100 : 0;

      const currentLikes = currentInteractions?.filter(i => i.liked).length || 0;
      const previousLikes = previousInteractions?.filter(i => i.liked).length || 0;
      const likesTrend = previousLikes > 0 ? ((currentLikes - previousLikes) / previousLikes) * 100 : 0;

      // Generate chart data
      const days = eachDayOfInterval({ start: subDays(new Date(), daysBack - 1), end: new Date() });
      const chartPoints = days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        
        const dayInteractions = currentInteractions?.filter((i) => {
          const date = new Date(i.created_at);
          return date >= dayStart && date <= dayEnd;
        }) || [];

        const views = dayInteractions.length;
        const engagement = dayInteractions.filter(i => i.liked || i.shared).length;

        return {
          date: format(day, period === '7d' ? 'EEE' : 'MMM d'),
          views,
          engagement,
        };
      });

      setChartData(chartPoints);
      setStats({
        totalViews,
        totalLikes,
        totalShares,
        totalFollowers: profile?.followers_count || 0,
        avgEngagement: totalViews > 0 ? ((totalLikes + totalShares) / totalViews) * 100 : 0,
        viewsTrend,
        likesTrend,
        followersTrend: 0,
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
    }
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

  if (loading) {
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
        <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
          <TabsList className="h-8">
            <TabsTrigger value="7d" className="text-xs px-3">7D</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

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
            </div>
            <p className="text-2xl font-bold text-foreground">{stats.totalShares.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Total Shares</p>
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
      </div>

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
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="audience" className="text-xs">
            <Users className="w-3 h-3 mr-1" />
            Audience
          </TabsTrigger>
          <TabsTrigger value="timing" className="text-xs">
            <Clock className="w-3 h-3 mr-1" />
            Timing
          </TabsTrigger>
          <TabsTrigger value="compare" className="text-xs">
            <BarChart3 className="w-3 h-3 mr-1" />
            Compare
          </TabsTrigger>
        </TabsList>
        <TabsContent value="audience" className="mt-4">
          <AudienceInsights />
        </TabsContent>
        <TabsContent value="timing" className="mt-4">
          <BestPostingTimes />
        </TabsContent>
        <TabsContent value="compare" className="mt-4">
          <ContentComparison />
        </TabsContent>
      </Tabs>
    </div>
  );
};
