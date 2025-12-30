import React, { useState, useRef, useCallback } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  disabled?: boolean;
  className?: string;
}

export const PullToRefresh: React.FC<PullToRefreshProps> = ({
  children,
  onRefresh,
  disabled = false,
  className,
}) => {
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const { medium, success } = useHapticFeedback();

  const PULL_THRESHOLD = 80;
  const MAX_PULL = 120;

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) return;
    
    startY.current = e.touches[0].clientY;
    setIsPulling(true);
  }, [disabled, isRefreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || disabled || isRefreshing) return;
    
    const container = containerRef.current;
    if (!container || container.scrollTop > 0) {
      setIsPulling(false);
      setPullDistance(0);
      return;
    }
    
    const currentY = e.touches[0].clientY;
    const diff = currentY - startY.current;
    
    if (diff > 0) {
      // Apply resistance
      const resistance = Math.min(diff * 0.5, MAX_PULL);
      setPullDistance(resistance);
      
      if (resistance >= PULL_THRESHOLD) {
        medium();
      }
    }
  }, [isPulling, disabled, isRefreshing, medium]);

  const handleTouchEnd = useCallback(async () => {
    if (!isPulling || disabled) return;
    
    setIsPulling(false);
    
    if (pullDistance >= PULL_THRESHOLD && !isRefreshing) {
      setIsRefreshing(true);
      success();
      
      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      setPullDistance(0);
    }
  }, [isPulling, pullDistance, isRefreshing, onRefresh, disabled, success]);

  const progress = Math.min(pullDistance / PULL_THRESHOLD, 1);
  const shouldTrigger = pullDistance >= PULL_THRESHOLD;

  return (
    <div 
      ref={containerRef}
      className={cn("relative overflow-auto touch-pan-y", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div 
        className={cn(
          "absolute left-1/2 -translate-x-1/2 z-50 flex items-center justify-center transition-all duration-200",
          isRefreshing && "animate-spin"
        )}
        style={{ 
          top: Math.max(pullDistance - 40, -40),
          opacity: pullDistance > 10 ? 1 : 0,
        }}
      >
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center transition-all",
          shouldTrigger || isRefreshing 
            ? "bg-primary text-primary-foreground" 
            : "bg-muted text-muted-foreground"
        )}>
          <RefreshCw 
            className="w-5 h-5 transition-transform"
            style={{ 
              transform: isRefreshing ? undefined : `rotate(${progress * 360}deg)`,
            }} 
          />
        </div>
      </div>
      
      {/* Content with pull transform */}
      <div 
        style={{ 
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : undefined,
          transition: isPulling ? 'none' : 'transform 0.3s ease-out',
        }}
      >
        {children}
      </div>
    </div>
  );
};
