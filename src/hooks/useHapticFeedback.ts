import { useCallback } from 'react';

export const useHapticFeedback = () => {
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(25), [vibrate]);
  const heavy = useCallback(() => vibrate(50), [vibrate]);
  const success = useCallback(() => vibrate([10, 50, 10]), [vibrate]);
  const error = useCallback(() => vibrate([50, 100, 50]), [vibrate]);

  return { vibrate, light, medium, heavy, success, error };
};
