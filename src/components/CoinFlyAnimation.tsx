import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

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
  const [coins, setCoins] = useState<Coin[]>([]);
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    // Generate coins based on amount (max 8 coins for performance)
    const coinCount = Math.min(Math.ceil(amount / 50), 8);
    const newCoins: Coin[] = [];
    
    for (let i = 0; i < coinCount; i++) {
      newCoins.push({
        id: i,
        x: (Math.random() - 0.5) * 60, // Random horizontal spread
        delay: i * 80, // Staggered delay
        duration: 600 + Math.random() * 200, // Slightly varied duration
      });
    }
    
    setCoins(newCoins);

    // Hide and cleanup after animation
    const timeout = setTimeout(() => {
      setIsVisible(false);
      onComplete?.();
    }, 1200);

    return () => clearTimeout(timeout);
  }, [amount, onComplete]);

  if (!isVisible) return null;

  const coinColor = coinType === 'icoin' ? 'bg-icoin' : 'bg-primary';
  const glowColor = coinType === 'icoin' 
    ? 'shadow-[0_0_10px_hsl(var(--icoin)/0.6)]' 
    : 'shadow-[0_0_10px_hsl(var(--primary)/0.6)]';

  return (
    <div className="absolute inset-0 pointer-events-none overflow-visible z-50">
      {coins.map((coin) => (
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
      
      {/* Amount burst text */}
      <div 
        className={cn(
          'absolute left-1/2 bottom-8 -translate-x-1/2',
          'font-display font-bold text-lg',
          coinType === 'icoin' ? 'text-icoin' : 'text-primary',
          'animate-[amountBurst_0.8s_ease-out_forwards]'
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
