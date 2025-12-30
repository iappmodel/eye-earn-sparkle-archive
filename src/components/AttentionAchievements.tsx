import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Trophy, Star, Flame, Eye, Target, Zap, Crown, Award } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

// Achievement definitions
export const ATTENTION_ACHIEVEMENTS = [
  {
    id: 'first_perfect',
    name: 'First Perfect Video',
    description: 'Achieve 100% attention on your first video',
    icon: Star,
    requirement: { type: 'perfect_videos', value: 1 },
    color: 'from-yellow-500 to-amber-600',
    rarity: 'common',
  },
  {
    id: 'focus_novice',
    name: 'Focus Novice',
    description: 'Complete 5 videos with 90%+ attention',
    icon: Eye,
    requirement: { type: 'high_attention_videos', value: 5 },
    color: 'from-blue-500 to-cyan-600',
    rarity: 'common',
  },
  {
    id: 'focus_adept',
    name: 'Focus Adept',
    description: 'Complete 10 videos with 90%+ attention',
    icon: Target,
    requirement: { type: 'high_attention_videos', value: 10 },
    color: 'from-purple-500 to-violet-600',
    rarity: 'uncommon',
  },
  {
    id: 'focus_master',
    name: 'Focus Master',
    description: 'Complete 25 videos with 90%+ attention',
    icon: Crown,
    requirement: { type: 'high_attention_videos', value: 25 },
    color: 'from-amber-500 to-orange-600',
    rarity: 'rare',
  },
  {
    id: 'focus_legend',
    name: 'Focus Legend',
    description: 'Complete 100 videos with 90%+ attention',
    icon: Trophy,
    requirement: { type: 'high_attention_videos', value: 100 },
    color: 'from-rose-500 to-pink-600',
    rarity: 'legendary',
  },
  {
    id: 'perfect_streak_3',
    name: 'Triple Threat',
    description: 'Get 3 perfect videos in a row',
    icon: Flame,
    requirement: { type: 'perfect_streak', value: 3 },
    color: 'from-red-500 to-orange-600',
    rarity: 'uncommon',
  },
  {
    id: 'perfect_streak_5',
    name: 'Unstoppable Focus',
    description: 'Get 5 perfect videos in a row',
    icon: Zap,
    requirement: { type: 'perfect_streak', value: 5 },
    color: 'from-emerald-500 to-green-600',
    rarity: 'rare',
  },
  {
    id: 'laser_focus',
    name: 'Laser Focus',
    description: 'Maintain 95%+ attention for a 60+ second video',
    icon: Target,
    requirement: { type: 'long_focus', value: 60 },
    color: 'from-sky-500 to-blue-600',
    rarity: 'uncommon',
  },
  {
    id: 'daily_perfectionist',
    name: 'Daily Perfectionist',
    description: 'Get 10 perfect videos in one day',
    icon: Award,
    requirement: { type: 'daily_perfect', value: 10 },
    color: 'from-indigo-500 to-purple-600',
    rarity: 'rare',
  },
] as const;

export type AttentionAchievementId = typeof ATTENTION_ACHIEVEMENTS[number]['id'];

interface AttentionStats {
  perfectVideos: number;
  highAttentionVideos: number; // 90%+
  currentPerfectStreak: number;
  longestPerfectStreak: number;
  dailyPerfectCount: number;
  lastPerfectDate: string | null;
}

