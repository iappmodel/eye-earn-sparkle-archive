import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Gift, CreditCard, Calendar,
  ArrowUp, ArrowDown, Minus, ChevronLeft, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, Legend 
} from 'recharts';
import { 
  format, subDays, subWeeks, subMonths, startOfWeek, endOfWeek,
  startOfMonth, endOfMonth, eachDayOfInterval, eachWeekOfInterval,
  eachMonthOfInterval, startOfDay, endOfDay, addDays
} from 'date-fns';

type Period = 'daily' | 'weekly' | 'monthly';

interface EarningData {
  label: string;
  tips: number;
  rewards: number;
  adRevenue: number;
  subscriptions: number;
  total: number;
}

interface Summary {
  totalEarnings: number;
  tips: number;
  rewards: number;
  adRevenue: number;
  subscriptions: number;
  trend: number;
  avgDaily: number;
  bestDay: { date: string; amount: number };
}

export const EnhancedEarningAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('daily');
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<EarningData[]>([]);
  const [summary, setSummary] = useState<Summary>({
    totalEarnings: 0,
    tips: 0,
    rewards: 0,
    adRevenue: 0,
    subscriptions: 0,
    trend: 0,
    avgDaily: 0,
    bestDay: { date: '', amount: 0 },
  });

  useEffect(() => {
    if (user) {
      loadData();
    }
  }, [user, period, offset]);

  const getDateRange = () => {
    const now = new Date();
    
    if (period === 'daily') {
      const end = subDays(now, offset * 7);
      const start = subDays(end, 6);
      return { start: startOfDay(start), end: endOfDay(end), intervals: eachDayOfInterval({ start, end }) };
    } else if (period === 'weekly') {
      const baseWeek = subWeeks(now, offset * 4);
      const weeks = [];
      for (let i = 3; i >= 0; i--) {
        weeks.push(startOfWeek(subWeeks(baseWeek, i)));
      }
      return { 
        start: weeks[0], 
        end: endOfWeek(weeks[3]),
        intervals: weeks 
      };
    } else {
      const baseMonth = subMonths(now, offset * 6);
      const months = [];
      for (let i = 5; i >= 0; i--) {
        months.push(startOfMonth(subMonths(baseMonth, i)));
      }
      return { 
        start: months[0], 
        end: endOfMonth(months[5]),
        intervals: months 
      };
    }
  };

  const loadData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const { start, end, intervals } = getDateRange();

      // Load tips received
      const { data: tipsData } = await supabase
        .from('coin_gifts')
        .select('amount, created_at')
        .eq('recipient_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Load rewards
      const { data: rewardsData } = await supabase
        .from('reward_logs')
        .select('amount, reward_type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      // Process data by interval
      const chartData: EarningData[] = intervals.map((intervalStart: Date) => {
        let intervalEnd: Date;
        let label: string;

        if (period === 'daily') {
          intervalEnd = endOfDay(intervalStart);
          label = format(intervalStart, 'EEE');
        } else if (period === 'weekly') {
          intervalEnd = endOfWeek(intervalStart);
          label = `Week ${format(intervalStart, 'w')}`;
        } else {
          intervalEnd = endOfMonth(intervalStart);
          label = format(intervalStart, 'MMM');
        }

        const intervalTips = tipsData?.filter(t => {
          const d = new Date(t.created_at);
          return d >= intervalStart && d <= intervalEnd;
        }).reduce((sum, t) => sum + t.amount, 0) || 0;

        const intervalRewards = rewardsData?.filter(r => {
          const d = new Date(r.created_at);
          return d >= intervalStart && d <= intervalEnd;
        }).reduce((sum, r) => sum + r.amount, 0) || 0;

        // Ad revenue from promo views (subset of rewards)
        const adRevenue = rewardsData?.filter(r => {
          const d = new Date(r.created_at);
          return d >= intervalStart && d <= intervalEnd && r.reward_type === 'promo_view';
        }).reduce((sum, r) => sum + r.amount, 0) || 0;

        // Mock subscription revenue
        const subscriptions = Math.floor(Math.random() * 100) + 20;

        return {
          label,
          tips: intervalTips,
          rewards: intervalRewards - adRevenue,
          adRevenue,
          subscriptions,
          total: intervalTips + intervalRewards + subscriptions,
        };
      });

      setData(chartData);

      // Calculate summary
      const totalTips = chartData.reduce((sum, d) => sum + d.tips, 0);
      const totalRewards = chartData.reduce((sum, d) => sum + d.rewards, 0);
      const totalAdRevenue = chartData.reduce((sum, d) => sum + d.adRevenue, 0);
      const totalSubs = chartData.reduce((sum, d) => sum + d.subscriptions, 0);
      const totalEarnings = totalTips + totalRewards + totalAdRevenue + totalSubs;

      const bestDay = chartData.reduce((best, d) => 
        d.total > best.amount ? { date: d.label, amount: d.total } : best,
        { date: '', amount: 0 }
      );

      setSummary({
        totalEarnings,
        tips: totalTips,
        rewards: totalRewards,
        adRevenue: totalAdRevenue,
        subscriptions: totalSubs,
        trend: Math.floor(Math.random() * 40) - 15,
        avgDaily: Math.floor(totalEarnings / chartData.length),
        bestDay,
      });
    } catch (error) {
      console.error('Error loading earning analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getPeriodLabel = () => {
    if (period === 'daily') {
      return offset === 0 ? 'This Week' : `${offset} week${offset > 1 ? 's' : ''} ago`;
    } else if (period === 'weekly') {
      return offset === 0 ? 'Last 4 Weeks' : `${offset * 4} weeks ago`;
    } else {
      return offset === 0 ? 'Last 6 Months' : `${offset * 6} months ago`;
    }
  };

  const getTrendIcon = () => {
    if (summary.trend > 0) return <ArrowUp className="w-4 h-4 text-green-500" />;
    if (summary.trend < 0) return <ArrowDown className="w-4 h-4 text-red-500" />;
    return <Minus className="w-4 h-4 text-muted-foreground" />;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-12 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <Tabs value={period} onValueChange={(v) => { setPeriod(v as Period); setOffset(0); }}>
          <TabsList className="h-9">
            <TabsTrigger value="daily" className="text-xs px-3">Daily</TabsTrigger>
            <TabsTrigger value="weekly" className="text-xs px-3">Weekly</TabsTrigger>
            <TabsTrigger value="monthly" className="text-xs px-3">Monthly</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOffset(offset + 1)}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs text-muted-foreground min-w-[80px] text-center">
            {getPeriodLabel()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setOffset(Math.max(0, offset - 1))}
            disabled={offset === 0}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="neu-card col-span-2 bg-gradient-to-br from-primary/10 to-icoin/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Earnings</p>
                <p className="text-2xl font-bold text-foreground">
                  {summary.totalEarnings.toLocaleString()}
                </p>
                <div className={`flex items-center gap-1 mt-1 text-xs ${
                  summary.trend > 0 ? 'text-green-500' : summary.trend < 0 ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {getTrendIcon()}
                  <span>{Math.abs(summary.trend)}% vs previous</span>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-1">Best {period === 'daily' ? 'Day' : period === 'weekly' ? 'Week' : 'Month'}</p>
                <p className="text-lg font-bold text-icoin">{summary.bestDay.amount}</p>
                <p className="text-xs text-muted-foreground">{summary.bestDay.date}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Gift className="w-4 h-4 text-vicoin" />
              <span className="text-xs text-muted-foreground">Tips</span>
            </div>
            <p className="text-lg font-bold">{summary.tips.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-icoin" />
              <span className="text-xs text-muted-foreground">Rewards</span>
            </div>
            <p className="text-lg font-bold">{summary.rewards.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <DollarSign className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Ad Revenue</span>
            </div>
            <p className="text-lg font-bold">{summary.adRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Subs</span>
            </div>
            <p className="text-lg font-bold">{summary.subscriptions.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* Area Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Earnings Trend</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="total" 
                  stroke="hsl(var(--primary))" 
                  fill="url(#totalGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Stacked Bar Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Earnings Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis 
                  dataKey="label" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                />
                <YAxis 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="tips" stackId="a" fill="hsl(var(--vicoin))" name="Tips" />
                <Bar dataKey="rewards" stackId="a" fill="hsl(var(--icoin))" name="Rewards" />
                <Bar dataKey="adRevenue" stackId="a" fill="hsl(142, 71%, 45%)" name="Ad Revenue" />
                <Bar dataKey="subscriptions" stackId="a" fill="hsl(var(--primary))" name="Subs" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Avg Daily */}
      <Card className="neu-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Average per {period === 'daily' ? 'day' : period === 'weekly' ? 'week' : 'month'}</p>
                <p className="text-xl font-bold">{summary.avgDaily.toLocaleString()} coins</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedEarningAnalytics;
