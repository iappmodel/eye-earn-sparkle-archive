import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export type GiftType = 
  | 'rose' 
  | 'heart' 
  | 'star' 
  | 'diamond' 
  | 'crown' 
  | 'rocket' 
  | 'unicorn' 
  | 'galaxy';

interface GiftConfig {
  emoji: string;
  name: string;
  coinValue: number;
  color: string;
  animation: 'float' | 'burst' | 'spiral' | 'explosion';
  particles: number;
}

const GIFT_CONFIGS: Record<GiftType, GiftConfig> = {
  rose: {
    emoji: '🌹',
    name: 'Rose',
    coinValue: 10,
    color: 'hsl(350, 80%, 60%)',
    animation: 'float',
    particles: 5,
  },
  heart: {
    emoji: '❤️',
    name: 'Heart',
    coinValue: 50,
    color: 'hsl(350, 90%, 55%)',
    animation: 'burst',
    particles: 8,
  },
  star: {
    emoji: '⭐',
    name: 'Star',
    coinValue: 100,
    color: 'hsl(45, 100%, 50%)',
    animation: 'burst',
    particles: 10,
  },
  diamond: {
    emoji: '💎',
    name: 'Diamond',
    coinValue: 500,
    color: 'hsl(200, 100%, 70%)',
    animation: 'spiral',
    particles: 12,
  },
  crown: {
    emoji: '👑',
    name: 'Crown',
    coinValue: 1000,
    color: 'hsl(45, 100%, 45%)',
    animation: 'explosion',
    particles: 15,
  },
  rocket: {
    emoji: '🚀',
    name: 'Rocket',
    coinValue: 2000,
    color: 'hsl(20, 90%, 55%)',
    animation: 'spiral',
    particles: 18,
  },
  unicorn: {
    emoji: '🦄',
    name: 'Unicorn',
    coinValue: 5000,
    color: 'hsl(280, 80%, 70%)',
    animation: 'explosion',
    particles: 20,
  },
  galaxy: {
    emoji: '🌌',
    name: 'Galaxy',
    coinValue: 10000,
    color: 'hsl(260, 100%, 50%)',
    animation: 'explosion',
    particles: 25,
  },
};

interface Particle {
  id: number;
  x: number;
  y: number;
  angle: number;
  scale: number;
  delay: number;
}

interface PremiumGiftAnimationProps {
  giftType: GiftType;
  senderName?: string;
  onComplete?: () => void;
}

