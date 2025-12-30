import { useState, useEffect, useRef, useCallback } from 'react';
import { GazeDirection } from './useGazeDirection';

// Storage keys
export const GESTURE_COMBOS_KEY = 'app_gesture_combos';

export type GestureStep = 
  | { type: 'direction'; direction: GazeDirection }
  | { type: 'blink'; count: 1 | 2 | 3 }
  | { type: 'hold'; duration: number }; // Hold gaze for X ms

export type ComboAction = 
  | 'like'
  | 'comment'
  | 'share'
  | 'follow'
  | 'nextVideo'
  | 'prevVideo'
  | 'friendsFeed'
  | 'promoFeed'
  | 'openSettings'
  | 'toggleMute'
  | 'save'
  | 'none';

export interface GestureCombo {
  id: string;
  name: string;
  description: string;
  steps: GestureStep[];
  action: ComboAction;
  enabled: boolean;
}

interface GestureComboState {
  isTracking: boolean;
  currentSteps: GestureStep[];
  lastMatchedCombo: GestureCombo | null;
  matchProgress: number; // 0-1
}

interface UseGestureCombosOptions {
  enabled?: boolean;
  comboTimeout?: number; // Time window to complete combo (ms)
  onComboExecuted?: (combo: GestureCombo) => void;
}

// Default combos
const DEFAULT_COMBOS: GestureCombo[] = [
  {
    id: 'quick-like',
    name: 'Quick Like',
    description: 'Look right, then blink twice',
    steps: [
      { type: 'direction', direction: 'right' },
      { type: 'blink', count: 2 },
    ],
    action: 'like',
    enabled: true,
  },
  {
    id: 'quick-share',
    name: 'Quick Share',
    description: 'Look left, then blink twice',
    steps: [
      { type: 'direction', direction: 'left' },
      { type: 'blink', count: 2 },
    ],
    action: 'share',
    enabled: true,
  },
  {
    id: 'save-video',
    name: 'Save Video',
    description: 'Look up, then blink three times',
    steps: [
      { type: 'direction', direction: 'up' },
      { type: 'blink', count: 3 },
    ],
    action: 'save',
    enabled: true,
  },
  {
    id: 'open-comments',
    name: 'Open Comments',
    description: 'Look down, blink once, look up',
    steps: [
      { type: 'direction', direction: 'down' },
      { type: 'blink', count: 1 },
      { type: 'direction', direction: 'up' },
    ],
    action: 'comment',
    enabled: false,
  },
  {
    id: 'follow-creator',
    name: 'Follow Creator',
    description: 'Blink twice, look right, blink once',
    steps: [
      { type: 'blink', count: 2 },
      { type: 'direction', direction: 'right' },
      { type: 'blink', count: 1 },
    ],
    action: 'follow',
    enabled: false,
  },
];

