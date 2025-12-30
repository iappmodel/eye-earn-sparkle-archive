import { useState, useEffect, useRef, useCallback } from 'react';
import { useBlinkDetection } from './useBlinkDetection';
import { useGazeDirection, GazeDirection } from './useGazeDirection';

// Storage keys
export const BLINK_COMMANDS_KEY = 'app_blink_commands';
export const GAZE_COMMANDS_KEY = 'app_gaze_commands';
export const REMOTE_CONTROL_SETTINGS_KEY = 'app_remote_control_settings';
export const CALIBRATION_DATA_KEY = 'app_remote_control_calibration';

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

export interface CalibrationData {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  isCalibrated: boolean;
  calibratedAt: number;
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

interface CalibrationPoint {
  screenX: number;
  screenY: number;
  gazeX: number;
  gazeY: number;
}

interface RemoteControlState {
  isActive: boolean;
  isCalibrating: boolean;
  currentTarget: GazeTarget | null;
  gazePosition: { x: number; y: number } | null;
  rawGazePosition: { x: number; y: number } | null;
  pendingBlinkCount: number;
  lastAction: string | null;
  calibrationStep: number;
  calibrationPoints: CalibrationPoint[];
  ghostButtons: Map<string, GhostButton>;
  lastNavigationAction: GazeNavigationAction | null;
  isCameraActive: boolean;
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

const DEFAULT_CALIBRATION: CalibrationData = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  isCalibrated: false,
  calibratedAt: 0,
};

const DEFAULT_GAZE_COMMANDS: GazeCommand[] = [
  { direction: 'left', action: 'friendsFeed', enabled: true },
  { direction: 'right', action: 'promoFeed', enabled: true },
  { direction: 'up', action: 'prevVideo', enabled: true },
  { direction: 'down', action: 'nextVideo', enabled: true },
];

// Calibration point positions (screen corners + center)
const CALIBRATION_TARGETS = [
  { x: 0.1, y: 0.15, label: 'Top Left' },
  { x: 0.9, y: 0.15, label: 'Top Right' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.1, y: 0.85, label: 'Bottom Left' },
  { x: 0.9, y: 0.85, label: 'Bottom Right' },
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

export const loadCalibrationData = (): CalibrationData => {
  try {
    const saved = localStorage.getItem(CALIBRATION_DATA_KEY);
    return saved ? { ...DEFAULT_CALIBRATION, ...JSON.parse(saved) } : DEFAULT_CALIBRATION;
  } catch {
    return DEFAULT_CALIBRATION;
  }
};

export const saveCalibrationData = (data: CalibrationData) => {
  localStorage.setItem(CALIBRATION_DATA_KEY, JSON.stringify(data));
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

export { CALIBRATION_TARGETS };

export function useBlinkRemoteControl(options: UseBlinkRemoteControlOptions = {}) {
  const { enabled = false, onAction, onNavigate } = options;
  
  const [state, setState] = useState<RemoteControlState>({
    isActive: false,
    isCalibrating: false,
    currentTarget: null,
    gazePosition: null,
    rawGazePosition: null,
    pendingBlinkCount: 0,
    lastAction: null,
    calibrationStep: 0,
    calibrationPoints: [],
    ghostButtons: new Map(),
    lastNavigationAction: null,
    isCameraActive: false,
  });
  
  const [settings, setSettings] = useState<RemoteControlSettings>(loadRemoteControlSettings);
  const [gazeCommands, setGazeCommands] = useState<GazeCommand[]>(loadGazeCommands);
  const [calibration, setCalibration] = useState<CalibrationData>(loadCalibrationData);
  
  // Refs
  const registeredButtonsRef = useRef<Map<string, HTMLElement>>(new Map());
  const ghostActivationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const onActionRef = useRef(onAction);
  const onNavigateRef = useRef(onNavigate);
  const navigationCooldownRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const trackingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const smoothedPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  
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

  // Process raw gaze from camera feed and apply calibration
  const processGazePosition = useCallback((rawX: number, rawY: number) => {
    // Apply calibration
    const calibratedX = (rawX - 0.5) * calibration.scaleX + 0.5 + calibration.offsetX;
    const calibratedY = (rawY - 0.5) * calibration.scaleY + 0.5 + calibration.offsetY;
    
    // Apply sensitivity
    const sensitivity = settings.sensitivity / 5;
    
    // Map to screen coordinates
    const screenX = calibratedX * window.innerWidth * sensitivity + (window.innerWidth * (1 - sensitivity) / 2);
    const screenY = calibratedY * window.innerHeight * sensitivity + (window.innerHeight * (1 - sensitivity) / 2);
    
    // Smooth the position
    const smoothing = 0.3;
    smoothedPositionRef.current = {
      x: smoothedPositionRef.current.x * (1 - smoothing) + screenX * smoothing,
      y: smoothedPositionRef.current.y * (1 - smoothing) + screenY * smoothing,
    };
    
    const clampedX = Math.max(0, Math.min(window.innerWidth, smoothedPositionRef.current.x));
    const clampedY = Math.max(0, Math.min(window.innerHeight, smoothedPositionRef.current.y));
    
    // Update gaze direction tracking
    updateGazeDir(clampedX, clampedY);
    
    setState(prev => ({
      ...prev,
      rawGazePosition: { x: rawX * window.innerWidth, y: rawY * window.innerHeight },
      gazePosition: { x: clampedX, y: clampedY },
    }));
    
    return { x: clampedX, y: clampedY };
  }, [calibration, settings.sensitivity, updateGazeDir]);

  // Extract face/eye position from camera frame
  const detectFacePosition = useCallback((imageData: ImageData): { x: number; y: number } | null => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    
    let sumX = 0, sumY = 0, count = 0;
    
    // Detect skin-tone pixels (simple face detection)
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        
        // Basic skin tone detection
        if (r > 60 && g > 40 && b > 20 && 
            r > g && r > b && 
            Math.abs(r - g) > 15 &&
            r - b > 15) {
          sumX += x;
          sumY += y;
          count++;
        }
      }
    }
    
    if (count < 500) return null; // Not enough skin pixels
    
    // Normalize to 0-1
    const faceCenterX = sumX / count / width;
    const faceCenterY = sumY / count / height;
    
    // Mirror X axis (camera is mirrored)
    return { x: 1 - faceCenterX, y: faceCenterY };
  }, []);

