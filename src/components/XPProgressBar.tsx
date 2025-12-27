import React from 'react';
import { cn } from '@/lib/utils';
import { getXpForLevel } from '@/hooks/useTasks';
import { Zap, TrendingUp } from 'lucide-react';

interface XPProgressBarProps {
  currentXp: number;
  level: number;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({
  currentXp,
  level,
  showLabel = true,
  size = 'md',
  className,
}) => {
  const xpRequired = getXpForLevel(level);
  const progress = Math.min((currentXp / xpRequired) * 100, 100);

  const sizeClasses = {
    sm: 'h-2',
    md: 'h-3',
    lg: 'h-4',
  };

  return (
    <div className={cn('w-full', className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-icoin to-primary flex items-center justify-center">
              <span className="text-xs font-bold text-white">{level}</span>
            </div>
            <div>
              <p className="text-sm font-medium">Level {level}</p>
              <p className="text-xs text-muted-foreground">
                {currentXp} / {xpRequired} XP
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 text-icoin">
            <TrendingUp className="w-4 h-4" />
            <span className="text-xs font-medium">{Math.round(progress)}%</span>
          </div>
        </div>
      )}
      <div className={cn('w-full rounded-full bg-muted overflow-hidden', sizeClasses[size])}>
        <div
          className="h-full bg-gradient-to-r from-icoin via-primary to-icoin rounded-full transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

interface LevelBadgeProps {
  level: number;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({
  level,
  size = 'md',
  className,
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-lg',
  };

  const getBadgeColor = () => {
    if (level >= 25) return 'from-amber-400 to-amber-600';
    if (level >= 10) return 'from-purple-400 to-purple-600';
    if (level >= 5) return 'from-primary to-primary/80';
    return 'from-muted-foreground to-muted-foreground/80';
  };

  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center font-bold text-white shadow-lg',
        getBadgeColor(),
        sizeClasses[size],
        className
      )}
    >
      {level}
    </div>
  );
};

interface StreakDisplayProps {
  streakDays: number;
  longestStreak: number;
  className?: string;
}

export const StreakDisplay: React.FC<StreakDisplayProps> = ({
  streakDays,
  longestStreak,
  className,
}) => {
  const isOnFire = streakDays >= 3;

  return (
    <div className={cn('flex items-center gap-3', className)}>
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center',
        isOnFire ? 'bg-gradient-to-br from-orange-500 to-red-500' : 'bg-muted'
      )}>
        <Zap className={cn('w-6 h-6', isOnFire ? 'text-white' : 'text-muted-foreground')} />
      </div>
      <div>
        <p className="text-lg font-bold">
          {streakDays} Day{streakDays !== 1 ? 's' : ''}
        </p>
        <p className="text-xs text-muted-foreground">
          Best: {longestStreak} days
        </p>
      </div>
    </div>
  );
};
