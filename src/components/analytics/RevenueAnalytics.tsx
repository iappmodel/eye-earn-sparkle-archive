import React, { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  TrendingUp,
  Gift,
  CreditCard,
  Video,
  Image,
  Music,
  ArrowUp,
  ArrowDown,
  Minus,
  PieChart as PieChartIcon,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import {
  format,
  subDays,
  eachDayOfInterval,
  startOfDay,
  endOfDay,
} from 'date-fns';

// Reward type labels and icons for breakdown
const REWARD_TYPE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  promo_view: {
    label: 'Promo views',
    icon: <Video className="w-4 h-4" />,
    color: 'hsl(217, 91%, 60%)',
  },
  task_complete: {
    label: 'Tasks',
    icon: <TrendingUp className="w-4 h-4" />,
    color: 'hsl(142, 71%, 45%)',
  },
  referral: {
    label: 'Referrals',
    icon: <Gift className="w-4 h-4" />,
    color: 'hsl(280, 65%, 60%)',
  },
  milestone: {
    label: 'Milestones',
    icon: <Image className="w-4 h-4" />,
    color: 'hsl(35, 92%, 50%)',
  },
  daily_bonus: {
    label: 'Daily bonus',
    icon: <Music className="w-4 h-4" />,
    color: 'hsl(170, 70%, 45%)',
  },
};

interface RevenueData {
  totalEarnings: number;
  tips: number;
  subscriptions: number;
  rewards: number;
  earnedVicoin: number;
  earnedIcoin: number;
  contentEarnings: { type: string; amount: number; icon: React.ReactNode; color: string }[];
  dailyEarnings: { date: string; tips: number; subs: number; rewards: number }[];
  trend: number;
}

