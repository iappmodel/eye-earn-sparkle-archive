import React from 'react';
import { Flame, Gift, Zap, Star, Crown, Trophy, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface StreakTier {
  days: number;
  bonus: number;
  icon: React.ReactNode;
  label: string;
  color: string;
}

const STREAK_TIERS: StreakTier[] = [
  { days: 3, bonus: 5, icon: <Flame className="w-5 h-5" />, label: 'Getting Started', color: 'text-orange-400' },
  { days: 7, bonus: 10, icon: <Zap className="w-5 h-5" />, label: 'Week Warrior', color: 'text-yellow-400' },
  { days: 14, bonus: 15, icon: <Star className="w-5 h-5" />, label: 'Two Week Champion', color: 'text-primary' },
  { days: 21, bonus: 25, icon: <Gift className="w-5 h-5" />, label: 'Three Week Legend', color: 'text-purple-400' },
  { days: 30, bonus: 35, icon: <Crown className="w-5 h-5" />, label: 'Monthly Master', color: 'text-icoin' },
  { days: 60, bonus: 50, icon: <Trophy className="w-5 h-5" />, label: 'Diamond Streak', color: 'text-cyan-400' },
  { days: 100, bonus: 75, icon: <Sparkles className="w-5 h-5" />, label: 'Legendary', color: 'text-pink-400' },
];

interface StreakBonusesProps {
  currentStreak: number;
  longestStreak?: number;
  className?: string;
  compact?: boolean;
}

export const StreakBonuses: React.FC<StreakBonusesProps> = ({
  currentStreak,
  longestStreak = 0,
  className,
  compact = false
}) => {
  const getCurrentTier = () => {
    for (let i = STREAK_TIERS.length - 1; i >= 0; i--) {
      if (currentStreak >= STREAK_TIERS[i].days) {
        return STREAK_TIERS[i];
      }
    }
    return null;
  };

  const getNextTier = () => {
    for (const tier of STREAK_TIERS) {
      if (currentStreak < tier.days) {
        return tier;
      }
    }
    return null;
  };

  const currentTier = getCurrentTier();
  const nextTier = getNextTier();
  const currentBonus = currentTier?.bonus || 0;
  
  const progressToNext = nextTier 
    ? ((currentStreak - (currentTier?.days || 0)) / (nextTier.days - (currentTier?.days || 0))) * 100
    : 100;

  if (compact) {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-orange-500/10 to-red-500/10 border border-orange-500/20', className)}>
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-orange-500/20">
          <Flame className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="font-bold">{currentStreak} day streak</p>
          <p className="text-xs text-muted-foreground">+{currentBonus}% bonus rewards</p>
        </div>
        {nextTier && (
          <div className="text-right text-xs text-muted-foreground">
            <p>{nextTier.days - currentStreak} days to</p>
            <p className={nextTier.color}>+{nextTier.bonus}%</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Current Streak Display */}
      <div className="p-4 rounded-2xl bg-gradient-to-br from-orange-500/20 via-red-500/10 to-yellow-500/20 border border-orange-500/30">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
              <Flame className="w-8 h-8 text-white" />
            </div>
            {currentStreak >= 7 && (
              <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-yellow-500 flex items-center justify-center">
                <span className="text-xs font-bold text-black">🔥</span>
              </div>
            )}
          </div>
          <div className="flex-1">
            <p className="text-3xl font-display font-bold">{currentStreak}</p>
            <p className="text-sm text-muted-foreground">Day Streak</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-primary">+{currentBonus}%</p>
            <p className="text-xs text-muted-foreground">Bonus Rewards</p>
          </div>
        </div>

        {/* Progress to next tier */}
        {nextTier && (
          <div className="mt-4">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>{currentTier?.label || 'Start your streak!'}</span>
              <span className={nextTier.color}>{nextTier.label}</span>
            </div>
            <Progress value={progressToNext} className="h-2" />
            <p className="text-xs text-center text-muted-foreground mt-1">
              {nextTier.days - currentStreak} more days for +{nextTier.bonus}% bonus
            </p>
          </div>
        )}
      </div>

      {/* Longest Streak */}
      {longestStreak > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
          <Trophy className="w-5 h-5 text-icoin" />
          <span className="text-sm">Longest streak: <span className="font-bold">{longestStreak} days</span></span>
        </div>
      )}

      {/* Tier Roadmap */}
      <div className="space-y-2">
        <h4 className="font-medium text-sm text-muted-foreground">Streak Bonuses</h4>
        <div className="grid gap-2">
          {STREAK_TIERS.map((tier, index) => {
            const isUnlocked = currentStreak >= tier.days;
            const isCurrent = currentTier?.days === tier.days;
            
            return (
              <div
                key={tier.days}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-xl border transition-all',
                  isUnlocked 
                    ? 'bg-primary/10 border-primary/30' 
                    : 'bg-secondary/30 border-border/50 opacity-60',
                  isCurrent && 'ring-2 ring-primary'
                )}
              >
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center', 
                  isUnlocked ? 'bg-primary/20' : 'bg-secondary'
                )}>
                  <span className={tier.color}>{tier.icon}</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{tier.label}</p>
                  <p className="text-xs text-muted-foreground">{tier.days} days</p>
                </div>
                <div className={cn(
                  'px-2 py-1 rounded-full text-xs font-bold',
                  isUnlocked ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                )}>
                  +{tier.bonus}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default StreakBonuses;
