import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useAccessibility } from '@/contexts/AccessibilityContext';

interface Coin {
  id: number;
  x: number;
  delay: number;
  duration: number;
}

interface CoinFlyAnimationProps {
  coinType: 'vicoin' | 'icoin';
  amount: number;
  onComplete?: () => void;
}

export const CoinFlyAnimation: React.FC<CoinFlyAnimationProps> = ({
  coinType,
  amount,
  onComplete,
}) => {
  const { reducedMotion: prefersReducedMotion } = useAccessibility();
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Generate coins based on amount (max 8 coins for performance) - skip when reduced motion
    const coinCount = prefersReducedMotion ? 0 : Math.min(Math.ceil(amount / 50), 8);
    const newCoins: Coin[] = [];
    
    for (let i = 0; i < coinCount; i++) {
      newCoins.push({
        id: i,
        x: (Math.random() - 0.5) * 60,
        delay: i * 80,
        duration: 600 + Math.random() * 200,
      });
    }
    
    setCoins(newCoins);

    const duration = prefersReducedMotion ? 600 : 1200;
    const timeout = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, duration);

    return () => clearTimeout(timeout);
  }, [amount, onComplete, prefersReducedMotion]);

  if (!isVisible) return null;

  const coinColor = coinType === 'icoin' ? 'bg-icoin' : 'bg-primary';
  const glowColor = coinType === 'icoin' 
    ? 'shadow-[0_0_10px_hsl(var(--icoin)/0.6)]' 
    : 'shadow-[0_0_10px_hsl(var(--primary)/0.6)]';

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50" aria-hidden="true">
      {!prefersReducedMotion && coins.map((coin) => (
        <div
          key={coin.id}
          className={cn(
            'absolute left-1/2 bottom-0 w-4 h-4 rounded-full',
            coinColor,
            glowColor,
            'flex items-center justify-center text-[8px] font-bold text-background'
          )}
          style={{
            animation: `coinFly ${coin.duration}ms ease-out forwards`,
            animationDelay: `${coin.delay}ms`,
            '--coin-x': `${coin.x}px`,
          } as React.CSSProperties}
        >
          {coinType === 'icoin' ? 'I' : 'V'}
        </div>
      ))}
      
      {/* Amount: static when reduced motion, burst animation otherwise */}
      <div 
        className={cn(
          'absolute left-1/2 bottom-8 -translate-x-1/2',
          'font-display font-bold text-lg',
          coinType === 'icoin' ? 'text-icoin' : 'text-primary',
          !prefersReducedMotion && 'animate-[amountBurst_0.8s_ease-out_forwards]'
        )}
        style={{
          textShadow: coinType === 'icoin' 
            ? '0 0 10px hsl(var(--icoin) / 0.8)' 
            : '0 0 10px hsl(var(--primary) / 0.8)'
        }}
      >
        +{amount}
      </div>
    </div>
  );
};
