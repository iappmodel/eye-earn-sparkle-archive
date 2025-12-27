import React from 'react';
import { Target, Trophy } from 'lucide-react';
import { useTasks } from '@/hooks/useTasks';
import { XPProgressBar } from './XPProgressBar';
import { cn } from '@/lib/utils';

interface GamificationWidgetProps {
  onOpenTasks?: () => void;
  onOpenAchievements?: () => void;
  compact?: boolean;
  className?: string;
}

export const GamificationWidget: React.FC<GamificationWidgetProps> = ({
  onOpenTasks,
  onOpenAchievements,
  compact = false,
  className,
}) => {
  const { tasks, userLevel, userAchievements, achievements } = useTasks();

  const completedToday = tasks.filter(t => t.template?.type === 'daily' && t.completed).length;
  const totalDaily = tasks.filter(t => t.template?.type === 'daily').length;
  const unclaimedRewards = tasks.filter(t => t.completed && !t.reward_claimed).length;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3', className)}>
        {/* Level badge */}
        <button
          onClick={onOpenTasks}
          className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-icoin/20 to-primary/20 hover:from-icoin/30 hover:to-primary/30 transition-colors"
        >
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-icoin to-primary flex items-center justify-center">
            <span className="text-xs font-bold text-white">{userLevel?.level || 1}</span>
          </div>
          <span className="text-xs font-medium">{userLevel?.streak_days || 0}🔥</span>
        </button>

        {/* Tasks indicator */}
        {totalDaily > 0 && (
          <button
            onClick={onOpenTasks}
            className="relative flex items-center gap-1.5 px-3 py-1.5 rounded-full neu-button hover:scale-105 transition-transform"
          >
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium">{completedToday}/{totalDaily}</span>
            {unclaimedRewards > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-icoin text-white text-[10px] font-bold flex items-center justify-center">
                {unclaimedRewards}
              </span>
            )}
          </button>
        )}

        {/* Achievements */}
        <button
          onClick={onOpenAchievements}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full neu-button hover:scale-105 transition-transform"
        >
          <Trophy className="w-4 h-4 text-icoin" />
          <span className="text-xs font-medium">{userAchievements.length}</span>
        </button>
      </div>
    );
  }

  return (
    <div className={cn('neu-card rounded-2xl p-4', className)}>
      {/* XP Progress */}
      {userLevel && (
        <XPProgressBar
          currentXp={userLevel.current_xp}
          level={userLevel.level}
          className="mb-4"
        />
      )}

      {/* Quick stats */}
      <div className="grid grid-cols-3 gap-3">
        <button
          onClick={onOpenTasks}
          className="flex flex-col items-center p-3 rounded-xl neu-inset hover:bg-primary/5 transition-colors"
        >
          <Target className="w-5 h-5 text-primary mb-1" />
          <span className="text-lg font-bold">{completedToday}/{totalDaily}</span>
          <span className="text-xs text-muted-foreground">Daily</span>
        </button>

        <button
          onClick={onOpenTasks}
          className="flex flex-col items-center p-3 rounded-xl neu-inset hover:bg-orange-500/5 transition-colors"
        >
          <span className="text-xl mb-1">🔥</span>
          <span className="text-lg font-bold">{userLevel?.streak_days || 0}</span>
          <span className="text-xs text-muted-foreground">Streak</span>
        </button>

        <button
          onClick={onOpenAchievements}
          className="flex flex-col items-center p-3 rounded-xl neu-inset hover:bg-icoin/5 transition-colors"
        >
          <Trophy className="w-5 h-5 text-icoin mb-1" />
          <span className="text-lg font-bold">{userAchievements.length}/{achievements.length}</span>
          <span className="text-xs text-muted-foreground">Badges</span>
        </button>
      </div>
    </div>
  );
};
