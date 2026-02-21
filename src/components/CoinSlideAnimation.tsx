import React from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

interface CoinSlideAnimationProps {
  type: 'vicoin' | 'icoin';
  amount?: number;
  isAnimating: boolean;
  onComplete?: () => void;
}

export const CoinSlideAnimation: React.FC<CoinSlideAnimationProps> = ({
  type,
  amount = 0,
  isAnimating,
  onComplete,
}) => {
  const { reducedMotion: prefersReducedMotion } = useAccessibility();

  React.useEffect(() => {
    if (isAnimating) {
      const duration = prefersReducedMotion ? 400 : 1400;
      const timer = setTimeout(() => {
        onComplete?.();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isAnimating, onComplete, prefersReducedMotion]);

  if (!isAnimating) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-[60]" aria-hidden="true">
      {/* Coin: static badge when prefers-reduced-motion, slide animation otherwise */}
      <div
        className={cn(
          'absolute w-14 h-14 rounded-full flex flex-col items-center justify-center shadow-xl',
          !prefersReducedMotion && 'animate-slide-to-wallet',
          type === 'vicoin'
            ? 'bg-gradient-to-br from-primary to-primary/70'
            : 'bg-gradient-to-br from-icoin to-yellow-600'
        )}
        style={{ top: '50%', right: '24px' }}
      >
        <span className="font-display font-bold text-xl text-primary-foreground leading-tight">
          {type === 'vicoin' ? 'V' : 'I'}
        </span>
        {amount > 0 && (
          <span className="text-[10px] font-bold text-primary-foreground/90 -mt-0.5">+{amount}</span>
        )}
      </div>

      {/* Sparkle trail - hidden when prefers-reduced-motion */}
      {!prefersReducedMotion && (
        <>
          <div className="absolute top-1/2 right-6 w-1.5 h-1.5 bg-primary/60 rounded-full animate-sparkle-1" />
          <div className="absolute top-1/2 right-12 w-1 h-1 bg-primary/40 rounded-full animate-sparkle-2" />
          <div className="absolute top-1/2 right-20 w-1 h-1 bg-primary/25 rounded-full animate-sparkle-3" />
        </>
      )}
    </div>
  );
};
