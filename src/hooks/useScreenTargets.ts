import { useState, useEffect, useCallback } from 'react';
import { ComboAction, COMBO_ACTION_LABELS } from './useGestureCombos';

// --- Types ---

export type GestureTrigger =
  | 'singleBlink'
  | 'doubleBlink'
  | 'tripleBlink'
  | 'lipRaiseLeft'
  | 'lipRaiseRight'
  | 'faceTurnLeft'
  | 'faceTurnRight'
  | 'eyebrowLeftLift'
  | 'eyebrowRightLift'
  | 'eyebrowsBothLift'
  | 'smirkSmile'
  | 'fullSmile'
  | 'slowBlink'
  | 'gazeActivated'
  | 'gazeAndBlink'
  | 'screenTap'
  | 'screenDoubleTap'
  | 'phoneTiltLeft'
  | 'phoneTiltRight'
  | 'phoneTiltForward'
  | 'phoneTiltBack';

export type AppCommand = ComboAction;

export interface ScreenTarget {
  id: string;
  label: string;
  command: AppCommand;
  trigger: GestureTrigger;
  position: { x: number; y: number }; // 0-1 normalized
  size: number; // radius in % of screen width, default 8
  enabled: boolean;
  createdAt: number;
}

export interface TargetBehaviorRecord {
  targetId: string;
  hits: number;
  misses: number;
  lastUsed: number;
}

export interface BehaviorData {
  records: Record<string, TargetBehaviorRecord>;
  manualActions: Record<string, number>; // action -> count today
  lastReset: number; // daily reset timestamp
}

export interface TargetSuggestion {
  id: string;
  type: 'add' | 'move' | 'remove';
  message: string;
  command?: AppCommand;
  trigger?: GestureTrigger;
  position?: { x: number; y: number };
}

// --- Storage ---

const TARGETS_KEY = 'app_screen_targets';
const BEHAVIOR_KEY = 'app_target_behavior';

