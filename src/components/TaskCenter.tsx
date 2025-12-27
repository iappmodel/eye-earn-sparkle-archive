import React from 'react';
import { X, CheckCircle, Gift, Clock, Flame, Target, Heart, Share2, Play, Calendar, UserPlus } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { XPProgressBar, StreakDisplay } from './XPProgressBar';
import { useTasks, UserTask } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';

interface TaskCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  play: Play,
  heart: Heart,
  share: Share2,
  calendar: Calendar,
  'user-plus': UserPlus,
  'check-circle': CheckCircle,
  flame: Flame,
  target: Target,
};

const TaskItem: React.FC<{
  task: UserTask;
  onClaim: (taskId: string) => void;
}> = ({ task, onClaim }) => {
  const template = task.template;
  if (!template) return null;

  const Icon = iconMap[template.icon || 'target'] || Target;
  const progress = (task.progress / task.goal) * 100;
  const canClaim = task.completed && !task.reward_claimed;

  return (
    <div className={cn(
      'neu-card rounded-2xl p-4 transition-all',
      task.completed && task.reward_claimed && 'opacity-60'
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
          task.completed ? 'bg-primary/20' : 'neu-inset'
        )}>
          <Icon className={cn(
            'w-6 h-6',
            task.completed ? 'text-primary' : 'text-muted-foreground'
          )} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <h3 className="font-medium text-sm">{template.title}</h3>
              <p className="text-xs text-muted-foreground">{template.description}</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {task.completed ? (
                <CheckCircle className="w-5 h-5 text-primary" />
              ) : (
                <span className="text-xs font-medium text-muted-foreground">
                  {task.progress}/{task.goal}
                </span>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <Progress value={progress} className="h-2 mb-2" />

          {/* Rewards */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn(
                'text-xs font-medium px-2 py-0.5 rounded-full',
                template.reward_type === 'vicoin' && 'bg-primary/20 text-primary',
                template.reward_type === 'icoin' && 'bg-icoin/20 text-icoin',
                template.reward_type === 'xp' && 'bg-purple-500/20 text-purple-500'
              )}>
                +{template.reward_value} {template.reward_type.toUpperCase()}
              </span>
              <span className="text-xs text-muted-foreground">
                +{template.xp_reward} XP
              </span>
            </div>

            {canClaim && (
              <Button
                size="sm"
                onClick={() => onClaim(task.id)}
                className="h-7 text-xs gap-1"
              >
                <Gift className="w-3 h-3" />
                Claim
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export const TaskCenter: React.FC<TaskCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { tasks, userLevel, isLoading, claimTaskReward } = useTasks();

  if (!isOpen) return null;

  const dailyTasks = tasks.filter(t => t.template?.type === 'daily');
  const weeklyTasks = tasks.filter(t => t.template?.type === 'weekly');
  const streakTasks = tasks.filter(t => t.template?.type === 'streak');

  const completedCount = tasks.filter(t => t.completed).length;
  const totalTasks = tasks.length;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="font-display text-xl font-bold">Tasks & Rewards</h1>
            <NeuButton onClick={onClose} size="sm">
              <X className="w-5 h-5" />
            </NeuButton>
          </div>

          {/* XP Progress */}
          {userLevel && (
            <div className="space-y-4">
              <XPProgressBar
                currentXp={userLevel.current_xp}
                level={userLevel.level}
              />
              <div className="flex items-center justify-between">
                <StreakDisplay
                  streakDays={userLevel.streak_days}
                  longestStreak={userLevel.longest_streak}
                />
                <div className="text-right">
                  <p className="text-sm font-medium">{completedCount}/{totalTasks}</p>
                  <p className="text-xs text-muted-foreground">Tasks completed</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 pb-20">
              {/* Daily Tasks */}
              {dailyTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-primary" />
                    <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      Daily Tasks
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      ({dailyTasks.filter(t => t.completed).length}/{dailyTasks.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {dailyTasks.map(task => (
                      <TaskItem key={task.id} task={task} onClaim={claimTaskReward} />
                    ))}
                  </div>
                </div>
              )}

              {/* Weekly Tasks */}
              {weeklyTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Calendar className="w-4 h-4 text-icoin" />
                    <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      Weekly Tasks
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      ({weeklyTasks.filter(t => t.completed).length}/{weeklyTasks.length})
                    </span>
                  </div>
                  <div className="space-y-3">
                    {weeklyTasks.map(task => (
                      <TaskItem key={task.id} task={task} onClaim={claimTaskReward} />
                    ))}
                  </div>
                </div>
              )}

              {/* Streak Tasks */}
              {streakTasks.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                      Streak Challenges
                    </h2>
                  </div>
                  <div className="space-y-3">
                    {streakTasks.map(task => (
                      <TaskItem key={task.id} task={task} onClaim={claimTaskReward} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
};
