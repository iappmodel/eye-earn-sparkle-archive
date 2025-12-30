import React, { useState, useEffect } from 'react';
import { 
  DollarSign, TrendingUp, Gift, CreditCard, Video, Image, 
  Music, ArrowUp, ArrowDown, Minus, PieChart as PieChartIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { format, subDays, eachDayOfInterval, startOfDay, endOfDay } from 'date-fns';

interface RevenueData {
  totalEarnings: number;
  tips: number;
  subscriptions: number;
  rewards: number;
  contentEarnings: { type: string; amount: number; icon: React.ReactNode; color: string }[];
  dailyEarnings: { date: string; tips: number; subs: number; rewards: number }[];
  trend: number;
}

export const RevenueAnalytics: React.FC = () => {
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');
  const [data, setData] = useState<RevenueData>({
    totalEarnings: 0,
    tips: 0,
    subscriptions: 0,
    rewards: 0,
    contentEarnings: [],
    dailyEarnings: [],
    trend: 0,
  });

  useEffect(() => {
    if (user) {
      loadRevenueData();
    }
  }, [user, period]);

  const loadRevenueData = async () => {
    if (!user) return;
    setLoading(true);

    try {
      const daysBack = period === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);

      // Load transactions
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .eq('type', 'earning')
        .gte('created_at', startDate.toISOString());

      // Load tips received
      const { data: tipsReceived } = await supabase
        .from('coin_gifts')
        .select('*')
        .eq('recipient_id', user.id)
        .gte('created_at', startDate.toISOString());

      // Load reward logs
      const { data: rewardLogs } = await supabase
        .from('reward_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', startDate.toISOString());

      // Calculate totals
      const tips = tipsReceived?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const rewards = rewardLogs?.reduce((sum, r) => sum + r.amount, 0) || 0;
      // Mock subscription revenue (would come from Stripe in production)
      const subscriptions = Math.floor(Math.random() * 500) + 200;
      const totalEarnings = tips + subscriptions + rewards;

      // Content type breakdown
      const contentEarnings = [
        { type: 'Videos', amount: Math.floor(rewards * 0.5), icon: <Video className="w-4 h-4" />, color: 'hsl(217, 91%, 60%)' },
        { type: 'Images', amount: Math.floor(rewards * 0.3), icon: <Image className="w-4 h-4" />, color: 'hsl(142, 71%, 45%)' },
        { type: 'Reels', amount: Math.floor(rewards * 0.2), icon: <Music className="w-4 h-4" />, color: 'hsl(280, 65%, 60%)' },
      ];

      // Generate daily earnings chart data
      const days = eachDayOfInterval({ start: subDays(new Date(), daysBack - 1), end: new Date() });
      const dailyEarnings = days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        const dayTips = tipsReceived?.filter(t => {
          const d = new Date(t.created_at);
          return d >= dayStart && d <= dayEnd;
        }).reduce((sum, t) => sum + t.amount, 0) || 0;

        const dayRewards = rewardLogs?.filter(r => {
          const d = new Date(r.created_at);
          return d >= dayStart && d <= dayEnd;
        }).reduce((sum, r) => sum + r.amount, 0) || 0;

        return {
          date: format(day, period === '7d' ? 'EEE' : 'MMM d'),
          tips: dayTips,
          subs: Math.floor(Math.random() * 50) + 10,
          rewards: dayRewards,
        };
      });

      // Calculate trend (mock for demo)
      const trend = Math.floor(Math.random() * 30) - 10;

      setData({
        totalEarnings,
        tips,
        subscriptions,
        rewards,
        contentEarnings,
        dailyEarnings,
        trend,
      });
    } catch (error) {
      console.error('Error loading revenue data:', error);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Tips', value: data.tips, color: 'hsl(var(--vicoin))' },
    { name: 'Subscriptions', value: data.subscriptions, color: 'hsl(var(--primary))' },
    { name: 'Rewards', value: data.rewards, color: 'hsl(var(--icoin))' },
  ].filter(d => d.value > 0);

  const getTrendIcon = () => {
    if (data.trend > 0) return <ArrowUp className="w-3 h-3 text-green-500" />;
    if (data.trend < 0) return <ArrowDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const getTrendColor = () => {
    if (data.trend > 0) return 'text-green-500';
    if (data.trend < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Revenue Analytics</h3>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
          <TabsList className="h-8">
            <TabsTrigger value="7d" className="text-xs px-3">7D</TabsTrigger>
            <TabsTrigger value="30d" className="text-xs px-3">30D</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Total Earnings Card */}
      <Card className="neu-card bg-gradient-to-br from-vicoin/10 to-primary/10 border-vicoin/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Earnings</p>
              <p className="text-3xl font-bold text-foreground">
                {data.totalEarnings.toLocaleString()}
                <span className="text-lg text-vicoin ml-1">coins</span>
              </p>
              <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor()}`}>
                {getTrendIcon()}
                <span>{Math.abs(data.trend)}% from last period</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full bg-vicoin/20 flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-vicoin" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Revenue Breakdown */}
      <div className="grid grid-cols-3 gap-2">
        <Card className="neu-card">
          <CardContent className="p-3 text-center">
            <Gift className="w-5 h-5 text-vicoin mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{data.tips}</p>
            <p className="text-xs text-muted-foreground">Tips</p>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3 text-center">
            <CreditCard className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{data.subscriptions}</p>
            <p className="text-xs text-muted-foreground">Subs</p>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 text-icoin mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">{data.rewards}</p>
            <p className="text-xs text-muted-foreground">Rewards</p>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Distribution Pie Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieChartIcon className="w-4 h-4 text-primary" />
            Revenue Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={70}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => [value.toLocaleString(), 'Coins']}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend
                  formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Earnings Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Daily Earnings</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyEarnings}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                <XAxis 
                  dataKey="date" 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                />
                <YAxis 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }} 
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '10px' }} />
                <Bar dataKey="tips" stackId="a" fill="hsl(var(--vicoin))" name="Tips" radius={[0, 0, 0, 0]} />
                <Bar dataKey="subs" stackId="a" fill="hsl(var(--primary))" name="Subs" radius={[0, 0, 0, 0]} />
                <Bar dataKey="rewards" stackId="a" fill="hsl(var(--icoin))" name="Rewards" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Earnings by Content Type */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Earnings by Content Type</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.contentEarnings.map((content) => (
            <div key={content.type} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${content.color}20`, color: content.color }}
                  >
                    {content.icon}
                  </div>
                  <span className="text-foreground">{content.type}</span>
                </div>
                <span className="font-medium text-foreground">{content.amount.toLocaleString()}</span>
              </div>
              <Progress 
                value={(content.amount / data.rewards) * 100} 
                className="h-1.5"
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};
