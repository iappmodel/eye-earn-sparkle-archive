import {
  normalizeResidualModel,
  type VisionResidualModel,
} from '@/lib/visionCalibration/residualModel';
export type AffineParams = [number, number, number, number, number, number];

export interface GestureThresholds {
  eyebrowLift?: number;
  headTurn?: number;
  lipRaise?: number;
  smileRatio?: number;
}

export type VisionDeviceClass = 'iphone' | 'android' | 'desktop';

export interface VisionRuntimePreset {
  gazeScale: number;
  gazeSmoothing: number;
  pointerResponse: number;
  gazeHoldTime: number;
  edgeThreshold: number;
  blinkBaselineSampleCount: number;
  blinkMinEarForBaseline: number;
  blinkCloseRatio: number;
  blinkMaxCloseEAR: number;
  blinkReopenRatio: number;
  blinkMinDurationMs: number;
  blinkMaxDurationMs: number;
  blinkCooldownMs: number;
  blinkMinClosedFrames: number;
}

export interface VisionCalibrationProfile {
  offsetX: number;
  offsetY: number;
  scaleX: number;
  scaleY: number;
  isCalibrated: boolean;
  calibratedAt: number;
  autoCalibrationEnabled: boolean;
  autoAdjustments: number;
  affineParams?: AffineParams;
  slowBlinkMinMs?: number;
  slowBlinkMaxMs?: number;
  version: 2;
  profileQuality: number; // 0-1
  livenessMinScore: number; // 0-1
  handPinchMinConfidence: number; // 0-1
  handPointMinConfidence: number; // 0-1
  handOpenPalmMinConfidence: number; // 0-1
  headYawCommandThreshold: number; // degrees
  nodRangeThreshold: number; // degrees
  residualModel?: VisionResidualModel;
  deviceClass?: VisionDeviceClass;
  gestureThresholds?: GestureThresholds;
}

export const VISION_CALIBRATION_STORAGE_KEY = 'app_remote_control_calibration';

export const DEFAULT_VISION_CALIBRATION: VisionCalibrationProfile = {
  offsetX: 0,
  offsetY: 0,
  scaleX: 1,
  scaleY: 1,
  isCalibrated: false,
  calibratedAt: 0,
  autoCalibrationEnabled: true,
  autoAdjustments: 0,
  version: 2,
  profileQuality: 0.5,
  livenessMinScore: 0.55,
  handPinchMinConfidence: 0.58,
  handPointMinConfidence: 0.62,
  handOpenPalmMinConfidence: 0.55,
  headYawCommandThreshold: 18,
  nodRangeThreshold: 12,
  deviceClass: 'desktop',
};

const DEVICE_PRESETS: Record<
  VisionDeviceClass,
  Pick<
    VisionCalibrationProfile,
    | 'livenessMinScore'
    | 'handPinchMinConfidence'
    | 'handPointMinConfidence'
    | 'handOpenPalmMinConfidence'
    | 'headYawCommandThreshold'
    | 'nodRangeThreshold'
  >
> = {
  iphone: {
    livenessMinScore: 0.5,
    handPinchMinConfidence: 0.54,
    handPointMinConfidence: 0.58,
    handOpenPalmMinConfidence: 0.52,
    headYawCommandThreshold: 16,
    nodRangeThreshold: 11,
  },
  android: {
    livenessMinScore: 0.53,
    handPinchMinConfidence: 0.56,
    handPointMinConfidence: 0.6,
    handOpenPalmMinConfidence: 0.53,
    headYawCommandThreshold: 18,
    nodRangeThreshold: 12,
  },
  desktop: {
    livenessMinScore: 0.6,
    handPinchMinConfidence: 0.62,
    handPointMinConfidence: 0.66,
    handOpenPalmMinConfidence: 0.58,
    headYawCommandThreshold: 20,
    nodRangeThreshold: 13,
  },
};