// Load/save functions
export const loadGestureCombos = (): GestureCombo[] => {
  try {
    const saved = localStorage.getItem(GESTURE_COMBOS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_COMBOS;
  } catch {
    return DEFAULT_COMBOS;
  }
};

export const saveGestureCombos = (combos: GestureCombo[]) => {
  localStorage.setItem(GESTURE_COMBOS_KEY, JSON.stringify(combos));
  window.dispatchEvent(new CustomEvent('gestureCombosChanged'));
};

export const getComboById = (id: string): GestureCombo | undefined => {
  return loadGestureCombos().find(c => c.id === id);
};

export const updateCombo = (id: string, updates: Partial<GestureCombo>) => {
  const combos = loadGestureCombos();
  const index = combos.findIndex(c => c.id === id);
  if (index >= 0) {
    combos[index] = { ...combos[index], ...updates };
    saveGestureCombos(combos);
  }
};

export const addCombo = (combo: Omit<GestureCombo, 'id'>) => {
  const combos = loadGestureCombos();
  const newCombo: GestureCombo = {
    ...combo,
    id: `custom-${Date.now()}`,
  };
  combos.push(newCombo);
  saveGestureCombos(combos);
  return newCombo;
};

export const removeCombo = (id: string) => {
  const combos = loadGestureCombos().filter(c => c.id !== id);
  saveGestureCombos(combos);
};

// Check if two steps match
const stepsMatch = (a: GestureStep, b: GestureStep): boolean => {
  if (a.type !== b.type) return false;
  
  switch (a.type) {
    case 'direction':
      return (b as typeof a).direction === a.direction;
    case 'blink':
      return (b as typeof a).count === a.count;
    case 'hold':
      return true; // Hold is checked via duration
    default:
      return false;
  }
};

export function useGestureCombos(options: UseGestureCombosOptions = {}) {
  const {
    enabled = false,
    comboTimeout = 3000,
    onComboExecuted,
  } = options;

  const [state, setState] = useState<GestureComboState>({
    isTracking: false,
    currentSteps: [],
    lastMatchedCombo: null,
    matchProgress: 0,
  });

  const [combos, setCombos] = useState<GestureCombo[]>(loadGestureCombos);
  
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentStepsRef = useRef<GestureStep[]>([]);
  const onComboExecutedRef = useRef(onComboExecuted);
  
  useEffect(() => {
    onComboExecutedRef.current = onComboExecuted;
  }, [onComboExecuted]);

  // Reload combos when changed
  useEffect(() => {
    const handleChange = () => setCombos(loadGestureCombos());
    window.addEventListener('gestureCombosChanged', handleChange);
    return () => window.removeEventListener('gestureCombosChanged', handleChange);
  }, []);

  // Reset combo tracking
  const resetTracking = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    currentStepsRef.current = [];
    setState(prev => ({
      ...prev,
      currentSteps: [],
      matchProgress: 0,
    }));
  }, []);

  // Check if current steps match any combo
  const checkForMatch = useCallback((): GestureCombo | null => {
    const steps = currentStepsRef.current;
    const enabledCombos = combos.filter(c => c.enabled);
    
    for (const combo of enabledCombos) {
      if (steps.length !== combo.steps.length) continue;
      
      let matches = true;
      for (let i = 0; i < steps.length; i++) {
        if (!stepsMatch(steps[i], combo.steps[i])) {
          matches = false;
          break;
        }
      }
      
      if (matches) return combo;
    }
    
    return null;
  }, [combos]);

  // Check if current steps are a prefix of any combo
  const getMatchProgress = useCallback((): { progress: number; potentialCombos: GestureCombo[] } => {
    const steps = currentStepsRef.current;
    if (steps.length === 0) return { progress: 0, potentialCombos: [] };
    
    const enabledCombos = combos.filter(c => c.enabled);
    const potentialCombos: GestureCombo[] = [];
    let maxProgress = 0;
    
    for (const combo of enabledCombos) {
      if (steps.length > combo.steps.length) continue;
      
      let matches = true;
      for (let i = 0; i < steps.length; i++) {
        if (!stepsMatch(steps[i], combo.steps[i])) {
          matches = false;
          break;
        }
      }
      
      if (matches) {
        potentialCombos.push(combo);
        const progress = steps.length / combo.steps.length;
        if (progress > maxProgress) maxProgress = progress;
      }
    }
    
    return { progress: maxProgress, potentialCombos };
  }, [combos]);

  // Add a new step to the current sequence
  const addStep = useCallback((step: GestureStep) => {
    if (!enabled) return;
    
    // Clear timeout and set new one
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    
    timeoutRef.current = setTimeout(() => {
      resetTracking();
    }, comboTimeout);
    
    // Add step
    currentStepsRef.current = [...currentStepsRef.current, step];
    
    // Check for complete match
    const matchedCombo = checkForMatch();
    if (matchedCombo) {
      console.log('[GestureCombos] Combo matched:', matchedCombo.name);
      onComboExecutedRef.current?.(matchedCombo);
      
      setState(prev => ({
        ...prev,
        currentSteps: currentStepsRef.current,
        lastMatchedCombo: matchedCombo,
        matchProgress: 1,
      }));
      
      // Reset after successful match
      setTimeout(resetTracking, 500);
      return;
    }
    
    // Check progress
    const { progress, potentialCombos } = getMatchProgress();
    
    // If no potential matches, reset
    if (potentialCombos.length === 0) {
      resetTracking();
      return;
    }
    
    setState(prev => ({
      ...prev,
      isTracking: true,
      currentSteps: currentStepsRef.current,
      matchProgress: progress,
    }));
  }, [enabled, comboTimeout, checkForMatch, getMatchProgress, resetTracking]);

  // Convenience methods for adding specific step types
  const addDirectionStep = useCallback((direction: GazeDirection) => {
    if (direction === 'center') return; // Ignore center
    addStep({ type: 'direction', direction });
  }, [addStep]);

  const addBlinkStep = useCallback((count: 1 | 2 | 3) => {
    addStep({ type: 'blink', count });
  }, [addStep]);

  // Cleanup
  useEffect(() => {
    if (!enabled) {
      resetTracking();
    }
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [enabled, resetTracking]);

  return {
    ...state,
    combos,
    enabledCombos: combos.filter(c => c.enabled),
    addStep,
    addDirectionStep,
    addBlinkStep,
    resetTracking,
    updateCombo,
    addCombo,
    removeCombo,
  };
}

// Helper to describe a step in human-readable form
export const describeStep = (step: GestureStep): string => {
  switch (step.type) {
    case 'direction':
      return `Look ${step.direction}`;
    case 'blink':
      return `Blink ${step.count}×`;
    case 'hold':
      return `Hold for ${step.duration}ms`;
    default:
      return 'Unknown step';
  }
};

// Helper to describe a full combo
export const describeCombo = (combo: GestureCombo): string => {
  return combo.steps.map(describeStep).join(' → ');
};

// Action labels for UI
export const COMBO_ACTION_LABELS: Record<ComboAction, string> = {
  like: 'Like Video',
  comment: 'Open Comments',
  share: 'Share',
  follow: 'Follow Creator',
  nextVideo: 'Next Video',
  prevVideo: 'Previous Video',
  friendsFeed: 'Friends Feed',
  promoFeed: 'Promo Feed',
  openSettings: 'Open Settings',
  toggleMute: 'Toggle Mute',
  save: 'Save Video',
  none: 'No Action',
};
