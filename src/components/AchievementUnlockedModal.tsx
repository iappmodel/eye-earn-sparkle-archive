import React, { useEffect, useState } from 'react';
import { X, Trophy, Star, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { notificationSoundService } from '@/services/notificationSound.service';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon?: string;
  xp_reward: number;
  category: string;
}

interface AchievementUnlockedModalProps {
  achievement: Achievement | null;
  isOpen: boolean;
  onClose: () => void;
}

export const AchievementUnlockedModal: React.FC<AchievementUnlockedModalProps> = ({
  achievement,
  isOpen,
  onClose,
}) => {
  const haptic = useHapticFeedback();
  const [showParticles, setShowParticles] = useState(false);

  useEffect(() => {
    if (isOpen && achievement) {
      haptic.success();
      notificationSoundService.playAchievement();
      setShowParticles(true);
      
      const timer = setTimeout(() => setShowParticles(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, achievement, haptic]);

  if (!isOpen || !achievement) return null;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'engagement':
        return <Star className="w-8 h-8" />;
      case 'creator':
        return <Sparkles className="w-8 h-8" />;
      default:
        return <Trophy className="w-8 h-8" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'engagement':
        return 'from-primary to-primary/60';
      case 'creator':
        return 'from-icoin to-yellow-500';
      case 'social':
        return 'from-pink-500 to-rose-500';
      default:
        return 'from-violet-500 to-purple-500';
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-background/80 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      
      {/* Particle effects */}
      {showParticles && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {Array.from({ length: 20 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full bg-primary animate-float-particle"
              style={{
                left: `${50 + (Math.random() - 0.5) * 60}%`,
                top: `${50 + (Math.random() - 0.5) * 60}%`,
                animationDelay: `${Math.random() * 0.5}s`,
                opacity: Math.random() * 0.8 + 0.2,
              }}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      <div className="relative z-10 w-full max-w-sm animate-achievement-pop">
        <div className="neu-card p-6 text-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-2 rounded-full hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Achievement badge */}
          <div className="relative mx-auto w-24 h-24 mb-4">
            <div className={cn(
              'absolute inset-0 rounded-full bg-gradient-to-br animate-pulse-slow',
              getCategoryColor(achievement.category)
            )} />
            <div className="absolute inset-1 rounded-full bg-background flex items-center justify-center">
              <div className={cn(
                'w-16 h-16 rounded-full bg-gradient-to-br flex items-center justify-center text-white',
                getCategoryColor(achievement.category)
              )}>
                {achievement.icon ? (
                  <span className="text-3xl">{achievement.icon}</span>
                ) : (
                  getCategoryIcon(achievement.category)
                )}
              </div>
            </div>
            
            {/* Glow effect */}
            <div className={cn(
              'absolute inset-0 rounded-full bg-gradient-to-br opacity-50 blur-xl -z-10',
              getCategoryColor(achievement.category)
            )} />
          </div>

          {/* Title */}
          <h2 className="font-display text-2xl font-bold mb-2 gradient-text">
            Achievement Unlocked!
          </h2>
          
          {/* Achievement name */}
          <h3 className="font-semibold text-lg mb-2">{achievement.name}</h3>
          
          {/* Description */}
          <p className="text-sm text-muted-foreground mb-4">
            {achievement.description}
          </p>

          {/* XP Reward */}
          {achievement.xp_reward > 0 && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary font-medium">
              <Sparkles className="w-4 h-4" />
              <span>+{achievement.xp_reward} XP</span>
            </div>
          )}

          {/* Action button */}
          <button
            onClick={onClose}
            className="mt-6 w-full py-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold transition-transform active:scale-95"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  );
};

// Hook to manage achievement popups
export const useAchievementPopup = () => {
  const [currentAchievement, setCurrentAchievement] = useState<Achievement | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const showAchievement = (achievement: Achievement) => {
    setCurrentAchievement(achievement);
    setIsOpen(true);
  };

  const closeAchievement = () => {
    setIsOpen(false);
    setTimeout(() => setCurrentAchievement(null), 300);
  };

  return {
    currentAchievement,
    isOpen,
    showAchievement,
    closeAchievement,
  };
};
