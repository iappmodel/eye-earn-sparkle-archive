import React, { useState, useEffect } from 'react';
import { Eye, Heart, Share2, MessageCircle, TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface ContentAnalyticsProps {
  contentId: string;
}

interface InteractionData {
  created_at: string;
  liked: boolean | null;
  shared: boolean | null;
  watch_duration: number | null;
}

export const ContentAnalytics: React.FC<ContentAnalyticsProps> = ({ contentId }) => {
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [content, setContent] = useState<any>(null);
  const [interactions, setInteractions] = useState<InteractionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [contentId, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const daysBack = period === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);

      // Load content stats
      const { data: contentData } = await supabase
        .from('user_content')
        .select('views_count, likes_count, shares_count, comments_count, created_at')
        .eq('id', contentId)
        .single();

      setContent(contentData);

      // Load interactions
      const { data: interactionData } = await supabase
        .from('content_interactions')
        .select('created_at, liked, shared, watch_duration')
        .eq('content_id', contentId)
        .gte('created_at', startDate.toISOString());

      setInteractions((interactionData || []) as InteractionData[]);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    const daysBack = period === '7d' ? 7 : 30;
    const days = eachDayOfInterval({ start: subDays(new Date(), daysBack - 1), end: new Date() });

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const dayInteractions = interactions.filter((i) => {
        const date = new Date(i.created_at);
        return date >= dayStart && date <= dayEnd;
      });

      return {
        date: format(day, period === '7d' ? 'EEE' : 'MMM d'),
        views: dayInteractions.length,
        likes: dayInteractions.filter(i => i.liked).length,
        shares: dayInteractions.filter(i => i.shared).length,
        watchTime: Math.round(dayInteractions.reduce((sum, i) => sum + (i.watch_duration || 0), 0) / 60),
      };
    });
  };

  const chartData = getChartData();
  const totalViews = content?.views_count || 0;
  const totalLikes = content?.likes_count || 0;
  const totalShares = content?.shares_count || 0;
  const totalComments = content?.comments_count || 0;
  const engagementRate = totalViews > 0 ? ((totalLikes + totalShares + totalComments) / totalViews * 100).toFixed(1) : '0';

  if (loading) {
    return <div className="h-60 bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Content Analytics</h3>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
          <TabsList>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center">
              <Eye className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalViews.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Views</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
              <Heart className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalLikes.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Likes</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
              <Share2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{totalShares.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground">Shares</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xl font-bold">{engagementRate}%</p>
              <p className="text-xs text-muted-foreground">Engagement</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Views Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Views Over Time</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
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
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Engagement Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Engagement Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
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
                <Bar dataKey="likes" fill="#ef4444" name="Likes" radius={[4, 4, 0, 0]} />
                <Bar dataKey="shares" fill="#22c55e" name="Shares" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
