import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, subDays, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';

type Period = '7d' | '30d' | 'all';

interface Transaction {
  amount: number;
  coin_type: string;
  type: string;
  created_at: string;
}

export const EarningBreakdownChart: React.FC = () => {
  const { user } = useAuth();
  const [period, setPeriod] = useState<Period>('7d');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      loadTransactions();
    }
  }, [user, period]);

  const loadTransactions = async () => {
    setLoading(true);
    try {
      let startDate: Date;
      const now = new Date();

      switch (period) {
        case '7d':
          startDate = subDays(now, 7);
          break;
        case '30d':
          startDate = subDays(now, 30);
          break;
        default:
          startDate = subDays(now, 365);
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, coin_type, type, created_at')
        .eq('user_id', user?.id)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  // Prepare chart data
  const getChartData = () => {
    const now = new Date();
    let days: Date[] = [];

    switch (period) {
      case '7d':
        days = eachDayOfInterval({ start: subDays(now, 6), end: now });
        break;
      case '30d':
        days = eachDayOfInterval({ start: subDays(now, 29), end: now });
        break;
      default:
        days = eachDayOfInterval({ start: subDays(now, 29), end: now });
    }

    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = endOfDay(day);
      
      const dayTransactions = transactions.filter((t) => {
        const tDate = new Date(t.created_at);
        return tDate >= dayStart && tDate <= dayEnd && t.amount > 0;
      });

      const vicoin = dayTransactions
        .filter((t) => t.coin_type === 'vicoin')
        .reduce((sum, t) => sum + t.amount, 0);
      
      const icoin = dayTransactions
        .filter((t) => t.coin_type === 'icoin')
        .reduce((sum, t) => sum + t.amount, 0);

      return {
        date: format(day, period === '7d' ? 'EEE' : 'MMM d'),
        vicoin,
        icoin,
        total: vicoin + icoin,
      };
    });
  };

  // Prepare pie chart data for earning sources
  const getPieData = () => {
    const sources: Record<string, number> = {};
    
    transactions.filter(t => t.amount > 0).forEach((t) => {
      const source = t.type || 'other';
      sources[source] = (sources[source] || 0) + t.amount;
    });

    const labels: Record<string, string> = {
      'promo_view': 'Promo Views',
      'daily_task': 'Daily Tasks',
      'weekly_task': 'Weekly Tasks',
      'referral': 'Referrals',
      'gift_received': 'Gifts Received',
      'tip_received': 'Tips Received',
      'content_view': 'Content Views',
      'achievement': 'Achievements',
      'other': 'Other',
    };

    return Object.entries(sources).map(([key, value]) => ({
      name: labels[key] || key,
      value,
    }));
  };

  const chartData = getChartData();
  const pieData = getPieData();
  
  const totalVicoin = transactions
    .filter((t) => t.coin_type === 'vicoin' && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);
  
  const totalIcoin = transactions
    .filter((t) => t.coin_type === 'icoin' && t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'];

  if (loading) {
    return <div className="h-60 bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Earning Analytics</h3>
        </div>
        <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <TabsList>
            <TabsTrigger value="7d">7D</TabsTrigger>
            <TabsTrigger value="30d">30D</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-primary">{totalVicoin.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Vicoins Earned</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-secondary-foreground">{totalIcoin.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground">Icoins Earned</p>
          </CardContent>
        </Card>
      </div>

      {/* Area Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Earnings Over Time
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorVicoin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorIcoin" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--secondary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--secondary))" stopOpacity={0}/>
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
                  dataKey="vicoin"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorVicoin)"
                  name="Vicoin"
                />
                <Area
                  type="monotone"
                  dataKey="icoin"
                  stroke="hsl(var(--secondary))"
                  fillOpacity={1}
                  fill="url(#colorIcoin)"
                  name="Icoin"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Pie Chart for sources */}
      {pieData.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Earning Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend
                    wrapperStyle={{ fontSize: '12px' }}
                    formatter={(value) => <span className="text-foreground">{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
