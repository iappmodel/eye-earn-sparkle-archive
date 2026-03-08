import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useGazeDirection, GazeDirection } from './useGazeDirection';
import { useVisionEngine } from './useVisionEngine';
import { useVision, USE_VISION_CONTEXT } from '@/contexts/VisionContext';
import { logger } from '@/lib/logger';
import { getCameraRuntimeIssue, isDemoVisionSimulationEnabled } from '@/lib/demoRuntime';
import { fetchProfileCalibration, saveProfileCalibration } from '@/services/calibration.service';
import { securityService } from '@/services/security.service';
import {
  applyResidualCompensation,
  blendResidualModels,
  fitResidualModel,
  type ResidualTrainingSample,
} from '@/lib/visionCalibration/residualModel';
import {
  detectVisionDeviceClass,
  getDefaultVisionCalibration,
  getVisionRuntimePreset,
  loadVisionCalibration,
  mergeVisionCalibration,
  normalizeVisionCalibration,
  saveVisionCalibration,
  type AffineParams,
  type VisionCalibrationProfile,
} from '@/lib/visionCalibration/profile';

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
export type RemoteControlProfile = 'adaptive' | 'precision' | 'speed';

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

export type { AffineParams };
export type CalibrationData = VisionCalibrationProfile;

export interface AutoCalibrationState {
  clickHistory: AutoCalibrationSample[];
  lastAdjustment: number;
}

export interface RemoteControlSettings {
  settingsVersion?: number;
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
  /** Gaze source: mediapipe (default), gazecloud (higher accuracy, server-side), webgazer (fallback) */
  gazeBackend?: 'mediapipe' | 'gazecloud' | 'webgazer';
  /** Runtime tuning profile for gaze response + selection speed */
  controlProfile?: RemoteControlProfile;
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
  settingsVersion: 2,
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
  controlProfile: 'adaptive',
};

const getDefaultRemoteControlSettings = (
  deviceClass = detectVisionDeviceClass()
): RemoteControlSettings => {
  const preset = getVisionRuntimePreset(deviceClass);
  return {
    ...DEFAULT_SETTINGS,
    gazeHoldTime: preset.gazeHoldTime,
    edgeThreshold: preset.edgeThreshold,
    gazeReach: preset.gazeScale,
  };
};

const AUTO_CALIBRATION_STORAGE_KEY = 'app_remote_control_auto_calibration';
const AUTO_CALIBRATION_MAX_SAMPLES = 30;
const AUTO_CALIBRATION_WINDOW_MS = 8 * 60 * 1000;
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

type AutoCalibrationSample = {
  gazeX: number;
  gazeY: number;
  targetX: number;
  targetY: number;
  timestamp: number;
};

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
  const calibration = loadVisionCalibration();
  const deviceClass = calibration.deviceClass ?? detectVisionDeviceClass();
  const defaults = getDefaultRemoteControlSettings(deviceClass);
  try {
    const saved = localStorage.getItem(REMOTE_CONTROL_SETTINGS_KEY);
    if (!saved) return defaults;
    const parsed = JSON.parse(saved);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const merged: RemoteControlSettings = { ...defaults, ...parsed };
    const legacyDefaultTriplet =
      typeof parsed.gazeReach === 'number' &&
      typeof parsed.gazeHoldTime === 'number' &&
      typeof parsed.edgeThreshold === 'number' &&
      parsed.gazeReach === 1.6 &&
      parsed.gazeHoldTime === 800 &&
      parsed.edgeThreshold === 0.35;

    if (parsed.settingsVersion !== 2 && legacyDefaultTriplet) {
      merged.gazeReach = defaults.gazeReach;
      merged.gazeHoldTime = defaults.gazeHoldTime;
      merged.edgeThreshold = defaults.edgeThreshold;
    }

    merged.settingsVersion = 2;
    return merged;
  } catch {
    return defaults;
  }
};

