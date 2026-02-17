import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { GESTURE_TUTORIAL_STORAGE_KEY, GESTURE_TUTORIAL_SKIPPED_KEY } from '@/components/GestureTutorial';

interface GestureTutorialContextValue {
  showTutorial: boolean;
  completeTutorial: () => void;
  /** Skip without marking as completed; can show again via openTutorial. */
  skipTutorial: () => void;
  resetTutorial: () => void;
  /** Show tutorial again (e.g. from Settings). Clears completed flag and sets show to true. */
  openTutorial: () => void;
  /** Whether user has ever completed (not skipped) the tutorial */
  hasCompletedOnce: boolean;
}

const GestureTutorialContext = createContext<GestureTutorialContextValue | null>(null);

export function GestureTutorialProvider({ children }: { children: React.ReactNode }) {
  const [showTutorial, setShowTutorial] = useState(false);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);

  useEffect(() => {
    try {
      const completed = localStorage.getItem(GESTURE_TUTORIAL_STORAGE_KEY) === 'true';
      if (completed) setHasCompletedOnce(true);
      if (!completed) {
        const timer = setTimeout(() => setShowTutorial(true), 1500);
        return () => clearTimeout(timer);
      }
    } catch {
      setShowTutorial(true);
    }
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(GESTURE_TUTORIAL_STORAGE_KEY, 'true');
    localStorage.removeItem(GESTURE_TUTORIAL_SKIPPED_KEY);
    setHasCompletedOnce(true);
    setShowTutorial(false);
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem(GESTURE_TUTORIAL_STORAGE_KEY);
    localStorage.removeItem(GESTURE_TUTORIAL_SKIPPED_KEY);
    setShowTutorial(true);
  }, []);

  const skipTutorial = useCallback(() => {
    localStorage.setItem(GESTURE_TUTORIAL_SKIPPED_KEY, 'true');
    setShowTutorial(false);
  }, []);

  const openTutorial = useCallback(() => {
    localStorage.removeItem(GESTURE_TUTORIAL_STORAGE_KEY);
    localStorage.removeItem(GESTURE_TUTORIAL_SKIPPED_KEY);
    setShowTutorial(true);
  }, []);

  const value: GestureTutorialContextValue = {
    showTutorial,
    completeTutorial,
    skipTutorial,
    resetTutorial,
    openTutorial,
    hasCompletedOnce,
  };

  return (
    <GestureTutorialContext.Provider value={value}>
      {children}
    </GestureTutorialContext.Provider>
  );
}

export function useGestureTutorial(): GestureTutorialContextValue {
  const ctx = useContext(GestureTutorialContext);
  if (!ctx) {
    throw new Error('useGestureTutorial must be used within GestureTutorialProvider');
  }
  return ctx;
}
