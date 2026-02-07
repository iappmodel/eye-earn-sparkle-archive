import React from 'react';
import { SwipeDismissOverlay } from './SwipeDismissOverlay';
import { X, Trophy, Star, Medal, Crown, Flame, Zap, CheckSquare, Coins, Gem, Footprints, Lock } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { useTasks, Achievement, UserAchievement } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AchievementCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  footprints: Footprints,
  star: Star,
  medal: Medal,
  crown: Crown,
  coins: Coins,
  gem: Gem,
  flame: Flame,
  zap: Zap,
  trophy: Trophy,
  'check-square': CheckSquare,
};

const AchievementCard: React.FC<{
  achievement: Achievement;
  unlocked?: UserAchievement;
}> = ({ achievement, unlocked }) => {
  const Icon = iconMap[achievement.icon || 'trophy'] || Trophy;
  const isUnlocked = !!unlocked;

  return (
    <div className={cn(
      'neu-card rounded-2xl p-4 transition-all',
      !isUnlocked && 'opacity-50 grayscale'
    )}>
      <div className="flex items-center gap-4">
        <div className={cn(
          'w-14 h-14 rounded-xl flex items-center justify-center shrink-0',
          isUnlocked
            ? 'bg-gradient-to-br from-icoin to-primary'
            : 'bg-muted'
        )}>
          {isUnlocked ? (
            <Icon className="w-7 h-7 text-white" />
          ) : (
            <Lock className="w-6 h-6 text-muted-foreground" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-medium">{achievement.name}</h3>
          <p className="text-xs text-muted-foreground line-clamp-1">
            {achievement.description}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs font-medium text-icoin">
              +{achievement.xp_reward} XP
            </span>
            {isUnlocked && unlocked && (
              <span className="text-xs text-muted-foreground">
                Unlocked {new Date(unlocked.unlocked_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {isUnlocked && (
          <Trophy className="w-5 h-5 text-icoin shrink-0" />
        )}
      </div>
    </div>
  );
};

export const AchievementCenter: React.FC<AchievementCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { achievements, userAchievements, isLoading } = useTasks();

  const unlockedCount = userAchievements.length;
  const totalCount = achievements.length;

  // Group by category
  const categories = ['general', 'earning', 'streak', 'social'];
  const groupedAchievements = categories.map(cat => ({
    category: cat,
    items: achievements.filter(a => a.category === cat),
  })).filter(g => g.items.length > 0);

  return (
    <SwipeDismissOverlay isOpen={isOpen} onClose={onClose}>
      <div className="max-w-md mx-auto h-full flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-icoin to-primary flex items-center justify-center">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold">Achievements</h1>
                <p className="text-xs text-muted-foreground">
                  {unlockedCount} of {totalCount} unlocked
                </p>
              </div>
            </div>
            <NeuButton onClick={onClose} size="sm">
              <X className="w-5 h-5" />
            </NeuButton>
          </div>

          {/* Progress bar */}
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-icoin to-primary transition-all duration-500"
              style={{ width: `${totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1 p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-40">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-6 pb-20">
              {groupedAchievements.map(group => (
                <div key={group.category}>
                  <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-3 capitalize">
                    {group.category}
                  </h2>
                  <div className="space-y-3">
                    {group.items.map(achievement => (
                      <AchievementCard
                        key={achievement.id}
                        achievement={achievement}
                        unlocked={userAchievements.find(ua => ua.achievement_id === achievement.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </div>
    </SwipeDismissOverlay>
  );
};