const DEVICE_RUNTIME_PRESETS: Record<VisionDeviceClass, VisionRuntimePreset> = {
  iphone: {
    gazeScale: 1.55,
    gazeSmoothing: 0.2,
    pointerResponse: 0.35,
    gazeHoldTime: 720,
    edgeThreshold: 0.33,
    blinkBaselineSampleCount: 7,
    blinkMinEarForBaseline: 0.11,
    blinkCloseRatio: 0.72,
    blinkMaxCloseEAR: 0.22,
    blinkReopenRatio: 0.85,
    blinkMinDurationMs: 45,
    blinkMaxDurationMs: 780,
    blinkCooldownMs: 130,
    blinkMinClosedFrames: 1,
  },
  android: {
    gazeScale: 1.5,
    gazeSmoothing: 0.28,
    pointerResponse: 0.3,
    gazeHoldTime: 820,
    edgeThreshold: 0.36,
    blinkBaselineSampleCount: 8,
    blinkMinEarForBaseline: 0.1,
    blinkCloseRatio: 0.74,
    blinkMaxCloseEAR: 0.21,
    blinkReopenRatio: 0.86,
    blinkMinDurationMs: 55,
    blinkMaxDurationMs: 900,
    blinkCooldownMs: 150,
    blinkMinClosedFrames: 2,
  },
  desktop: {
    gazeScale: 1.7,
    gazeSmoothing: 0.24,
    pointerResponse: 0.34,
    gazeHoldTime: 760,
    edgeThreshold: 0.34,
    blinkBaselineSampleCount: 9,
    blinkMinEarForBaseline: 0.12,
    blinkCloseRatio: 0.73,
    blinkMaxCloseEAR: 0.22,
    blinkReopenRatio: 0.86,
    blinkMinDurationMs: 50,
    blinkMaxDurationMs: 850,
    blinkCooldownMs: 140,
    blinkMinClosedFrames: 1,
  },
};

const isVisionDeviceClass = (value: unknown): value is VisionDeviceClass =>
  value === 'iphone' || value === 'android' || value === 'desktop';

export const detectVisionDeviceClass = (): VisionDeviceClass => {
  if (typeof navigator === 'undefined') return 'desktop';
  const userAgent = (navigator.userAgent || '').toLowerCase();
  const maxTouchPoints = Number.isFinite(navigator.maxTouchPoints) ? navigator.maxTouchPoints : 0;
  const isIpad = userAgent.includes('ipad') || (userAgent.includes('macintosh') && maxTouchPoints > 1);

  if (userAgent.includes('android')) return 'android';
  if (userAgent.includes('iphone') || userAgent.includes('ipod') || isIpad) return 'iphone';
  return 'desktop';
};

export const getVisionDevicePreset = (
  deviceClass: VisionDeviceClass = detectVisionDeviceClass()
): Pick<
  VisionCalibrationProfile,
  | 'livenessMinScore'
  | 'handPinchMinConfidence'
  | 'handPointMinConfidence'
  | 'handOpenPalmMinConfidence'
  | 'headYawCommandThreshold'
  | 'nodRangeThreshold'
> => {
  return DEVICE_PRESETS[deviceClass];
};

export const getVisionRuntimePreset = (
  deviceClass: VisionDeviceClass = detectVisionDeviceClass()
): VisionRuntimePreset => {
  return DEVICE_RUNTIME_PRESETS[deviceClass];
};

export const getDefaultVisionCalibration = (
  deviceClass: VisionDeviceClass = detectVisionDeviceClass()
): VisionCalibrationProfile => {
  return {
    ...DEFAULT_VISION_CALIBRATION,
    ...getVisionDevicePreset(deviceClass),
    deviceClass,
  };
};

