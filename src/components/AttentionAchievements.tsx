import React, { useState, useEffect, useRef, useMemo } from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { cn } from '@/lib/utils';
import {
  Trophy,
  Star,
  Flame,
  Eye,
  Target,
  Zap,
  Crown,
  Award,
  Sunrise,
  Moon,
  Calendar,
  Timer,
  TrendingUp,
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { notificationSoundService } from '@/services/notificationSound.service';

// --- Helpers for week (Monday start) and streaks ---
const MS_PER_DAY = 24 * 60 * 60 * 1000;
function getWeekStartKey(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toDateString();
}
function getYesterdayKey(todayKey: string): string {
  const d = new Date(todayKey);
  d.setTime(d.getTime() - MS_PER_DAY);
  return d.toDateString();
}

// Achievement requirement types (discriminated union for type-safe progress)
export type AttentionRequirement =
  | { type: 'perfect_videos'; value: number }
  | { type: 'high_attention_videos'; value: number }
  | { type: 'perfect_streak'; value: number }
  | { type: 'daily_perfect'; value: number }
  | { type: 'long_focus'; value: number }
  | { type: 'weekly_perfect'; value: number }
  | { type: 'streak_days'; value: number }
  | { type: 'daily_watch_time_minutes'; value: number }
  | { type: 'time_of_day'; value: 'early_bird' | 'night_owl' }
  | { type: 'perfect_videos_total'; value: number };

// Achievement definitions
export const ATTENTION_ACHIEVEMENTS = [
  {
    id: 'first_perfect',
    name: 'First Perfect Video',
    description: 'Achieve 98%+ attention on your first video',
    icon: Star,
    requirement: { type: 'perfect_videos', value: 1 } as const,
    color: 'from-yellow-500 to-amber-600',
    rarity: 'common' as const,
  },
  {
    id: 'focus_novice',
    name: 'Focus Novice',
    description: 'Complete 5 videos with 90%+ attention',
    icon: Eye,
    requirement: { type: 'high_attention_videos', value: 5 } as const,
    color: 'from-blue-500 to-cyan-600',
    rarity: 'common' as const,
  },
  {
    id: 'focus_adept',
    name: 'Focus Adept',
    description: 'Complete 10 videos with 90%+ attention',
    icon: Target,
    requirement: { type: 'high_attention_videos', value: 10 } as const,
    color: 'from-purple-500 to-violet-600',
    rarity: 'uncommon' as const,
  },
  {
    id: 'focus_master',
    name: 'Focus Master',
    description: 'Complete 25 videos with 90%+ attention',
    icon: Crown,
    requirement: { type: 'high_attention_videos', value: 25 } as const,
    color: 'from-amber-500 to-orange-600',
    rarity: 'rare' as const,
  },
  {
    id: 'focus_legend',
    name: 'Focus Legend',
    description: 'Complete 100 videos with 90%+ attention',
    icon: Trophy,
    requirement: { type: 'high_attention_videos', value: 100 } as const,
    color: 'from-rose-500 to-pink-600',
    rarity: 'legendary' as const,
  },
  {
    id: 'perfect_streak_3',
    name: 'Triple Threat',
    description: 'Get 3 perfect videos in a row',
    icon: Flame,
    requirement: { type: 'perfect_streak', value: 3 } as const,
    color: 'from-red-500 to-orange-600',
    rarity: 'uncommon' as const,
  },
  {
    id: 'perfect_streak_5',
    name: 'Unstoppable Focus',
    description: 'Get 5 perfect videos in a row',
    icon: Zap,
    requirement: { type: 'perfect_streak', value: 5 } as const,
    color: 'from-emerald-500 to-green-600',
    rarity: 'rare' as const,
  },
  {
    id: 'laser_focus',
    name: 'Laser Focus',
    description: 'Maintain 95%+ attention for a 60+ second video',
    icon: Target,
    requirement: { type: 'long_focus', value: 60 } as const,
    color: 'from-sky-500 to-blue-600',
    rarity: 'uncommon' as const,
  },
  {
    id: 'daily_perfectionist',
    name: 'Daily Perfectionist',
    description: 'Get 10 perfect videos in one day',
    icon: Award,
    requirement: { type: 'daily_perfect', value: 10 } as const,
    color: 'from-indigo-500 to-purple-600',
    rarity: 'rare' as const,
  },
  {
    id: 'weekly_warrior',
    name: 'Weekly Warrior',
    description: 'Get 7 perfect videos in one week',
    icon: Calendar,
    requirement: { type: 'weekly_perfect', value: 7 } as const,
    color: 'from-teal-500 to-emerald-600',
    rarity: 'uncommon' as const,
  },
  {
    id: 'consistency',
    name: 'Consistency',
    description: 'At least one 90%+ video for 7 days in a row',
    icon: TrendingUp,
    requirement: { type: 'streak_days', value: 7 } as const,
    color: 'from-violet-500 to-purple-600',
    rarity: 'rare' as const,
  },
  {
    id: 'marathon',
    name: 'Marathon',
    description: 'Watch 10+ minutes of content in one day',
    icon: Timer,
    requirement: { type: 'daily_watch_time_minutes', value: 10 } as const,
    color: 'from-orange-500 to-red-600',
    rarity: 'uncommon' as const,
  },
  {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Get a perfect video before 9:00 AM',
    icon: Sunrise,
    requirement: { type: 'time_of_day', value: 'early_bird' } as const,
    color: 'from-amber-400 to-yellow-500',
    rarity: 'common' as const,
  },
  {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Get a perfect video after 10:00 PM',
    icon: Moon,
    requirement: { type: 'time_of_day', value: 'night_owl' } as const,
    color: 'from-indigo-700 to-blue-900',
    rarity: 'common' as const,
  },
  {
    id: 'hundred_percent_club',
    name: 'Hundred Percent Club',
    description: 'Reach 50 perfect (98%+) videos total',
    icon: Crown,
    requirement: { type: 'perfect_videos_total', value: 50 } as const,
    color: 'from-amber-400 to-amber-600',
    rarity: 'rare' as const,
  },
] as const;

export type AttentionAchievementId = (typeof ATTENTION_ACHIEVEMENTS)[number]['id'];

/** Full stats for attention achievements. Persisted to localStorage. */
export interface AttentionStats {
  perfectVideos: number;
  highAttentionVideos: number;
  currentPerfectStreak: number;
  longestPerfectStreak: number;
  dailyPerfectCount: number;
  lastPerfectDate: string | null;
  // Extended stats
  totalVideosWatched: number;
  totalWatchTimeMs: number;
  weeklyPerfectCount: number;
  weeklyHighAttentionCount: number;
  weekStartKey: string | null;
  currentStreakDays: number;
  bestStreakDays: number;
  lastActivityDate: string | null;
  averageAttentionScore: number;
  sumAttentionForAverage: number;
  longestSingleVideoSeconds: number;
  dailyWatchTimeMs: number;
  lastDailyWatchDate: string | null;
  lastActivityAt: string | null;
  earlyBirdUnlocked: boolean;
  nightOwlUnlocked: boolean;
}

const DEFAULT_STATS: AttentionStats = {
  perfectVideos: 0,
  highAttentionVideos: 0,
  currentPerfectStreak: 0,
  longestPerfectStreak: 0,
  dailyPerfectCount: 0,
  lastPerfectDate: null,
  totalVideosWatched: 0,
  totalWatchTimeMs: 0,
  weeklyPerfectCount: 0,
  weeklyHighAttentionCount: 0,
  weekStartKey: null,
  currentStreakDays: 0,
  bestStreakDays: 0,
  lastActivityDate: null,
  averageAttentionScore: 0,
  sumAttentionForAverage: 0,
  longestSingleVideoSeconds: 0,
  dailyWatchTimeMs: 0,
  lastDailyWatchDate: null,
  lastActivityAt: null,
  earlyBirdUnlocked: false,
  nightOwlUnlocked: false,
};

function migrateStats(parsed: Partial<AttentionStats>): AttentionStats {
  return {
    ...DEFAULT_STATS,
    ...parsed,
  };
}

const STORAGE_KEYS = {
  STATS: 'attention_stats',
  ACHIEVEMENTS: 'attention_achievements',
  UNLOCKED_AT: 'attention_achievements_unlocked_at',
} as const;

interface AchievementBadgeProps {
  achievement: (typeof ATTENTION_ACHIEVEMENTS)[number];
  isUnlocked: boolean;
  progress?: number;
  requirementValue: number;
  unlockedAt?: string | null;
  onClick?: () => void;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  isUnlocked,
  progress = 0,
  requirementValue,
  unlockedAt,
  onClick,
}) => {
  const Icon = achievement.icon;
  const progressPercent = requirementValue > 0 ? Math.min((progress / requirementValue) * 100, 100) : (isUnlocked ? 100 : 0);

  return (
    <button
      onClick={onClick}
      className={cn(
        'relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200',
        isUnlocked
          ? 'bg-gradient-to-br opacity-100 shadow-lg hover:scale-105 hover:shadow-xl'
          : 'bg-muted/30 opacity-70 grayscale hover:opacity-90',
        isUnlocked && achievement.color
      )}
    >
      <div
        className={cn(
          'w-12 h-12 rounded-full flex items-center justify-center',
          isUnlocked ? 'bg-white/20' : 'bg-muted/50'
        )}
      >
        <Icon className={cn('w-6 h-6', isUnlocked ? 'text-white' : 'text-muted-foreground')} />
      </div>
      <span
        className={cn(
          'text-[10px] font-medium text-center leading-tight max-w-[80px]',
          isUnlocked ? 'text-white' : 'text-muted-foreground'
        )}
      >
        {achievement.name}
      </span>
      {unlockedAt && isUnlocked && (
        <span className="text-[8px] text-white/70">
          {new Date(unlockedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </span>
      )}
      {!isUnlocked && requirementValue > 0 && (
        <div className="absolute bottom-1 left-1 right-1 h-1 bg-muted/50 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary/50 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
      <div
        className={cn(
          'absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold',
          achievement.rarity === 'legendary'
            ? 'bg-amber-500 text-black'
            : achievement.rarity === 'rare'
              ? 'bg-purple-500 text-white'
              : achievement.rarity === 'uncommon'
                ? 'bg-blue-500 text-white'
                : 'bg-muted text-muted-foreground'
        )}
      >
        {achievement.rarity === 'legendary' ? '★' : achievement.rarity === 'rare' ? 'R' : achievement.rarity === 'uncommon' ? 'U' : 'C'}
      </div>
    </button>
  );
};

function getRequirementValue(achievement: (typeof ATTENTION_ACHIEVEMENTS)[number]): number {
  const r = achievement.requirement;
  if (r.type === 'time_of_day') return 1;
  return r.value;
}

interface AttentionAchievementsPanelProps {
  isVisible: boolean;
  onClose: () => void;
  stats: AttentionStats;
  unlockedAchievements: Set<AttentionAchievementId>;
  unlockedAt: Record<AttentionAchievementId, string>;
}

export const AttentionAchievementsPanel: React.FC<AttentionAchievementsPanelProps> = ({
  isVisible,
  onClose,
  stats,
  unlockedAchievements,
  unlockedAt,
}) => {
  const getProgress = (achievement: (typeof ATTENTION_ACHIEVEMENTS)[number]): number => {
    const r = achievement.requirement;
    switch (r.type) {
      case 'perfect_videos':
        return stats.perfectVideos;
      case 'high_attention_videos':
        return stats.highAttentionVideos;
      case 'perfect_streak':
        return stats.longestPerfectStreak;
      case 'daily_perfect':
        return stats.dailyPerfectCount;
      case 'long_focus':
        return stats.longestSingleVideoSeconds;
      case 'weekly_perfect':
        return stats.weeklyPerfectCount;
      case 'streak_days':
        return stats.bestStreakDays;
      case 'daily_watch_time_minutes':
        return Math.floor(stats.dailyWatchTimeMs / 60000);
      case 'time_of_day':
        if (r.value === 'early_bird') return stats.earlyBirdUnlocked ? 1 : 0;
        return stats.nightOwlUnlocked ? 1 : 0;
      case 'perfect_videos_total':
        return stats.perfectVideos;
      default:
        return 0;
    }
  };

  const nextAchievement = useMemo(() => {
    for (const a of ATTENTION_ACHIEVEMENTS) {
      if (unlockedAchievements.has(a.id)) continue;
      const progress = getProgress(a);
      const required = getRequirementValue(a);
      if (required > 0 && progress < required) return { achievement: a, progress, required };
    }
    return null;
  }, [unlockedAchievements, stats]);

  const unlockedCount = unlockedAchievements.size;
  const totalCount = ATTENTION_ACHIEVEMENTS.length;
  const avgScore = stats.totalVideosWatched > 0 ? Math.round(stats.averageAttentionScore) : 0;

  return (
    <SwipeDismissOverlay isOpen={isVisible} onClose={onClose}>
      <div className="min-h-full p-4 pb-24">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold">Focus Achievements</h2>
            <p className="text-sm text-muted-foreground">
              {unlockedCount}/{totalCount} unlocked
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center hover:bg-muted transition-colors"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Stats summary - two rows */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-primary">{stats.perfectVideos}</p>
            <p className="text-[10px] text-muted-foreground">Perfect</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{stats.highAttentionVideos}</p>
            <p className="text-[10px] text-muted-foreground">90%+</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-orange-500">{stats.longestPerfectStreak}</p>
            <p className="text-[10px] text-muted-foreground">Best Streak</p>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-muted/30 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-foreground">{stats.totalVideosWatched}</p>
            <p className="text-[10px] text-muted-foreground">Videos</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-foreground">{stats.currentStreakDays}🔥</p>
            <p className="text-[10px] text-muted-foreground">Day Streak</p>
          </div>
          <div className="bg-muted/30 rounded-xl p-2.5 text-center">
            <p className="text-lg font-bold text-foreground">{avgScore}%</p>
            <p className="text-[10px] text-muted-foreground">Avg Score</p>
          </div>
        </div>

        {/* Next achievement hint */}
        {nextAchievement && (
          <div className="mb-4 p-3 rounded-xl bg-primary/10 border border-primary/20">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Next up</p>
            <p className="text-sm font-semibold">{nextAchievement.achievement.name}</p>
            <p className="text-xs text-muted-foreground mb-2">{nextAchievement.achievement.description}</p>
            <div className="h-2 bg-muted/50 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{
                  width: `${Math.min(
                    100,
                    (nextAchievement.progress / nextAchievement.required) * 100
                  )}%`,
                }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {nextAchievement.progress} / {nextAchievement.required}
            </p>
          </div>
        )}

        {/* Achievement grid */}
        <div className="grid grid-cols-3 gap-3">
          {ATTENTION_ACHIEVEMENTS.map((achievement) => (
            <AchievementBadge
              key={achievement.id}
              achievement={achievement}
              isUnlocked={unlockedAchievements.has(achievement.id)}
              progress={getProgress(achievement)}
              requirementValue={getRequirementValue(achievement)}
              unlockedAt={unlockedAt[achievement.id]}
            />
          ))}
        </div>
      </div>
    </SwipeDismissOverlay>
  );
};

// --- Achievement unlock notification (with legendary treatment) ---
interface AchievementUnlockNotificationProps {
  achievement: (typeof ATTENTION_ACHIEVEMENTS)[number] | null;
  onDismiss: () => void;
  onLegendaryCelebrate?: () => void;
}

export const AchievementUnlockNotification: React.FC<AchievementUnlockNotificationProps> = ({
  achievement,
  onDismiss,
  onLegendaryCelebrate,
}) => {
  const haptic = useHapticFeedback();

  useEffect(() => {
    if (achievement) {
      haptic.success();
      if (notificationSoundService.getEnabled()) {
        notificationSoundService.playNotification();
      }
      if (achievement.rarity === 'legendary' && onLegendaryCelebrate) {
        onLegendaryCelebrate();
      }
      const duration = achievement.rarity === 'legendary' ? 6000 : 4000;
      const timer = setTimeout(onDismiss, duration);
      return () => clearTimeout(timer);
    }
  }, [achievement, onDismiss, haptic, onLegendaryCelebrate]);

  if (!achievement) return null;

  const Icon = achievement.icon;
  const isLegendary = achievement.rarity === 'legendary';

  return (
    <div className="fixed top-20 left-4 right-4 z-50 animate-slide-down">
      <div
        className={cn(
          'bg-gradient-to-r p-4 rounded-2xl shadow-xl flex items-center gap-4',
          achievement.color,
          isLegendary && 'ring-2 ring-amber-400/50 ring-offset-2 ring-offset-background'
        )}
      >
        <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
          <Icon className="w-7 h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-white/80 font-medium">
            {isLegendary ? '★ Legendary Achievement! ★' : 'Achievement Unlocked!'}
          </p>
          <p className="text-lg font-bold text-white truncate">{achievement.name}</p>
          <p className="text-xs text-white/80 truncate">{achievement.description}</p>
        </div>
        <button
          onClick={onDismiss}
          className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center hover:bg-white/30 transition-colors flex-shrink-0"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>
    </div>
  );
};

// --- Hook ---
export const useAttentionAchievements = () => {
  const [stats, setStats] = useState<AttentionStats>(DEFAULT_STATS);
  const [unlockedAchievements, setUnlockedAchievements] = useState<Set<AttentionAchievementId>>(new Set());
  const [unlockedAt, setUnlockedAt] = useState<Record<AttentionAchievementId, string>>({});
  const [newlyUnlocked, setNewlyUnlocked] = useState<(typeof ATTENTION_ACHIEVEMENTS)[number] | null>(null);

  const unlockedRef = useRef<Set<AttentionAchievementId>>(new Set());
  unlockedRef.current = unlockedAchievements;

  useEffect(() => {
    const savedStats = localStorage.getItem(STORAGE_KEYS.STATS);
    const savedAchievements = localStorage.getItem(STORAGE_KEYS.ACHIEVEMENTS);
    const savedUnlockedAt = localStorage.getItem(STORAGE_KEYS.UNLOCKED_AT);

    if (savedStats) {
      try {
        setStats(migrateStats(JSON.parse(savedStats)));
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
    if (savedUnlockedAt) {
      try {
        setUnlockedAt(JSON.parse(savedUnlockedAt));
      } catch (e) {
        console.error('Failed to parse attention unlockedAt:', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
  }, [stats]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.ACHIEVEMENTS, JSON.stringify([...unlockedAchievements]));
  }, [unlockedAchievements]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.UNLOCKED_AT, JSON.stringify(unlockedAt));
  }, [unlockedAt]);

  const unlockAchievement = (id: AttentionAchievementId, achievement: (typeof ATTENTION_ACHIEVEMENTS)[number]) => {
    const now = new Date().toISOString();
    setUnlockedAchievements((prev) => new Set([...prev, id]));
    setUnlockedAt((prev) => ({ ...prev, [id]: now }));
    setNewlyUnlocked(achievement);
  };

  const checkAchievements = (
    newStats: AttentionStats
  ): (typeof ATTENTION_ACHIEVEMENTS)[number] | null => {
    const unlocked = unlockedRef.current;
    for (const achievement of ATTENTION_ACHIEVEMENTS) {
      if (unlocked.has(achievement.id)) continue;
      const r = achievement.requirement;
      let shouldUnlock = false;
      switch (r.type) {
        case 'perfect_videos':
          shouldUnlock = newStats.perfectVideos >= r.value;
          break;
        case 'high_attention_videos':
          shouldUnlock = newStats.highAttentionVideos >= r.value;
          break;
        case 'perfect_streak':
          shouldUnlock = newStats.longestPerfectStreak >= r.value;
          break;
        case 'daily_perfect':
          shouldUnlock = newStats.dailyPerfectCount >= r.value;
          break;
        case 'long_focus':
          // Handled in recordVideoCompletion
          break;
        case 'weekly_perfect':
          shouldUnlock = newStats.weeklyPerfectCount >= r.value;
          break;
        case 'streak_days':
          shouldUnlock = newStats.bestStreakDays >= r.value;
          break;
        case 'daily_watch_time_minutes':
          shouldUnlock = Math.floor(newStats.dailyWatchTimeMs / 60000) >= r.value;
          break;
        case 'time_of_day':
          if (r.value === 'early_bird') shouldUnlock = newStats.earlyBirdUnlocked;
          else shouldUnlock = newStats.nightOwlUnlocked;
          break;
        case 'perfect_videos_total':
          shouldUnlock = newStats.perfectVideos >= r.value;
          break;
      }
      if (shouldUnlock) {
        return achievement;
      }
    }
    return null;
  };

  const recordVideoCompletion = (attentionScore: number, videoDuration: number) => {
    const isPerfect = attentionScore >= 98;
    const isHighAttention = attentionScore >= 90;
    const now = new Date();
    const today = now.toDateString();
    const weekKey = getWeekStartKey(now);
    const hour = now.getHours();
    const minute = now.getMinutes();
    const isEarlyBird = hour < 9 || (hour === 9 && minute === 0);
    const isNightOwl = hour >= 22;

    setStats((prev) => {
      const isNewDay = prev.lastPerfectDate !== today;
      const isNewWeek = prev.weekStartKey !== weekKey;
      const yesterdayKey = getYesterdayKey(today);

      let newStreakDays = prev.currentStreakDays;
      if (isHighAttention && isNewDay) {
        if (prev.lastActivityDate === null || prev.lastActivityDate === yesterdayKey) {
          newStreakDays = prev.lastActivityDate === yesterdayKey ? prev.currentStreakDays + 1 : 1;
        } else {
          newStreakDays = 1;
        }
      } else if (isHighAttention && !isNewDay) {
        newStreakDays = prev.currentStreakDays;
      }

      const newDailyWatch = (prev.lastDailyWatchDate === today ? prev.dailyWatchTimeMs : 0) + videoDuration * 1000;
      const newTotalScore = prev.sumAttentionForAverage + attentionScore;
      const newTotalVideos = prev.totalVideosWatched + 1;
      const newAvg = newTotalVideos > 0 ? newTotalScore / newTotalVideos : 0;

      const newStats: AttentionStats = {
        ...prev,
        perfectVideos: prev.perfectVideos + (isPerfect ? 1 : 0),
        highAttentionVideos: prev.highAttentionVideos + (isHighAttention ? 1 : 0),
        currentPerfectStreak: isPerfect ? prev.currentPerfectStreak + 1 : 0,
        longestPerfectStreak: isPerfect
          ? Math.max(prev.longestPerfectStreak, prev.currentPerfectStreak + 1)
          : prev.longestPerfectStreak,
        dailyPerfectCount: isPerfect ? (isNewDay ? 1 : prev.dailyPerfectCount + 1) : isNewDay ? 0 : prev.dailyPerfectCount,
        lastPerfectDate: isPerfect ? today : prev.lastPerfectDate,
        totalVideosWatched: newTotalVideos,
        totalWatchTimeMs: prev.totalWatchTimeMs + videoDuration * 1000,
        weeklyPerfectCount: isNewWeek ? (isPerfect ? 1 : 0) : prev.weeklyPerfectCount + (isPerfect ? 1 : 0),
        weeklyHighAttentionCount: isNewWeek ? (isHighAttention ? 1 : 0) : prev.weeklyHighAttentionCount + (isHighAttention ? 1 : 0),
        weekStartKey: weekKey,
        currentStreakDays: newStreakDays,
        bestStreakDays: Math.max(prev.bestStreakDays, newStreakDays),
        lastActivityDate: isHighAttention ? today : prev.lastActivityDate,
        sumAttentionForAverage: newTotalScore,
        averageAttentionScore: newAvg,
        longestSingleVideoSeconds:
          attentionScore >= 95 ? Math.max(prev.longestSingleVideoSeconds, videoDuration) : prev.longestSingleVideoSeconds,
        dailyWatchTimeMs: newDailyWatch,
        lastDailyWatchDate: today,
        lastActivityAt: now.toISOString(),
        earlyBirdUnlocked: prev.earlyBirdUnlocked || (isPerfect && isEarlyBird),
        nightOwlUnlocked: prev.nightOwlUnlocked || (isPerfect && isNightOwl),
      };

      // Collect all achievements to unlock this run (laser_focus + any from checkAchievements)
      const toUnlockList: (typeof ATTENTION_ACHIEVEMENTS)[number][] = [];
      if (attentionScore >= 95 && videoDuration >= 60 && !unlockedRef.current.has('laser_focus')) {
        const laser = ATTENTION_ACHIEVEMENTS.find((a) => a.id === 'laser_focus');
        if (laser) toUnlockList.push(laser);
      }
      const fromCheck = checkAchievements(newStats);
      if (fromCheck && !toUnlockList.some((a) => a.id === fromCheck.id)) toUnlockList.push(fromCheck);

      if (toUnlockList.length > 0) {
        const rarityOrder = { legendary: 4, rare: 3, uncommon: 2, common: 1 };
        const rarest = toUnlockList.sort(
          (a, b) => (rarityOrder[b.rarity] ?? 0) - (rarityOrder[a.rarity] ?? 0)
        )[0];
        const now = new Date().toISOString();
        setTimeout(() => {
          setUnlockedAchievements((prev) => new Set([...prev, ...toUnlockList.map((a) => a.id)]));
          setUnlockedAt((prev) => {
            const next = { ...prev };
            toUnlockList.forEach((a) => (next[a.id] = now));
            return next;
          });
          setNewlyUnlocked(rarest);
        }, 0);
      }
      return newStats;
    });
  };

  const dismissNotification = () => setNewlyUnlocked(null);

  return {
    stats,
    unlockedAchievements,
    unlockedAt,
    newlyUnlocked,
    recordVideoCompletion,
    dismissNotification,
    nextAchievement: (() => {
      for (const a of ATTENTION_ACHIEVEMENTS) {
        if (unlockedAchievements.has(a.id)) continue;
        const r = a.requirement;
        let progress = 0;
        let required = 1;
        switch (r.type) {
          case 'perfect_videos':
            progress = stats.perfectVideos;
            required = r.value;
            break;
          case 'high_attention_videos':
            progress = stats.highAttentionVideos;
            required = r.value;
            break;
          case 'perfect_streak':
            progress = stats.longestPerfectStreak;
            required = r.value;
            break;
          case 'daily_perfect':
            progress = stats.dailyPerfectCount;
            required = r.value;
            break;
          case 'long_focus':
            progress = stats.longestSingleVideoSeconds;
            required = r.value;
            break;
          case 'weekly_perfect':
            progress = stats.weeklyPerfectCount;
            required = r.value;
            break;
          case 'streak_days':
            progress = stats.bestStreakDays;
            required = r.value;
            break;
          case 'daily_watch_time_minutes':
            progress = Math.floor(stats.dailyWatchTimeMs / 60000);
            required = r.value;
            break;
          case 'time_of_day':
            progress = r.value === 'early_bird' ? (stats.earlyBirdUnlocked ? 1 : 0) : stats.nightOwlUnlocked ? 1 : 0;
            required = 1;
            break;
          case 'perfect_videos_total':
            progress = stats.perfectVideos;
            required = r.value;
            break;
        }
        if (progress < required) return { achievement: a, progress, required };
      }
      return null;
    })(),
  };
};
