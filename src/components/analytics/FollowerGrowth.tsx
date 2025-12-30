import React, { useState, useEffect } from 'react';
import { 
  Users, TrendingUp, Target, Award, ArrowUp, ArrowDown, 
  Minus, Calendar, UserPlus, UserMinus, ChevronRight
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';

interface GrowthData {
  date: string;
  followers: number;
  gained: number;
  lost: number;
}

interface GrowthGoal {
  target: number;
  current: number;
  deadline: string;
  progress: number;
}

export const FollowerGrowth: React.FC = () => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [period, setPeriod] = useState<'daily' | 'weekly' | 'monthly'>('weekly');
  const [growthData, setGrowthData] = useState<GrowthData[]>([]);
  const [goal, setGoal] = useState<GrowthGoal>({
    target: 1000,
    current: profile?.followers_count || 0,
    deadline: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'),
    progress: 0,
  });
  const [newGoalTarget, setNewGoalTarget] = useState('1000');
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [stats, setStats] = useState({
    netGain: 0,
    gainedToday: 0,
    lostToday: 0,
    avgDailyGrowth: 0,
    growthRate: 0,
  });

  useEffect(() => {
    generateGrowthData();
  }, [period, profile]);

  const generateGrowthData = () => {
    const currentFollowers = profile?.followers_count || 0;
    let daysBack: number;
    
    switch (period) {
      case 'daily':
        daysBack = 7;
        break;
      case 'weekly':
        daysBack = 28;
        break;
      case 'monthly':
        daysBack = 90;
        break;
    }

    const days = eachDayOfInterval({ 
      start: subDays(new Date(), daysBack - 1), 
      end: new Date() 
    });

    // Generate realistic growth data
    let runningTotal = Math.max(0, currentFollowers - Math.floor(Math.random() * 100));
    const data = days.map((day, index) => {
      const gained = Math.floor(Math.random() * 15) + 2;
      const lost = Math.floor(Math.random() * 5);
      runningTotal = runningTotal + gained - lost;

      return {
        date: format(day, period === 'monthly' ? 'MMM d' : 'EEE'),
        followers: runningTotal,
        gained,
        lost,
      };
    });

    // Adjust last entry to match current followers
    if (data.length > 0) {
      data[data.length - 1].followers = currentFollowers;
    }

    setGrowthData(data);

    // Calculate stats
    const totalGained = data.reduce((sum, d) => sum + d.gained, 0);
    const totalLost = data.reduce((sum, d) => sum + d.lost, 0);
    const netGain = totalGained - totalLost;
    const lastDay = data[data.length - 1] || { gained: 0, lost: 0 };
    const firstFollowers = data[0]?.followers || currentFollowers;
    const growthRate = firstFollowers > 0 
      ? ((currentFollowers - firstFollowers) / firstFollowers * 100) 
      : 0;

    setStats({
      netGain,
      gainedToday: lastDay.gained,
      lostToday: lastDay.lost,
      avgDailyGrowth: Math.round(netGain / daysBack),
      growthRate,
    });

    // Update goal progress
    setGoal(prev => ({
      ...prev,
      current: currentFollowers,
      progress: Math.min(100, (currentFollowers / prev.target) * 100),
    }));
  };

  const updateGoal = () => {
    const target = parseInt(newGoalTarget, 10);
    if (target > 0) {
      setGoal(prev => ({
        ...prev,
        target,
        progress: Math.min(100, ((profile?.followers_count || 0) / target) * 100),
      }));
      setShowGoalDialog(false);
      toast({
        title: 'Goal Updated',
        description: `Your new follower goal is ${target.toLocaleString()}`,
      });
    }
  };

  const getTrendIcon = (value: number) => {
    if (value > 0) return <ArrowUp className="w-3 h-3 text-green-500" />;
    if (value < 0) return <ArrowDown className="w-3 h-3 text-red-500" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return 'text-green-500';
    if (value < 0) return 'text-red-500';
    return 'text-muted-foreground';
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'daily':
        return 'Last 7 Days';
      case 'weekly':
        return 'Last 4 Weeks';
      case 'monthly':
        return 'Last 3 Months';
    }
  };

  return (
    <div className="space-y-4">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Follower Growth</h3>
        <div className="flex gap-1 p-1 bg-muted rounded-lg">
          {(['daily', 'weekly', 'monthly'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                period === p
                  ? 'bg-background text-foreground shadow'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Current Followers & Growth */}
      <Card className="neu-card bg-gradient-to-br from-primary/10 to-vicoin/10 border-primary/20">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Followers</p>
              <p className="text-3xl font-bold text-foreground">
                {(profile?.followers_count || 0).toLocaleString()}
              </p>
              <div className={`flex items-center gap-1 mt-1 text-xs ${getTrendColor(stats.growthRate)}`}>
                {getTrendIcon(stats.growthRate)}
                <span>{Math.abs(stats.growthRate).toFixed(1)}% {getPeriodLabel().toLowerCase()}</span>
              </div>
            </div>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-2">
        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <UserPlus className="w-4 h-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Gained Today</span>
            </div>
            <p className="text-xl font-bold text-green-500">+{stats.gainedToday}</p>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <UserMinus className="w-4 h-4 text-red-500" />
              <span className="text-xs text-muted-foreground">Lost Today</span>
            </div>
            <p className="text-xl font-bold text-red-500">-{stats.lostToday}</p>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-xs text-muted-foreground">Net Gain</span>
            </div>
            <p className={`text-xl font-bold ${getTrendColor(stats.netGain)}`}>
              {stats.netGain >= 0 ? '+' : ''}{stats.netGain}
            </p>
          </CardContent>
        </Card>
        <Card className="neu-card">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Calendar className="w-4 h-4 text-vicoin" />
              <span className="text-xs text-muted-foreground">Avg/Day</span>
            </div>
            <p className={`text-xl font-bold ${getTrendColor(stats.avgDailyGrowth)}`}>
              {stats.avgDailyGrowth >= 0 ? '+' : ''}{stats.avgDailyGrowth}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Chart */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Follower Trend
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growthData}>
                <defs>
                  <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} 
                />
                <YAxis 
                  className="text-xs" 
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  domain={['dataMin - 10', 'dataMax + 10']}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number, name: string) => {
                    const label = name === 'followers' ? 'Followers' : name === 'gained' ? 'Gained' : 'Lost';
                    return [value.toLocaleString(), label];
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="followers"
                  stroke="hsl(var(--primary))"
                  fillOpacity={1}
                  fill="url(#colorFollowers)"
                  name="followers"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Follower Goal */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Target className="w-4 h-4 text-primary" />
              Follower Goal
            </CardTitle>
            <Dialog open={showGoalDialog} onOpenChange={setShowGoalDialog}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Edit
                  <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Set Follower Goal</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Target Followers</Label>
                    <Input
                      type="number"
                      value={newGoalTarget}
                      onChange={(e) => setNewGoalTarget(e.target.value)}
                      placeholder="Enter target"
                    />
                  </div>
                  <Button onClick={updateGoal} className="w-full">
                    Save Goal
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progress</span>
              <span className="font-medium text-foreground">
                {goal.current.toLocaleString()} / {goal.target.toLocaleString()}
              </span>
            </div>
            <Progress value={goal.progress} className="h-2" />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                {goal.progress >= 100 ? (
                  <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                    <Award className="w-3 h-3 mr-1" />
                    Goal Reached!
                  </Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {Math.round(goal.progress)}% complete
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground">
                {(goal.target - goal.current).toLocaleString()} to go
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Milestone Progress */}
      <Card className="neu-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Award className="w-4 h-4 text-vicoin" />
            Milestones
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[100, 500, 1000, 5000, 10000].map((milestone) => {
            const current = profile?.followers_count || 0;
            const achieved = current >= milestone;
            const progress = Math.min(100, (current / milestone) * 100);
            
            return (
              <div 
                key={milestone}
                className={`flex items-center gap-3 p-2 rounded-lg ${
                  achieved ? 'bg-vicoin/10' : 'bg-muted/30'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  achieved ? 'bg-vicoin/20' : 'bg-muted'
                }`}>
                  {achieved ? (
                    <Award className="w-4 h-4 text-vicoin" />
                  ) : (
                    <Users className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${achieved ? 'text-vicoin' : 'text-foreground'}`}>
                      {milestone.toLocaleString()} Followers
                    </span>
                    {achieved && (
                      <Badge variant="outline" className="text-xs bg-vicoin/10 text-vicoin border-vicoin/30">
                        Achieved
                      </Badge>
                    )}
                  </div>
                  {!achieved && (
                    <Progress value={progress} className="h-1 mt-1" />
                  )}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
};
