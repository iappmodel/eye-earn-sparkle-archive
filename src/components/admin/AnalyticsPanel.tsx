import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Cell
} from 'recharts';
import { 
  TrendingUp, 
  Users, 
  Coins, 
  Activity,
  Loader2
} from 'lucide-react';
import { format, subDays, startOfDay } from 'date-fns';

interface DailyStats {
  date: string;
  users: number;
  transactions: number;
  rewards: number;
}

interface RoleDistribution {
  name: string;
  value: number;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--accent))', 'hsl(var(--secondary))', 'hsl(var(--muted))'];

const AnalyticsPanel: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [dailyStats, setDailyStats] = useState<DailyStats[]>([]);
  const [roleDistribution, setRoleDistribution] = useState<RoleDistribution[]>([]);
  const [totals, setTotals] = useState({
    totalUsers: 0,
    totalTransactions: 0,
    totalRewards: 0,
    avgEngagement: 0,
  });

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    setIsLoading(true);

    // Fetch profiles for user stats
    const { data: profiles, count: totalUsers } = await supabase
      .from('profiles')
      .select('created_at', { count: 'exact' });

    // Fetch transactions
    const { data: transactions, count: totalTransactions } = await supabase
      .from('transactions')
      .select('created_at, amount', { count: 'exact' });

    // Fetch reward logs
    const { data: rewards, count: totalRewards } = await supabase
      .from('reward_logs')
      .select('created_at, amount', { count: 'exact' });

    // Fetch role distribution
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role');

    // Calculate role distribution
    const roleCounts: Record<string, number> = {};
    roles?.forEach(r => {
      roleCounts[r.role] = (roleCounts[r.role] || 0) + 1;
    });
    const roleData: RoleDistribution[] = Object.entries(roleCounts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
    setRoleDistribution(roleData);

    // Calculate daily stats for last 7 days
    const last7Days: DailyStats[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = startOfDay(subDays(new Date(), i));
      const dateStr = format(date, 'yyyy-MM-dd');
      const displayDate = format(date, 'MMM dd');

      const usersOnDay = profiles?.filter(p => 
        format(new Date(p.created_at), 'yyyy-MM-dd') === dateStr
      ).length || 0;

      const transactionsOnDay = transactions?.filter(t => 
        format(new Date(t.created_at), 'yyyy-MM-dd') === dateStr
      ).length || 0;

      const rewardsOnDay = rewards?.filter(r => 
        format(new Date(r.created_at), 'yyyy-MM-dd') === dateStr
      ).length || 0;

      last7Days.push({
        date: displayDate,
        users: usersOnDay,
        transactions: transactionsOnDay,
        rewards: rewardsOnDay,
      });
    }
    setDailyStats(last7Days);

    // Calculate totals
    const totalRewardAmount = rewards?.reduce((sum, r) => sum + r.amount, 0) || 0;
    setTotals({
      totalUsers: totalUsers || 0,
      totalTransactions: totalTransactions || 0,
      totalRewards: totalRewardAmount,
      avgEngagement: totalUsers ? Math.round((totalTransactions || 0) / totalUsers) : 0,
    });

    setIsLoading(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totals.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Total Users</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{totals.totalTransactions}</p>
                <p className="text-sm text-muted-foreground">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Coins className="w-5 h-5 text-warning" />
              <div>
                <p className="text-2xl font-bold">{totals.totalRewards.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Rewards Issued</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{totals.avgEngagement}</p>
                <p className="text-sm text-muted-foreground">Avg Engagement</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* User Growth Chart */}
        <Card>
          <CardHeader>
            <CardTitle>User Signups (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Bar dataKey="users" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activity Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Activity (Last 7 Days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={dailyStats}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="transactions" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="rewards" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--accent))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Role Distribution */}
        <Card>
          <CardHeader>
            <CardTitle>Role Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={roleDistribution}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="hsl(var(--primary))"
                  dataKey="value"
                >
                  {roleDistribution.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))', 
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }} 
                />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Daily Active Users</span>
                <span className="font-bold">{dailyStats[dailyStats.length - 1]?.users || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Today's Transactions</span>
                <span className="font-bold">{dailyStats[dailyStats.length - 1]?.transactions || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Today's Rewards</span>
                <span className="font-bold">{dailyStats[dailyStats.length - 1]?.rewards || 0}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">User Growth (7d)</span>
                <span className="font-bold text-primary">
                  +{dailyStats.reduce((sum, d) => sum + d.users, 0)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AnalyticsPanel;