export const RevenueAnalytics: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d'>('7d');

  const [data, setData] = useState<RevenueData>({
    totalEarnings: 0,
    tips: 0,
    subscriptions: 0,
    rewards: 0,
    earnedVicoin: 0,
    earnedIcoin: 0,
    contentEarnings: [],
    dailyEarnings: [],
    trend: 0,
  });

  const loadRevenueData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      const daysBack = period === '7d' ? 7 : 30;
      const startDate = subDays(new Date(), daysBack);
      const prevStartDate = subDays(startDate, daysBack);
      const endDate = new Date();

      // 1. Transactions: creator tips = type='earned' with 'Tip received from viewer'
      const { data: txData, error: txErr } = await supabase
        .from('transactions')
        .select('type, coin_type, amount, description, created_at')
        .eq('user_id', user.id)
        .in('type', ['earned', 'received'])
        .gte('created_at', prevStartDate.toISOString());

      if (txErr) throw txErr;

      // 2. Coin gifts (general gifts received)
      const { data: giftsData, error: giftsErr } = await supabase
        .from('coin_gifts')
        .select('amount, created_at')
        .eq('recipient_id', user.id)
        .gte('created_at', prevStartDate.toISOString());

      if (giftsErr) throw giftsErr;

      // 3. Reward logs (platform engagement earnings)
      const { data: rewardData, error: rewardErr } = await supabase
        .from('reward_logs')
        .select('amount, reward_type, created_at')
        .eq('user_id', user.id)
        .gte('created_at', prevStartDate.toISOString());

      if (rewardErr) throw rewardErr;

      const transactions = txData || [];
      const gifts = giftsData || [];
      const rewardLogs = rewardData || [];

      // Current period boundaries
      const currStart = startDate.getTime();
      const currEnd = endDate.getTime();

      const inCurrentPeriod = (d: string) => {
        const t = new Date(d).getTime();
        return t >= currStart && t <= currEnd;
      };
      const inPrevPeriod = (d: string) => {
        const t = new Date(d).getTime();
        return t >= prevStartDate.getTime() && t < currStart;
      };

      // Tips = transactions (Tip received) + coin_gifts
      const tipsFromTx = transactions
        .filter(
          (t) =>
            t.description?.includes('Tip received') ||
            t.description?.toLowerCase().includes('gift')
        )
        .reduce((s, t) => s + t.amount, 0);

      const tipsFromGifts = gifts.reduce((s, g) => s + g.amount, 0);

      const currTips =
        transactions
          .filter(
            (t) =>
              inCurrentPeriod(t.created_at) &&
              (t.description?.includes('Tip received') ||
                t.description?.toLowerCase().includes('gift'))
          )
          .reduce((s, t) => s + t.amount, 0) +
        gifts.filter((g) => inCurrentPeriod(g.created_at)).reduce((s, g) => s + g.amount, 0);

      const prevTips =
        transactions
          .filter(
            (t) =>
              inPrevPeriod(t.created_at) &&
              (t.description?.includes('Tip received') ||
                t.description?.toLowerCase().includes('gift'))
          )
          .reduce((s, t) => s + t.amount, 0) +
        gifts.filter((g) => inPrevPeriod(g.created_at)).reduce((s, g) => s + g.amount, 0);

      const tips = currTips;

      // Rewards (from reward_logs)
      const currRewards = rewardLogs
        .filter((r) => inCurrentPeriod(r.created_at))
        .reduce((s, r) => s + r.amount, 0);
      const prevRewards = rewardLogs
        .filter((r) => inPrevPeriod(r.created_at))
        .reduce((s, r) => s + r.amount, 0);
      const rewards = currRewards;

      // Subscriptions: no creator subscription revenue in platform
      const subscriptions = 0;

      const totalEarnings = tips + subscriptions + rewards;
      const prevTotal = prevTips + 0 + prevRewards;

      const trend =
        prevTotal > 0
          ? Math.round(((totalEarnings - prevTotal) / prevTotal) * 100)
          : totalEarnings > 0
            ? 100
            : 0;

      // Vicoin vs Icoin from current period transactions (earned) + gifts
      const currTxEarned = transactions.filter((t) => inCurrentPeriod(t.created_at));
      const currGiftsForPeriod = gifts.filter((g) => inCurrentPeriod(g.created_at));

      let earnedVicoin = 0;
      let earnedIcoin = 0;

      for (const t of currTxEarned) {
        if (
          t.description?.includes('Tip received') ||
          t.description?.toLowerCase().includes('gift')
        ) {
          if (t.coin_type === 'vicoin') earnedVicoin += t.amount;
          else earnedIcoin += t.amount;
        }
      }
      for (const g of currGiftsForPeriod) {
        const gt = g as { coin_type: string; amount: number };
        if (gt.coin_type === 'vicoin') earnedVicoin += gt.amount;
        else earnedIcoin += gt.amount;
      }

      for (const r of rewardLogs.filter((x) => inCurrentPeriod(x.created_at))) {
        const rl = r as { coin_type: string; amount: number };
        if (rl.coin_type === 'vicoin') earnedVicoin += rl.amount;
        else earnedIcoin += rl.amount;
      }

      // Content earnings by reward_type (from reward_logs)
      const rewardByType = rewardLogs
        .filter((r) => inCurrentPeriod(r.created_at))
        .reduce(
          (acc, r) => {
            const rt = (r.reward_type || 'other') as string;
            acc[rt] = (acc[rt] || 0) + r.amount;
            return acc;
          },
          {} as Record<string, number>
        );

      const contentEarnings = Object.entries(rewardByType)
        .map(([type, amount]) => {
          const config = REWARD_TYPE_CONFIG[type] || {
            label: type.replace(/_/g, ' '),
            icon: <TrendingUp className="w-4 h-4" />,
            color: 'hsl(200, 70%, 50%)',
          };
          return {
            type: config.label,
            amount,
            icon: config.icon,
            color: config.color,
          };
        })
        .sort((a, b) => b.amount - a.amount);

      // Daily earnings (real data)
      const days = eachDayOfInterval({
        start: subDays(new Date(), daysBack - 1),
        end: new Date(),
      });

      const dailyEarnings = days.map((day) => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);
        const dayStartT = dayStart.getTime();
        const dayEndT = dayEnd.getTime();

        const dayTipsFromTx = transactions
          .filter((t) => {
            const d = new Date(t.created_at).getTime();
            return (
              d >= dayStartT &&
              d <= dayEndT &&
              (t.description?.includes('Tip received') ||
                t.description?.toLowerCase().includes('gift'))
            );
          })
          .reduce((s, t) => s + t.amount, 0);
        const dayTipsFromGifts = gifts
          .filter((g) => {
            const d = new Date(g.created_at).getTime();
            return d >= dayStartT && d <= dayEndT;
          })
          .reduce((s, g) => s + g.amount, 0);
        const dayTips = dayTipsFromTx + dayTipsFromGifts;

        const dayRewards = rewardLogs
          .filter((r) => {
            const d = new Date(r.created_at).getTime();
            return d >= dayStartT && d <= dayEndT;
          })
          .reduce((s, r) => s + r.amount, 0);

        return {
          date: format(day, period === '7d' ? 'EEE' : 'MMM d'),
          tips: dayTips,
          subs: 0,
          rewards: dayRewards,
        };
      });

      setData({
        totalEarnings,
        tips,
        subscriptions,
        rewards,
        earnedVicoin,
        earnedIcoin,
        contentEarnings,
        dailyEarnings,
        trend,
      });
    } catch (err) {
      console.error('Error loading revenue data:', err);
      setError(
        err instanceof Error ? err.message : 'Failed to load revenue data'
      );
    } finally {
      setLoading(false);
    }
  }, [user, period]);

  useEffect(() => {
    if (user) loadRevenueData();
  }, [user, period, loadRevenueData]);

  const pieData = [
    { name: 'Tips', value: data.tips, color: 'hsl(var(--vicoin))' },
    {
      name: 'Subscriptions',
      value: data.subscriptions,
      color: 'hsl(var(--primary))',
    },
    { name: 'Rewards', value: data.rewards, color: 'hsl(var(--icoin))' },
  ].filter((d) => d.value > 0);

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

  if (loading && !data.totalEarnings) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-48 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card className="neu-card border-destructive/50">
          <CardContent className="p-6 flex flex-col items-center gap-3">
            <AlertCircle className="w-10 h-10 text-destructive" />
            <p className="text-sm text-muted-foreground text-center">{error}</p>
            <button
              onClick={loadRevenueData}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-2 text-sm text-primary-foreground hover:bg-primary/90"
            >
              <RefreshCw className="w-4 h-4" />
              Retry
            </button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with Period Selector and Refresh */}
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-lg font-semibold text-foreground">
          Revenue Analytics
        </h3>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadRevenueData()}
            disabled={loading}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw
              className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
            />
          </button>
          <Tabs value={period} onValueChange={(v) => setPeriod(v as '7d' | '30d')}>
            <TabsList className="h-8">
              <TabsTrigger value="7d" className="text-xs px-3">
                7D
              </TabsTrigger>
              <TabsTrigger value="30d" className="text-xs px-3">
                30D
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* Total Earnings Card */}
      <Card className="neu-card bg-gradient-to-br from-vicoin/10 to-primary/10 border-vicoin/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Total Earnings
              </p>
              <p className="text-3xl font-bold text-foreground">
                {data.totalEarnings.toLocaleString()}
                <span className="text-lg text-vicoin ml-1">coins</span>
              </p>
              {(data.earnedVicoin > 0 || data.earnedIcoin > 0) && (
                <p className="text-xs text-muted-foreground mt-1">
                  {data.earnedVicoin > 0 && (
                    <span className="text-vicoin">{data.earnedVicoin} Vicoin</span>
                  )}
                  {data.earnedVicoin > 0 && data.earnedIcoin > 0 && ' · '}
                  {data.earnedIcoin > 0 && (
                    <span className="text-icoin">{data.earnedIcoin} Icoin</span>
                  )}
                </p>
              )}
              <div
                className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor()}`}
              >
                {getTrendIcon()}
                <span>
                  {Math.abs(data.trend)}% from last period
                </span>
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
            <p className="text-lg font-bold text-foreground">
              {data.tips.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Tips</p>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3 text-center">
            <CreditCard className="w-5 h-5 text-primary mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">
              {data.subscriptions.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">Subs</p>
            <span className="text-[10px] text-muted-foreground/80">
              Coming soon
            </span>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3 text-center">
            <TrendingUp className="w-5 h-5 text-icoin mx-auto mb-1" />
            <p className="text-lg font-bold text-foreground">
              {data.rewards.toLocaleString()}
            </p>
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
          {pieData.length > 0 ? (
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
                    formatter={(value) => (
                      <span className="text-xs text-foreground">{value}</span>
                    )}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
              No earnings in this period
            </div>
          )}
        </CardContent>
      </Card>

      {/* Daily Earnings Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Daily Earnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.dailyEarnings}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  className="stroke-muted"
                  vertical={false}
                />
                <XAxis
                  dataKey="date"
                  className="text-xs"
                  tick={{
                    fill: 'hsl(var(--muted-foreground))',
                    fontSize: 10,
                  }}
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
                <Bar
                  dataKey="tips"
                  stackId="a"
                  fill="hsl(var(--vicoin))"
                  name="Tips"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="subs"
                  stackId="a"
                  fill="hsl(var(--primary))"
                  name="Subs"
                  radius={[0, 0, 0, 0]}
                />
                <Bar
                  dataKey="rewards"
                  stackId="a"
                  fill="hsl(var(--icoin))"
                  name="Rewards"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Earnings by Content Type (reward_type) */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">
            Earnings by Source
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.contentEarnings.length > 0 ? (
            data.contentEarnings.map((content) => (
              <div key={content.type} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{
                        backgroundColor: `${content.color}20`,
                        color: content.color,
                      }}
                    >
                      {content.icon}
                    </div>
                    <span className="text-foreground">{content.type}</span>
                  </div>
                  <span className="font-medium text-foreground">
                    {content.amount.toLocaleString()}
                  </span>
                </div>
                <Progress
                  value={
                    data.rewards > 0
                      ? (content.amount / data.rewards) * 100
                      : 0
                  }
                  className="h-1.5"
                />
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground py-2">
              No rewards earned in this period
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