interface AchievementBadgeProps {
  achievement: typeof ATTENTION_ACHIEVEMENTS[number];
  isUnlocked: boolean;
  progress?: number;
  onClick?: () => void;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  isUnlocked,
  progress = 0,
  onClick,
}) => {
  const Icon = achievement.icon;
  const progressPercent = Math.min((progress / achievement.requirement.value) * 100, 100);

  return (
    <button
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
        isUnlocked 
          ? "bg-gradient-to-br opacity-100 shadow-lg hover:scale-105" 
          : "bg-muted/30 opacity-60 grayscale hover:opacity-80",
        isUnlocked && achievement.color
      )}
    >
      {/* Badge icon */}
      <div className={cn(
        "w-12 h-12 rounded-full flex items-center justify-center",
        isUnlocked ? "bg-white/20" : "bg-muted/50"
      )}>
        <Icon className={cn(
          "w-6 h-6",
          isUnlocked ? "text-white" : "text-muted-foreground"
        )} />
      </div>

      {/* Achievement name */}
      <span className={cn(
        "text-[10px] font-medium text-center leading-tight max-w-[80px]",
        isUnlocked ? "text-white" : "text-muted-foreground"
      )}>
        {achievement.name}
      </span>

      {/* Progress indicator for locked achievements */}
      {!isUnlocked && (
        <div className="absolute bottom-1 left-1 right-1 h-1 bg-muted/50 rounded-full overflow-hidden">
          <div 
            className="h-full bg-primary/50 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}

      {/* Rarity indicator */}
      <div className={cn(
        "absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold",
        achievement.rarity === 'legendary' ? "bg-amber-500 text-black" :
        achievement.rarity === 'rare' ? "bg-purple-500 text-white" :
        achievement.rarity === 'uncommon' ? "bg-blue-500 text-white" :
        "bg-muted text-muted-foreground"
      )}>
        {achievement.rarity === 'legendary' ? '★' :
         achievement.rarity === 'rare' ? 'R' :
         achievement.rarity === 'uncommon' ? 'U' : 'C'}
      </div>
    </button>
  );
};

interface AttentionAchievementsPanelProps {
  isVisible: boolean;
  onClose: () => void;
  stats: AttentionStats;
  unlockedAchievements: Set<AttentionAchievementId>;
}