  // Start camera for gaze tracking
  const startCamera = useCallback(async () => {
    if (streamRef.current) return;
    
    try {
      console.log('[RemoteControl] Starting camera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      
      streamRef.current = stream;
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;
      
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvasRef.current = canvas;
      
      await video.play();
      
      setState(prev => ({ ...prev, isCameraActive: true }));
      
      console.log('[RemoteControl] Camera started');
      
      // Start tracking loop
      trackingIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const imageData = ctx.getImageData(0, 0, 320, 240);
        
        const facePos = detectFacePosition(imageData);
        if (facePos) {
          processGazePosition(facePos.x, facePos.y);
        }
      }, 50); // 20fps
      
    } catch (error) {
      console.error('[RemoteControl] Camera error:', error);
    }
  }, [detectFacePosition, processGazePosition]);

  // Stop camera
  const stopCamera = useCallback(() => {
    console.log('[RemoteControl] Stopping camera...');
    
    if (trackingIntervalRef.current) {
      clearInterval(trackingIntervalRef.current);
      trackingIntervalRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    
    setState(prev => ({ ...prev, isCameraActive: false }));
  }, []);

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
        if (!ghostActivationTimersRef.current.has(buttonId)) {
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
    startCamera();
    setState(prev => ({ ...prev, isActive: true }));
    saveRemoteControlSettings({ ...settings, enabled: true });
  }, [settings, startCamera]);
  
  const deactivate = useCallback(() => {
    stopCamera();
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
  }, [settings, stopCamera]);
  
  const toggleActive = useCallback(() => {
    if (state.isActive) {
      deactivate();
    } else {
      activate();
    }
  }, [state.isActive, activate, deactivate]);
  
  // Calibration functions
  const startCalibration = useCallback(async () => {
    // Ensure camera is running
    if (!streamRef.current) {
      await startCamera();
    }
    
    setState(prev => ({ 
      ...prev, 
      isCalibrating: true, 
      calibrationStep: 0,
      calibrationPoints: [],
    }));
  }, [startCamera]);
  
  const recordCalibrationPoint = useCallback((screenX: number, screenY: number) => {
    const currentStep = state.calibrationStep;
    const target = CALIBRATION_TARGETS[currentStep];
    
    if (!target || !state.rawGazePosition) {
      console.log('[RemoteControl] No target or gaze position for calibration');
      return;
    }
    
    const newPoint: CalibrationPoint = {
      screenX: target.x,
      screenY: target.y,
      gazeX: state.rawGazePosition.x / window.innerWidth,
      gazeY: state.rawGazePosition.y / window.innerHeight,
    };
    
    const newPoints = [...state.calibrationPoints, newPoint];
    
    console.log('[RemoteControl] Calibration point recorded:', currentStep, newPoint);
    
    if (currentStep >= CALIBRATION_TARGETS.length - 1) {
      // Complete calibration - calculate offsets and scales
      const avgGazeX = newPoints.reduce((a, p) => a + p.gazeX, 0) / newPoints.length;
      const avgGazeY = newPoints.reduce((a, p) => a + p.gazeY, 0) / newPoints.length;
      const avgScreenX = newPoints.reduce((a, p) => a + p.screenX, 0) / newPoints.length;
      const avgScreenY = newPoints.reduce((a, p) => a + p.screenY, 0) / newPoints.length;
      
      // Calculate scale factors
      let scaleX = 1, scaleY = 1;
      const gazeRangeX = Math.max(...newPoints.map(p => p.gazeX)) - Math.min(...newPoints.map(p => p.gazeX));
      const gazeRangeY = Math.max(...newPoints.map(p => p.gazeY)) - Math.min(...newPoints.map(p => p.gazeY));
      const screenRangeX = Math.max(...newPoints.map(p => p.screenX)) - Math.min(...newPoints.map(p => p.screenX));
      const screenRangeY = Math.max(...newPoints.map(p => p.screenY)) - Math.min(...newPoints.map(p => p.screenY));
      
      if (gazeRangeX > 0.1) scaleX = screenRangeX / gazeRangeX;
      if (gazeRangeY > 0.1) scaleY = screenRangeY / gazeRangeY;
      
      const newCalibration: CalibrationData = {
        offsetX: avgScreenX - avgGazeX,
        offsetY: avgScreenY - avgGazeY,
        scaleX: Math.max(0.5, Math.min(2, scaleX)),
        scaleY: Math.max(0.5, Math.min(2, scaleY)),
        isCalibrated: true,
        calibratedAt: Date.now(),
      };
      
      console.log('[RemoteControl] Calibration complete:', newCalibration);
      
      setCalibration(newCalibration);
      saveCalibrationData(newCalibration);
      
      setState(prev => ({ 
        ...prev, 
        isCalibrating: false, 
        calibrationStep: 0,
        calibrationPoints: [],
        lastAction: 'Calibration complete!',
      }));
    } else {
      setState(prev => ({ 
        ...prev, 
        calibrationStep: prev.calibrationStep + 1,
        calibrationPoints: newPoints,
      }));
    }
  }, [state.calibrationStep, state.rawGazePosition, state.calibrationPoints]);
  
  const cancelCalibration = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isCalibrating: false, 
      calibrationStep: 0,
      calibrationPoints: [],
    }));
  }, []);

  const resetCalibration = useCallback(() => {
    setCalibration(DEFAULT_CALIBRATION);
    saveCalibrationData(DEFAULT_CALIBRATION);
    setState(prev => ({ ...prev, lastAction: 'Calibration reset' }));
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
  
  // Auto-start camera when enabled
  useEffect(() => {
    if (enabled && settings.enabled && !streamRef.current) {
      startCamera();
    } else if ((!enabled || !settings.enabled) && streamRef.current) {
      stopCamera();
    }
  }, [enabled, settings.enabled, startCamera, stopCamera]);
  
  // Sync active state with detection
  useEffect(() => {
    setState(prev => ({ ...prev, isActive: isDetecting || state.isCameraActive }));
  }, [isDetecting, state.isCameraActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopCamera();
      ghostActivationTimersRef.current.forEach(timer => clearTimeout(timer));
    };
  }, [stopCamera]);
  
  return {
    ...state,
    settings,
    gazeCommands,
    calibration,
    eyeOpenness,
    blinkCount,
    currentDirection,
    normalizedPosition,
    calibrationTargets: CALIBRATION_TARGETS,
    registerButton,
    unregisterButton,
    activate,
    deactivate,
    toggleActive,
    startCalibration,
    recordCalibrationPoint,
    cancelCalibration,
    resetCalibration,
    updateSettings,
    updateGazeCommand,
  };
}
