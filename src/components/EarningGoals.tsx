import React, { useState, useEffect } from 'react';
import { Target, Plus, Trophy, Calendar, CheckCircle2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format, addDays, addWeeks, addMonths, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface EarningGoal {
  id: string;
  goal_type: string;
  target_amount: number;
  coin_type: string;
  current_progress: number;
  period_start: string;
  period_end: string;
  is_active: boolean;
  achieved: boolean;
  achieved_at: string | null;
  created_at: string;
}

export const EarningGoals: React.FC = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [goals, setGoals] = useState<EarningGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [newGoal, setNewGoal] = useState({
    type: 'daily',
    amount: '',
    coinType: 'vicoin',
  });

  useEffect(() => {
    if (user) {
      loadGoals();
    }
  }, [user]);

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('earning_goals')
        .select('*')
        .eq('user_id', user?.id)
        .order('is_active', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setGoals((data || []) as EarningGoal[]);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const calculatePeriod = (type: string) => {
    const now = new Date();
    switch (type) {
      case 'daily':
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
      case 'weekly':
        return {
          start: startOfWeek(now, { weekStartsOn: 1 }),
          end: endOfWeek(now, { weekStartsOn: 1 }),
        };
      case 'monthly':
        return {
          start: startOfMonth(now),
          end: endOfMonth(now),
        };
      default:
        return {
          start: startOfDay(now),
          end: endOfDay(now),
        };
    }
  };

  const handleCreateGoal = async () => {
    if (!newGoal.amount || parseInt(newGoal.amount) <= 0) {
      toast({ title: 'Please enter a valid target amount', variant: 'destructive' });
      return;
    }

    const period = calculatePeriod(newGoal.type);

    try {
      // Deactivate existing goals of the same type
      await supabase
        .from('earning_goals')
        .update({ is_active: false })
        .eq('user_id', user?.id)
        .eq('goal_type', newGoal.type)
        .eq('coin_type', newGoal.coinType);

      const { error } = await supabase
        .from('earning_goals')
        .insert({
          user_id: user?.id,
          goal_type: newGoal.type,
          target_amount: parseInt(newGoal.amount),
          coin_type: newGoal.coinType,
          period_start: period.start.toISOString(),
          period_end: period.end.toISOString(),
        });

      if (error) throw error;

      toast({ title: 'Goal created!' });
      setIsAdding(false);
      setNewGoal({ type: 'daily', amount: '', coinType: 'vicoin' });
      loadGoals();
    } catch (error) {
      console.error('Error creating goal:', error);
      toast({ title: 'Failed to create goal', variant: 'destructive' });
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      const { error } = await supabase
        .from('earning_goals')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Goal removed' });
      loadGoals();
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const getGoalIcon = (type: string) => {
    switch (type) {
      case 'daily': return '📅';
      case 'weekly': return '📊';
      case 'monthly': return '🗓️';
      default: return '🎯';
    }
  };

  const getProgressPercentage = (goal: EarningGoal) => {
    return Math.min(100, Math.round((goal.current_progress / goal.target_amount) * 100));
  };

  const activeGoals = goals.filter(g => g.is_active && !g.achieved);
  const completedGoals = goals.filter(g => g.achieved);

  if (loading) {
    return <div className="h-40 bg-muted rounded-xl animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Earning Goals</h3>
        </div>
        <Sheet open={isAdding} onOpenChange={setIsAdding}>
          <SheetTrigger asChild>
            <Button size="sm" variant="outline" className="gap-2">
              <Plus className="w-4 h-4" /> New Goal
            </Button>
          </SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Create Earning Goal</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 mt-6">
              <div>
                <Label>Goal Type</Label>
                <Select value={newGoal.type} onValueChange={(v) => setNewGoal({ ...newGoal, type: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily Goal</SelectItem>
                    <SelectItem value="weekly">Weekly Goal</SelectItem>
                    <SelectItem value="monthly">Monthly Goal</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Coin Type</Label>
                <Select value={newGoal.coinType} onValueChange={(v) => setNewGoal({ ...newGoal, coinType: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="vicoin">Vicoin</SelectItem>
                    <SelectItem value="icoin">Icoin</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Target Amount</Label>
                <Input
                  type="number"
                  placeholder="e.g., 100"
                  value={newGoal.amount}
                  onChange={(e) => setNewGoal({ ...newGoal, amount: e.target.value })}
                  min={1}
                />
              </div>

              <Button className="w-full" onClick={handleCreateGoal}>
                Create Goal
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      {/* Active Goals */}
      {activeGoals.length === 0 && completedGoals.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center text-muted-foreground">
            <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>No goals set</p>
            <p className="text-sm">Create goals to track your earnings</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeGoals.map((goal) => (
            <Card key={goal.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{getGoalIcon(goal.goal_type)}</span>
                    <div>
                      <p className="font-medium capitalize">{goal.goal_type} Goal</p>
                      <p className="text-sm text-muted-foreground">
                        {goal.target_amount} {goal.coin_type === 'vicoin' ? 'Vicoins' : 'Icoins'}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-muted-foreground"
                    onClick={() => handleDeleteGoal(goal.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{goal.current_progress.toLocaleString()} earned</span>
                    <span className="font-medium">{getProgressPercentage(goal)}%</span>
                  </div>
                  <Progress value={getProgressPercentage(goal)} className="h-2" />
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Ends {format(new Date(goal.period_end), 'MMM d, h:mm a')}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Completed Goals */}
          {completedGoals.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-3">
                <Trophy className="w-4 h-4 text-yellow-500" />
                <h4 className="font-medium">Completed Goals</h4>
              </div>
              <div className="space-y-2">
                {completedGoals.slice(0, 3).map((goal) => (
                  <Card key={goal.id} className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-3 flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-500" />
                      <div className="flex-1">
                        <p className="font-medium capitalize">{goal.goal_type} Goal</p>
                        <p className="text-sm text-muted-foreground">
                          {goal.target_amount} {goal.coin_type === 'vicoin' ? 'V' : 'I'}
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {goal.achieved_at ? format(new Date(goal.achieved_at), 'MMM d') : ''}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
