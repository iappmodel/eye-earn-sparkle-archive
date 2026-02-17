import { useState, useEffect, useRef, useCallback } from 'react';
import { useGazeDirection, GazeDirection } from './useGazeDirection';
import { useVisionEngine } from './useVisionEngine';
import { useVision, USE_VISION_CONTEXT } from '@/contexts/VisionContext';
import { logger } from '@/lib/logger';
import { fetchProfileCalibration, saveProfileCalibration } from '@/services/calibration.service';
import { securityService } from '@/services/security.service';

// Storage keys
export const BLINK_COMMANDS_KEY = 'app_blink_commands';
export const GESTURE_THRESHOLDS_KEY = 'app_gesture_thresholds';

/** Derive gesture thresholds from FacialExpressionScanning result for persistence */
export function deriveGestureThresholdsFromExpressions(expressions: { type: string; captured: boolean }[]): Record<string, number> {
  const captured = new Set(expressions.filter((e) => e.captured).map((e) => e.type));
  const thresholds: Record<string, number> = {};
  if (captured.has('tilt-left') || captured.has('tilt-right')) thresholds.headTurn = 6;
  if (captured.has('lift-lips')) thresholds.lipRaise = 0.010;
  if (captured.has('surprised')) thresholds.eyebrowLift = 0.18;
  if (captured.has('happy') || captured.has('smiling') || captured.has('smirk')) thresholds.smileRatio = 0.12;
  return thresholds;
}
export const GAZE_COMMANDS_KEY = 'app_gaze_commands';
export const REMOTE_CONTROL_SETTINGS_KEY = 'app_remote_control_settings';
export const CALIBRATION_DATA_KEY = 'app_remote_control_calibration';

// Special command ID used for global default blink mappings
export const GLOBAL_BLINK_COMMAND_ID = '__global__';

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

/** 2D affine params: targetX = a*gazeX + b*gazeY + c, targetY = d*gazeX + e*gazeY + f */
export type AffineParams = [number, number, number, number, number, number];

export interface CalibrationData {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  isCalibrated: boolean;
  calibratedAt: number;
  autoCalibrationEnabled: boolean;
  autoAdjustments: number;
  /** 2D affine mapping for better accuracy (Phase 2). When present, used instead of offset+scale. */
  affineParams?: AffineParams;
  /** Personalized slow blink range (ms) from training. Defaults: 400–2000 */
  slowBlinkMinMs?: number;
  slowBlinkMaxMs?: number;
}

export interface AutoCalibrationState {
  clickHistory: { gazeX: number; gazeY: number; targetX: number; targetY: number; timestamp: number }[];
  lastAdjustment: number;
}

export interface RemoteControlSettings {
  enabled: boolean;
  sensitivity: number; // 1-10
  gazeHoldTime: number; // ms to confirm target (ghost mode activation)
  blinkPatternTimeout: number; // ms to complete pattern
  ghostOpacity: number; // 0.3-0.5 for ghost mode
  edgeThreshold: number; // How far eyes need to move to trigger navigation
  rapidMovementEnabled: boolean;
  gazeReach: number; // 0.8-2.4 scale for iris range
  mirrorX: boolean;
  invertY: boolean;
  tiltEnabled: boolean;
  tiltSensitivity: number; // 1-10
  /** Use 16-point calibration for better gaze accuracy (Phase 2) */
  extendedGazeCalibration?: boolean;
  /** Vision backend: face_mesh (legacy) or face_landmarker (Phase 3) */
  visionBackend?: 'face_mesh' | 'face_landmarker';
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
  userId?: string | null;
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
  gazeReach: 1.6,
  mirrorX: true,
  invertY: true,
  tiltEnabled: false,
  tiltSensitivity: 5,
};

const DEFAULT_CALIBRATION: CalibrationData = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  isCalibrated: false,
  calibratedAt: 0,
  autoCalibrationEnabled: true,
  autoAdjustments: 0,
};

const AUTO_CALIBRATION_STORAGE_KEY = 'app_remote_control_auto_calibration';

const DEFAULT_GAZE_COMMANDS: GazeCommand[] = [
  { direction: 'left', action: 'friendsFeed', enabled: true },
  { direction: 'right', action: 'promoFeed', enabled: true },
  { direction: 'up', action: 'prevVideo', enabled: true },
  { direction: 'down', action: 'nextVideo', enabled: true },
];

