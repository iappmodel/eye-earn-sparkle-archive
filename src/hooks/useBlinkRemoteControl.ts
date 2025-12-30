import { useState, useEffect, useRef, useCallback } from 'react';
import { useBlinkDetection } from './useBlinkDetection';
import { useGazeDirection, GazeDirection } from './useGazeDirection';

// Storage keys
export const BLINK_COMMANDS_KEY = 'app_blink_commands';
export const GAZE_COMMANDS_KEY = 'app_gaze_commands';
export const REMOTE_CONTROL_SETTINGS_KEY = 'app_remote_control_settings';

export type BlinkAction = 'click' | 'longPress' | 'toggle' | 'none';
export type GazeNavigationAction = 'nextVideo' | 'prevVideo' | 'friendsFeed' | 'promoFeed' | 'none';

export interface BlinkCommand {
  buttonId: string;
  singleBlink: BlinkAction;
  doubleBlink: BlinkAction;
  tripleBlink: BlinkAction;
}

export interface GazeCommand {
  direction: GazeDirection;
  action: GazeNavigationAction;
  enabled: boolean;
}

export interface RemoteControlSettings {
  enabled: boolean;
  sensitivity: number; // 1-10
  gazeHoldTime: number; // ms to confirm target (ghost mode activation)
  blinkPatternTimeout: number; // ms to complete pattern
  ghostOpacity: number; // 0.3-0.5 for ghost mode
  edgeThreshold: number; // How far eyes need to move to trigger navigation
  rapidMovementEnabled: boolean;
}

export interface GhostButton {
  buttonId: string;
  element: HTMLElement;
  rect: DOMRect;
  activationProgress: number; // 0-1, where 1 = fully activated (ghost mode)
  isGhost: boolean;
}

interface GazeTarget {
  buttonId: string;
  element: HTMLElement;
  rect: DOMRect;
}

interface RemoteControlState {
  isActive: boolean;
  isCalibrating: boolean;
  currentTarget: GazeTarget | null;
  gazePosition: { x: number; y: number } | null;
  pendingBlinkCount: number;
  lastAction: string | null;
  calibrationStep: number;
  ghostButtons: Map<string, GhostButton>;
  lastNavigationAction: GazeNavigationAction | null;
}

interface UseBlinkRemoteControlOptions {
  enabled?: boolean;
  onAction?: (buttonId: string, action: BlinkAction, blinkCount: number) => void;
  onNavigate?: (action: GazeNavigationAction, direction: GazeDirection) => void;
}

const DEFAULT_SETTINGS: RemoteControlSettings = {
  enabled: false,
  sensitivity: 5,
  gazeHoldTime: 800,
  blinkPatternTimeout: 600,
  ghostOpacity: 0.4,
  edgeThreshold: 0.35,
  rapidMovementEnabled: true,
};

const DEFAULT_GAZE_COMMANDS: GazeCommand[] = [
  { direction: 'left', action: 'friendsFeed', enabled: true },
  { direction: 'right', action: 'promoFeed', enabled: true },
  { direction: 'up', action: 'prevVideo', enabled: true },
  { direction: 'down', action: 'nextVideo', enabled: true },
];

