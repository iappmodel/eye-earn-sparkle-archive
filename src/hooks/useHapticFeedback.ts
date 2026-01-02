import { useCallback } from 'react';
import { safeVibrate, hapticPatterns } from '@/lib/haptics';

/**
 * Hook for haptic feedback that respects browser security policies.
 * All vibration is routed through safeVibrate() which checks for user activation.
 * 
 * Currently DISABLED for debugging - see src/lib/haptics.ts HAPTICS_ENABLED flag.
 */
export const useHapticFeedback = () => {
  const vibrate = useCallback((pattern: number | readonly number[] = 10) => {
    safeVibrate(pattern);
  }, []);

  const light = useCallback(() => safeVibrate(hapticPatterns.light), []);
  const medium = useCallback(() => safeVibrate(hapticPatterns.medium), []);
  const heavy = useCallback(() => safeVibrate(hapticPatterns.heavy), []);
  const success = useCallback(() => safeVibrate(hapticPatterns.success), []);
  const error = useCallback(() => safeVibrate(hapticPatterns.error), []);

  return { vibrate, light, medium, heavy, success, error };
};
