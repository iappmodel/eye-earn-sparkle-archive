import React from 'react';
import { 
  Target, 
  TrendingUp, 
  Trophy,
  Gift,
  Zap,
  Crown
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface GamificationButtonProps {
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

// Join Challenge
export const JoinChallengeButton: React.FC<GamificationButtonProps & {
  challengeName?: string;
  reward?: number;
  coinType?: 'vicoin' | 'icoin';
  joined?: boolean;
}> = ({ 
  onClick, 
  disabled,
  challengeName = 'Daily Challenge',
  reward = 50,
  coinType = 'vicoin',
  joined = false,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled || joined}
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 w-full flex items-center gap-4 transition-all',
        joined ? 'neu-inset' : 'neu-button hover:scale-[1.01]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className={cn(
        'w-12 h-12 rounded-xl flex items-center justify-center',
        joined ? 'bg-primary/20' : 'neu-inset'
      )}>
        <Target className={cn(
          'w-6 h-6',
          joined ? 'text-primary' : 'text-muted-foreground'
        )} />
      </div>
      <div className="flex-1 text-left">
        <span className="font-medium block">{challengeName}</span>
        <span className={cn(
          'text-xs',
          coinType === 'vicoin' ? 'text-primary' : 'text-icoin'
        )}>
          Earn {reward} {coinType === 'vicoin' ? 'Vicoins' : 'Icoins'}
        </span>
      </div>
      <span className={cn(
        'text-sm font-medium px-3 py-1 rounded-full',
        joined 
          ? 'bg-primary/20 text-primary' 
          : 'bg-secondary text-muted-foreground'
      )}>
        {joined ? 'Joined' : 'Join'}
      </span>
    </button>
  );
};

// Track Progress
export const TrackProgressButton: React.FC<GamificationButtonProps & {
  currentProgress?: number;
  maxProgress?: number;
  taskName?: string;
}> = ({ 
  onClick, 
  disabled,
  currentProgress = 0,
  maxProgress = 100,
  taskName = 'Daily Goal',
  className 
}) => {
  const percentage = Math.min((currentProgress / maxProgress) * 100, 100);
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-card rounded-2xl p-4 w-full text-left transition-all hover:scale-[1.01]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <TrendingUp className="w-5 h-5 text-primary" />
          <span className="font-medium">{taskName}</span>
        </div>
        <span className="text-sm text-muted-foreground">
          {currentProgress}/{maxProgress}
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden">
        <div 
          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </button>
  );
};

// Level Up Button
export const LevelUpButton: React.FC<GamificationButtonProps & {
  currentLevel?: number;
  xpToNext?: number;
  totalXpNeeded?: number;
}> = ({ 
  onClick, 
  disabled,
  currentLevel = 1,
  xpToNext = 500,
  totalXpNeeded = 1000,
  className 
}) => {
  const xpProgress = ((totalXpNeeded - xpToNext) / totalXpNeeded) * 100;
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative overflow-hidden rounded-2xl p-4 w-full transition-all hover:scale-[1.01]',
        'bg-gradient-to-r from-icoin/10 to-primary/10 border border-icoin/20',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="w-14 h-14 rounded-full neu-inset flex items-center justify-center">
            <Crown className="w-7 h-7 text-icoin" />
          </div>
          <span className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
            {currentLevel}
          </span>
        </div>
        <div className="flex-1 text-left">
          <span className="font-display font-bold block">Level {currentLevel}</span>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div 
                className="h-full rounded-full bg-icoin transition-all duration-500"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground">{xpToNext} XP to go</span>
          </div>
        </div>
        <Zap className="w-5 h-5 text-icoin" />
      </div>
    </button>
  );
};

// View Rewards History
export const ViewRewardsHistoryButton: React.FC<GamificationButtonProps & {
  totalRewards?: number;
}> = ({ 
  onClick, 
  disabled,
  totalRewards = 0,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-4 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Gift className="w-6 h-6 text-icoin" />
      <div className="flex-1 text-left">
        <span className="font-medium block">Rewards History</span>
        <span className="text-xs text-muted-foreground">
          {totalRewards} rewards claimed
        </span>
      </div>
    </button>
  );
};

// Leaderboard
export const LeaderboardButton: React.FC<GamificationButtonProps & {
  currentRank?: number;
}> = ({ 
  onClick, 
  disabled,
  currentRank,
  className 
}) => {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'neu-button rounded-2xl px-5 py-4 flex items-center gap-3 transition-all hover:scale-[1.02]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <Trophy className="w-6 h-6 text-icoin" />
      <div className="flex-1 text-left">
        <span className="font-medium block">Leaderboard</span>
        {currentRank && (
          <span className="text-xs text-primary">You're #{currentRank}</span>
        )}
      </div>
    </button>
  );
};
