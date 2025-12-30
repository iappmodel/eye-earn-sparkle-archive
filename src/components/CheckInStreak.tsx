import React from 'react';
import { Flame, Award, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CheckInStreakProps {
  currentStreak: number;
  longestStreak: number;
  streakBonus?: number;
  className?: string;
  compact?: boolean;
}

// Streak bonus multipliers
export const STREAK_BONUSES = [
  { days: 1, bonus: 0, label: 'Day 1' },
  { days: 2, bonus: 5, label: '2 Days' },
  { days: 3, bonus: 10, label: '3 Days' },
  { days: 5, bonus: 15, label: '5 Days' },
  { days: 7, bonus: 25, label: '1 Week' },
  { days: 14, bonus: 35, label: '2 Weeks' },
  { days: 30, bonus: 50, label: '1 Month' },
];

export function getStreakBonus(streakDays: number): number {
  // Find the highest bonus tier the user qualifies for
  let bonus = 0;
  for (const tier of STREAK_BONUSES) {
    if (streakDays >= tier.days) {
      bonus = tier.bonus;
    }
  }
  return bonus;
}

export function getNextStreakMilestone(currentStreak: number): { days: number; bonus: number } | null {
  for (const tier of STREAK_BONUSES) {
    if (tier.days > currentStreak) {
      return tier;
    }
  }
  return null;
}

export function CheckInStreak({ 
  currentStreak, 
  longestStreak, 
  streakBonus = 0,
  className,
  compact = false 
}: CheckInStreakProps) {
  const nextMilestone = getNextStreakMilestone(currentStreak);
  const currentBonus = getStreakBonus(currentStreak);
  
  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <div className={cn(
          'flex items-center gap-1 px-2 py-1 rounded-full text-sm font-medium',
          currentStreak > 0 
            ? 'bg-orange-500/20 text-orange-500' 
            : 'bg-muted text-muted-foreground'
        )}>
          <Flame className={cn('w-4 h-4', currentStreak > 0 && 'animate-pulse')} />
          <span>{currentStreak}</span>
        </div>
        {currentBonus > 0 && (
          <span className="text-xs text-green-500 font-medium">+{currentBonus}%</span>
        )}
      </div>
    );
  }

  return (
    <div className={cn('p-4 rounded-2xl bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20', className)}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center',
            currentStreak > 0 
              ? 'bg-gradient-to-br from-orange-500 to-red-500 text-white' 
              : 'bg-muted text-muted-foreground'
          )}>
            <Flame className={cn('w-5 h-5', currentStreak > 0 && 'animate-pulse')} />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Check-in Streak</h3>
            <p className="text-xs text-muted-foreground">Daily consecutive check-ins</p>
          </div>
        </div>
        {currentBonus > 0 && (
          <div className="px-3 py-1 rounded-full bg-green-500/20 text-green-500 text-sm font-bold">
            +{currentBonus}% Bonus
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-background/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-orange-500">{currentStreak}</div>
          <div className="text-xs text-muted-foreground">Current Streak</div>
        </div>
        <div className="bg-background/50 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold flex items-center justify-center gap-1">
            <Award className="w-5 h-5 text-yellow-500" />
            {longestStreak}
          </div>
          <div className="text-xs text-muted-foreground">Best Streak</div>
        </div>
      </div>

      {/* Progress to next milestone */}
      {nextMilestone && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Next milestone</span>
            <span className="font-medium text-orange-500">
              {nextMilestone.days} days (+{nextMilestone.bonus}% bonus)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-orange-500 to-red-500 transition-all duration-500"
              style={{ 
                width: `${Math.min((currentStreak / nextMilestone.days) * 100, 100)}%` 
              }}
            />
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <TrendingUp className="w-3 h-3" />
            <span>{nextMilestone.days - currentStreak} more days to go!</span>
          </div>
        </div>
      )}

      {/* Milestone badges */}
      <div className="flex gap-1 mt-4 overflow-x-auto pb-1">
        {STREAK_BONUSES.slice(1).map((tier) => (
          <div
            key={tier.days}
            className={cn(
              'flex-shrink-0 px-2 py-1 rounded-lg text-xs font-medium transition-all',
              currentStreak >= tier.days
                ? 'bg-orange-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}
          >
            {tier.label}
          </div>
        ))}
      </div>
    </div>
  );
}
