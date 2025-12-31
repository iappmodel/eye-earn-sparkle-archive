import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface RateLimitIndicatorProps {
  remainingRequests: number;
  maxRequests: number;
  timeUntilReset: number;
  isLimited: boolean;
  showAlways?: boolean;
  className?: string;
  variant?: 'inline' | 'badge' | 'toast';
}

export function RateLimitIndicator({
  remainingRequests,
  maxRequests,
  timeUntilReset,
  isLimited,
  showAlways = false,
  className,
  variant = 'badge',
}: RateLimitIndicatorProps) {
  const [countdown, setCountdown] = useState(Math.ceil(timeUntilReset / 1000));
  const percentage = (remainingRequests / maxRequests) * 100;
  
  // Warning thresholds
  const isLow = percentage <= 30 && percentage > 0;
  const isCritical = percentage <= 10 && percentage > 0;

  useEffect(() => {
    if (!isLimited) {
      setCountdown(0);
      return;
    }

    setCountdown(Math.ceil(timeUntilReset / 1000));
    
    const interval = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);

    return () => clearInterval(interval);
  }, [isLimited, timeUntilReset]);

  // Don't show if not limited and showAlways is false
  if (!isLimited && !showAlways && !isLow) {
    return null;
  }

  const formatTime = (seconds: number) => {
    if (seconds >= 60) {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    return `${seconds}s`;
  };

  if (variant === 'inline') {
    return (
      <span
        className={cn(
          'text-xs transition-colors',
          isLimited && 'text-destructive',
          isCritical && !isLimited && 'text-destructive',
          isLow && !isCritical && !isLimited && 'text-warning',
          !isLow && !isLimited && 'text-muted-foreground',
          className
        )}
      >
        {isLimited ? (
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" />
            Wait {formatTime(countdown)}
          </span>
        ) : (
          `${remainingRequests}/${maxRequests} remaining`
        )}
      </span>
    );
  }

  if (variant === 'toast') {
    return (
      <AnimatePresence>
        {isLimited && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className={cn(
              'fixed bottom-24 left-1/2 -translate-x-1/2 z-50',
              'flex items-center gap-3 px-4 py-3 rounded-xl',
              'bg-destructive text-destructive-foreground shadow-lg',
              className
            )}
          >
            <AlertCircle className="w-5 h-5" />
            <div className="flex flex-col">
              <span className="font-medium text-sm">Rate limit reached</span>
              <span className="text-xs opacity-90">
                Try again in {formatTime(countdown)}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    );
  }

  // Default badge variant
  return (
    <AnimatePresence>
      {(isLimited || isLow || showAlways) && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className={cn(
            'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
            isLimited && 'bg-destructive/10 text-destructive border border-destructive/20',
            isCritical && !isLimited && 'bg-destructive/10 text-destructive border border-destructive/20',
            isLow && !isCritical && !isLimited && 'bg-warning/10 text-warning border border-warning/20',
            !isLow && !isLimited && 'bg-muted text-muted-foreground',
            className
          )}
        >
          {isLimited ? (
            <>
              <Clock className="w-3 h-3" />
              <span>{formatTime(countdown)}</span>
            </>
          ) : (
            <>
              <div
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  isCritical && 'bg-destructive animate-pulse',
                  isLow && !isCritical && 'bg-warning',
                  !isLow && 'bg-success'
                )}
              />
              <span>{remainingRequests}</span>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default RateLimitIndicator;
