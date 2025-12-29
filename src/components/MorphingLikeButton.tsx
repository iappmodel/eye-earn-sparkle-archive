import React, { useState, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { CoinFlyAnimation } from './CoinFlyAnimation';

interface MorphingLikeButtonProps {
  isLiked?: boolean;
  likeCount?: number;
  onLike?: () => void;
  onTip?: (coinType: 'vicoin' | 'icoin', amount: number) => void;
  className?: string;
}

export const MorphingLikeButton: React.FC<MorphingLikeButtonProps> = ({
  isLiked = false,
  likeCount = 0,
  onLike,
  onTip,
  className,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedCoin, setSelectedCoin] = useState<'vicoin' | 'icoin' | null>(null);
  const [tipAmount, setTipAmount] = useState(10);
  const [isDragging, setIsDragging] = useState(false);
  const [flyingCoin, setFlyingCoin] = useState<{ type: 'vicoin' | 'icoin'; amount: number } | null>(null);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startX = useRef(0);
  const haptic = useHapticFeedback();
  const rulerRef = useRef<HTMLDivElement>(null);

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const handlePressStart = useCallback((e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;

    longPressTimer.current = setTimeout(() => {
      setIsExpanded(true);
    }, 300);
  }, []);

  const handlePressEnd = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    // If not expanded, treat as regular tap
    if (!isExpanded && !selectedCoin) {
      onLike?.();
    }
  }, [isExpanded, selectedCoin, onLike]);

  const handleCoinSelect = (coinType: 'vicoin' | 'icoin') => {
    haptic.medium();
    setSelectedCoin(coinType);
    setTipAmount(10);
  };

  const handleRulerStart = (e: React.TouchEvent | React.MouseEvent) => {
    setIsDragging(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    startX.current = clientX;
  };

  const handleRulerMove = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const delta = clientX - startX.current;
    
    // Change amount based on drag distance (10 units per 30px)
    const change = Math.round(delta / 30) * 10;
    const newAmount = Math.max(10, Math.min(1000, tipAmount + change));
    
    if (Math.abs(delta) > 30) {
      setTipAmount(newAmount);
      startX.current = clientX;
    }
  };

  const handleRulerEnd = () => {
    setIsDragging(false);
  };

  const handleConfirmTip = () => {
    if (selectedCoin && tipAmount > 0) {
      haptic.success();
      setFlyingCoin({ type: selectedCoin, amount: tipAmount });
      onTip?.(selectedCoin, tipAmount);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setSelectedCoin(null);
    setTipAmount(10);
  };

  // Shared neumorphic button styles matching NeuButton
  const neuButtonBase = cn(
    'rounded-2xl flex items-center justify-center',
    'transition-all duration-200 ease-out',
    'transform-gpu will-change-transform',
    'shadow-[0_8px_16px_rgba(0,0,0,0.4),0_2px_4px_rgba(0,0,0,0.3)]',
    'neu-button',
    'hover:scale-105 hover:-translate-y-0.5',
    'active:scale-95 active:translate-y-1'
  );

  return (
    <div className={cn('relative flex flex-col items-center gap-4', className)}>
      {/* Coin fly animation */}
      {flyingCoin && (
        <CoinFlyAnimation
          coinType={flyingCoin.type}
          amount={flyingCoin.amount}
          onComplete={() => setFlyingCoin(null)}
        />
      )}

      {/* Backdrop to close */}
      {selectedCoin && (
        <div 
          className="fixed inset-0 z-10"
          onClick={handleClose}
        />
      )}

      {/* Icoin Button (Top) */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={() => handleCoinSelect('icoin')}
          className={cn(
            neuButtonBase,
            'w-14 h-14 z-20',
            'text-icoin border border-icoin/30',
            'hover:shadow-[0_0_20px_hsl(var(--icoin)/0.3)]',
            selectedCoin === 'icoin' && 'neu-inset scale-95 translate-y-1'
          )}
        >
          {/* Inner glow effect */}
          <div className={cn(
            'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300',
            'group-hover:opacity-100 bg-icoin/10'
          )} />
          <span className="relative z-10 font-display font-bold text-lg">I</span>
        </button>
        
        {/* Mini ruler for Icoin */}
        {selectedCoin === 'icoin' && (
          <div
            ref={rulerRef}
            onMouseDown={handleRulerStart}
            onMouseMove={handleRulerMove}
            onMouseUp={handleRulerEnd}
            onMouseLeave={handleRulerEnd}
            onTouchStart={handleRulerStart}
            onTouchMove={handleRulerMove}
            onTouchEnd={handleRulerEnd}
            className="absolute right-full mr-2 flex items-center gap-1 z-30 animate-fade-in"
          >
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-xl neu-button bg-destructive/20 text-destructive text-sm font-bold
                shadow-[0_4px_8px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-transform"
            >
              ×
            </button>
            <div className="neu-card rounded-xl px-4 py-2 border border-icoin/30 cursor-ew-resize select-none
              shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
              <span className="text-icoin font-bold text-base">{tipAmount}</span>
            </div>
            <button
              onClick={handleConfirmTip}
              className="w-8 h-8 rounded-xl neu-button text-icoin text-sm font-bold
                shadow-[0_4px_8px_rgba(0,0,0,0.3)] border border-icoin/30
                hover:shadow-[0_0_15px_hsl(var(--icoin)/0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              ✓
            </button>
          </div>
        )}
      </div>

      {/* Vicoin Button (Middle) */}
      <div className="relative flex flex-col items-center">
        <button
          onClick={() => handleCoinSelect('vicoin')}
          className={cn(
            neuButtonBase,
            'w-14 h-14 z-20',
            'text-primary border border-primary/30',
            'hover:shadow-[0_0_20px_hsl(var(--primary)/0.3)]',
            selectedCoin === 'vicoin' && 'neu-inset scale-95 translate-y-1'
          )}
        >
          {/* Inner glow effect */}
          <div className={cn(
            'absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300',
            'group-hover:opacity-100 bg-primary/10'
          )} />
          <span className="relative z-10 font-display font-bold text-lg">V</span>
        </button>
        
        {/* Mini ruler for Vicoin */}
        {selectedCoin === 'vicoin' && (
          <div
            ref={rulerRef}
            onMouseDown={handleRulerStart}
            onMouseMove={handleRulerMove}
            onMouseUp={handleRulerEnd}
            onMouseLeave={handleRulerEnd}
            onTouchStart={handleRulerStart}
            onTouchMove={handleRulerMove}
            onTouchEnd={handleRulerEnd}
            className="absolute right-full mr-2 flex items-center gap-1 z-30 animate-fade-in"
          >
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-xl neu-button bg-destructive/20 text-destructive text-sm font-bold
                shadow-[0_4px_8px_rgba(0,0,0,0.3)] hover:scale-105 active:scale-95 transition-transform"
            >
              ×
            </button>
            <div className="neu-card rounded-xl px-4 py-2 border border-primary/30 cursor-ew-resize select-none
              shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
              <span className="text-primary font-bold text-base">{tipAmount}</span>
            </div>
            <button
              onClick={handleConfirmTip}
              className="w-8 h-8 rounded-xl neu-button text-primary text-sm font-bold
                shadow-[0_4px_8px_rgba(0,0,0,0.3)] border border-primary/30
                hover:shadow-[0_0_15px_hsl(var(--primary)/0.3)] hover:scale-105 active:scale-95 transition-all"
            >
              ✓
            </button>
          </div>
        )}
      </div>

      {/* Main Heart Button (Bottom) */}
      <div className="flex flex-col items-center gap-1">
        <button
          onMouseDown={handlePressStart}
          onMouseUp={handlePressEnd}
          onMouseLeave={() => {
            if (longPressTimer.current) {
              clearTimeout(longPressTimer.current);
            }
          }}
          onTouchStart={handlePressStart}
          onTouchEnd={handlePressEnd}
          className={cn(
            neuButtonBase,
            'w-14 h-14 z-20',
            isLiked 
              ? 'text-destructive border border-destructive/30 hover:shadow-[0_0_20px_hsl(var(--destructive)/0.3)]' 
              : 'text-foreground border border-border/30 hover:shadow-[0_4px_20px_rgba(0,0,0,0.3)]',
          )}
        >
          {/* Inner glow for liked state */}
          {isLiked && (
            <div className="absolute inset-0 rounded-2xl bg-destructive/10" />
          )}
          <Heart 
            className={cn(
              'relative z-10 w-6 h-6 transition-colors',
              isLiked && 'fill-destructive'
            )} 
          />
        </button>

        {/* Like count */}
        <span className="text-xs text-muted-foreground">
          {formatCount(likeCount)}
        </span>
      </div>
    </div>
  );
};
