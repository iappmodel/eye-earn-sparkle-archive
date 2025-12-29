import React, { useState, useRef, useCallback } from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

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
            'w-10 h-10 rounded-full flex items-center justify-center z-20',
            'bg-gradient-to-br from-icoin to-yellow-600 text-primary-foreground',
            'shadow-lg shadow-icoin/30',
            'hover:scale-110 active:scale-95 transition-transform',
            selectedCoin === 'icoin' && 'ring-2 ring-icoin ring-offset-2 ring-offset-background'
          )}
        >
          <span className="font-display font-bold text-base">I</span>
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
              className="w-6 h-6 rounded-full bg-destructive/20 text-destructive text-xs font-bold"
            >
              ×
            </button>
            <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1 border border-icoin/50 cursor-ew-resize select-none">
              <span className="text-icoin font-bold text-sm">{tipAmount}</span>
            </div>
            <button
              onClick={handleConfirmTip}
              className="w-6 h-6 rounded-full bg-icoin text-primary-foreground text-xs font-bold"
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
            'w-10 h-10 rounded-full flex items-center justify-center z-20',
            'bg-gradient-to-br from-primary to-primary/70 text-primary-foreground',
            'shadow-lg shadow-primary/30',
            'hover:scale-110 active:scale-95 transition-transform',
            selectedCoin === 'vicoin' && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
          )}
        >
          <span className="font-display font-bold text-base">V</span>
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
              className="w-6 h-6 rounded-full bg-destructive/20 text-destructive text-xs font-bold"
            >
              ×
            </button>
            <div className="bg-background/90 backdrop-blur-sm rounded-full px-3 py-1 border border-primary/50 cursor-ew-resize select-none">
              <span className="text-primary font-bold text-sm">{tipAmount}</span>
            </div>
            <button
              onClick={handleConfirmTip}
              className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold"
            >
              ✓
            </button>
          </div>
        )}
      </div>

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
    </div>
  );
};