// Calibration point positions (9 positions in specified order)
const CALIBRATION_TARGETS = [
  { x: 0.1, y: 0.1, label: 'Top Left' },
  { x: 0.9, y: 0.1, label: 'Top Right' },
  { x: 0.1, y: 0.5, label: 'Middle Left' },
  { x: 0.9, y: 0.5, label: 'Middle Right' },
  { x: 0.1, y: 0.9, label: 'Bottom Left' },
  { x: 0.9, y: 0.9, label: 'Bottom Right' },
  { x: 0.5, y: 0.1, label: 'Top Middle' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.5, y: 0.9, label: 'Bottom Middle' },
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

/** Solve 3x3 system Mx=v. Returns null if singular. */
function solve3x3(M: number[][], v: number[]): [number, number, number] | null {
  const a = M.map((r) => [...r]);
  const b = [...v];
  for (let col = 0; col < 3; col++) {
    let maxRow = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(a[r][col]) > Math.abs(a[maxRow][col])) maxRow = r;
    }
    [a[col], a[maxRow]] = [a[maxRow], a[col]];
    [b[col], b[maxRow]] = [b[maxRow], b[col]];
    if (Math.abs(a[col][col]) < 1e-10) return null;
    for (let r = col + 1; r < 3; r++) {
      const f = a[r][col] / a[col][col];
      for (let c = col; c < 3; c++) a[r][c] -= f * a[col][c];
      b[r] -= f * b[col];
    }
  }
  const x = [0, 0, 0];
  for (let i = 2; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < 3; j++) s -= a[i][j] * x[j];
    x[i] = s / a[i][i];
  }
  return [x[0], x[1], x[2]];
}

/** Fit 2D affine from (gazeX,gazeY)->(targetX,targetY). Returns null if <6 points or singular. */
function fitAffineFromPoints(
  points: Array<{ gazeX: number; gazeY: number; targetX: number; targetY: number }>
): AffineParams | null {
  if (points.length < 6) return null;
  const AtA = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  const AtbX = [0, 0, 0];
  const AtbY = [0, 0, 0];
  for (const p of points) {
    const row = [p.gazeX, p.gazeY, 1];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) AtA[i][j] += row[i] * row[j];
      AtbX[i] += row[i] * p.targetX;
      AtbY[i] += row[i] * p.targetY;
    }
  }
  const abc = solve3x3(AtA, AtbX);
  const def = solve3x3(AtA, AtbY);
  return abc && def ? ([...abc, ...def] as AffineParams) : null;
}

/** Apply calibration to raw gaze (0-1) → calibrated (0-1). Uses affine when available. */
export function applyCalibration(
  rawX: number,
  rawY: number,
  calibration: CalibrationData
): { x: number; y: number } {
  if (calibration.affineParams && calibration.affineParams.length === 6) {
    const [a, b, c, d, e, f] = calibration.affineParams;
    return {
      x: Math.max(0, Math.min(1, a * rawX + b * rawY + c)),
      y: Math.max(0, Math.min(1, d * rawX + e * rawY + f)),
    };
  }
  const calibratedX = (rawX - 0.5) * calibration.scaleX + 0.5 + calibration.offsetX;
  const calibratedY = (rawY - 0.5) * calibration.scaleY + 0.5 + calibration.offsetY;
  return {
    x: Math.max(0, Math.min(1, calibratedX)),
    y: Math.max(0, Math.min(1, calibratedY)),
  };
}