export const AttentionAchievementsPanel: React.FC<AttentionAchievementsPanelProps> = ({
  isVisible,
  onClose,
  stats,
  unlockedAchievements,
}) => {
  if (!isVisible) return null;

  const getProgress = (achievement: typeof ATTENTION_ACHIEVEMENTS[number]): number => {
    switch (achievement.requirement.type) {
      case 'perfect_videos':
        return stats.perfectVideos;
      case 'high_attention_videos':
        return stats.highAttentionVideos;
      case 'perfect_streak':
        return stats.longestPerfectStreak;
      case 'daily_perfect':
        return stats.dailyPerfectCount;
      case 'long_focus':
        return 0; // This is checked per-video
      default:
        return 0;
    }
  };

  const unlockedCount = unlockedAchievements.size;
  const totalCount = ATTENTION_ACHIEVEMENTS.length;

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="min-h-full p-4 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold">Focus Achievements</h2>
            <p className="text-sm text-muted-foreground">
              {unlockedCount}/{totalCount} unlocked
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Stats summary */}
        <div className="grid grid-cols-3 gap-2 mb-6">
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.perfectVideos}</p>
            <p className="text-[10px] text-muted-foreground">Perfect Videos</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.highAttentionVideos}</p>
            <p className="text-[10px] text-muted-foreground">90%+ Videos</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.longestPerfectStreak}</p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </div>
        </div>

        {/* Achievement grid */}
        <div className="grid grid-cols-3 gap-3">
          {ATTENTION_ACHIEVEMENTS.map(achievement => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              isUnlocked={unlockedAchievements.has(achievement.id)}
              progress={getProgress(achievement)}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// New achievement unlock notification
interface AchievementUnlockNotificationProps {
  achievement: typeof ATTENTION_ACHIEVEMENTS[number] | null;
  onDismiss: () => void;
}

export const AchievementUnlockNotification: React.FC<AchievementUnlockNotificationProps> = ({
  achievement,
  onDismiss,
}) => {
  const haptic = useHapticFeedback();

  useEffect(() => {
    if (achievement) {
      haptic.success();
      const timer = setTimeout(onDismiss, 4000);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss, haptic]);

  if (!achievement) return null;

  const Icon = achievement.icon;

  return (
    <div className="fixed top-20 left-4 right-4 z-50 animate-slide-down">
      <div className={cn(
        "bg-gradient-to-r p-4 rounded-2xl shadow-xl flex items-center gap-4",
        achievement.color
      )}>
        {/* Icon */}
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-7 h-7 text-white" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/80 font-medium">
            Achievement Unlocked!
          </p>
          <p className="text-lg font-bold text-white truncate">
            {achievement.name}
          </p>
          <p className="text-xs text-white/80 truncate">
            {achievement.description}
          </p>
        </div>

        {/* Dismiss */}
        <button
          onClick={onDismiss}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// Hook to manage attention achievements
export const useAttentionAchievements = () => {
  const [stats, setStats] = useState<AttentionStats>({
    perfectVideos: 0,
    highAttentionVideos: 0,
    currentPerfectStreak: 0,
    longestPerfectStreak: 0,
    dailyPerfectCount: 0,
    lastPerfectDate: null,
  });
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<AttentionAchievementId>>(new Set());
  const [newlyUnlocked, setNewlyUnlocked] = useState<typeof ATTENTION_ACHIEVEMENTS[number] | null>(null);

  // Load from localStorage on mount
  useEffect(() => {
    const savedStats = localStorage.getItem('attention_stats');
    const savedAchievements = localStorage.getItem('attention_achievements');
    
    if (savedStats) {
      try {
        setStats(JSON.parse(savedStats));
      } catch (e) {
        console.error('Failed to parse attention stats:', e);
      }
    }
    
    if (savedAchievements) {
      try {
        setUnlockedAchievements(new Set(JSON.parse(savedAchievements)));
      } catch (e) {
        console.error('Failed to parse attention achievements:', e);
      }
    }
  }, []);

  // Save to localStorage when stats change
  useEffect(() => {
    localStorage.setItem('attention_stats', JSON.stringify(stats));
  }, [stats]);

  // Save achievements to localStorage
  useEffect(() => {
    localStorage.setItem('attention_achievements', JSON.stringify([...unlockedAchievements]));
  }, [unlockedAchievements]);

  // Check and unlock achievements
  const checkAchievements = (newStats: AttentionStats): typeof ATTENTION_ACHIEVEMENTS[number] | null => {
    for (const achievement of ATTENTION_ACHIEVEMENTS) {
      if (unlockedAchievements.has(achievement.id)) continue;

      let shouldUnlock = false;

      switch (achievement.requirement.type) {
        case 'perfect_videos':
          shouldUnlock = newStats.perfectVideos >= achievement.requirement.value;
          break;
        case 'high_attention_videos':
          shouldUnlock = newStats.highAttentionVideos >= achievement.requirement.value;
          break;
        case 'perfect_streak':
          shouldUnlock = newStats.longestPerfectStreak >= achievement.requirement.value;
          break;
        case 'daily_perfect':
          shouldUnlock = newStats.dailyPerfectCount >= achievement.requirement.value;
          break;
      }

      if (shouldUnlock) {
        setUnlockedAchievements(prev => new Set([...prev, achievement.id]));
        return achievement;
      }
    }
    return null;
  };

  // Record a completed video with attention score
  const recordVideoCompletion = (attentionScore: number, videoDuration: number) => {
    const isPerfect = attentionScore >= 98;
    const isHighAttention = attentionScore >= 90;
    const today = new Date().toDateString();

    setStats(prev => {
      const isNewDay = prev.lastPerfectDate !== today;
      
      const newStats: AttentionStats = {
        perfectVideos: prev.perfectVideos + (isPerfect ? 1 : 0),
        highAttentionVideos: prev.highAttentionVideos + (isHighAttention ? 1 : 0),
        currentPerfectStreak: isPerfect ? prev.currentPerfectStreak + 1 : 0,
        longestPerfectStreak: isPerfect 
          ? Math.max(prev.longestPerfectStreak, prev.currentPerfectStreak + 1)
          : prev.longestPerfectStreak,
        dailyPerfectCount: isPerfect 
          ? (isNewDay ? 1 : prev.dailyPerfectCount + 1)
          : (isNewDay ? 0 : prev.dailyPerfectCount),
        lastPerfectDate: isPerfect ? today : prev.lastPerfectDate,
      };

      // Check for long focus achievement
      if (attentionScore >= 95 && videoDuration >= 60) {
        const longFocusAchievement = ATTENTION_ACHIEVEMENTS.find(a => a.id === 'laser_focus');
        if (longFocusAchievement && !unlockedAchievements.has('laser_focus')) {
          setUnlockedAchievements(prev => new Set([...prev, 'laser_focus']));
          setNewlyUnlocked(longFocusAchievement);
          return newStats;
        }
      }

      // Check other achievements
      const newAchievement = checkAchievements(newStats);
      if (newAchievement) {
        setNewlyUnlocked(newAchievement);
      }

      return newStats;
    });
  };

  const dismissNotification = () => setNewlyUnlocked(null);

  return {
    stats,
    unlockedAchievements,
    newlyUnlocked,
    recordVideoCompletion,
    dismissNotification,
  };
};