export const withVisionDeviceDefaults = (
  value: VisionCalibrationProfile,
  deviceClass: VisionDeviceClass = detectVisionDeviceClass()
): VisionCalibrationProfile => {
  return normalizeVisionCalibration({
    ...value,
    ...getVisionDevicePreset(deviceClass),
    deviceClass,
  });
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object';

const num = (value: unknown, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const bool = (value: unknown, fallback: boolean) =>
  typeof value === 'boolean' ? value : fallback;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

export const normalizeVisionCalibration = (value: unknown): VisionCalibrationProfile => {
  if (!isObject(value)) {
    return getDefaultVisionCalibration();
  }

  const inputDeviceClass = isVisionDeviceClass(value.deviceClass) ? value.deviceClass : undefined;
  const base = getDefaultVisionCalibration(inputDeviceClass ?? detectVisionDeviceClass());
  const affine = Array.isArray(value.affineParams) && value.affineParams.length === 6
    ? (value.affineParams.map((n) => num(n, 0)) as AffineParams)
    : undefined;

  const gestureThresholds = isObject(value.gestureThresholds)
    ? {
        eyebrowLift: typeof value.gestureThresholds.eyebrowLift === 'number' ? value.gestureThresholds.eyebrowLift : undefined,
        headTurn: typeof value.gestureThresholds.headTurn === 'number' ? value.gestureThresholds.headTurn : undefined,
        lipRaise: typeof value.gestureThresholds.lipRaise === 'number' ? value.gestureThresholds.lipRaise : undefined,
        smileRatio: typeof value.gestureThresholds.smileRatio === 'number' ? value.gestureThresholds.smileRatio : undefined,
      }
    : undefined;

  const profile: VisionCalibrationProfile = {
    ...base,
    offsetX: num(value.offsetX, base.offsetX),
    offsetY: num(value.offsetY, base.offsetY),
    scaleX: num(value.scaleX, base.scaleX),
    scaleY: num(value.scaleY, base.scaleY),
    isCalibrated: bool(value.isCalibrated, base.isCalibrated),
    calibratedAt: num(value.calibratedAt, base.calibratedAt),
    autoCalibrationEnabled: bool(value.autoCalibrationEnabled, base.autoCalibrationEnabled),
    autoAdjustments: num(value.autoAdjustments, base.autoAdjustments),
    affineParams: affine,
    slowBlinkMinMs:
      typeof value.slowBlinkMinMs === 'number' ? Math.max(200, Math.round(value.slowBlinkMinMs)) : undefined,
    slowBlinkMaxMs:
      typeof value.slowBlinkMaxMs === 'number' ? Math.max(300, Math.round(value.slowBlinkMaxMs)) : undefined,
    version: 2,
    profileQuality: clamp01(num(value.profileQuality, base.profileQuality)),
    livenessMinScore: clamp01(num(value.livenessMinScore, base.livenessMinScore)),
    handPinchMinConfidence: clamp01(num(value.handPinchMinConfidence, base.handPinchMinConfidence)),
    handPointMinConfidence: clamp01(num(value.handPointMinConfidence, base.handPointMinConfidence)),
    handOpenPalmMinConfidence: clamp01(num(value.handOpenPalmMinConfidence, base.handOpenPalmMinConfidence)),
    headYawCommandThreshold: Math.max(6, num(value.headYawCommandThreshold, base.headYawCommandThreshold)),
    nodRangeThreshold: Math.max(6, num(value.nodRangeThreshold, base.nodRangeThreshold)),
    residualModel: normalizeResidualModel(value.residualModel),
    deviceClass: inputDeviceClass ?? base.deviceClass,
    gestureThresholds,
  };

  if (
    typeof profile.slowBlinkMinMs === 'number' &&
    typeof profile.slowBlinkMaxMs === 'number' &&
    profile.slowBlinkMinMs >= profile.slowBlinkMaxMs
  ) {
    profile.slowBlinkMaxMs = profile.slowBlinkMinMs + 300;
  }

  return profile;
};

export const loadVisionCalibration = (): VisionCalibrationProfile => {
  const fallback = getDefaultVisionCalibration();
  try {
    const raw = localStorage.getItem(VISION_CALIBRATION_STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = normalizeVisionCalibration(JSON.parse(raw));
    return parsed.isCalibrated ? parsed : withVisionDeviceDefaults(parsed);
  } catch {
    return fallback;
  }
};

export const saveVisionCalibration = (value: VisionCalibrationProfile) => {
  const normalized = normalizeVisionCalibration(value);
  localStorage.setItem(VISION_CALIBRATION_STORAGE_KEY, JSON.stringify(normalized));
  try {
    window.dispatchEvent(new CustomEvent('visionCalibrationChanged', { detail: normalized }));
  } catch {
    // ignore
  }
};

export const mergeVisionCalibration = (
  current: VisionCalibrationProfile,
  patch: Partial<VisionCalibrationProfile>
): VisionCalibrationProfile => {
  return normalizeVisionCalibration({
    ...current,
    ...patch,
    gestureThresholds: {
      ...(current.gestureThresholds ?? {}),
      ...(patch.gestureThresholds ?? {}),
    },
  });
};
