import { useState, useEffect, useCallback } from 'react';

/**
 * Wraps a hook call in try-catch to prevent crashes during initialization
 */
export function useSafeCallback<T extends (...args: unknown[]) => unknown>(
  callback: T,
  fallback: ReturnType<T>
): T {
  return useCallback((...args: Parameters<T>) => {
    try {
      return callback(...args);
    } catch (error) {
      console.error('[useSafeCallback] Error in callback:', error);
      return fallback;
    }
  }, [callback, fallback]) as T;
}

/**
 * Hook that safely initializes state with a factory function
 */
export function useSafeState<T>(
  factory: () => T,
  fallback: T
): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [state, setState] = useState<T>(() => {
    try {
      return factory();
    } catch (error) {
      console.error('[useSafeState] Error in factory:', error);
      return fallback;
    }
  });
  return [state, setState];
}

/**
 * Wraps useEffect to catch errors in the effect
 */
export function useSafeEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList,
  effectName?: string
): void {
  useEffect(() => {
    try {
      const cleanup = effect();
      return () => {
        try {
          if (typeof cleanup === 'function') {
            cleanup();
          }
        } catch (error) {
          console.error(`[useSafeEffect] Error in cleanup (${effectName || 'unknown'}):`, error);
        }
      };
    } catch (error) {
      console.error(`[useSafeEffect] Error in effect (${effectName || 'unknown'}):`, error);
      return undefined;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

/**
 * Default empty hook return values for fail-open patterns
 */
export const EMPTY_HOOK_DEFAULTS = {
  useAttentionAchievements: {
    stats: { totalWatchTime: 0, perfectAttentionCount: 0, longestStreak: 0 },
    unlockedAchievements: new Set<string>(),
    newlyUnlocked: null,
    dismissNotification: () => {},
    recordVideoCompletion: () => {},
  },
  useMediaSettings: {
    attentionThreshold: 70,
    eyeTrackingEnabled: false,
    soundEffects: false,
  },
  useCelebration: {
    isActive: false,
    type: 'confetti' as const,
    celebrate: () => {},
    stopCelebration: () => {},
  },
  usePageNavigation: {
    currentPage: null,
    currentState: { direction: 'center' as const, index: 0 },
    transition: null,
    transitionState: 'idle' as const,
    canNavigate: () => true,
    navigate: () => {},
    getTransitionClasses: () => '',
    getTransitionStyles: () => ({}),
  },
  useContentFeed: {
    content: [],
    isLoading: false,
    refresh: async () => {},
  },
  useSwipeNavigation: {
    handlers: {},
  },
  useOnboarding: {
    showOnboarding: false,
    closeOnboarding: () => {},
    completeOnboarding: () => {},
    openOnboarding: () => {},
  },
} as const;