export const loadTargets = (): ScreenTarget[] => {
  try {
    const saved = localStorage.getItem(TARGETS_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveTargets = (targets: ScreenTarget[]) => {
  localStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
  window.dispatchEvent(new CustomEvent('screenTargetsChanged'));
};

const loadBehavior = (): BehaviorData => {
  try {
    const saved = localStorage.getItem(BEHAVIOR_KEY);
    if (saved) {
      const data = JSON.parse(saved) as BehaviorData;
      // Reset daily counts if new day
      const today = new Date().toDateString();
      const lastResetDate = new Date(data.lastReset).toDateString();
      if (today !== lastResetDate) {
        return { records: data.records, manualActions: {}, lastReset: Date.now() };
      }
      return data;
    }
    return { records: {}, manualActions: {}, lastReset: Date.now() };
  } catch {
    return { records: {}, manualActions: {}, lastReset: Date.now() };
  }
};

const saveBehavior = (data: BehaviorData) => {
  localStorage.setItem(BEHAVIOR_KEY, JSON.stringify(data));
};

// --- Trigger labels for UI ---

export const TRIGGER_LABELS: Record<GestureTrigger, string> = {
  singleBlink: 'Single Blink',
  doubleBlink: 'Double Blink',
  tripleBlink: 'Triple Blink',
  lipRaiseLeft: 'Left Lip Raise',
  lipRaiseRight: 'Right Lip Raise',
  faceTurnLeft: 'Face Turn Left',
  faceTurnRight: 'Face Turn Right',
  eyebrowLeftLift: 'Left Eyebrow Lift',
  eyebrowRightLift: 'Right Eyebrow Lift',
  eyebrowsBothLift: 'Both Eyebrows Lift',
  smirkSmile: 'Smirk',
  fullSmile: 'Full Smile',
  slowBlink: 'Slow Blink',
  gazeActivated: 'Gaze (look at it)',
  gazeAndBlink: 'Look + Blink',
  screenTap: 'Screen Tap',
  screenDoubleTap: 'Screen Double Tap',
  phoneTiltLeft: 'Tilt Phone Left',
  phoneTiltRight: 'Tilt Phone Right',
  phoneTiltForward: 'Tilt Phone Forward',
  phoneTiltBack: 'Tilt Phone Back',
};

export const TRIGGER_CATEGORIES: { label: string; triggers: GestureTrigger[] }[] = [
  {
    label: 'Eyes',
    triggers: ['singleBlink', 'doubleBlink', 'tripleBlink', 'slowBlink', 'gazeActivated', 'gazeAndBlink'],
  },
  {
    label: 'Face',
    triggers: ['lipRaiseLeft', 'lipRaiseRight', 'faceTurnLeft', 'faceTurnRight', 'eyebrowLeftLift', 'eyebrowRightLift', 'eyebrowsBothLift', 'smirkSmile', 'fullSmile'],
  },
  {
    label: 'Touch & Motion',
    triggers: ['screenTap', 'screenDoubleTap', 'phoneTiltLeft', 'phoneTiltRight', 'phoneTiltForward', 'phoneTiltBack'],
  },
];

// --- Preset Layouts ---

export interface TargetPreset {
  id: string;
  name: string;
  description: string;
  targets: Omit<ScreenTarget, 'id' | 'createdAt'>[];
}

export const TARGET_PRESETS: TargetPreset[] = [
  {
    id: 'quick-actions',
    name: 'Quick Actions',
    description: 'Like, Share, Save, Comment in the corners',
    targets: [
      { label: 'Like', command: 'like', trigger: 'singleBlink', position: { x: 0.85, y: 0.75 }, size: 10, enabled: true },
      { label: 'Share', command: 'share', trigger: 'doubleBlink', position: { x: 0.85, y: 0.2 }, size: 10, enabled: true },
      { label: 'Save', command: 'save', trigger: 'gazeAndBlink', position: { x: 0.85, y: 0.5 }, size: 10, enabled: true },
      { label: 'Comment', command: 'comment', trigger: 'lipRaiseLeft', position: { x: 0.15, y: 0.75 }, size: 10, enabled: true },
    ],
  },
  {
    id: 'navigation',
    name: 'Navigation',
    description: 'Navigate between content and feeds',
    targets: [
      { label: 'Next', command: 'nextVideo', trigger: 'singleBlink', position: { x: 0.5, y: 0.9 }, size: 12, enabled: true },
      { label: 'Previous', command: 'prevVideo', trigger: 'singleBlink', position: { x: 0.5, y: 0.1 }, size: 12, enabled: true },
      { label: 'Friends', command: 'friendsFeed', trigger: 'faceTurnLeft', position: { x: 0.1, y: 0.5 }, size: 10, enabled: true },
      { label: 'Promos', command: 'promoFeed', trigger: 'faceTurnRight', position: { x: 0.9, y: 0.5 }, size: 10, enabled: true },
    ],
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Just Like and Next',
    targets: [
      { label: 'Like', command: 'like', trigger: 'singleBlink', position: { x: 0.85, y: 0.85 }, size: 12, enabled: true },
      { label: 'Next', command: 'nextVideo', trigger: 'doubleBlink', position: { x: 0.15, y: 0.85 }, size: 12, enabled: true },
    ],
  },
  {
    id: 'power-user',
    name: 'Power User',
    description: 'Full control grid with 8 targets',
    targets: [
      { label: 'Like', command: 'like', trigger: 'singleBlink', position: { x: 0.85, y: 0.75 }, size: 8, enabled: true },
      { label: 'Share', command: 'share', trigger: 'doubleBlink', position: { x: 0.85, y: 0.25 }, size: 8, enabled: true },
      { label: 'Save', command: 'save', trigger: 'gazeAndBlink', position: { x: 0.85, y: 0.5 }, size: 8, enabled: true },
      { label: 'Comment', command: 'comment', trigger: 'lipRaiseLeft', position: { x: 0.15, y: 0.75 }, size: 8, enabled: true },
      { label: 'Next', command: 'nextVideo', trigger: 'faceTurnRight', position: { x: 0.5, y: 0.9 }, size: 8, enabled: true },
      { label: 'Prev', command: 'prevVideo', trigger: 'faceTurnLeft', position: { x: 0.5, y: 0.1 }, size: 8, enabled: true },
      { label: 'Wallet', command: 'openWallet', trigger: 'eyebrowsBothLift', position: { x: 0.15, y: 0.25 }, size: 8, enabled: true },
      { label: 'Settings', command: 'openSettings', trigger: 'tripleBlink', position: { x: 0.15, y: 0.5 }, size: 8, enabled: true },
    ],
  },
];

// --- Hit Testing ---

export const getTargetAtPosition = (
  targets: ScreenTarget[],
  gazeX: number,
  gazeY: number,
  screenWidth: number,
  screenHeight: number
): ScreenTarget | null => {
  const normalizedX = gazeX / screenWidth;
  const normalizedY = gazeY / screenHeight;

  for (const target of targets) {
    if (!target.enabled) continue;
    const dx = normalizedX - target.position.x;
    const dy = normalizedY - target.position.y;
    const radiusNormalized = target.size / 100;
    if (Math.sqrt(dx * dx + dy * dy) <= radiusNormalized) {
      return target;
    }
  }
  return null;
};

// --- Hook ---

export function useScreenTargets() {
  const [targets, setTargets] = useState<ScreenTarget[]>(loadTargets);
  const [behavior, setBehavior] = useState<BehaviorData>(loadBehavior);

  // Sync on external changes
  useEffect(() => {
    const handleChange = () => setTargets(loadTargets());
    window.addEventListener('screenTargetsChanged', handleChange);
    return () => window.removeEventListener('screenTargetsChanged', handleChange);
  }, []);

  const addTarget = useCallback((target: Omit<ScreenTarget, 'id' | 'createdAt'>) => {
    const newTarget: ScreenTarget = {
      ...target,
      id: `target-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
    };
    const updated = [...targets, newTarget];
    setTargets(updated);
    saveTargets(updated);
    return newTarget;
  }, [targets]);

  const removeTarget = useCallback((id: string) => {
    const updated = targets.filter(t => t.id !== id);
    setTargets(updated);
    saveTargets(updated);
  }, [targets]);

  const updateTarget = useCallback((id: string, updates: Partial<ScreenTarget>) => {
    const updated = targets.map(t => t.id === id ? { ...t, ...updates } : t);
    setTargets(updated);
    saveTargets(updated);
  }, [targets]);

  const applyPreset = useCallback((presetId: string) => {
    const preset = TARGET_PRESETS.find(p => p.id === presetId);
    if (!preset) return;
    const newTargets: ScreenTarget[] = preset.targets.map((t, i) => ({
      ...t,
      id: `preset-${presetId}-${i}-${Date.now()}`,
      createdAt: Date.now(),
    }));
    setTargets(newTargets);
    saveTargets(newTargets);
  }, []);

  const clearAll = useCallback(() => {
    setTargets([]);
    saveTargets([]);
  }, []);

  // Behavioral learning
  const recordInteraction = useCallback((targetId: string, hit: boolean) => {
    setBehavior(prev => {
      const record = prev.records[targetId] || { targetId, hits: 0, misses: 0, lastUsed: 0 };
      const updated: BehaviorData = {
        ...prev,
        records: {
          ...prev.records,
          [targetId]: {
            ...record,
            hits: hit ? record.hits + 1 : record.hits,
            misses: hit ? record.misses : record.misses + 1,
            lastUsed: Date.now(),
          },
        },
      };
      saveBehavior(updated);
      return updated;
    });
  }, []);

  const recordManualAction = useCallback((action: string) => {
    setBehavior(prev => {
      const updated: BehaviorData = {
        ...prev,
        manualActions: {
          ...prev.manualActions,
          [action]: (prev.manualActions[action] || 0) + 1,
        },
      };
      saveBehavior(updated);
      return updated;
    });
  }, []);

  const getSuggestions = useCallback((): TargetSuggestion[] => {
    const suggestions: TargetSuggestion[] = [];
    const existingCommands = new Set(targets.map(t => t.command));

    // Suggest adding targets for frequently manual actions
    Object.entries(behavior.manualActions).forEach(([action, count]) => {
      if (count >= 5 && !existingCommands.has(action as AppCommand)) {
        const label = COMBO_ACTION_LABELS[action as AppCommand] || action;
        suggestions.push({
          id: `suggest-add-${action}`,
          type: 'add',
          message: `You've used "${label}" ${count} times today — add a target?`,
          command: action as AppCommand,
          trigger: 'gazeAndBlink',
          position: { x: 0.5, y: 0.5 },
        });
      }
    });

    // Suggest moving targets with low accuracy
    Object.values(behavior.records).forEach(record => {
      const total = record.hits + record.misses;
      if (total >= 10 && record.hits / total < 0.5) {
        const target = targets.find(t => t.id === record.targetId);
        if (target) {
          suggestions.push({
            id: `suggest-move-${record.targetId}`,
            type: 'move',
            message: `"${target.label}" has low accuracy (${Math.round((record.hits / total) * 100)}%) — try repositioning it`,
          });
        }
      }
    });

    return suggestions;
  }, [targets, behavior]);

  return {
    targets,
    enabledTargets: targets.filter(t => t.enabled),
    addTarget,
    removeTarget,
    updateTarget,
    applyPreset,
    clearAll,
    recordInteraction,
    recordManualAction,
    getSuggestions,
    behavior,
  };
}
