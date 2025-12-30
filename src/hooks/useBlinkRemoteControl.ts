import { useState, useEffect, useRef, useCallback } from 'react';
import { useBlinkDetection } from './useBlinkDetection';

// Storage key for blink commands
export const BLINK_COMMANDS_KEY = 'app_blink_commands';
export const REMOTE_CONTROL_SETTINGS_KEY = 'app_remote_control_settings';

export type BlinkAction = 'click' | 'longPress' | 'toggle' | 'none';

export interface BlinkCommand {
  buttonId: string;
  singleBlink: BlinkAction;
  doubleBlink: BlinkAction;
  tripleBlink: BlinkAction;
}

export interface RemoteControlSettings {
  enabled: boolean;
  sensitivity: number; // 1-10
  gazeHoldTime: number; // ms to confirm target
  blinkPatternTimeout: number; // ms to complete pattern
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
}

interface UseBlinkRemoteControlOptions {
  enabled?: boolean;
  onAction?: (buttonId: string, action: BlinkAction, blinkCount: number) => void;
}

const DEFAULT_SETTINGS: RemoteControlSettings = {
  enabled: false,
  sensitivity: 5,
  gazeHoldTime: 500,
  blinkPatternTimeout: 600,
};

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

export function useBlinkRemoteControl(options: UseBlinkRemoteControlOptions = {}) {
  const { enabled = false, onAction } = options;
  
  const [state, setState] = useState<RemoteControlState>({
    isActive: false,
    isCalibrating: false,
    currentTarget: null,
    gazePosition: null,
    pendingBlinkCount: 0,
    lastAction: null,
    calibrationStep: 0,
  });
  
  const [settings, setSettings] = useState<RemoteControlSettings>(loadRemoteControlSettings);
  
  // Refs
  const registeredButtonsRef = useRef<Map<string, HTMLElement>>(new Map());
  const gazeConfirmTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const onActionRef = useRef(onAction);
  const calibrationPointsRef = useRef<{ x: number; y: number }[]>([]);
  const gazeOffsetRef = useRef({ x: 0, y: 0 });
  
  useEffect(() => {
    onActionRef.current = onAction;
  }, [onAction]);
  
  // Reload settings when changed
  useEffect(() => {
    const handleSettingsChange = () => {
      setSettings(loadRemoteControlSettings());
    };
    window.addEventListener('remoteControlSettingsChanged', handleSettingsChange);
    return () => window.removeEventListener('remoteControlSettingsChanged', handleSettingsChange);
  }, []);
  
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
        lastAction: `${count}x → ${action}`,
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
        // Dispatch long press event
        const longPressEvent = new CustomEvent('longpress', { bubbles: true });
        element.dispatchEvent(longPressEvent);
        // Also trigger pointerdown for components that listen to that
        const pointerDown = new PointerEvent('pointerdown', { bubbles: true });
        element.dispatchEvent(pointerDown);
        setTimeout(() => {
          const pointerUp = new PointerEvent('pointerup', { bubbles: true });
          element.dispatchEvent(pointerUp);
        }, 500);
        break;
      case 'toggle':
        // For toggle, simulate click twice with delay
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
  
  // Estimate gaze position based on face position in camera
  // This is a simplified version - real gaze tracking would use more sophisticated methods
  const updateGazeFromCamera = useCallback((canvas: HTMLCanvasElement, video: HTMLVideoElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    
    // Find center of face (bright region in center)
    let sumX = 0, sumY = 0, count = 0;
    
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        
        // Skin tone detection
        if (r > 60 && g > 40 && b > 20 && r > g && r > b) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    
    if (count > 100) {
      // Face center in camera (0-1)
      const faceCenterX = sumX / count / canvas.width;
      const faceCenterY = sumY / count / canvas.height;
      
      // Map to screen position (inverted X because camera is mirrored)
      // Apply sensitivity and calibration offset
      const sensitivity = settings.sensitivity / 5;
      const screenX = window.innerWidth * (1 - faceCenterX) * sensitivity + gazeOffsetRef.current.x;
      const screenY = window.innerHeight * faceCenterY * sensitivity + gazeOffsetRef.current.y;
      
      setState(prev => ({
        ...prev,
        gazePosition: {
          x: Math.max(0, Math.min(window.innerWidth, screenX)),
          y: Math.max(0, Math.min(window.innerHeight, screenY)),
        },
      }));
    }
  }, [settings.sensitivity]);
  
  // Find button at gaze position
  const findButtonAtPosition = useCallback((x: number, y: number): GazeTarget | null => {
    for (const [buttonId, element] of registeredButtonsRef.current) {
      const rect = element.getBoundingClientRect();
      // Add some padding for easier targeting
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
  
  // Update target when gaze position changes
  useEffect(() => {
    if (!state.gazePosition || !enabled || !settings.enabled) return;
    
    const target = findButtonAtPosition(state.gazePosition.x, state.gazePosition.y);
    
    if (target?.buttonId !== state.currentTarget?.buttonId) {
      // Clear any pending confirmation
      if (gazeConfirmTimeoutRef.current) {
        clearTimeout(gazeConfirmTimeoutRef.current);
      }
      
      if (target) {
        // Start confirmation timer
        gazeConfirmTimeoutRef.current = setTimeout(() => {
          setState(prev => ({
            ...prev,
            currentTarget: target,
          }));
        }, settings.gazeHoldTime);
      } else {
        setState(prev => ({
          ...prev,
          currentTarget: null,
        }));
      }
    }
  }, [state.gazePosition, enabled, settings.enabled, settings.gazeHoldTime, findButtonAtPosition, state.currentTarget?.buttonId]);
  
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
    setState(prev => ({ 
      ...prev, 
      isActive: false, 
      currentTarget: null,
      gazePosition: null,
      pendingBlinkCount: 0,
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
        // Calculate average offset
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
  
  // Sync active state with detection
  useEffect(() => {
    setState(prev => ({ ...prev, isActive: isDetecting }));
  }, [isDetecting]);
  
  return {
    ...state,
    settings,
    eyeOpenness,
    blinkCount,
    registerButton,
    unregisterButton,
    activate,
    deactivate,
    toggleActive,
    startCalibration,
    recordCalibrationPoint,
    cancelCalibration,
    updateSettings,
  };
}
