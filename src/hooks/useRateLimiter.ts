import { useState, useCallback, useRef } from 'react';
import { toast } from '@/hooks/use-toast';

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  showToast?: boolean;
}

interface RateLimitState {
  count: number;
  resetTime: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 10,
  windowMs: 60000, // 1 minute
  showToast: true,
};

export function useRateLimiter(key: string, config: Partial<RateLimitConfig> = {}) {
  const { maxRequests, windowMs, showToast } = { ...DEFAULT_CONFIG, ...config };
  const stateRef = useRef<RateLimitState>({ count: 0, resetTime: Date.now() + windowMs });
  const [isLimited, setIsLimited] = useState(false);
  const [remainingRequests, setRemainingRequests] = useState(maxRequests);

  const checkRateLimit = useCallback((): boolean => {
    const now = Date.now();
    const state = stateRef.current;

    // Reset window if expired
    if (now > state.resetTime) {
      state.count = 0;
      state.resetTime = now + windowMs;
    }

    // Check if limit exceeded
    if (state.count >= maxRequests) {
      setIsLimited(true);
      setRemainingRequests(0);

      if (showToast) {
        const secondsRemaining = Math.ceil((state.resetTime - now) / 1000);
        toast({
          title: 'Too many requests',
          description: `Please wait ${secondsRemaining}s before trying again`,
          variant: 'destructive',
        });
      }

      return false;
    }

    // Increment counter
    state.count++;
    const remaining = maxRequests - state.count;
    setRemainingRequests(remaining);
    setIsLimited(false);

    return true;
  }, [maxRequests, windowMs, showToast]);

  const reset = useCallback(() => {
    stateRef.current = { count: 0, resetTime: Date.now() + windowMs };
    setIsLimited(false);
    setRemainingRequests(maxRequests);
  }, [windowMs, maxRequests]);

  const getTimeUntilReset = useCallback((): number => {
    const now = Date.now();
    return Math.max(0, stateRef.current.resetTime - now);
  }, []);

  return {
    checkRateLimit,
    isLimited,
    remainingRequests,
    reset,
    getTimeUntilReset,
  };
}

// Pre-configured rate limiters for common actions
export const RATE_LIMIT_CONFIGS = {
  comment: { maxRequests: 5, windowMs: 60000 }, // 5 comments per minute
  like: { maxRequests: 30, windowMs: 60000 }, // 30 likes per minute
  tip: { maxRequests: 10, windowMs: 60000 }, // 10 tips per minute
  message: { maxRequests: 20, windowMs: 60000 }, // 20 messages per minute
  upload: { maxRequests: 3, windowMs: 300000 }, // 3 uploads per 5 minutes
  search: { maxRequests: 15, windowMs: 60000 }, // 15 searches per minute
  follow: { maxRequests: 20, windowMs: 60000 }, // 20 follows per minute
  report: { maxRequests: 5, windowMs: 300000 }, // 5 reports per 5 minutes
};

// Debounce hook for input fields
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

// Throttle hook for scroll/resize events
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  delay: number
): (...args: Parameters<T>) => void {
  const lastCallRef = useRef<number>(0);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      if (now - lastCallRef.current >= delay) {
        lastCallRef.current = now;
        callback(...args);
      }
    },
    [callback, delay]
  );
}

export default useRateLimiter;