export const getBlinkCommand = (buttonId: string): BlinkCommand => {
  const commands = loadBlinkCommands();
  const specific = commands[buttonId];
  const globalDefault = commands[GLOBAL_BLINK_COMMAND_ID];

  const fallback = globalDefault || {
    buttonId: GLOBAL_BLINK_COMMAND_ID,
    singleBlink: 'click',
    doubleBlink: 'longPress',
    tripleBlink: 'toggle',
  };

  return specific || { ...fallback, buttonId };
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
  const { enabled = false, userId, onAction, onNavigate } = options;
  const visionCtx = useVision();
  const useContextPath = USE_VISION_CONTEXT && !!visionCtx;
  
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
  const remoteLoadedRef = useRef(false);
  const lastSyncedRef = useRef<string>('');
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [calibrationActive, setCalibrationActive] = useState(false);
  const calibrationActiveRef = useRef(false);
  const [suspended, setSuspended] = useState(false);
  const suspendedRef = useRef(false);
  
  // Refs
  const registeredButtonsRef = useRef<Map<string, HTMLElement>>(new Map());
  const ghostActivationTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const onActionRef = useRef(onAction);
  const onNavigateRef = useRef(onNavigate);
  const navigationCooldownRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const smoothedPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const autoCalibrationHistoryRef = useRef<{ gazeX: number; gazeY: number; targetX: number; targetY: number; timestamp: number }[]>([]);
  const lastAutoAdjustmentRef = useRef<number>(0);
  
  useEffect(() => {
    onActionRef.current = onAction;
    onNavigateRef.current = onNavigate;
  }, [onAction, onNavigate]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { active?: boolean } | undefined;
      calibrationActiveRef.current = Boolean(detail?.active);
      setCalibrationActive(calibrationActiveRef.current);
      if (calibrationActiveRef.current) {
        setState(prev => ({
          ...prev,
          gazePosition: null,
          rawGazePosition: null,
          currentTarget: null,
          ghostButtons: new Map(),
        }));
      }
    };
    window.addEventListener('calibrationMode', handler as EventListener);
    return () => window.removeEventListener('calibrationMode', handler as EventListener);
  }, []);

  
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
  
  const dispatchGestureTrigger = useCallback((trigger: string) => {
    try {
      window.dispatchEvent(new CustomEvent('remoteGestureTrigger', { detail: { trigger, timestamp: Date.now() } }));
    } catch {
      // ignore
    }
  }, []);

  // Execute action when blink pattern is detected
  const handleBlinkPattern = useCallback((count: number) => {
    // Broadcast blink patterns so other systems (e.g. screen targets) can react.
    try {
      window.dispatchEvent(new CustomEvent('remoteBlinkPattern', { detail: { count, timestamp: Date.now() } }));
      if (count === 1) dispatchGestureTrigger('bothBlink');
    } catch {
      // ignore
    }

    const target = state.currentTarget;
    if (!target) {
      logger.log('[RemoteControl] No target for blink pattern');
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
      logger.log('[RemoteControl] Executing:', action, 'on', target.buttonId);
      
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

  const handleLeftWink = useCallback(() => {
    dispatchGestureTrigger('leftWink');
  }, [dispatchGestureTrigger]);

  const handleRightWink = useCallback(() => {
    dispatchGestureTrigger('rightWink');
  }, [dispatchGestureTrigger]);
  
  // Legacy path: own camera + useVisionEngine when not using VisionContext
  const legacyVision = useVisionEngine({
    enabled: !useContextPath && enabled && settings.enabled && !calibrationActive && !suspended,
    videoRef,
    patternTimeout: settings.blinkPatternTimeout,
    mirrorX: settings.mirrorX,
    invertY: settings.invertY,
    gazeScale: settings.gazeReach,
    gazeSmoothing: 0.25,
    visionBackend: settings.visionBackend ?? 'face_mesh',
    onBlink: handleBlink,
    onBlinkPattern: handleBlinkPattern,
    onLeftWink: handleLeftWink,
    onRightWink: handleRightWink,
  });
  
  const vision = useContextPath ? (visionCtx?.visionState ?? legacyVision) : legacyVision;

  // Register blink handlers with VisionContext when using context path
  useEffect(() => {
    if (!useContextPath || !visionCtx) return;
    visionCtx.registerBlinkHandlers({
      onBlink: handleBlink,
      onBlinkPattern: handleBlinkPattern,
      onLeftWink: handleLeftWink,
      onRightWink: handleRightWink,
    });
    return () => {
      visionCtx.registerBlinkHandlers(null);
    };
  }, [useContextPath, visionCtx, handleBlink, handleBlinkPattern, handleLeftWink, handleRightWink]);

  const gestureCooldownRef = useRef<Record<string, number>>({});
  const smileBaselineRef = useRef<number | null>(null);
  const cornerBaselineRef = useRef<{ leftY: number; rightY: number } | null>(null);
  const browBaselineRef = useRef<{ left: number; right: number } | null>(null);
  const slowBlinkStateRef = useRef<{ closedAt: number; isClosed: boolean }>({ closedAt: 0, isClosed: false });
  // Configurable gesture thresholds (can be populated from calibration results)
  const savedGestureThresholds = useRef<{
    eyebrowLift?: number;
    headTurn?: number;
    lipRaise?: number;
    smileRatio?: number;
  }>({});

  useEffect(() => {
    let mounted = true;
    const loadDeviceId = async () => {
      try {
        const fingerprint = await securityService.generateFingerprint();
        if (mounted) setDeviceId(fingerprint);
      } catch {
        if (mounted) setDeviceId(null);
      }
    };

    void loadDeviceId();
    return () => {
      mounted = false;
    };
  }, []);

  // Load gesture thresholds saved during calibration
  useEffect(() => {
    try {
      const saved = localStorage.getItem('app_gesture_thresholds');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object') {
          savedGestureThresholds.current = parsed;
        }
      }
    } catch {
      // ignore
    }
  }, []);

  /** Merge and persist gesture thresholds from calibration flows (FacialExpressionScanning, etc.) */
  const mergeGestureThresholds = useCallback((partial: Record<string, number>) => {
    try {
      const existing = localStorage.getItem('app_gesture_thresholds');
      const current = existing ? { ...JSON.parse(existing) } : {};
      Object.assign(current, partial);
      localStorage.setItem('app_gesture_thresholds', JSON.stringify(current));
      savedGestureThresholds.current = current;
    } catch {
      // ignore
    }
  }, []);

  const persistCalibration = useCallback((data: CalibrationData) => {
    setCalibration(data);
    saveCalibrationData(data);
  }, []);

  // Load calibration from profile when signed in
  useEffect(() => {
    let cancelled = false;
    remoteLoadedRef.current = false;

    if (!userId) {
      return () => {
        cancelled = true;
      };
    }

    const load = async () => {
      const remote = await fetchProfileCalibration(userId, deviceId);
      if (cancelled) return;
      const local = loadCalibrationData();

      const remoteAt = remote?.calibratedAt ?? 0;
      const localAt = local?.calibratedAt ?? 0;
      const candidate = remoteAt >= localAt ? remote : local;

      if (candidate) {
        const merged: CalibrationData = { ...DEFAULT_CALIBRATION, ...candidate };
        persistCalibration(merged);
      }

      remoteLoadedRef.current = true;
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId, deviceId, persistCalibration]);

  // Sync calibration updates to profile
  useEffect(() => {
    if (!userId || !remoteLoadedRef.current) return;
    const serialized = JSON.stringify(calibration);
    if (serialized === lastSyncedRef.current) return;
    lastSyncedRef.current = serialized;
    void saveProfileCalibration(userId, calibration, deviceId);
  }, [calibration, userId, deviceId]);

  // Process raw gaze from camera feed and apply calibration (affine or offset+scale)
  const processGazePosition = useCallback((rawX: number, rawY: number) => {
    if (calibrationActiveRef.current || suspendedRef.current) return null;
    const calibrated = applyCalibration(rawX, rawY, calibration);
    const calibratedX = calibrated.x;
    const calibratedY = calibrated.y;
    
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

    // Broadcast gaze so overlays (targets) can do hit-testing.
    try {
      window.dispatchEvent(new CustomEvent('remoteGazePosition', { detail: { x: clampedX, y: clampedY, timestamp: Date.now() } }));
    } catch {
      // ignore
    }
    
    return { x: clampedX, y: clampedY };
  }, [calibration, settings.sensitivity, updateGazeDir]);

  // Landmark-based gesture triggers for targets
  useEffect(() => {
    if (!enabled || !settings.enabled) return;
    if (!vision.landmarks || !vision.faceBox) return;

    const landmarks = vision.landmarks;
    const getLm = (i: number) => landmarks[i];
    const dist = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot(a.x - b.x, a.y - b.y);

    const emit = (trigger: string) => {
      const now = Date.now();
      const last = gestureCooldownRef.current[trigger] || 0;
      if (now - last < 650) return;
      gestureCooldownRef.current[trigger] = now;
      try {
        window.dispatchEvent(new CustomEvent('remoteGestureTrigger', { detail: { trigger, timestamp: now } }));
      } catch {
        // ignore
      }
    };

    // EMA alpha: faster warm-up (0.90/0.10) to establish baseline in ~10 frames,
    // then slow adaptation (0.95/0.05). First value initializes immediately.
    const emaAlpha = 0.08;

    // Smile (mouth width ratio)
    const up = getLm(13);
    const low = getLm(14);
    const left = getLm(61);
    const right = getLm(291);
    if (up && low && left && right) {
      const horizontal = dist(left, right);
      const vertical = dist(up, low);
      if (vertical > 0) {
        const ratio = horizontal / vertical;
        const base = smileBaselineRef.current ?? ratio;
        const smoothed = base * (1 - emaAlpha) + ratio * emaAlpha;
        smileBaselineRef.current = smoothed;
        // Smile fires when mouth width exceeds baseline by 12%
        if (ratio > smoothed * 1.12) emit('fullSmile');
      }
    }

    // Smirk / lip raises (mouth corner lift — Y decreases when corner lifts)
    const corners = left && right ? { leftY: left.y, rightY: right.y } : null;
    if (corners) {
      const base = cornerBaselineRef.current ?? corners;
      const smoothed = {
        leftY: base.leftY * (1 - emaAlpha) + corners.leftY * emaAlpha,
        rightY: base.rightY * (1 - emaAlpha) + corners.rightY * emaAlpha,
      };
      cornerBaselineRef.current = smoothed;
      // Positive delta = corner lifted (lower Y)
      const leftDelta = smoothed.leftY - corners.leftY;
      const rightDelta = smoothed.rightY - corners.rightY;
      const lipThreshold = savedGestureThresholds.current.lipRaise ?? 0.012;
      const smirkThreshold = Math.min(lipThreshold, 0.008);
      if (Math.abs(leftDelta - rightDelta) > lipThreshold && (leftDelta > smirkThreshold || rightDelta > smirkThreshold)) {
        emit('smirkSmile');
      }
      if (leftDelta > lipThreshold) emit('lipRaiseLeft');
      if (rightDelta > lipThreshold) emit('lipRaiseRight');
    }

    // Eyebrow lifts (left/right/both)
    const lb = getLm(105);
    const rb = getLm(334);
    const lUp = getLm(159);
    const lLow = getLm(145);
    const rUp = getLm(386);
    const rLow = getLm(374);
    if (lb && rb && lUp && lLow && rUp && rLow) {
      const leftLift = Math.abs(lUp.y - lb.y) / Math.max(0.0001, Math.abs(lLow.y - lUp.y));
      const rightLift = Math.abs(rUp.y - rb.y) / Math.max(0.0001, Math.abs(rLow.y - rUp.y));
      const base = browBaselineRef.current ?? { left: leftLift, right: rightLift };
      const smoothed = {
        left: base.left * (1 - emaAlpha) + leftLift * emaAlpha,
        right: base.right * (1 - emaAlpha) + rightLift * emaAlpha,
      };
      browBaselineRef.current = smoothed;
      // Use saved calibration thresholds if available, else default 0.20
      const browThreshold = savedGestureThresholds.current.eyebrowLift ?? 0.20;
      if (leftLift > smoothed.left + browThreshold) emit('eyebrowLeftLift');
      if (rightLift > smoothed.right + browThreshold) emit('eyebrowRightLift');
      if (leftLift > smoothed.left + browThreshold && rightLift > smoothed.right + browThreshold) emit('eyebrowsBothLift');
    }

    // Head turn (use headYaw from vision engine for more accuracy)
    const headTurnThreshold = savedGestureThresholds.current.headTurn ?? 8; // degrees
    if (Math.abs(vision.headYaw) > headTurnThreshold) {
      if (vision.headYaw < -headTurnThreshold) emit('faceTurnLeft');
      if (vision.headYaw > headTurnThreshold) emit('faceTurnRight');
    }

    // Slow blink (long closure) – use personalized range from calibration when available
    const slowMin = calibration.slowBlinkMinMs ?? 400;
    const slowMax = calibration.slowBlinkMaxMs ?? 2000;
    const openness = vision.eyeOpenness;
    const now = Date.now();
    if (openness < 0.50 && !slowBlinkStateRef.current.isClosed) {
      slowBlinkStateRef.current = { isClosed: true, closedAt: now };
    } else if (openness > 0.80 && slowBlinkStateRef.current.isClosed) {
      const duration = now - slowBlinkStateRef.current.closedAt;
      slowBlinkStateRef.current = { isClosed: false, closedAt: 0 };
      if (duration >= slowMin && duration <= slowMax) emit('slowBlink');
    }
  }, [enabled, settings.enabled, calibration.slowBlinkMinMs, calibration.slowBlinkMaxMs, vision.landmarks, vision.faceBox, vision.eyeOpenness, vision.headYaw]);

  // Gaze is now provided by Vision Engine (landmark-based).

  const contextReleaseRef = useRef<(() => void) | null>(null);

  // Start camera for gaze tracking
  const startCamera = useCallback(async () => {
    if (useContextPath && visionCtx) {
      if (contextReleaseRef.current) return; // already requested
      contextReleaseRef.current = visionCtx.requestCamera();
      await visionCtx.startCamera();
      setState(prev => ({ ...prev, isCameraActive: visionCtx.isActive }));
      return;
    }
    if (streamRef.current) return;
    
    try {
      logger.log('[RemoteControl] Starting camera...');
      
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
      
      await video.play();
      
      setState(prev => ({ ...prev, isCameraActive: true }));
      
      logger.log('[RemoteControl] Camera started');
    } catch (error) {
      logger.error('[RemoteControl] Camera error:', error);
    }
  }, [useContextPath, visionCtx]);

  // Some mobile browsers (notably iOS Safari) require getUserMedia to be initiated
  // directly from a user gesture. These events are dispatched from click/tap handlers.
  // remoteControlUserStart: RC toggle; cameraUserStart: play button, etc.
  useEffect(() => {
    const handler = () => {
      if (!enabled || !settings.enabled) return;
      startCamera();
    };

    window.addEventListener('remoteControlUserStart', handler);
    window.addEventListener('cameraUserStart', handler);
    return () => {
      window.removeEventListener('remoteControlUserStart', handler);
      window.removeEventListener('cameraUserStart', handler);
    };
  }, [enabled, settings.enabled, startCamera]);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (useContextPath && visionCtx) {
      if (contextReleaseRef.current) {
        contextReleaseRef.current();
        contextReleaseRef.current = null;
      }
      setState(prev => ({ ...prev, isCameraActive: false }));
      return;
    }
    logger.log('[RemoteControl] Stopping camera...');
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    
    setState(prev => ({ ...prev, isCameraActive: false }));
  }, [useContextPath, visionCtx]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { active?: boolean } | undefined;
      suspendedRef.current = Boolean(detail?.active);
      setSuspended(suspendedRef.current);
      if (suspendedRef.current) {
        stopCamera();
        setState(prev => ({
          ...prev,
          gazePosition: null,
          rawGazePosition: null,
          currentTarget: null,
          ghostButtons: new Map(),
        }));
      } else if (enabled && settings.enabled) {
        startCamera();
      }
    };
    window.addEventListener('remoteControlSuspend', handler as EventListener);
    return () => window.removeEventListener('remoteControlSuspend', handler as EventListener);
  }, [enabled, settings.enabled, startCamera, stopCamera]);

  useEffect(() => {
    if (!enabled || !settings.enabled) return;
    if (calibrationActiveRef.current || suspendedRef.current) return;

    // Calibrated gaze in normalized 0-1 for attention validation
    const calibratedGazePosition = vision.gazePosition
      ? applyCalibration(vision.gazePosition.x, vision.gazePosition.y, calibration)
      : null;

    // Broadcast vision data so attention-tracking (useEyeTracking) can consume it
    // without opening a second camera. Include calibratedGazePosition for reward validation.
    try {
      window.dispatchEvent(
        new CustomEvent('visionEngineSample', {
          detail: {
            hasFace: vision.hasFace,
            eyeEAR: vision.eyeEAR,
            eyeOpenness: vision.eyeOpenness,
            gazePosition: vision.gazePosition,
            calibratedGazePosition,
            headYaw: vision.headYaw,
            headPitch: vision.headPitch,
            timestamp: Date.now(),
          },
        })
      );
    } catch {
      // ignore
    }

    if (!vision.gazePosition) return;
    processGazePosition(vision.gazePosition.x, vision.gazePosition.y);
  }, [vision.gazePosition, vision.hasFace, vision.eyeEAR, vision.eyeOpenness, vision.headYaw, vision.headPitch, enabled, settings.enabled, calibration, processGazePosition]);

  useEffect(() => {
    if (!enabled || !settings.enabled) return;
    if (vision.hasFace) return;
    setState(prev => ({
      ...prev,
      gazePosition: null,
      rawGazePosition: null,
    }));
  }, [vision.hasFace, enabled, settings.enabled]);

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
    if (calibrationActiveRef.current || suspendedRef.current) return;
    
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
    const hasCamera = useContextPath ? contextReleaseRef.current : streamRef.current;
    if (!hasCamera) {
      await startCamera();
    }
    
    setState(prev => ({ 
      ...prev, 
      isCalibrating: true, 
      calibrationStep: 0,
      calibrationPoints: [],
    }));
  }, [useContextPath, startCamera]);
  
  const recordCalibrationPoint = useCallback((screenX: number, screenY: number) => {
    const currentStep = state.calibrationStep;
    const target = CALIBRATION_TARGETS[currentStep];
    
    if (!target || !state.rawGazePosition) {
      logger.log('[RemoteControl] No target or gaze position for calibration');
      return;
    }
    
    const newPoint: CalibrationPoint = {
      screenX: target.x,
      screenY: target.y,
      gazeX: state.rawGazePosition.x / window.innerWidth,
      gazeY: state.rawGazePosition.y / window.innerHeight,
    };
    
    const newPoints = [...state.calibrationPoints, newPoint];
    
    logger.log('[RemoteControl] Calibration point recorded:', currentStep, newPoint);
    
    if (currentStep >= CALIBRATION_TARGETS.length - 1) {
      const pts = newPoints.map((p) => ({
        gazeX: p.gazeX,
        gazeY: p.gazeY,
        targetX: p.screenX,
        targetY: p.screenY,
      }));
      const affineParams = fitAffineFromPoints(pts);

      let newCalibration: CalibrationData;
      if (affineParams) {
        newCalibration = {
          ...calibration,
          offsetX: 0,
          offsetY: 0,
          scaleX: 1,
          scaleY: 1,
          affineParams,
          isCalibrated: true,
          calibratedAt: Date.now(),
        };
      } else {
        const avgGazeX = newPoints.reduce((a, p) => a + p.gazeX, 0) / newPoints.length;
        const avgGazeY = newPoints.reduce((a, p) => a + p.gazeY, 0) / newPoints.length;
        const avgScreenX = newPoints.reduce((a, p) => a + p.screenX, 0) / newPoints.length;
        const avgScreenY = newPoints.reduce((a, p) => a + p.screenY, 0) / newPoints.length;
        let scaleX = 1, scaleY = 1;
        const gazeRangeX = Math.max(...newPoints.map(p => p.gazeX)) - Math.min(...newPoints.map(p => p.gazeX));
        const gazeRangeY = Math.max(...newPoints.map(p => p.gazeY)) - Math.min(...newPoints.map(p => p.gazeY));
        const screenRangeX = Math.max(...newPoints.map(p => p.screenX)) - Math.min(...newPoints.map(p => p.screenX));
        const screenRangeY = Math.max(...newPoints.map(p => p.screenY)) - Math.min(...newPoints.map(p => p.screenY));
        if (gazeRangeX > 0.1) scaleX = screenRangeX / gazeRangeX;
        if (gazeRangeY > 0.1) scaleY = screenRangeY / gazeRangeY;
        const boundedScaleX = Math.max(0.5, Math.min(2, scaleX));
        const boundedScaleY = Math.max(0.5, Math.min(2, scaleY));
        const calibratedCenterX = (avgGazeX - 0.5) * boundedScaleX + 0.5;
        const calibratedCenterY = (avgGazeY - 0.5) * boundedScaleY + 0.5;
        newCalibration = {
          ...calibration,
          offsetX: avgScreenX - calibratedCenterX,
          offsetY: avgScreenY - calibratedCenterY,
          scaleX: boundedScaleX,
          scaleY: boundedScaleY,
          isCalibrated: true,
          calibratedAt: Date.now(),
        };
      }
      logger.log('[RemoteControl] Calibration complete:', affineParams ? 'affine' : 'offset+scale', newCalibration);
      
      persistCalibration(newCalibration);
      
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
  }, [state.calibrationStep, state.rawGazePosition, state.calibrationPoints, calibration, persistCalibration]);

  const cancelCalibration = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      isCalibrating: false, 
      calibrationStep: 0,
      calibrationPoints: [],
    }));
  }, []);

  const resetCalibration = useCallback(() => {
    persistCalibration(DEFAULT_CALIBRATION);
    autoCalibrationHistoryRef.current = [];
    setState(prev => ({ ...prev, lastAction: 'Calibration reset' }));
  }, [persistCalibration]);

  // Toggle auto-calibration
  const toggleAutoCalibration = useCallback(() => {
    const newCalibration = {
      ...calibration,
      autoCalibrationEnabled: !calibration.autoCalibrationEnabled,
    };
    persistCalibration(newCalibration);
    logger.log('[RemoteControl] Auto-calibration:', !calibration.autoCalibrationEnabled ? 'enabled' : 'disabled');
  }, [calibration, persistCalibration]);

  // Record interaction for auto-calibration
  const recordInteractionForAutoCalibration = useCallback((targetX: number, targetY: number) => {
    if (!calibration.autoCalibrationEnabled || !state.gazePosition) return;
    
    const now = Date.now();
    
    // Add to history
    autoCalibrationHistoryRef.current.push({
      gazeX: state.gazePosition.x / window.innerWidth,
      gazeY: state.gazePosition.y / window.innerHeight,
      targetX: targetX / window.innerWidth,
      targetY: targetY / window.innerHeight,
      timestamp: now,
    });
    
    // Keep only last 20 interactions within 5 minutes
    const fiveMinutesAgo = now - 5 * 60 * 1000;
    autoCalibrationHistoryRef.current = autoCalibrationHistoryRef.current
      .filter(p => p.timestamp > fiveMinutesAgo)
      .slice(-20);
    
    // Only adjust every 10 seconds with at least 5 data points
    if (now - lastAutoAdjustmentRef.current < 10000 || autoCalibrationHistoryRef.current.length < 5) {
      return;
    }
    
    const history = autoCalibrationHistoryRef.current;
    
    // Calculate average offset error
    const avgGazeX = history.reduce((a, p) => a + p.gazeX, 0) / history.length;
    const avgGazeY = history.reduce((a, p) => a + p.gazeY, 0) / history.length;
    const avgTargetX = history.reduce((a, p) => a + p.targetX, 0) / history.length;
    const avgTargetY = history.reduce((a, p) => a + p.targetY, 0) / history.length;
    
    const errorX = avgTargetX - avgGazeX;
    const errorY = avgTargetY - avgGazeY;
    
    // Only adjust if error is significant (> 5%)
    if (Math.abs(errorX) < 0.05 && Math.abs(errorY) < 0.05) {
      return;
    }
    
    // Apply gradual adjustment (20% of error)
    const adjustmentFactor = 0.2;
    const newCalibration: CalibrationData = {
      ...calibration,
      offsetX: calibration.offsetX + errorX * adjustmentFactor,
      offsetY: calibration.offsetY + errorY * adjustmentFactor,
      autoAdjustments: calibration.autoAdjustments + 1,
    };
    
    logger.log('[RemoteControl] Auto-calibration adjustment:', {
      errorX: errorX.toFixed(3),
      errorY: errorY.toFixed(3),
      newOffsetX: newCalibration.offsetX.toFixed(3),
      newOffsetY: newCalibration.offsetY.toFixed(3),
    });
    
    persistCalibration(newCalibration);
    lastAutoAdjustmentRef.current = now;
  }, [calibration, state.gazePosition, persistCalibration]);
  
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
    const hasCamera = useContextPath ? contextReleaseRef.current : streamRef.current;
    if (enabled && settings.enabled && !hasCamera && !suspendedRef.current) {
      startCamera();
    } else if ((!enabled || !settings.enabled || suspendedRef.current) && hasCamera) {
      stopCamera();
    }
  }, [enabled, settings.enabled, useContextPath, startCamera, stopCamera]);

  const pauseCamera = useCallback(() => {
    if (suspendedRef.current) return;
    suspendedRef.current = true;
    setSuspended(true);
    stopCamera();
    setState(prev => ({
      ...prev,
      gazePosition: null,
      rawGazePosition: null,
      currentTarget: null,
      ghostButtons: new Map(),
      pendingBlinkCount: 0,
    }));
  }, [stopCamera]);

  const resumeCamera = useCallback(() => {
    if (!suspendedRef.current) return;
    suspendedRef.current = false;
    setSuspended(false);
    if (enabled && settings.enabled && !streamRef.current) {
      startCamera();
    }
  }, [enabled, settings.enabled, startCamera]);
  
  // Sync active state with detection
  useEffect(() => {
    const cameraActive = useContextPath && visionCtx ? visionCtx.isActive : state.isCameraActive;
    setState(prev => ({ ...prev, isActive: vision.isRunning || cameraActive, isCameraActive: cameraActive }));
  }, [vision.isRunning, state.isCameraActive, useContextPath, visionCtx?.isActive]);

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
    eyeOpenness: vision.eyeOpenness,
    blinkCount: vision.blinkCount,
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
    toggleAutoCalibration,
    recordInteractionForAutoCalibration,
    pauseCamera,
    resumeCamera,
    persistCalibration,
    mergeGestureThresholds,
  };
}