// Load/save functions
export const loadBlinkCommands = (): Record<string, BlinkCommand> => {
  try {
    const saved = localStorage.getItem(BLINK_COMMANDS_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

export const saveBlinkCommands = (commands: Record<string, BlinkCommand>) => {
  localStorage.setItem(BLINK_COMMANDS_KEY, JSON.stringify(commands));
  window.dispatchEvent(new CustomEvent('blinkCommandsChanged'));
};

export const loadGazeCommands = (): GazeCommand[] => {
  try {
    const saved = localStorage.getItem(GAZE_COMMANDS_KEY);
    return saved ? JSON.parse(saved) : DEFAULT_GAZE_COMMANDS;
  } catch {
    return DEFAULT_GAZE_COMMANDS;
  }
};

export const saveGazeCommands = (commands: GazeCommand[]) => {
  localStorage.setItem(GAZE_COMMANDS_KEY, JSON.stringify(commands));
  window.dispatchEvent(new CustomEvent('gazeCommandsChanged'));
};

export const loadRemoteControlSettings = (): RemoteControlSettings => {
  try {
    const saved = localStorage.getItem(REMOTE_CONTROL_SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveRemoteControlSettings = (settings: RemoteControlSettings) => {
  localStorage.setItem(REMOTE_CONTROL_SETTINGS_KEY, JSON.stringify(settings));
  window.dispatchEvent(new CustomEvent('remoteControlSettingsChanged'));
};

export const getBlinkCommand = (buttonId: string): BlinkCommand => {
  const commands = loadBlinkCommands();
  return commands[buttonId] || {
    buttonId,
    singleBlink: 'click',
    doubleBlink: 'longPress',
    tripleBlink: 'toggle',
  };
};

export const setBlinkCommand = (buttonId: string, command: Partial<BlinkCommand>) => {
  const commands = loadBlinkCommands();
  commands[buttonId] = {
    ...getBlinkCommand(buttonId),
    ...command,
    buttonId,
  };
  saveBlinkCommands(commands);
};

export const getGazeCommand = (direction: GazeDirection): GazeCommand => {
  const commands = loadGazeCommands();
  return commands.find(c => c.direction === direction) || {
    direction,
    action: 'none',
    enabled: false,
  };
};

export const setGazeCommand = (direction: GazeDirection, action: GazeNavigationAction, enabled: boolean) => {
  const commands = loadGazeCommands();
  const index = commands.findIndex(c => c.direction === direction);
  if (index >= 0) {
    commands[index] = { direction, action, enabled };
  } else {
    commands.push({ direction, action, enabled });
  }
  saveGazeCommands(commands);
};

export function useBlinkRemoteControl(options: UseBlinkRemoteControlOptions = {}) {
  const { enabled = false, onAction, onNavigate } = options;
  
  const [state, setState] = useState<RemoteControlState>({
    isActive: false,
    isCalibrating: false,
    currentTarget: null,
    gazePosition: null,
    pendingBlinkCount: 0,
    lastAction: null,
    calibrationStep: 0,
    ghostButtons: new Map(),
    lastNavigationAction: null,
  });
  
  const [settings, setSettings] = useState<RemoteControlSettings>(loadRemoteControlSettings);
  const [gazeCommands, setGazeCommands] = useState<GazeCommand[]>(loadGazeCommands);
  
  // Refs
  const registeredButtonsRef = useRef<Map<string, HTMLElement>>(new Map());
  const gazeConfirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ghostActivationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const onActionRef = useRef(onAction);
  const onNavigateRef = useRef(onNavigate);
  const calibrationPointsRef = useRef<{ x: number; y: number }[]>([]);
  const gazeOffsetRef = useRef({ x: 0, y: 0 });
  const navigationCooldownRef = useRef<number>(0);
  
  useEffect(() => {
    onActionRef.current = onAction;
    onNavigateRef.current = onNavigate;
  }, [onAction, onNavigate]);
  
  // Reload settings when changed
  useEffect(() => {
    const handleSettingsChange = () => setSettings(loadRemoteControlSettings());
    const handleGazeCommandsChange = () => setGazeCommands(loadGazeCommands());
    
    window.addEventListener('remoteControlSettingsChanged', handleSettingsChange);
    window.addEventListener('gazeCommandsChanged', handleGazeCommandsChange);
    return () => {
      window.removeEventListener('remoteControlSettingsChanged', handleSettingsChange);
      window.removeEventListener('gazeCommandsChanged', handleGazeCommandsChange);
    };
  }, []);
  
  // Handle rapid gaze movement for navigation
  const handleRapidMovement = useCallback((direction: GazeDirection) => {
    if (!settings.rapidMovementEnabled) return;
    
    const now = Date.now();
    if (now - navigationCooldownRef.current < 1000) return;
    
    const command = gazeCommands.find(c => c.direction === direction && c.enabled);
    if (command && command.action !== 'none') {
      navigationCooldownRef.current = now;
      onNavigateRef.current?.(command.action, direction);
      
      setState(prev => ({
        ...prev,
        lastNavigationAction: command.action,
        lastAction: `👁 ${direction} → ${command.action}`,
      }));
      
      // Clear the action display after a moment
      setTimeout(() => {
        setState(prev => ({ ...prev, lastNavigationAction: null }));
      }, 1500);
    }
  }, [gazeCommands, settings.rapidMovementEnabled]);
  
  // Gaze direction tracking
  const {
    currentDirection,
    normalizedPosition,
    updateGazePosition: updateGazeDir,
  } = useGazeDirection({
    enabled: enabled && settings.enabled,
    edgeThreshold: settings.edgeThreshold,
    onRapidMovement: handleRapidMovement,
  });
  
  // Execute action when blink pattern is detected
  const handleBlinkPattern = useCallback((count: number) => {
    const target = state.currentTarget;
    if (!target) {
      console.log('[RemoteControl] No target for blink pattern');
      setState(prev => ({ ...prev, pendingBlinkCount: 0 }));
      return;
    }
    
    const command = getBlinkCommand(target.buttonId);
    let action: BlinkAction = 'none';
    
    switch (count) {
      case 1:
        action = command.singleBlink;
        break;
      case 2:
        action = command.doubleBlink;
        break;
      case 3:
        action = command.tripleBlink;
        break;
      default:
        action = 'none';
    }
    
    if (action !== 'none') {
      console.log('[RemoteControl] Executing:', action, 'on', target.buttonId);
      
      // Execute the action
      executeAction(target.element, action);
      
      onActionRef.current?.(target.buttonId, action, count);
      
      setState(prev => ({
        ...prev,
        pendingBlinkCount: 0,
        lastAction: `${count}× blink → ${action}`,
      }));
    } else {
      setState(prev => ({ ...prev, pendingBlinkCount: 0 }));
    }
  }, [state.currentTarget]);
  
  const executeAction = useCallback((element: HTMLElement, action: BlinkAction) => {
    switch (action) {
      case 'click':
        element.click();
        break;
      case 'longPress':
        const longPressEvent = new CustomEvent('longpress', { bubbles: true });
        element.dispatchEvent(longPressEvent);
        const pointerDown = new PointerEvent('pointerdown', { bubbles: true });
        element.dispatchEvent(pointerDown);
        setTimeout(() => {
          const pointerUp = new PointerEvent('pointerup', { bubbles: true });
          element.dispatchEvent(pointerUp);
        }, 500);
        break;
      case 'toggle':
        element.click();
        break;
    }
  }, []);
  
  // Track blink
  const handleBlink = useCallback(() => {
    setState(prev => ({
      ...prev,
      pendingBlinkCount: prev.pendingBlinkCount + 1,
    }));
  }, []);
  
  // Blink detection
  const {
    isDetecting,
    eyeOpenness,
    blinkCount,
  } = useBlinkDetection({
    enabled: enabled && settings.enabled,
    patternTimeout: settings.blinkPatternTimeout,
    onBlink: handleBlink,
    onBlinkPattern: handleBlinkPattern,
  });
  
  // Update gaze from camera
  const updateGazeFromCamera = useCallback((canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    let sumX = 0, sumY = 0, count = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        
        if (r > 60 && g > 40 && b > 20 && r > g && r > b) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    
    if (count > 100) {
      const faceCenterX = sumX / count / canvas.width;
      const faceCenterY = sumY / count / canvas.height;
      
      const sensitivity = settings.sensitivity / 5;
      const screenX = window.innerWidth * (1 - faceCenterX) * sensitivity + gazeOffsetRef.current.x;
      const screenY = window.innerHeight * faceCenterY * sensitivity + gazeOffsetRef.current.y;
      
      const clampedX = Math.max(0, Math.min(window.innerWidth, screenX));
      const clampedY = Math.max(0, Math.min(window.innerHeight, screenY));
      
      // Update gaze direction tracking
      updateGazeDir(clampedX, clampedY);
      
      setState(prev => ({
        ...prev,
        gazePosition: { x: clampedX, y: clampedY },
      }));
    }
  }, [settings.sensitivity, updateGazeDir]);
  
  // Find button at gaze position
  const findButtonAtPosition = useCallback((x: number, y: number): GazeTarget | null => {
    for (const [buttonId, element] of registeredButtonsRef.current) {
      const rect = element.getBoundingClientRect();
      const padding = 20;
      if (
        x >= rect.left - padding &&
        x <= rect.right + padding &&
        y >= rect.top - padding &&
        y <= rect.bottom + padding
      ) {
        return { buttonId, element, rect };
      }
    }
    return null;
  }, []);
  
  // Update ghost buttons based on gaze position
  const updateGhostButtons = useCallback((gazeX: number, gazeY: number) => {
    const newGhostButtons = new Map<string, GhostButton>();
    
    for (const [buttonId, element] of registeredButtonsRef.current) {
      const rect = element.getBoundingClientRect();
      const padding = 30;
      
      const isNear = (
        gazeX >= rect.left - padding &&
        gazeX <= rect.right + padding &&
        gazeY >= rect.top - padding &&
        gazeY <= rect.bottom + padding
      );
      
      const existingGhost = state.ghostButtons.get(buttonId);
      
      if (isNear) {
        // Start or continue ghost activation
        if (!ghostActivationTimersRef.current.has(buttonId)) {
          // Start activation timer
          const timer = setTimeout(() => {
            setState(prev => {
              const updated = new Map(prev.ghostButtons);
              const ghost = updated.get(buttonId);
              if (ghost) {
                ghost.isGhost = true;
                ghost.activationProgress = 1;
              }
              return { ...prev, ghostButtons: updated, currentTarget: { buttonId, element, rect } };
            });
          }, settings.gazeHoldTime);
          
          ghostActivationTimersRef.current.set(buttonId, timer);
        }
        
        newGhostButtons.set(buttonId, {
          buttonId,
          element,
          rect,
          activationProgress: existingGhost?.activationProgress || 0,
          isGhost: existingGhost?.isGhost || false,
        });
      } else {
        // Clear activation timer if looking away
        const timer = ghostActivationTimersRef.current.get(buttonId);
        if (timer) {
          clearTimeout(timer);
          ghostActivationTimersRef.current.delete(buttonId);
        }
      }
    }
    
    setState(prev => ({ ...prev, ghostButtons: newGhostButtons }));
  }, [settings.gazeHoldTime, state.ghostButtons]);
  
  // Update target when gaze position changes
  useEffect(() => {
    if (!state.gazePosition || !enabled || !settings.enabled) return;
    
    updateGhostButtons(state.gazePosition.x, state.gazePosition.y);
  }, [state.gazePosition, enabled, settings.enabled, updateGhostButtons]);
  
  // Register a button for remote control
  const registerButton = useCallback((buttonId: string, element: HTMLElement) => {
    registeredButtonsRef.current.set(buttonId, element);
  }, []);
  
  const unregisterButton = useCallback((buttonId: string) => {
    registeredButtonsRef.current.delete(buttonId);
  }, []);
  
  // Activate/deactivate remote control
  const activate = useCallback(() => {
    setState(prev => ({ ...prev, isActive: true }));
    saveRemoteControlSettings({ ...settings, enabled: true });
  }, [settings]);
  
  const deactivate = useCallback(() => {
    // Clear all ghost timers
    ghostActivationTimersRef.current.forEach(timer => clearTimeout(timer));
    ghostActivationTimersRef.current.clear();
    
    setState(prev => ({ 
      ...prev, 
      isActive: false, 
      currentTarget: null,
      gazePosition: null,
      pendingBlinkCount: 0,
      ghostButtons: new Map(),
    }));
    saveRemoteControlSettings({ ...settings, enabled: false });
  }, [settings]);
  
  const toggleActive = useCallback(() => {
    if (state.isActive) {
      deactivate();
    } else {
      activate();
    }
  }, [state.isActive, activate, deactivate]);
  
  // Calibration
  const startCalibration = useCallback(() => {
    calibrationPointsRef.current = [];
    setState(prev => ({ ...prev, isCalibrating: true, calibrationStep: 0 }));
  }, []);
  
  const recordCalibrationPoint = useCallback((screenX: number, screenY: number) => {
    if (state.gazePosition) {
      calibrationPointsRef.current.push({
        x: screenX - state.gazePosition.x,
        y: screenY - state.gazePosition.y,
      });
      
      if (calibrationPointsRef.current.length >= 4) {
        const avgX = calibrationPointsRef.current.reduce((a, b) => a + b.x, 0) / calibrationPointsRef.current.length;
        const avgY = calibrationPointsRef.current.reduce((a, b) => a + b.y, 0) / calibrationPointsRef.current.length;
        gazeOffsetRef.current = { x: avgX, y: avgY };
        
        setState(prev => ({ ...prev, isCalibrating: false, calibrationStep: 0 }));
      } else {
        setState(prev => ({ ...prev, calibrationStep: prev.calibrationStep + 1 }));
      }
    }
  }, [state.gazePosition]);
  
  const cancelCalibration = useCallback(() => {
    setState(prev => ({ ...prev, isCalibrating: false, calibrationStep: 0 }));
  }, []);
  
  // Update settings
  const updateSettings = useCallback((newSettings: Partial<RemoteControlSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    saveRemoteControlSettings(updated);
  }, [settings]);
  
  // Update gaze command
  const updateGazeCommand = useCallback((direction: GazeDirection, action: GazeNavigationAction, enabled: boolean) => {
    setGazeCommand(direction, action, enabled);
  }, []);
  
  // Sync active state with detection
  useEffect(() => {
    setState(prev => ({ ...prev, isActive: isDetecting }));
  }, [isDetecting]);
  
  return {
    ...state,
    settings,
    gazeCommands,
    eyeOpenness,
    blinkCount,
    currentDirection,
    normalizedPosition,
    registerButton,
    unregisterButton,
    activate,
    deactivate,
    toggleActive,
    startCalibration,
    recordCalibrationPoint,
    cancelCalibration,
    updateSettings,
    updateGazeCommand,
  };
}
