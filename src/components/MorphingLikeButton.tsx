import React, { useState, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const startX = useRef(0);
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
      onTip?.(selectedCoin, tipAmount);
      handleClose();
    }
  };

  const handleClose = () => {
    setIsExpanded(false);
    setSelectedCoin(null);
    setTipAmount(10);
  };

  // Generate ruler marks
  const rulerMarks = [];
  const centerValue = tipAmount;
  for (let i = -3; i <= 3; i++) {
    const value = centerValue + (i * 10);
    if (value > 0 && value <= 1000) {
      rulerMarks.push({ value, offset: i });
    }
  }

  return (
    <div className={cn('relative flex flex-col items-center gap-1', className)}>
      {/* Backdrop to close */}
      {(isExpanded || selectedCoin) && (
        <div 
          className="fixed inset-0 z-10"
          onClick={handleClose}
        />
      )}

      {/* Icoin Button (Top) - Always visible */}
      <button
        onClick={() => handleCoinSelect('icoin')}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center z-20',
          'bg-gradient-to-br from-icoin to-yellow-600 text-primary-foreground',
          'shadow-lg shadow-icoin/30',
          'hover:scale-110 active:scale-95 transition-transform',
          selectedCoin === 'icoin' && 'ring-2 ring-icoin ring-offset-2 ring-offset-background'
        )}
      >
        <span className="font-display font-bold text-base">I</span>
      </button>

      {/* Vicoin Button (Middle) - Always visible */}
      <button
        onClick={() => handleCoinSelect('vicoin')}
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center z-20',
          'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground',
          'shadow-lg shadow-primary/30',
          'hover:scale-110 active:scale-95 transition-transform',
          selectedCoin === 'vicoin' && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
        )}
      >
        <span className="font-display font-bold text-base">V</span>
      </button>

      {/* Main Heart Button (Bottom) */}
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
          'relative w-10 h-10 rounded-full flex items-center justify-center z-20',
          'transition-all duration-200',
          'shadow-[0_4px_12px_rgba(0,0,0,0.15),inset_0_1px_2px_rgba(255,255,255,0.1)]',
          isLiked 
            ? 'bg-destructive/20 border border-destructive/50' 
            : 'bg-background/80 backdrop-blur-md border border-border/50',
          'hover:scale-105 active:scale-95'
        )}
      >
        <Heart 
          className={cn(
            'w-5 h-5 transition-colors',
            isLiked ? 'fill-destructive text-destructive' : 'text-foreground'
          )} 
        />
      </button>

      {/* Like count */}
      <span className="text-xs text-muted-foreground">
        {formatCount(likeCount)}
      </span>

      {/* Ruler Slider (When coin is selected) */}
      {selectedCoin && (
        <div 
          className="absolute right-full mr-4 flex items-center gap-2 animate-fade-in z-30"
          style={{ top: '50%', transform: 'translateY(-50%)' }}
        >
          {/* Close button */}
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-destructive/20 text-destructive
              flex items-center justify-center text-sm font-bold"
          >
            ×
          </button>

          {/* Ruler */}
          <div
            ref={rulerRef}
            onMouseDown={handleRulerStart}
            onMouseMove={handleRulerMove}
            onMouseUp={handleRulerEnd}
            onMouseLeave={handleRulerEnd}
            onTouchStart={handleRulerStart}
            onTouchMove={handleRulerMove}
            onTouchEnd={handleRulerEnd}
            className={cn(
              'relative w-48 h-16 rounded-2xl overflow-hidden cursor-ew-resize select-none',
              'bg-background/80 backdrop-blur-md border border-border/50',
              'shadow-lg'
            )}
          >
            {/* Ruler background with gradient */}
            <div className={cn(
              'absolute inset-0',
              selectedCoin === 'vicoin' 
                ? 'bg-gradient-to-r from-primary/10 via-primary/20 to-primary/10'
                : 'bg-gradient-to-r from-icoin/10 via-icoin/20 to-icoin/10'
            )} />

            {/* Center indicator line */}
            <div className={cn(
              'absolute left-1/2 top-0 bottom-0 w-0.5 -translate-x-1/2 z-10',
              selectedCoin === 'vicoin' ? 'bg-primary' : 'bg-icoin'
            )} />

            {/* Ruler marks */}
            <div className="absolute inset-0 flex items-center justify-center">
              {rulerMarks.map((mark) => (
                <div
                  key={mark.value}
                  className="absolute flex flex-col items-center"
                  style={{ 
                    left: `calc(50% + ${mark.offset * 24}px)`,
                    transform: 'translateX(-50%)'
                  }}
                >
                  <div className={cn(
                    'w-px h-3',
                    mark.offset === 0 
                      ? (selectedCoin === 'vicoin' ? 'bg-primary h-5' : 'bg-icoin h-5')
                      : 'bg-muted-foreground/50'
                  )} />
                  <span className={cn(
                    'text-xs mt-1 font-medium transition-all',
                    mark.offset === 0 
                      ? (selectedCoin === 'vicoin' ? 'text-primary text-sm font-bold' : 'text-icoin text-sm font-bold')
                      : 'text-muted-foreground/70'
                  )}>
                    {mark.value}
                  </span>
                </div>
              ))}
            </div>

            {/* Coin icon */}
            <div className={cn(
              'absolute top-1 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full',
              'flex items-center justify-center text-xs font-bold',
              selectedCoin === 'vicoin'
                ? 'bg-primary text-primary-foreground'
                : 'bg-icoin text-primary-foreground'
            )}>
              {selectedCoin === 'vicoin' ? 'V' : 'I'}
            </div>

            {/* Drag hint */}
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground">
              ← slide →
            </div>
          </div>

          {/* Confirm button */}
          <button
            onClick={handleConfirmTip}
            className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center',
              'text-primary-foreground font-bold text-sm',
              'transition-transform hover:scale-110',
              selectedCoin === 'vicoin'
                ? 'bg-primary shadow-lg shadow-primary/30'
                : 'bg-icoin shadow-lg shadow-icoin/30'
            )}
          >
            ✓
          </button>
        </div>
      )}
    </div>
  );
};
