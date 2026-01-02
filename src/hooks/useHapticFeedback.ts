import { useCallback } from 'react';

// Track if user has interacted with the page (required for vibrate API)
let hasUserInteracted = false;

const markUserInteraction = () => {
  hasUserInteracted = true;
  window.removeEventListener('touchstart', markUserInteraction);
  window.removeEventListener('click', markUserInteraction);
  window.removeEventListener('pointerdown', markUserInteraction);
};

// Set up listeners once
if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', markUserInteraction, { once: true, passive: true });
  window.addEventListener('click', markUserInteraction, { once: true });
  window.addEventListener('pointerdown', markUserInteraction, { once: true });
}

export const useHapticFeedback = () => {
  const vibrate = useCallback((pattern: number | number[] = 10) => {
    if (hasUserInteracted && 'vibrate' in navigator) {
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
