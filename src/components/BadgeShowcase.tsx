import React, { useState, useEffect } from 'react';
import { Trophy, Star, Crown, Zap, Flame, Target, Gift, Award, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Achievement {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category: string;
  requirement_type: string;
  requirement_value: number;
  xp_reward: number;
}

interface UserAchievement {
  id: string;
  achievement_id: string;
  unlocked_at: string;
}

interface BadgeShowcaseProps {
  userId?: string;
  className?: string;
  compact?: boolean;
  maxVisible?: number;
}

const ICON_MAP: Record<string, React.ReactNode> = {
  trophy: <Trophy className="w-full h-full" />,
  star: <Star className="w-full h-full" />,
  crown: <Crown className="w-full h-full" />,
  zap: <Zap className="w-full h-full" />,
  flame: <Flame className="w-full h-full" />,
  target: <Target className="w-full h-full" />,
  gift: <Gift className="w-full h-full" />,
  award: <Award className="w-full h-full" />,
  sparkles: <Sparkles className="w-full h-full" />,
};

const CATEGORY_COLORS: Record<string, string> = {
  general: 'from-blue-500 to-cyan-500',
  earning: 'from-green-500 to-emerald-500',
  social: 'from-purple-500 to-pink-500',
  streak: 'from-orange-500 to-red-500',
  engagement: 'from-yellow-500 to-amber-500',
  creator: 'from-indigo-500 to-violet-500',
};

export const BadgeShowcase: React.FC<BadgeShowcaseProps> = ({ 
  userId, 
  className, 
  compact = false,
  maxVisible = 6 
}) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (targetUserId) {
      fetchAchievements();
    }
  }, [targetUserId]);

  const fetchAchievements = async () => {
    try {
      // Fetch all achievements
      const { data: allAchievements, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('category', { ascending: true });

      if (achievementsError) throw achievementsError;

      // Fetch user's unlocked achievements
      const { data: unlocked, error: unlockedError } = await supabase
        .from('user_achievements')
        .select('*')
        .eq('user_id', targetUserId);

      if (unlockedError) throw unlockedError;

      setAchievements(allAchievements || []);
      setUserAchievements(unlocked || []);
    } catch (error) {
      console.error('Failed to fetch achievements:', error);
    } finally {
      setLoading(false);
    }
  };

  const isUnlocked = (achievementId: string) => {
    return userAchievements.some(ua => ua.achievement_id === achievementId);
  };

  const getUnlockedDate = (achievementId: string) => {
    const ua = userAchievements.find(ua => ua.achievement_id === achievementId);
    return ua ? new Date(ua.unlocked_at) : null;
  };

  const unlockedAchievements = achievements.filter(a => isUnlocked(a.id));
  const lockedAchievements = achievements.filter(a => !isUnlocked(a.id));
  
  const displayAchievements = compact 
    ? unlockedAchievements.slice(0, maxVisible)
    : showAll 
      ? [...unlockedAchievements, ...lockedAchievements]
      : unlockedAchievements;

  if (loading) {
    return (
      <div className={cn('flex gap-2', className)}>
        {[...Array(compact ? 3 : 6)].map((_, i) => (
          <Skeleton key={i} className="w-12 h-12 rounded-full" />
        ))}
      </div>
    );
  }

  if (compact) {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {displayAchievements.map((achievement) => (
          <button
            key={achievement.id}
            onClick={() => setSelectedAchievement(achievement)}
            className={cn(
              'w-8 h-8 rounded-full p-1.5 transition-transform hover:scale-110',
              `bg-gradient-to-br ${CATEGORY_COLORS[achievement.category] || CATEGORY_COLORS.general}`,
              'text-white shadow-md'
            )}
            title={achievement.name}
          >
            {ICON_MAP[achievement.icon || 'trophy'] || ICON_MAP.trophy}
          </button>
        ))}
        {unlockedAchievements.length > maxVisible && (
          <span className="text-xs text-muted-foreground ml-1">
            +{unlockedAchievements.length - maxVisible}
          </span>
        )}

        <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
          <DialogContent className="sm:max-w-sm">
            {selectedAchievement && (
              <>
                <DialogHeader>
                  <div className={cn(
                    'w-16 h-16 rounded-full p-3 mx-auto mb-2',
                    `bg-gradient-to-br ${CATEGORY_COLORS[selectedAchievement.category] || CATEGORY_COLORS.general}`,
                    'text-white shadow-lg'
                  )}>
                    {ICON_MAP[selectedAchievement.icon || 'trophy'] || ICON_MAP.trophy}
                  </div>
                  <DialogTitle className="text-center">{selectedAchievement.name}</DialogTitle>
                </DialogHeader>
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    {selectedAchievement.description}
                  </p>
                  <p className="text-xs text-primary">
                    +{selectedAchievement.xp_reward} XP
                  </p>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-primary" />
          Badges
        </h3>
        <span className="text-sm text-muted-foreground">
          {unlockedAchievements.length}/{achievements.length} unlocked
        </span>
      </div>

      {/* Badge Grid */}
      <div className="grid grid-cols-4 gap-3">
        {displayAchievements.map((achievement) => {
          const unlocked = isUnlocked(achievement.id);
          const unlockedDate = getUnlockedDate(achievement.id);
          
          return (
            <button
              key={achievement.id}
              onClick={() => setSelectedAchievement(achievement)}
              className={cn(
                'relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all',
                unlocked 
                  ? 'hover:scale-105' 
                  : 'opacity-40 grayscale'
              )}
            >
              <div className={cn(
                'w-12 h-12 rounded-full p-2.5',
                unlocked 
                  ? `bg-gradient-to-br ${CATEGORY_COLORS[achievement.category] || CATEGORY_COLORS.general} text-white shadow-lg`
                  : 'bg-secondary text-muted-foreground'
              )}>
                {unlocked 
                  ? (ICON_MAP[achievement.icon || 'trophy'] || ICON_MAP.trophy)
                  : <Lock className="w-full h-full" />
                }
              </div>
              <span className="text-xs text-center font-medium line-clamp-2">
                {achievement.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Show more/less toggle */}
      {!compact && lockedAchievements.length > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full text-center text-sm text-primary hover:underline"
        >
          {showAll ? 'Show unlocked only' : `Show all (${lockedAchievements.length} locked)`}
        </button>
      )}

      {/* Achievement Detail Dialog */}
      <Dialog open={!!selectedAchievement} onOpenChange={() => setSelectedAchievement(null)}>
        <DialogContent className="sm:max-w-sm">
          {selectedAchievement && (
            <>
              <DialogHeader>
                <div className={cn(
                  'w-20 h-20 rounded-full p-4 mx-auto mb-2',
                  isUnlocked(selectedAchievement.id)
                    ? `bg-gradient-to-br ${CATEGORY_COLORS[selectedAchievement.category] || CATEGORY_COLORS.general} text-white shadow-lg`
                    : 'bg-secondary text-muted-foreground'
                )}>
                  {isUnlocked(selectedAchievement.id)
                    ? (ICON_MAP[selectedAchievement.icon || 'trophy'] || ICON_MAP.trophy)
                    : <Lock className="w-full h-full" />
                  }
                </div>
                <DialogTitle className="text-center">{selectedAchievement.name}</DialogTitle>
              </DialogHeader>
              <div className="text-center space-y-3">
                <p className="text-sm text-muted-foreground">
                  {selectedAchievement.description}
                </p>
                
                <div className="flex justify-center gap-4 text-sm">
                  <div className="text-center">
                    <p className="font-bold text-primary">+{selectedAchievement.xp_reward}</p>
                    <p className="text-xs text-muted-foreground">XP Reward</p>
                  </div>
                  <div className="text-center">
                    <p className="font-bold">{selectedAchievement.category}</p>
                    <p className="text-xs text-muted-foreground">Category</p>
                  </div>
                </div>

                {isUnlocked(selectedAchievement.id) && (
                  <p className="text-xs text-green-500 flex items-center justify-center gap-1">
                    <Sparkles className="w-3 h-3" />
                    Unlocked {getUnlockedDate(selectedAchievement.id)?.toLocaleDateString()}
                  </p>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BadgeShowcase;
