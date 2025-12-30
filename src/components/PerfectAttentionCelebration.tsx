import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface Particle {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  type: 'confetti' | 'star' | 'sparkle' | 'coin';
  opacity: number;
  life: number;
}

interface PerfectAttentionCelebrationProps {
  isActive: boolean;
  onComplete?: () => void;
}

const COLORS = [
  '#FFD700', // Gold
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#A855F7', // Purple
  '#3B82F6', // Blue
  '#22C55E', // Green
  '#F59E0B', // Amber
  '#EC4899', // Pink
];

const PARTICLE_COUNT = 80;
const DURATION = 3000;

export const PerfectAttentionCelebration: React.FC<PerfectAttentionCelebrationProps> = ({
  isActive,
  onComplete,
}) => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [showMessage, setShowMessage] = useState(false);
  const haptic = useHapticFeedback();

  const createParticle = useCallback((id: number): Particle => {
    const types: Particle['type'][] = ['confetti', 'star', 'sparkle', 'coin'];
    const type = types[Math.floor(Math.random() * types.length)];
    
    return {
      id,
      x: 50 + (Math.random() - 0.5) * 20,
      y: 50,
      vx: (Math.random() - 0.5) * 15,
      vy: -Math.random() * 20 - 10,
      size: type === 'coin' ? 20 : Math.random() * 12 + 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 20,
      type,
      opacity: 1,
      life: 1,
    };
  }, []);

  useEffect(() => {
    if (!isActive) {
      setParticles([]);
      setShowMessage(false);
      return;
    }

    // Trigger haptic feedback
    haptic.success();

    // Create initial burst of particles
    const initialParticles = Array.from({ length: PARTICLE_COUNT }, (_, i) => createParticle(i));
    setParticles(initialParticles);
    setShowMessage(true);

    // Animation loop
    let animationId: number;
    let lastTime = performance.now();

    const animate = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 16.67; // Normalize to ~60fps
      lastTime = currentTime;

      setParticles(prev => 
        prev.map(p => ({
          ...p,
          x: p.x + p.vx * deltaTime * 0.3,
          y: p.y + p.vy * deltaTime * 0.3,
          vy: p.vy + 0.8 * deltaTime, // Gravity
          rotation: p.rotation + p.rotationSpeed * deltaTime,
          life: p.life - 0.015 * deltaTime,
          opacity: Math.max(0, p.life),
        })).filter(p => p.life > 0)
      );

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    // Complete after duration
    const timer = setTimeout(() => {
      setShowMessage(false);
      onComplete?.();
    }, DURATION);

    return () => {
      cancelAnimationFrame(animationId);
      clearTimeout(timer);
    };
  }, [isActive, createParticle, haptic, onComplete]);

  if (!isActive && particles.length === 0) return null;

  const renderParticle = (particle: Particle) => {
    const style: React.CSSProperties = {
      left: `${particle.x}%`,
      top: `${particle.y}%`,
      transform: `rotate(${particle.rotation}deg)`,
      opacity: particle.opacity,
    };

    switch (particle.type) {
      case 'confetti':
        return (
          <div
            key={particle.id}
            className="absolute pointer-events-none"
            style={{
              ...style,
              width: particle.size,
              height: particle.size * 0.6,
              backgroundColor: particle.color,
              borderRadius: '2px',
            }}
          />
        );
      
      case 'star':
        return (
          <div
            key={particle.id}
            className="absolute pointer-events-none"
            style={style}
          >
            <svg
              width={particle.size}
              height={particle.size}
              viewBox="0 0 24 24"
              fill={particle.color}
            >
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
          </div>
        );

      case 'sparkle':
        return (
          <div
            key={particle.id}
            className="absolute pointer-events-none"
            style={{
              ...style,
              width: particle.size,
              height: particle.size,
            }}
          >
            <div
              className="absolute inset-0 rounded-full"
              style={{
                background: `radial-gradient(circle, ${particle.color} 0%, transparent 70%)`,
                animation: 'pulse 0.5s ease-in-out infinite',
              }}
            />
          </div>
        );

      case 'coin':
        return (
          <div
            key={particle.id}
            className="absolute pointer-events-none text-xl"
            style={style}
          >
            🪙
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="absolute inset-0 z-50 pointer-events-none overflow-hidden">
      {/* Particles */}
      {particles.map(renderParticle)}

      {/* Central celebration message */}
      {showMessage && (
        <div className="absolute inset-0 flex items-center justify-center animate-fade-in">
          <div className="flex flex-col items-center gap-3">
            <div className="text-5xl animate-bounce">🎯</div>
            <div className="px-6 py-3 rounded-full bg-gradient-to-r from-amber-500/90 to-yellow-500/90 backdrop-blur-sm shadow-2xl">
              <span className="text-lg font-bold text-white drop-shadow-lg">
                Perfect Attention!
              </span>
            </div>
            <div className="flex items-center gap-2 text-amber-400">
              <span className="text-2xl">✨</span>
              <span className="font-medium">100% Focus</span>
              <span className="text-2xl">✨</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
