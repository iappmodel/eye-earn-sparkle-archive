import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { useLocalization } from '@/contexts/LocalizationContext';

interface RewardBadgeProps {
  amount: number;
  type: 'vicoin' | 'icoin';
  isVisible: boolean;
}

/** Reward chip shown top-right for 3 seconds during promo playback. Uses locale-aware currency format. */
export const RewardBadge: React.FC<RewardBadgeProps> = ({
  amount,
  type,
  isVisible,
}) => {
  const [show, setShow] = useState(false);
  const { formatCurrency } = useLocalization();

  useEffect(() => {
    if (isVisible) {
      setShow(true);
      const timer = setTimeout(() => {
        setShow(false);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible]);

  if (!show) return null;

  const displayLabel = type === 'icoin'
    ? `Earn ${formatCurrency(amount)}`
    : `Earn +${amount} Vicoins`;

  return (
    <div
      className={cn(
        'fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-md transition-all duration-500',
        type === 'vicoin'
          ? 'bg-primary/20 border border-primary/40'
          : 'bg-icoin/20 border border-icoin/40',
        'animate-float-in'
      )}
    >
      <div className={cn(
        'w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold',
        type === 'vicoin'
          ? 'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground'
          : 'bg-gradient-to-br from-icoin to-yellow-600 text-primary-foreground'
      )}>
        {type === 'vicoin' ? 'V' : 'I'}
      </div>
      <span className={cn(
        'font-display font-bold text-sm',
        type === 'vicoin' ? 'gradient-text' : 'gradient-text-gold'
      )}>
        {displayLabel}
      </span>
    </div>
  );
};
