import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';
import { Coins, Star, Sparkles, Trophy } from 'lucide-react';

interface RewardAnimation3DProps {
  type: 'coins' | 'xp' | 'achievement' | 'level-up';
  amount?: number;
  message?: string;
  isVisible: boolean;
  onComplete?: () => void;
}

export const RewardAnimation3D: React.FC<RewardAnimation3DProps> = ({
  type,
  amount,
  message,
  isVisible,
  onComplete,
}) => {
  const { reducedMotion, triggerHaptic } = useAccessibility();
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; delay: number }[]>([]);

  useEffect(() => {
    if (isVisible && !reducedMotion) {
      triggerHaptic('heavy');
      
      // Generate particles
      const newParticles = Array.from({ length: 12 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 0.5,
      }));
      setParticles(newParticles);
      
      // Cleanup
      const timer = setTimeout(() => {
        onComplete?.();
      }, 2500);
      
      return () => clearTimeout(timer);
    }
  }, [isVisible, reducedMotion, triggerHaptic, onComplete]);

  if (!isVisible) return null;

  const icons = {
    coins: <Coins className="w-16 h-16 text-icoin" />,
    xp: <Star className="w-16 h-16 text-primary" />,
    achievement: <Trophy className="w-16 h-16 text-amber-400" />,
    'level-up': <Sparkles className="w-16 h-16 text-purple-400" />,
  };

  const colors = {
    coins: 'from-icoin/20 to-icoin/5',
    xp: 'from-primary/20 to-primary/5',
    achievement: 'from-amber-400/20 to-amber-400/5',
    'level-up': 'from-purple-400/20 to-purple-400/5',
  };

  if (reducedMotion) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="text-center p-8 rounded-2xl bg-card border border-border">
          {icons[type]}
          {amount && (
            <p className="text-3xl font-display font-bold mt-4 text-foreground">
              +{amount}
            </p>
          )}
          {message && (
            <p className="text-lg text-muted-foreground mt-2">{message}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      {/* Backdrop */}
      <div 
        className={cn(
          'absolute inset-0 bg-gradient-radial',
          colors[type],
          'animate-fade-in'
        )}
      />
      
      {/* Particles */}
      {particles.map((p) => (
        <div
          key={p.id}
          className="absolute w-2 h-2 rounded-full bg-primary"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            animation: `sparkle 1s ease-out ${p.delay}s forwards`,
          }}
        />
      ))}
      
      {/* Main content */}
      <div 
        className={cn(
          'relative flex flex-col items-center gap-4',
          'animate-bounce-3d'
        )}
        style={{
          transformStyle: 'preserve-3d',
        }}
      >
        {/* 3D Icon container */}
        <div 
          className={cn(
            'relative p-6 rounded-3xl',
            'bg-gradient-to-br from-card via-card to-muted',
            'shadow-[0_20px_60px_-10px_hsl(var(--primary)/0.5)]',
            'animate-float-3d'
          )}
          style={{
            transform: 'translateZ(30px)',
          }}
        >
          {/* Glow ring */}
          <div 
            className="absolute inset-0 rounded-3xl animate-glow-ambient"
            style={{
              boxShadow: `0 0 40px hsl(var(--primary) / 0.4), 0 0 80px hsl(var(--primary) / 0.2)`,
            }}
          />
          
          {/* Icon */}
          <div className="relative animate-pulse-3d">
            {icons[type]}
          </div>
        </div>
        
        {/* Amount */}
        {amount && (
          <div 
            className="animate-scale-in"
            style={{
              transform: 'translateZ(40px)',
              animationDelay: '0.3s',
            }}
          >
            <span className="text-5xl font-display font-bold gradient-text">
              +{amount.toLocaleString()}
            </span>
          </div>
        )}
        
        {/* Message */}
        {message && (
          <p 
            className="text-xl text-foreground/80 animate-slide-up"
            style={{
              transform: 'translateZ(20px)',
              animationDelay: '0.5s',
            }}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
};