export const PremiumGiftAnimation: React.FC<PremiumGiftAnimationProps> = ({
  giftType,
  senderName,
  onComplete,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [particles, setParticles] = useState<Particle[]>([]);
  const config = GIFT_CONFIGS[giftType];

  useEffect(() => {
    // Generate particles
    const newParticles: Particle[] = [];
    for (let i = 0; i < config.particles; i++) {
      newParticles.push({
        id: i,
        x: (Math.random() - 0.5) * 200,
        y: (Math.random() - 0.5) * 200,
        angle: (360 / config.particles) * i,
        scale: 0.5 + Math.random() * 0.5,
        delay: i * 50,
      });
    }
    setParticles(newParticles);

    const timeout = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 3000);

    return () => clearTimeout(timeout);
  }, [config.particles, onComplete]);

  const getAnimationVariants = (particle: Particle) => {
    switch (config.animation) {
      case 'float':
        return {
          initial: { opacity: 0, y: 50, scale: 0 },
          animate: { 
            opacity: [0, 1, 1, 0],
            y: [50, -100, -200],
            x: [0, particle.x * 0.5],
            scale: [0, particle.scale, particle.scale, 0],
          },
          transition: { duration: 2, delay: particle.delay / 1000, ease: 'easeOut' },
        };
      case 'burst':
        return {
          initial: { opacity: 0, scale: 0, x: 0, y: 0 },
          animate: { 
            opacity: [0, 1, 1, 0],
            scale: [0, particle.scale * 1.5, particle.scale, 0],
            x: [0, particle.x],
            y: [0, particle.y],
          },
          transition: { duration: 1.5, delay: particle.delay / 1000, ease: 'easeOut' },
        };
      case 'spiral':
        const radius = 50 + particle.id * 10;
        return {
          initial: { opacity: 0, scale: 0 },
          animate: { 
            opacity: [0, 1, 1, 0],
            scale: [0, particle.scale, particle.scale, 0],
            x: [0, Math.cos(particle.angle * Math.PI / 180) * radius],
            y: [0, Math.sin(particle.angle * Math.PI / 180) * radius - 50],
            rotate: [0, 360],
          },
          transition: { duration: 2, delay: particle.delay / 1000, ease: 'easeOut' },
        };
      case 'explosion':
        const distance = 80 + Math.random() * 80;
        return {
          initial: { opacity: 0, scale: 0, x: 0, y: 0 },
          animate: { 
            opacity: [0, 1, 1, 0],
            scale: [0, particle.scale * 2, particle.scale * 1.5, 0],
            x: [0, Math.cos(particle.angle * Math.PI / 180) * distance],
            y: [0, Math.sin(particle.angle * Math.PI / 180) * distance - 30],
          },
          transition: { 
            duration: 2, 
            delay: particle.delay / 1000, 
            ease: [0.32, 0.72, 0, 1],
          },
        };
    }
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
        {/* Background glow */}
        <motion.div
          className="absolute w-64 h-64 rounded-full blur-3xl"
          style={{ backgroundColor: config.color }}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: [0, 0.3, 0.3, 0], scale: [0.5, 1.5, 2, 2.5] }}
          transition={{ duration: 2.5 }}
        />

        {/* Main gift emoji */}
        <motion.div
          className="text-7xl z-10"
          initial={{ opacity: 0, scale: 0, rotate: -30 }}
          animate={{ 
            opacity: [0, 1, 1, 0],
            scale: [0, 1.5, 1.2, 0],
            rotate: [-30, 10, 0, 0],
            y: [0, -20, -10, -50],
          }}
          transition={{ duration: 2.5, ease: 'easeOut' }}
        >
          {config.emoji}
        </motion.div>

        {/* Particles */}
        {particles.map((particle) => {
          const variants = getAnimationVariants(particle);
          return (
            <motion.div
              key={particle.id}
              className="absolute text-2xl"
              initial={variants.initial}
              animate={variants.animate}
              transition={variants.transition}
            >
              {config.emoji}
            </motion.div>
          );
        })}

        {/* Sparkles for premium gifts */}
        {config.coinValue >= 500 && (
          <>
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={`sparkle-${i}`}
                className="absolute w-2 h-2 bg-white rounded-full"
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1.5, 0],
                  x: [0, (Math.random() - 0.5) * 150],
                  y: [0, (Math.random() - 0.5) * 150],
                }}
                transition={{
                  duration: 1.5,
                  delay: 0.5 + i * 0.1,
                  ease: 'easeOut',
                }}
                style={{
                  boxShadow: `0 0 10px ${config.color}, 0 0 20px ${config.color}`,
                }}
              />
            ))}
          </>
        )}

        {/* Gift info card */}
        <motion.div
          className={cn(
            'absolute bottom-32 px-6 py-3 rounded-2xl',
            'bg-card/90 backdrop-blur-xl border border-border',
            'shadow-lg'
          )}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: [0, 1, 1, 0], y: [20, 0, 0, -10], scale: [0.9, 1, 1, 0.9] }}
          transition={{ duration: 2.5, delay: 0.3 }}
        >
          <div className="flex items-center gap-3">
            <span className="text-3xl">{config.emoji}</span>
            <div>
              <p className="font-bold text-foreground">
                {senderName ? `${senderName} sent` : 'Received'} {config.name}!
              </p>
              <p className="text-sm text-muted-foreground">
                +{config.coinValue.toLocaleString()} coins
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export const GIFT_OPTIONS = Object.entries(GIFT_CONFIGS).map(([key, config]) => ({
  type: key as GiftType,
  ...config,
}));

export default PremiumGiftAnimation;
