import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type UIDensity = 'compact' | 'default' | 'comfortable';
export type ThemePack = 'default' | 'lunar' | 'night' | 'focus' | 'energy' | 'nature';

interface AccessibilityState {
  // UI Density
  uiDensity: UIDensity;
  
  // Accessibility Features
  reducedMotion: boolean;
  highContrast: boolean;
  voiceControlEnabled: boolean;
  
  // Personalization
  themePack: ThemePack;
  fontSize: number; // multiplier: 0.85, 1, 1.15, 1.3
  
  // Gesture preferences
  gestureNavEnabled: boolean;
  hapticFeedback: boolean;
}

interface AccessibilityContextType extends AccessibilityState {
  setUIDensity: (density: UIDensity) => void;
  setReducedMotion: (enabled: boolean) => void;
  setHighContrast: (enabled: boolean) => void;
  setVoiceControl: (enabled: boolean) => void;
  setThemePack: (theme: ThemePack) => void;
  setFontSize: (size: number) => void;
  setGestureNav: (enabled: boolean) => void;
  setHapticFeedback: (enabled: boolean) => void;
  triggerHaptic: (type: 'light' | 'medium' | 'heavy') => void;
}

const defaultState: AccessibilityState = {
  uiDensity: 'default',
  reducedMotion: false,
  highContrast: false,
  voiceControlEnabled: false,
  themePack: 'default',
  fontSize: 1,
  gestureNavEnabled: true,
  hapticFeedback: true,
};

const AccessibilityContext = createContext<AccessibilityContextType | undefined>(undefined);

export function useAccessibility() {
  const context = useContext(AccessibilityContext);
  if (!context) {
    throw new Error('useAccessibility must be used within AccessibilityProvider');
  }
  return context;
}

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AccessibilityState>(() => {
    const saved = localStorage.getItem('visuai-accessibility');
    if (saved) {
      try {
        return { ...defaultState, ...JSON.parse(saved) };
      } catch {
        return defaultState;
      }
    }
    return defaultState;
  });

  // Detect system preferences
  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    
    setState(s => ({
      ...s,
      reducedMotion: motionQuery.matches || s.reducedMotion,
      highContrast: contrastQuery.matches || s.highContrast,
    }));

    const handleMotionChange = (e: MediaQueryListEvent) => {
      setState(s => ({ ...s, reducedMotion: e.matches }));
    };
    
    motionQuery.addEventListener('change', handleMotionChange);
    return () => motionQuery.removeEventListener('change', handleMotionChange);
  }, []);

  // Apply UI density class to document
  useEffect(() => {
    document.documentElement.classList.remove('ui-compact', 'ui-comfortable');
    if (state.uiDensity === 'compact') {
      document.documentElement.classList.add('ui-compact');
    } else if (state.uiDensity === 'comfortable') {
      document.documentElement.classList.add('ui-comfortable');
    }
  }, [state.uiDensity]);

  // Apply high contrast
  useEffect(() => {
    document.documentElement.classList.toggle('high-contrast', state.highContrast);
  }, [state.highContrast]);

  // Apply theme pack class
  useEffect(() => {
    const themes = ['theme-default', 'theme-lunar', 'theme-night', 'theme-focus', 'theme-energy', 'theme-nature'];
    themes.forEach(t => document.documentElement.classList.remove(t));
    document.documentElement.classList.add(`theme-${state.themePack}`);
  }, [state.themePack]);

  // Apply font size
  useEffect(() => {
    document.documentElement.style.fontSize = `${state.fontSize * 100}%`;
  }, [state.fontSize]);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('visuai-accessibility', JSON.stringify(state));
  }, [state]);

  const setUIDensity = useCallback((density: UIDensity) => {
    setState(s => ({ ...s, uiDensity: density }));
  }, []);

  const setReducedMotion = useCallback((enabled: boolean) => {
    setState(s => ({ ...s, reducedMotion: enabled }));
  }, []);

  const setHighContrast = useCallback((enabled: boolean) => {
    setState(s => ({ ...s, highContrast: enabled }));
  }, []);

  const setVoiceControl = useCallback((enabled: boolean) => {
    setState(s => ({ ...s, voiceControlEnabled: enabled }));
  }, []);

  const setThemePack = useCallback((theme: ThemePack) => {
    setState(s => ({ ...s, themePack: theme }));
  }, []);

  const setFontSize = useCallback((size: number) => {
    setState(s => ({ ...s, fontSize: size }));
  }, []);

  const setGestureNav = useCallback((enabled: boolean) => {
    setState(s => ({ ...s, gestureNavEnabled: enabled }));
  }, []);

  const setHapticFeedback = useCallback((enabled: boolean) => {
    setState(s => ({ ...s, hapticFeedback: enabled }));
  }, []);

  const triggerHaptic = useCallback((type: 'light' | 'medium' | 'heavy') => {
    if (!state.hapticFeedback || !navigator.vibrate) return;
    
    const patterns = {
      light: [10],
      medium: [25],
      heavy: [50, 30, 50],
    };
    
    navigator.vibrate(patterns[type]);
  }, [state.hapticFeedback]);

  return (
    <AccessibilityContext.Provider
      value={{
        ...state,
        setUIDensity,
        setReducedMotion,
        setHighContrast,
        setVoiceControl,
        setThemePack,
        setFontSize,
        setGestureNav,
        setHapticFeedback,
        triggerHaptic,
      }}
    >
      {children}
    </AccessibilityContext.Provider>
  );
}