export const saveRemoteControlSettings = (settings: RemoteControlSettings) => {
  localStorage.setItem(REMOTE_CONTROL_SETTINGS_KEY, JSON.stringify({ ...settings, settingsVersion: 2 }));
  window.dispatchEvent(new CustomEvent('remoteControlSettingsChanged'));
};

export const loadCalibrationData = (): CalibrationData => {
  return loadVisionCalibration();
};

export const saveCalibrationData = (data: CalibrationData) => {
  saveVisionCalibration(data);
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
function applyBaseCalibration(
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

export function applyCalibration(
  rawX: number,
  rawY: number,
  calibration: CalibrationData
): { x: number; y: number } {
  const base = applyBaseCalibration(rawX, rawY, calibration);
  return applyResidualCompensation(base.x, base.y, calibration.residualModel);
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
  const runtimePreset = useMemo(
    () => getVisionRuntimePreset(calibration.deviceClass ?? detectVisionDeviceClass()),
    [calibration.deviceClass]
  );
  const [autoCalibrationSampleCount, setAutoCalibrationSampleCount] = useState(0);
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
  const demoVisionIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const smoothedPositionRef = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const autoCalibrationHistoryRef = useRef<AutoCalibrationSample[]>([]);
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

  const setAutoCalibrationHistory = useCallback((samples: AutoCalibrationSample[]) => {
    autoCalibrationHistoryRef.current = samples;
    setAutoCalibrationSampleCount(samples.length);
    try {
      localStorage.setItem(AUTO_CALIBRATION_STORAGE_KEY, JSON.stringify(samples));
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTO_CALIBRATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;

      const now = Date.now();
      const normalized = parsed
        .filter((entry) => (
          entry &&
          typeof entry === 'object' &&
          typeof entry.gazeX === 'number' &&
          typeof entry.gazeY === 'number' &&
          typeof entry.targetX === 'number' &&
          typeof entry.targetY === 'number' &&
          typeof entry.timestamp === 'number'
        ))
        .filter((entry) => now - entry.timestamp < AUTO_CALIBRATION_WINDOW_MS)
        .slice(-AUTO_CALIBRATION_MAX_SAMPLES) as AutoCalibrationSample[];

      if (normalized.length > 0) {
        autoCalibrationHistoryRef.current = normalized;
        setAutoCalibrationSampleCount(normalized.length);
      }
    } catch {
      // ignore malformed history payloads
    }
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
    gazeSmoothing: runtimePreset.gazeSmoothing,
    enableHandTracking: true,
    blinkConfig: {
      baselineSampleCount: runtimePreset.blinkBaselineSampleCount,
      minEarForBaseline: runtimePreset.blinkMinEarForBaseline,
      closeRatio: runtimePreset.blinkCloseRatio,
      maxCloseEAR: runtimePreset.blinkMaxCloseEAR,
      reopenRatio: runtimePreset.blinkReopenRatio,
      minBlinkDurationMs: runtimePreset.blinkMinDurationMs,
      maxBlinkDurationMs: runtimePreset.blinkMaxDurationMs,
      blinkCooldownMs: runtimePreset.blinkCooldownMs,
      minClosedFramesForBlink: runtimePreset.blinkMinClosedFrames,
    },
    fusionConfig: {
      livenessMinScore: calibration.livenessMinScore,
      handPinchMinConfidence: calibration.handPinchMinConfidence,
      handPointMinConfidence: calibration.handPointMinConfidence,
      handOpenPalmMinConfidence: calibration.handOpenPalmMinConfidence,
      headYawCommandThreshold: calibration.headYawCommandThreshold,
      nodRangeThreshold: calibration.nodRangeThreshold,
    },
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
  const lastVisionHandEventRef = useRef(0);
  const lastVisionCommandEventRef = useRef(0);
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

  // Load gesture thresholds from unified calibration profile (fallback to legacy key once).
  useEffect(() => {
    if (calibration.gestureThresholds && Object.keys(calibration.gestureThresholds).length > 0) {
      savedGestureThresholds.current = calibration.gestureThresholds;
      return;
    }
    try {
      const saved = localStorage.getItem('app_gesture_thresholds');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        savedGestureThresholds.current = parsed;
      }
    } catch {
      // ignore
    }
  }, [calibration.gestureThresholds]);

  const persistCalibration = useCallback((data: CalibrationData) => {
    const normalized = normalizeVisionCalibration(data);
    setCalibration(normalized);
    saveCalibrationData(normalized);
  }, []);

  /** Merge and persist gesture thresholds from calibration flows (FacialExpressionScanning, etc.) */
  const mergeGestureThresholds = useCallback((partial: Record<string, number>) => {
    const current = {
      ...(calibration.gestureThresholds ?? {}),
      ...savedGestureThresholds.current,
      ...partial,
    };
    savedGestureThresholds.current = current;
    const merged = mergeVisionCalibration(calibration, { gestureThresholds: current });
    persistCalibration(merged);
  }, [calibration, persistCalibration]);

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
        persistCalibration(candidate);
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
    
    // Adaptive smoothing: precision profile is steadier, speed profile is more responsive.
    const profile = settings.controlProfile ?? 'adaptive';
    const smoothing = profile === 'precision'
      ? 0.22
      : profile === 'speed'
        ? 0.42
        : calibration.profileQuality < 0.45
          ? 0.38
          : calibration.profileQuality < 0.7
            ? 0.32
            : 0.28;
    const tunedSmoothing = clamp(
      smoothing * (runtimePreset.pointerResponse / 0.32),
      0.18,
      0.5
    );
    smoothedPositionRef.current = {
      x: smoothedPositionRef.current.x * (1 - tunedSmoothing) + screenX * tunedSmoothing,
      y: smoothedPositionRef.current.y * (1 - tunedSmoothing) + screenY * tunedSmoothing,
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
  }, [calibration, runtimePreset.pointerResponse, settings.controlProfile, settings.sensitivity, updateGazeDir]);

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

  useEffect(() => {
    if (!enabled || !settings.enabled) return;
    const eventTs = vision.lastHandGestureTime ?? 0;
    if (!eventTs || eventTs <= lastVisionHandEventRef.current) return;
    lastVisionHandEventRef.current = eventTs;

    if (vision.handGesture === 'pinch') dispatchGestureTrigger('handPinch');
    if (vision.handGesture === 'point') dispatchGestureTrigger('handPoint');
    if (vision.handGesture === 'openPalm') dispatchGestureTrigger('handOpenPalm');
  }, [enabled, settings.enabled, vision.handGesture, vision.lastHandGestureTime, dispatchGestureTrigger]);

  useEffect(() => {
    if (!enabled || !settings.enabled) return;
    const eventTs = vision.lastCommandTime ?? 0;
    if (!eventTs || eventTs <= lastVisionCommandEventRef.current) return;
    lastVisionCommandEventRef.current = eventTs;

    if (vision.commandIntent === 'select') dispatchGestureTrigger('handPinch');
    if (vision.commandIntent === 'confirm') dispatchGestureTrigger('headNod');
    if (vision.commandIntent === 'next') dispatchGestureTrigger('faceTurnRight');
    if (vision.commandIntent === 'previous') dispatchGestureTrigger('faceTurnLeft');
  }, [enabled, settings.enabled, vision.commandIntent, vision.lastCommandTime, dispatchGestureTrigger]);

  // Gaze is now provided by Vision Engine (landmark-based).

  const contextReleaseRef = useRef<(() => void) | null>(null);

  const stopDemoCamera = useCallback(() => {
    if (demoVisionIntervalRef.current) {
      clearInterval(demoVisionIntervalRef.current);
      demoVisionIntervalRef.current = null;
    }
  }, []);

  const startDemoCamera = useCallback(
    (reason: string) => {
      stopDemoCamera();
      setState((prev) => ({ ...prev, isCameraActive: true }));
      logger.warn('[RemoteControl] Camera unavailable, running demo vision simulation:', reason);
      const seed = Math.random() * Math.PI;
      demoVisionIntervalRef.current = setInterval(() => {
        const t = Date.now() / 1000 + seed;
        const rawX = 0.5 + Math.sin(t * 0.9) * 0.03;
        const rawY = 0.5 + Math.cos(t * 0.8) * 0.02;
        const calibrated = applyCalibration(rawX, rawY, calibration);
        processGazePosition(rawX, rawY);
        try {
          window.dispatchEvent(
            new CustomEvent('visionEngineSample', {
              detail: {
                hasFace: true,
                eyeEAR: 0.26,
                eyeOpenness: 0.9,
                gazePosition: { x: rawX, y: rawY },
                calibratedGazePosition: calibrated,
                headYaw: Math.sin(t * 0.7) * 4,
                headPitch: Math.cos(t * 0.6) * 3,
                handCount: 1,
                handGesture: 'none',
                handGestureConfidence: 0,
                commandIntent: 'none',
                commandConfidence: 0,
                livenessScore: 0.78,
                livenessStable: true,
                needsUserGesture: false,
                source: 'demo',
              },
            })
          );
        } catch {
          // ignore
        }
      }, 120);
    },
    [calibration, processGazePosition, stopDemoCamera]
  );

  // Start camera for gaze tracking
  const startCamera = useCallback(async () => {
    const runtimeIssue = getCameraRuntimeIssue();
    if (runtimeIssue) {
      if (isDemoVisionSimulationEnabled()) {
        startDemoCamera(runtimeIssue);
      } else {
        logger.error('[RemoteControl] Camera blocked:', runtimeIssue);
        setState((prev) => ({ ...prev, isCameraActive: false }));
      }
      return;
    }

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
      if (isDemoVisionSimulationEnabled()) {
        startDemoCamera(error instanceof Error ? error.message : 'Camera error');
        return;
      }
      logger.error('[RemoteControl] Camera error:', error);
    }
  }, [startDemoCamera, useContextPath, visionCtx]);

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
    stopDemoCamera();
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
  }, [stopDemoCamera, useContextPath, visionCtx]);

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
            handCount: vision.handCount,
            handGesture: vision.handGesture,
            handGestureConfidence: vision.handGestureConfidence,
            lastHandGestureTime: vision.lastHandGestureTime,
            commandIntent: vision.commandIntent,
            commandConfidence: vision.commandConfidence,
            lastCommandTime: vision.lastCommandTime,
            livenessScore: vision.livenessScore,
            livenessStable: vision.livenessStable,
            timestamp: Date.now(),
          },
        })
      );
    } catch {
      // ignore
    }

    if (!vision.gazePosition) return;
    processGazePosition(vision.gazePosition.x, vision.gazePosition.y);
  }, [
    vision.gazePosition,
    vision.hasFace,
    vision.eyeEAR,
    vision.eyeOpenness,
    vision.headYaw,
    vision.headPitch,
    vision.handCount,
    vision.handGesture,
    vision.handGestureConfidence,
    vision.lastHandGestureTime,
    vision.commandIntent,
    vision.commandConfidence,
    vision.lastCommandTime,
    vision.livenessScore,
    vision.livenessStable,
    enabled,
    settings.enabled,
    calibration,
    processGazePosition,
  ]);

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
    persistCalibration(getDefaultVisionCalibration(calibration.deviceClass));
    setAutoCalibrationHistory([]);
    setState(prev => ({ ...prev, lastAction: 'Calibration reset' }));
  }, [calibration.deviceClass, persistCalibration, setAutoCalibrationHistory]);

  // Toggle auto-calibration
  const toggleAutoCalibration = useCallback(() => {
    const newCalibration = {
      ...calibration,
      autoCalibrationEnabled: !calibration.autoCalibrationEnabled,
    };
    persistCalibration(newCalibration);
    logger.log('[RemoteControl] Auto-calibration:', !calibration.autoCalibrationEnabled ? 'enabled' : 'disabled');
  }, [calibration, persistCalibration]);

  const applyAutoCalibrationFromHistory = useCallback((
    history: AutoCalibrationSample[],
    now: number,
    force = false
  ): boolean => {
    const adjustments = calibration.autoAdjustments ?? 0;
    const warmup = adjustments < 3;
    const minSamples = force ? 3 : (warmup ? 3 : 5);
    const minIntervalMs = warmup ? 2500 : 10000;

    if (history.length < minSamples) return false;
    if (!force && now - lastAutoAdjustmentRef.current < minIntervalMs) return false;

    const avgGazeX = history.reduce((acc, point) => acc + point.gazeX, 0) / history.length;
    const avgGazeY = history.reduce((acc, point) => acc + point.gazeY, 0) / history.length;
    const avgTargetX = history.reduce((acc, point) => acc + point.targetX, 0) / history.length;
    const avgTargetY = history.reduce((acc, point) => acc + point.targetY, 0) / history.length;

    const errorX = avgTargetX - avgGazeX;
    const errorY = avgTargetY - avgGazeY;
    const radialError = Math.hypot(errorX, errorY);
    const minError = warmup ? 0.025 : 0.05;
    if (radialError < minError) return false;

    const adjustmentFactor = warmup ? 0.45 : adjustments < 8 ? 0.3 : 0.18;
    const qualityFromError = clamp(1 - radialError / 0.35, 0, 1);

    let nextCalibration: CalibrationData = calibration.affineParams && calibration.affineParams.length === 6
      ? {
          ...calibration,
          affineParams: [
            calibration.affineParams[0],
            calibration.affineParams[1],
            clamp(calibration.affineParams[2] + errorX * adjustmentFactor, -1, 1),
            calibration.affineParams[3],
            calibration.affineParams[4],
            clamp(calibration.affineParams[5] + errorY * adjustmentFactor, -1, 1),
          ],
          autoAdjustments: adjustments + 1,
          profileQuality: clamp(calibration.profileQuality * 0.72 + qualityFromError * 0.28, 0, 1),
          calibratedAt: now,
        }
      : {
          ...calibration,
          offsetX: clamp(calibration.offsetX + errorX * adjustmentFactor, -0.45, 0.45),
          offsetY: clamp(calibration.offsetY + errorY * adjustmentFactor, -0.45, 0.45),
          autoAdjustments: adjustments + 1,
          profileQuality: clamp(calibration.profileQuality * 0.72 + qualityFromError * 0.28, 0, 1),
          calibratedAt: now,
        };

    const residualSamples: ResidualTrainingSample[] = history.map((point) => {
      const basePoint = applyBaseCalibration(point.gazeX, point.gazeY, nextCalibration);
      const distance = Math.hypot(basePoint.x - point.targetX, basePoint.y - point.targetY);
      const weight = clamp(1.2 - distance * 1.6, 0.2, 1.2);
      return {
        inputX: basePoint.x,
        inputY: basePoint.y,
        targetX: point.targetX,
        targetY: point.targetY,
        weight,
      };
    });
    const fittedResidual = fitResidualModel(residualSamples, {
      lambda: warmup ? 0.08 : 0.05,
      minSamples: force ? 3 : (warmup ? 3 : 5),
      now,
    });
    if (fittedResidual) {
      nextCalibration = {
        ...nextCalibration,
        residualModel: blendResidualModels(
          calibration.residualModel,
          fittedResidual,
          force ? 0.55 : (warmup ? 0.35 : 0.22)
        ),
      };
    }

    logger.log('[RemoteControl] Auto-calibration adjustment:', {
      mode: force ? 'manual' : 'automatic',
      warmup,
      sampleCount: history.length,
      errorX: errorX.toFixed(3),
      errorY: errorY.toFixed(3),
      radialError: radialError.toFixed(3),
      residualModel: Boolean(nextCalibration.residualModel),
      profileQuality: nextCalibration.profileQuality.toFixed(3),
    });

    persistCalibration(nextCalibration);
    lastAutoAdjustmentRef.current = now;
    return true;
  }, [calibration, persistCalibration]);

  // Record interaction for auto-calibration
  const recordInteractionForAutoCalibration = useCallback((targetX: number, targetY: number) => {
    const activeGaze = state.rawGazePosition ?? state.gazePosition;
    if (!calibration.autoCalibrationEnabled || !activeGaze) return;

    const now = Date.now();
    const nextSample: AutoCalibrationSample = {
      gazeX: clamp(activeGaze.x / window.innerWidth, 0, 1),
      gazeY: clamp(activeGaze.y / window.innerHeight, 0, 1),
      targetX: clamp(targetX / window.innerWidth, 0, 1),
      targetY: clamp(targetY / window.innerHeight, 0, 1),
      timestamp: now,
    };

    const refreshed = [...autoCalibrationHistoryRef.current, nextSample]
      .filter((point) => now - point.timestamp < AUTO_CALIBRATION_WINDOW_MS)
      .slice(-AUTO_CALIBRATION_MAX_SAMPLES);

    setAutoCalibrationHistory(refreshed);
    applyAutoCalibrationFromHistory(refreshed, now);
  }, [applyAutoCalibrationFromHistory, calibration.autoCalibrationEnabled, setAutoCalibrationHistory, state.gazePosition, state.rawGazePosition]);

  const optimizeCalibrationNow = useCallback(() => {
    const now = Date.now();
    return applyAutoCalibrationFromHistory(autoCalibrationHistoryRef.current, now, true);
  }, [applyAutoCalibrationFromHistory]);
  
  // Update settings
  const updateSettings = useCallback((newSettings: Partial<RemoteControlSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      saveRemoteControlSettings(updated);
      return updated;
    });
  }, []);

  const applyControlProfile = useCallback((profile: RemoteControlProfile) => {
    const lowQuality = calibration.profileQuality < 0.55;
    const baseHold = runtimePreset.gazeHoldTime;
    const baseEdge = runtimePreset.edgeThreshold;
    const presets: Record<RemoteControlProfile, Partial<RemoteControlSettings>> = {
      adaptive: {
        sensitivity: lowQuality ? 4 : 5,
        gazeHoldTime: Math.round(baseHold + (lowQuality ? 170 : 90)),
        edgeThreshold: clamp(baseEdge + (lowQuality ? -0.03 : 0), 0.24, 0.45),
        blinkPatternTimeout: 650,
        ghostOpacity: 0.4,
      },
      precision: {
        sensitivity: 4,
        gazeHoldTime: Math.round(baseHold + 260),
        edgeThreshold: clamp(baseEdge - 0.06, 0.22, 0.4),
        blinkPatternTimeout: 750,
        ghostOpacity: 0.45,
      },
      speed: {
        sensitivity: 7,
        gazeHoldTime: Math.round(clamp(baseHold - 190, 420, 760)),
        edgeThreshold: clamp(baseEdge + 0.06, 0.28, 0.5),
        blinkPatternTimeout: 500,
        ghostOpacity: 0.35,
      },
    };

    updateSettings({
      ...presets[profile],
      controlProfile: profile,
    });
  }, [calibration.profileQuality, runtimePreset.edgeThreshold, runtimePreset.gazeHoldTime, updateSettings]);

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
    autoCalibrationSampleCount,
    visionHasFace: vision.hasFace,
    eyeOpenness: vision.eyeOpenness,
    blinkCount: vision.blinkCount,
    livenessScore: vision.livenessScore,
    livenessStable: vision.livenessStable,
    handGesture: vision.handGesture,
    handGestureConfidence: vision.handGestureConfidence,
    commandIntent: vision.commandIntent,
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
    applyControlProfile,
    updateGazeCommand,
    toggleAutoCalibration,
    recordInteractionForAutoCalibration,
    optimizeCalibrationNow,
    pauseCamera,
    resumeCamera,
    persistCalibration,
    mergeGestureThresholds,
  };
}
