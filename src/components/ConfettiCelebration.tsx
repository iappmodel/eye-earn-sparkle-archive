import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface Particle {
  id: number;
  x: number;
  y: number;
  size: number;
  color: string;
  rotation: number;
  velocityX: number;
  velocityY: number;
  rotationSpeed: number;
  type: 'confetti' | 'star' | 'coin';
}

interface ConfettiCelebrationProps {
  isActive: boolean;
  duration?: number;
  particleCount?: number;
  type?: 'confetti' | 'coins' | 'stars' | 'achievement';
  onComplete?: () => void;
}

const COLORS = [
  'hsl(270, 95%, 65%)', // Primary purple
  'hsl(320, 90%, 60%)', // Magenta
  'hsl(190, 100%, 50%)', // Cyan
  'hsl(45, 100%, 55%)', // Gold
  'hsl(160, 80%, 50%)', // Emerald
  'hsl(350, 90%, 60%)', // Rose
];

const COIN_COLORS = ['hsl(45, 100%, 55%)', 'hsl(270, 95%, 65%)'];

export const ConfettiCelebration: React.FC<ConfettiCelebrationProps> = ({
  isActive,
  duration = 3000,
  particleCount = 50,
  type = 'confetti',
  onComplete,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const { success } = useHapticFeedback();

  const createParticles = useCallback(() => {
    const newParticles: Particle[] = [];
    
    for (let i = 0; i < particleCount; i++) {
      const colors = type === 'coins' ? COIN_COLORS : COLORS;
      
      newParticles.push({
        id: i,
        x: 50 + (Math.random() - 0.5) * 40, // Start near center
        y: 40 + Math.random() * 20,
        size: type === 'coins' ? 24 : 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        rotation: Math.random() * 360,
        velocityX: (Math.random() - 0.5) * 8,
        velocityY: -8 - Math.random() * 8,
        rotationSpeed: (Math.random() - 0.5) * 20,
        type: type === 'coins' ? 'coin' : type === 'stars' ? 'star' : 'confetti',
      });
    }
    
    return newParticles;
  }, [particleCount, type]);

  useEffect(() => {
    if (isActive) {
      setIsVisible(true);
      setParticles(createParticles());
      success();

      const timer = setTimeout(() => {
        setIsVisible(false);
        onComplete?.();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [isActive, duration, createParticles, success, onComplete]);

  useEffect(() => {
    if (!isVisible || particles.length === 0) return;

    const interval = setInterval(() => {
      setParticles(prev => prev.map(p => ({
        ...p,
        x: p.x + p.velocityX * 0.1,
        y: p.y + p.velocityY * 0.1 + 0.5, // Gravity
        velocityY: p.velocityY + 0.3, // Accelerate downward
        rotation: p.rotation + p.rotationSpeed,
      })).filter(p => p.y < 120)); // Remove particles that fell off screen
    }, 16);

    return () => clearInterval(interval);
  }, [isVisible, particles.length]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[200] overflow-hidden">
      {particles.map(particle => (
        <div
          key={particle.id}
          className="absolute transition-none"
          style={{
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            transform: `rotate(${particle.rotation}deg)`,
          }}
        >
          {particle.type === 'coin' ? (
            <div 
              className="rounded-full border-2 flex items-center justify-center font-bold text-xs"
              style={{
                width: particle.size,
                height: particle.size,
                backgroundColor: particle.color,
                borderColor: 'rgba(0,0,0,0.2)',
                color: 'white',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              {particle.color.includes('45') ? 'i' : 'v'}
            </div>
          ) : particle.type === 'star' ? (
            <svg
              width={particle.size}
              height={particle.size}
              viewBox="0 0 24 24"
              fill={particle.color}
            >
              <polygon points="12,2 15,9 22,9 17,14 19,21 12,17 5,21 7,14 2,9 9,9" />
            </svg>
          ) : (
            <div
              className={cn(
                Math.random() > 0.5 ? "rounded-sm" : "rounded-full"
              )}
              style={{
                width: particle.size,
                height: particle.size * (0.4 + Math.random() * 0.6),
                backgroundColor: particle.color,
              }}
            />
          )}
        </div>
      ))}
      
      {/* Center celebration text for achievements */}
      {type === 'achievement' && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-4xl font-display font-bold gradient-text animate-scale-in">
            🎉 Achievement Unlocked!
          </div>
        </div>
      )}
    </div>
  );
};

// Hook to trigger celebrations
export const useCelebration = () => {
  const [celebrationState, setCelebrationState] = useState<{
    isActive: boolean;
    type: ConfettiCelebrationProps['type'];
  }>({ isActive: false, type: 'confetti' });

  const celebrate = useCallback((type: ConfettiCelebrationProps['type'] = 'confetti') => {
    setCelebrationState({ isActive: true, type });
  }, []);

  const stopCelebration = useCallback(() => {
    setCelebrationState(prev => ({ ...prev, isActive: false }));
  }, []);

  return {
    ...celebrationState,
    celebrate,
    stopCelebration,
  };
};
