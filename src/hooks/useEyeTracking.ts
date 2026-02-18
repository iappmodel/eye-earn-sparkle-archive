import { useState, useEffect, useRef, useCallback } from 'react';
import type { AttentionFlag } from '@/constants/attention';
import {
  getAttentionPreset,
  getAttentionConfig,
  loadAttentionPresetFromStorage,
  type AttentionPresetId,
} from '@/constants/attention';
import { getPassThreshold, isCashEligible } from '@/constants/attentionPass';
import { loadRemoteControlSettings } from '@/hooks/useBlinkRemoteControl';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import { useVision, USE_VISION_CONTEXT } from '@/contexts/VisionContext';
import type { SkinToneFallbackResult } from '@/lib/skinToneFallback';
import {
  createAttentionState,
  resetForPromoStart,
  applyAttentionSample,
  getAttentionResult as getEngineAttentionResult,
  computeRawAttention,
  type AttentionSample as EngineAttentionSample,
  type AttentionSource,
} from '@/lib/attentionScoring';

export interface GazePosition {
  x: number;
  y: number;
}

/** Session aggregate stats for the current tracking session */
export interface AttentionSessionStats {
  minScore: number;
  maxScore: number;
  avgScore: number;
  sampleCount: number;
}

/** Source of attention data: Vision Engine (shared with Remote Control) or fallback (own camera). */
export type EyeTrackingSource = 'vision_engine' | 'fallback';

/** Vision status for UI: loading (waiting for MediaPipe), active (Vision providing data), fallback (skin-tone). */
export type VisionStatus = 'loading' | 'active' | 'fallback';

/** Result from getAttentionResult – time-weighted ledger, source and cash-eligibility for rewards. */
export interface AttentionResult {
  score: number;
  passed: boolean;
  required: number;
  attentiveMs: number;
  totalMs: number;
  source: AttentionSource;
  sourceConfidence: number;
  uiScore: number;
  /** False when source is fallback/none – do not allow Icoin payout. */
  cashEligible: boolean;
  /** Legacy: kept for backward compat; derived from attentiveMs/totalMs. */
  framesDetected: number;
  totalFrames: number;
  /** Samples { t, r } for server-side verification; server recomputes score from these. */
  samples: Array<{ t: number; r: number }>;
}

interface EyeTrackingState {
  isTracking: boolean;
  isFaceDetected: boolean;
  attentionScore: number;
  isPermissionGranted: boolean;
  error: string | null;
  /** Latest raw gaze (0–1) when using Vision Engine; null when fallback or no face. */
  lastGazePosition: GazePosition | null;
  /** Latest calibrated gaze when available; null otherwise. */
  lastCalibratedGazePosition: GazePosition | null;
  /** True briefly after recovering from error (e.g. face lost then restored). */
  isRecovering: boolean;
  /** Current consecutive seconds with attention above threshold */
  attentionStreakSec: number;
  /** Total milliseconds counted as attentive this session */
  totalAttentiveMs: number;
  /** Human-readable flags for why attention may be low (NO_FACE, EYES_CLOSED, LOOK_AWAY, BAD_POSE) */
  lastFlags: AttentionFlag[];
  /** Aggregate min/max/avg for the session; updated as samples arrive */
  sessionStats: AttentionSessionStats;
  /** Data source: vision_engine = shared camera with Remote Control, fallback = own skin-tone camera */
  source: EyeTrackingSource;
  /** Vision pipeline status: loading (waiting for MediaPipe), active (high accuracy), fallback (basic mode) */
  visionStatus: VisionStatus;
  /** True when camera failed due to missing user gesture (iOS). UI should show "Tap to enable". */
  needsUserGesture: boolean;
}

/** Thresholds for attention scoring (aligned with useAttentionVerification / calibration). */
export interface AttentionThresholds {
  /** EAR below which eyes are considered closed (default 0.18). */
  earThreshold?: number;
  /** Gaze must be within this range of center to count as "forward" (default 0.22). */
  gazeForwardRange?: number;
  /** Max absolute head yaw in degrees (default 20). */
  maxYaw?: number;
  /** Max absolute head pitch in degrees (default 15). */
  maxPitch?: number;
  /** Rolling average >= this (0–1) counts as one "attentive" frame for reward (default 0.70). */
  attentionFrameThreshold?: number;
}

interface UseEyeTrackingOptions extends AttentionThresholds {
  enabled?: boolean;
  /** Use preset from storage or this id; overrides individual threshold options when set */
  preset?: AttentionPresetId | null;
  onAttentionLost?: () => void;
  onAttentionRestored?: () => void;
  /** Minimum final score (0–100) to pass validation (default 85). */
  requiredAttentionThreshold?: number;
  /** Extra smoothing for displayed attention score 0–1 (default 0.3). Higher = smoother, less jumpy on low-end devices. */
  scoreSmoothing?: number;
  /** Wait time (ms) before falling back to skin-tone when Vision Engine doesn't produce data (default 5000). Increase for slow devices. */
  visionFallbackMs?: number;
}

const DEFAULT_EAR = 0.18;
const DEFAULT_GAZE_RANGE = 0.22;
const DEFAULT_MAX_YAW = 20;
const DEFAULT_MAX_PITCH = 15;
const DEFAULT_ATTENTIVE_FRAME = 0.70;
const ROLLING_WINDOW_MS = 2000;
const EMA_ALPHA = 0.2;
/** Default wait for Vision Engine before falling back to skin-tone (ms). */
const DEFAULT_VISION_FALLBACK_MS = 5000;
/** When on fallback, retry Vision every 30s (model may have loaded late). */
const VISION_RETRY_INTERVAL_MS = 30000;
/** Sample rate for attention: process at 5–10 Hz so main thread stays lightweight (video + events only). */
const SAMPLE_INTERVAL_MS = 100;
/** Starvation: if no valid sample for this long, apply fail-closed 'none' sample. */
const STARVATION_MS = 700;
/** Fallback only when no valid vision sample for this long, or MediaPipe no face > VISION_FALLBACK_MS. */
const FALLBACK_STARVING_MS = 500;
const EMPTY_SESSION_STATS: AttentionSessionStats = {
  minScore: 100,
  maxScore: 0,
  avgScore: 0,
  sampleCount: 0,
};

/**
 * Eye-tracking hook for promo video attention verification (MediaPipe / Vision Engine).
 *
 * When the Remote Control's Vision Engine is active, listens for
 * `visionEngineSample` and scores attention from face presence, eyes open (EAR),
 * gaze forward, and head pose. Uses calibrated gaze when the event includes
 * `calibratedGazePosition` (fixes reward validation for users who calibrated).
 *
 * Final score and frames sent to validate-attention are based on weighted
 * "attentive" frames (rolling average >= attentionFrameThreshold), not just
 * face presence, so rewards reflect actual attention.
 *
 * Provides attentionStreakSec, totalAttentiveMs, lastFlags, and sessionStats for
 * UI and insights. Supports presets (strict / normal / relaxed) via options.preset.
 *
 * Otherwise falls back to a lightweight skin-tone heuristic with its own camera.
 */
export function useEyeTracking(options: UseEyeTrackingOptions = {}) {
  const presetId = options.preset ?? loadAttentionPresetFromStorage();
  const preset = getAttentionPreset(presetId);

  const {
    enabled = false,
    onAttentionLost,
    onAttentionRestored,
    requiredAttentionThreshold = options.requiredAttentionThreshold ?? Math.round(preset.requiredAttentionThreshold),
    earThreshold = options.earThreshold ?? preset.earThreshold,
    gazeForwardRange = options.gazeForwardRange ?? preset.gazeForwardRange,
    maxYaw = options.maxYaw ?? preset.maxYaw,
    maxPitch = options.maxPitch ?? preset.maxPitch,
    attentionFrameThreshold = options.attentionFrameThreshold ?? preset.attentionFrameThreshold,
    scoreSmoothing = 0.3,
    visionFallbackMs = DEFAULT_VISION_FALLBACK_MS,
  } = options;

  const rollingWindowMs = preset.rollingWindowMs;
  const emaAlpha = preset.emaAlpha;

  // Track RC enabled so we run our own Vision when RC is off
  const [rcEnabled, setRcEnabled] = useState(() => loadRemoteControlSettings().enabled);

  // Refs for preset params so fallback interval always uses current values
  const presetRef = useRef({ rollingWindowMs, emaAlpha, attentionFrameThreshold, scoreSmoothing, visionFallbackMs });
  presetRef.current = { rollingWindowMs, emaAlpha, attentionFrameThreshold, scoreSmoothing, visionFallbackMs };
  const presetIdRef = useRef<AttentionPresetId>(presetId);
  presetIdRef.current = presetId;
  const requiredThresholdRef = useRef(requiredAttentionThreshold);
  requiredThresholdRef.current = requiredAttentionThreshold;

  // Time-weighted attention ledger (stable across sampling rates)
  const attentionStateRef = useRef(createAttentionState(scoreSmoothing || 0.25));
  const promoActiveRef = useRef(false);
  const MAX_SESSION_SAMPLES = 2000;
  const sessionSamplesRef = useRef<Array<{ t: number; r: number }>>([]);
  const promoStartTsRef = useRef<number>(0);
  const lastValidSampleTsRef = useRef<number>(0);

  const [state, setState] = useState<EyeTrackingState>({
    isTracking: false,
    isFaceDetected: false,
    attentionScore: 0,
    isPermissionGranted: false,
    error: null,
    lastGazePosition: null,
    lastCalibratedGazePosition: null,
    isRecovering: false,
    attentionStreakSec: 0,
    totalAttentiveMs: 0,
    lastFlags: [],
    sessionStats: EMPTY_SESSION_STATS,
    source: 'fallback',
    visionStatus: 'fallback',
    needsUserGesture: false,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const visionFallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visionRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skinTonePrevFrameRef = useRef<{ data: Uint8ClampedArray | null }>({ data: null });

  const visionCtx = useVision();
  const useContextPath = USE_VISION_CONTEXT && !!visionCtx && enabled && !rcEnabled;
  // When RC is off, run our own Vision Engine for MediaPipe-quality attention (no skin-tone fallback)
  // When useContextPath, we use VisionContext instead of own camera
  const useOwnVision = enabled && !rcEnabled && !useContextPath;
  const rcSettings = loadRemoteControlSettings();
  const vision = useVisionEngine({
    enabled: useOwnVision,
    videoRef,
    mirrorX: true,
    invertY: true,
    gazeScale: 1.6,
    gazeSmoothing: 0.25,
    visionBackend: rcSettings.visionBackend ?? 'face_mesh',
    blinkConfig: { calibrationMode: true },
  });
  const wasAttentiveRef = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Batched sampling: latest vision payload (from RC event or from interval reading context/own vision)
  const latestVisionSampleRef = useRef<Record<string, unknown> | null>(null);
  const visionCtxRef = useRef<ReturnType<typeof useVision> | null>(null);
  const visionRef = useRef<ReturnType<typeof useVisionEngine> | null>(null);
  const sampleIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const processFallbackResultRef = useRef<(r: SkinToneFallbackResult) => void>(() => {});

  // Use refs for callbacks to prevent dependency changes
  const onAttentionLostRef = useRef(onAttentionLost);
  const onAttentionRestoredRef = useRef(onAttentionRestored);
  const isInitializingRef = useRef(false);
  const isTabVisibleRef = useRef(true);
  const usingVisionEngineRef = useRef(false);

  const hadErrorRef = useRef(false);
  const recoveringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Streak and session stats (from time-weighted state + uiScore for session min/max/avg)
  const streakStartRef = useRef<number>(0);
  const lastSampleTsRef = useRef<number>(0);
  const sessionStatsRef = useRef<{ min: number; max: number; sum: number; count: number }>({
    min: 100,
    max: 0,
    sum: 0,
    count: 0,
  });

  // Update callback refs when they change
  useEffect(() => {
    onAttentionLostRef.current = onAttentionLost;
  }, [onAttentionLost]);

  useEffect(() => {
    onAttentionRestoredRef.current = onAttentionRestored;
  }, [onAttentionRestored]);

  // Track tab visibility
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      isTabVisibleRef.current = visible;
      if (!visible) {
        attentionStateRef.current.lastTs = null;
        if (wasAttentiveRef.current) {
          wasAttentiveRef.current = false;
          onAttentionLostRef.current?.();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Helper: release our own camera when Vision Engine takes over (avoids duplicate camera).
  const releaseOwnCamera = useCallback(() => {
    if (visionFallbackTimerRef.current) {
      clearTimeout(visionFallbackTimerRef.current);
      visionFallbackTimerRef.current = null;
    }
    if (visionRetryTimerRef.current) {
      clearTimeout(visionRetryTimerRef.current);
      visionRetryTimerRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    canvasRef.current = null;
    skinTonePrevFrameRef.current = { data: null };
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }
    isInitializingRef.current = false;
  }, []);

  // Build gaze positions from a vision payload (shared for batching).
  const gazeFromPayload = useCallback((d: { gazePosition?: { x: number; y: number }; calibratedGazePosition?: { x: number; y: number } }) => {
    const gazePos: GazePosition | null =
      d.gazePosition && typeof d.gazePosition.x === 'number' && typeof d.gazePosition.y === 'number'
        ? { x: d.gazePosition.x, y: d.gazePosition.y }
        : null;
    const calibratedPos: GazePosition | null =
      d.calibratedGazePosition &&
      typeof d.calibratedGazePosition.x === 'number' &&
      typeof d.calibratedGazePosition.y === 'number'
        ? { x: d.calibratedGazePosition.x, y: d.calibratedGazePosition.y }
        : gazePos;
    return { gazePos, calibratedPos };
  }, []);

  // Process one vision payload: time-weighted ledger (applyAttentionSample), UI state, flags. Do not use UI EMA for reward.
  const processVisionPayload = useCallback(
    (d: {
      hasFace: boolean;
      eyeEAR?: number;
      gazePosition?: { x: number; y: number };
      calibratedGazePosition?: { x: number; y: number };
      headYaw?: number;
      headPitch?: number;
    }, source: AttentionSource, sourceConfidence: number, needsUserGesture = false) => {
      const cfg = getAttentionConfig(presetIdRef.current);
      const state = attentionStateRef.current;

      if (document.hidden) {
        applyAttentionSample(
          { hasFace: false },
          state,
          cfg,
          'none',
          0
        );
        lastValidSampleTsRef.current = Date.now();
        setState((prev) => ({
          ...prev,
          isFaceDetected: false,
          attentionScore: Math.round(state.uiEma * 100),
          totalAttentiveMs: state.attentiveMs,
          lastFlags: ['NO_FACE'],
        }));
        return;
      }

      const sample: EngineAttentionSample = {
        hasFace: d.hasFace,
        eyeEAR: d.eyeEAR,
        gazePosition: d.gazePosition,
        calibratedGazePosition: d.calibratedGazePosition,
        headYaw: d.headYaw,
        headPitch: d.headPitch,
      };
      const raw = computeRawAttention(sample, cfg, state.neutralGaze ?? null, state.useCalibratedGaze);
      if (promoActiveRef.current) {
        const arr = sessionSamplesRef.current;
        arr.push({ t: Date.now(), r: raw });
        if (arr.length > MAX_SESSION_SAMPLES) arr.shift();
      }
      applyAttentionSample(sample, state, cfg, source, sourceConfidence);
      const now = Date.now();
      lastValidSampleTsRef.current = now;
      lastSampleTsRef.current = now;

      const uiScore100 = Math.round(state.uiEma * 100);
      const isAttentive = state.totalMs > 0 && state.attentiveMs / state.totalMs >= (getPassThreshold(presetIdRef.current) / 100) * 0.8;
      if (isAttentive && !wasAttentiveRef.current) {
        wasAttentiveRef.current = true;
        onAttentionRestoredRef.current?.();
      } else if (!isAttentive && wasAttentiveRef.current) {
        wasAttentiveRef.current = false;
        onAttentionLostRef.current?.();
      }

      const facePresent = d.hasFace && isTabVisibleRef.current;
      const flags: AttentionFlag[] = [];
      if (!facePresent) flags.push('NO_FACE');
      if ((d.eyeEAR ?? 0) <= earThreshold) flags.push('EYES_CLOSED');
      const gazeForCheck = d.calibratedGazePosition ?? d.gazePosition;
      const gazeForward =
        gazeForCheck &&
        Math.abs(gazeForCheck.x - 0.5) < gazeForwardRange &&
        Math.abs(gazeForCheck.y - 0.5) < gazeForwardRange;
      if (!gazeForward) flags.push('LOOK_AWAY');
      if (Math.abs(d.headYaw ?? 0) >= maxYaw || Math.abs(d.headPitch ?? 0) >= maxPitch) flags.push('BAD_POSE');

      sessionStatsRef.current.count++;
      sessionStatsRef.current.sum += uiScore100;
      sessionStatsRef.current.min = Math.min(sessionStatsRef.current.min, uiScore100);
      sessionStatsRef.current.max = Math.max(sessionStatsRef.current.max, uiScore100);
      const sessionStats: AttentionSessionStats = {
        minScore: sessionStatsRef.current.min,
        maxScore: sessionStatsRef.current.max,
        avgScore: Math.round(sessionStatsRef.current.sum / sessionStatsRef.current.count),
        sampleCount: sessionStatsRef.current.count,
      };

      const { gazePos, calibratedPos } = gazeFromPayload(d);
      const wasError = hadErrorRef.current;
      if (hadErrorRef.current) hadErrorRef.current = false;
      if (recoveringTimeoutRef.current) {
        clearTimeout(recoveringTimeoutRef.current);
        recoveringTimeoutRef.current = null;
      }

      setState((prev) => ({
        ...prev,
        isTracking: true,
        isPermissionGranted: true,
        isFaceDetected: facePresent,
        attentionScore: uiScore100,
        error: null,
        lastGazePosition: gazePos,
        lastCalibratedGazePosition: calibratedPos,
        isRecovering: wasError,
        lastFlags: flags,
        attentionStreakSec: isAttentive && streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0,
        totalAttentiveMs: state.attentiveMs,
        sessionStats,
        source: source === 'vision' ? 'vision_engine' : 'fallback',
        visionStatus: source === 'vision' ? 'active' : source === 'fallback' ? 'fallback' : 'loading',
        needsUserGesture,
      }));
      if (isAttentive) {
        if (streakStartRef.current === 0) streakStartRef.current = now;
      } else {
        streakStartRef.current = 0;
      }

      if (wasError) {
        recoveringTimeoutRef.current = setTimeout(() => {
          recoveringTimeoutRef.current = null;
          setState((prev) => (prev.isRecovering ? { ...prev, isRecovering: false } : prev));
        }, 2000);
      }
    },
    [earThreshold, gazeForwardRange, maxYaw, maxPitch, gazeFromPayload]
  );

  // Process one skin-tone fallback result: feed into time-weighted ledger with source 'fallback'.
  const processFallbackResult = useCallback((fallbackResult: SkinToneFallbackResult) => {
    const cfg = getAttentionConfig(presetIdRef.current);
    const state = attentionStateRef.current;
    const facePresent = fallbackResult.facePresent && isTabVisibleRef.current;
    const now = Date.now();
    const raw = facePresent ? fallbackResult.rawScore : 0;
    const sample: EngineAttentionSample = {
      hasFace: facePresent,
      rawFallbackScore: facePresent ? fallbackResult.rawScore : 0,
    };
    if (promoActiveRef.current) {
      const arr = sessionSamplesRef.current;
      arr.push({ t: now, r: raw });
      if (arr.length > MAX_SESSION_SAMPLES) arr.shift();
    }
    applyAttentionSample(sample, state, cfg, 'fallback', 0.5);
    lastValidSampleTsRef.current = now;
    lastSampleTsRef.current = now;

    const uiScore100 = Math.round(state.uiEma * 100);
    const isAttentive = state.totalMs > 0 && state.attentiveMs / state.totalMs >= (getPassThreshold(presetIdRef.current) / 100) * 0.8;
    if (isAttentive && !wasAttentiveRef.current) {
      wasAttentiveRef.current = true;
      onAttentionRestoredRef.current?.();
    } else if (!isAttentive && wasAttentiveRef.current) {
      wasAttentiveRef.current = false;
      onAttentionLostRef.current?.();
    }
    if (isAttentive && streakStartRef.current === 0) streakStartRef.current = now;
    else if (!isAttentive) streakStartRef.current = 0;

    sessionStatsRef.current.count++;
    sessionStatsRef.current.sum += uiScore100;
    sessionStatsRef.current.min = Math.min(sessionStatsRef.current.min, uiScore100);
    sessionStatsRef.current.max = Math.max(sessionStatsRef.current.max, uiScore100);
    const sessionStats: AttentionSessionStats = {
      minScore: sessionStatsRef.current.min,
      maxScore: sessionStatsRef.current.max,
      avgScore: Math.round(sessionStatsRef.current.sum / sessionStatsRef.current.count),
      sampleCount: sessionStatsRef.current.count,
    };
    const lastFlags: AttentionFlag[] =
      fallbackResult.lastFlags.length > 0 ? (fallbackResult.lastFlags as AttentionFlag[]) : (facePresent ? [] : ['NO_FACE']);

    setState((prev) => ({
      ...prev,
      isFaceDetected: facePresent,
      attentionScore: uiScore100,
      attentionStreakSec: streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0,
      totalAttentiveMs: state.attentiveMs,
      sessionStats,
      lastFlags,
      source: 'fallback',
      visionStatus: 'fallback',
    }));
  }, []);

  useEffect(() => {
    processFallbackResultRef.current = processFallbackResult;
  }, [processFallbackResult]);

  // Listen for Vision Engine samples from Remote Control (when active).
  // Lightweight: only store latest payload and release camera; scoring runs at 5–10 Hz in sample interval.
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || typeof d.hasFace !== 'boolean') return;

      if (streamRef.current) releaseOwnCamera();
      usingVisionEngineRef.current = true;
      latestVisionSampleRef.current = d;
    };

    window.addEventListener('visionEngineSample', handler);
    return () => {
      window.removeEventListener('visionEngineSample', handler);
      usingVisionEngineRef.current = false;
    };
  }, [enabled, releaseOwnCamera]);

  // Batched sampling at 5–10 Hz: process latest vision payload (from RC, context, or own Vision) so main thread stays light.
  useEffect(() => {
    if (!enabled) return;

    visionCtxRef.current = visionCtx ?? null;
    visionRef.current = vision;

    sampleIntervalRef.current = setInterval(() => {
      const fromRc = latestVisionSampleRef.current;
      if (fromRc && typeof fromRc.hasFace === 'boolean') {
        processVisionPayload(
          {
            hasFace: fromRc.hasFace,
            eyeEAR: typeof fromRc.eyeEAR === 'number' ? fromRc.eyeEAR : undefined,
            gazePosition: fromRc.gazePosition as { x: number; y: number } | undefined,
            calibratedGazePosition: fromRc.calibratedGazePosition as { x: number; y: number } | undefined,
            headYaw: typeof fromRc.headYaw === 'number' ? fromRc.headYaw : undefined,
            headPitch: typeof fromRc.headPitch === 'number' ? fromRc.headPitch : undefined,
          },
          'vision',
          1,
          (fromRc as { needsUserGesture?: boolean }).needsUserGesture ?? false
        );
        return;
      }
      const ctx = visionCtxRef.current;
      if (useContextPath && ctx?.visionState) {
        const vs = ctx.visionState;
        processVisionPayload(
          {
            hasFace: !!vs.hasFace,
            eyeEAR: vs.eyeEAR,
            gazePosition: vs.gazePosition ?? undefined,
            headYaw: vs.headYaw,
            headPitch: vs.headPitch,
          },
          'vision',
          1,
          ctx.needsUserGesture ?? false
        );
        return;
      }
      const own = visionRef.current;
      if (useOwnVision && own && (own.hasFace || own.landmarks)) {
        processVisionPayload(
          {
            hasFace: own.hasFace,
            eyeEAR: own.eyeEAR,
            gazePosition: own.gazePosition ?? undefined,
            calibratedGazePosition: own.gazePosition ?? undefined,
            headYaw: own.headYaw,
            headPitch: own.headPitch,
          },
          'vision',
          1
        );
      }
    }, SAMPLE_INTERVAL_MS);

    return () => {
      if (sampleIntervalRef.current) {
        clearInterval(sampleIntervalRef.current);
        sampleIntervalRef.current = null;
      }
    };
  }, [enabled, useContextPath, useOwnVision, processVisionPayload]);

  // Starvation watchdog: when promo active and no valid sample for STARVATION_MS, apply fail-closed 'none' sample.
  const starvationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    starvationIntervalRef.current = setInterval(() => {
      if (!promoActiveRef.current) return;
      const now = Date.now();
      if (now - lastValidSampleTsRef.current > STARVATION_MS) {
        processVisionPayload({ hasFace: false }, 'none', 0);
      }
    }, 250);
    return () => {
      if (starvationIntervalRef.current) {
        clearInterval(starvationIntervalRef.current);
        starvationIntervalRef.current = null;
      }
    };
  }, [enabled, processVisionPayload]);

  // When using VisionContext (RC off, context available), request camera and feed visionState into attention scoring
  const contextReleaseRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    if (!useContextPath || !visionCtx) return;
    contextReleaseRef.current = visionCtx.requestCamera();
    return () => {
      if (contextReleaseRef.current) {
        contextReleaseRef.current();
        contextReleaseRef.current = null;
      }
    };
  }, [useContextPath, visionCtx]);

  // Sync needsUserGesture from context when using context path
  useEffect(() => {
    if (!useContextPath || !visionCtx) return;
    if (visionCtx.needsUserGesture) {
      setState((prev) => (prev.needsUserGesture ? prev : { ...prev, needsUserGesture: true }));
    }
  }, [useContextPath, visionCtx?.needsUserGesture]);

  // VisionContext and useOwnVision scoring are handled by the batched sample interval above (5–10 Hz).
  // When Vision (own or context) recovers from fallback, clear fallback timers.
  useEffect(() => {
    if (!useOwnVision) return;
    if (vision.hasFace || vision.landmarks) {
      usingVisionEngineRef.current = true;
      if (visionFallbackTimerRef.current) {
        clearTimeout(visionFallbackTimerRef.current);
        visionFallbackTimerRef.current = null;
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
        detectionIntervalRef.current = null;
      }
      if (visionRetryTimerRef.current) {
        clearTimeout(visionRetryTimerRef.current);
        visionRetryTimerRef.current = null;
      }
    }
  }, [useOwnVision, vision.hasFace, vision.landmarks]);

  // Sync rcEnabled and react to Remote Control enable/disable
  useEffect(() => {
    const handler = () => {
      const next = loadRemoteControlSettings().enabled;
      setRcEnabled(next);
      if (next) {
        // RC turned on – release our camera (own or context); Vision Engine will provide data via event
        if (contextReleaseRef.current) {
          contextReleaseRef.current();
          contextReleaseRef.current = null;
        }
        releaseOwnCamera();
        usingVisionEngineRef.current = true;
        setState((prev) => ({ ...prev, source: 'vision_engine', visionStatus: 'active' }));
      } else if (enabled) {
        // RC turned off – start our camera + Vision or use context for MediaPipe-quality attention
        usingVisionEngineRef.current = false;
        startTracking();
      }
    };
    handler(); // initial sync
    window.addEventListener('remoteControlSettingsChanged', handler);
    return () => window.removeEventListener('remoteControlSettingsChanged', handler);
  }, [enabled, releaseOwnCamera, startTracking]);

  // Stop tracking - defined first so startTracking can reference it
  const stopTracking = useCallback(() => {
    if (visionFallbackTimerRef.current) {
      clearTimeout(visionFallbackTimerRef.current);
      visionFallbackTimerRef.current = null;
    }
    if (visionRetryTimerRef.current) {
      clearTimeout(visionRetryTimerRef.current);
      visionRetryTimerRef.current = null;
    }
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (useContextPath && contextReleaseRef.current) {
      contextReleaseRef.current();
      contextReleaseRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    isInitializingRef.current = false;
    skinTonePrevFrameRef.current = { data: null };
    if (recoveringTimeoutRef.current) {
      clearTimeout(recoveringTimeoutRef.current);
      recoveringTimeoutRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      isTracking: false,
      isFaceDetected: false,
      lastGazePosition: null,
      lastCalibratedGazePosition: null,
      source: 'fallback',
      visionStatus: 'fallback',
      needsUserGesture: false,
    }));
  }, [useContextPath]);

  // Request camera permission and start tracking
  const startTracking = useCallback(async () => {
    // If Vision Engine is already providing data, don't open a second camera
    if (usingVisionEngineRef.current) {
      setState((prev) => ({
        ...prev,
        isTracking: true,
        isPermissionGranted: true,
        error: null,
        source: 'vision_engine',
        visionStatus: 'active',
      }));
      return;
    }

    // When using VisionContext (RC off), trigger camera start (effect already requested)
    if (useContextPath && visionCtx) {
      await visionCtx.startCamera();
      setState((prev) => ({
        ...prev,
        isTracking: true,
        isPermissionGranted: true,
        error: null,
        needsUserGesture: visionCtx.needsUserGesture ?? false,
        source: 'vision_engine',
        visionStatus: visionCtx.isActive ? 'active' : 'loading',
      }));
      return;
    }

    // When Remote Control is enabled, we use its Vision Engine – never open our own camera.
    // This prevents duplicate cameras; visionEngineSample will provide data when RC's camera starts.
    const rcSettings = loadRemoteControlSettings();
    if (rcSettings.enabled) {
      setState((prev) => ({
        ...prev,
        isTracking: true,
        isPermissionGranted: true,
        error: null,
        source: 'vision_engine',
        visionStatus: 'active',
      }));
      return;
    }

    // Guard against multiple simultaneous calls
    if (isInitializingRef.current || streamRef.current) {
      return;
    }

    isInitializingRef.current = true;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      
      // Check if we should still be tracking (might have been disabled during async call)
      if (!isInitializingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;

      // Create hidden video element for camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;

      // Create canvas for face detection
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvasRef.current = canvas;

      await video.play();

      // Reset state so fallback starts fresh (avoids mixing with prior Vision data)
      lastSampleTsRef.current = 0;
      lastValidSampleTsRef.current = 0;
      streakStartRef.current = 0;
      sessionStatsRef.current = { min: 100, max: 0, sum: 0, count: 0 };
      resetForPromoStart(attentionStateRef.current, Date.now());

      setState((prev) => ({
        ...prev,
        isTracking: true,
        isPermissionGranted: true,
        error: null,
        needsUserGesture: false,
        source: 'vision_engine',
        visionStatus: 'loading',
      }));

      const startFallbackInterval = () => {
        if (!streamRef.current || detectionIntervalRef.current) return;
        setState((prev) => ({ ...prev, source: 'fallback', visionStatus: 'fallback' }));

        // Create worker once for skin-tone inference off main thread
        if (!workerRef.current) {
          workerRef.current = new Worker(
            new URL('../workers/eyeTracking.worker.ts', import.meta.url),
            { type: 'module' }
          );
          workerRef.current.onmessage = (ev: MessageEvent<{ type: string; rawScore: number; facePresent: boolean; lastFlags: string[] }>) => {
            if (ev.data?.type === 'result') {
              processFallbackResultRef.current({
                rawScore: ev.data.rawScore,
                facePresent: ev.data.facePresent,
                lastFlags: ev.data.lastFlags ?? [],
              });
            }
          };
        }

        // Batch at 5–10 Hz: main thread only captures frame and posts to worker; inference runs in worker
        detectionIntervalRef.current = setInterval(() => {
          if (usingVisionEngineRef.current) return;
          if (!videoRef.current || !canvasRef.current || !workerRef.current) return;

          const ctx = canvasRef.current.getContext('2d');
          if (!ctx) return;

          ctx.drawImage(videoRef.current, 0, 0, 320, 240);
          const imageData = ctx.getImageData(80, 40, 160, 160);
          const buffer = imageData.data.buffer;
          workerRef.current.postMessage(
            { type: 'analyze', data: buffer, width: 160, height: 160 },
            [buffer]
          );
        }, SAMPLE_INTERVAL_MS);
        // Periodic retry: re-check Vision every 30s (model may have loaded late)
        visionRetryTimerRef.current = setTimeout(() => {
          visionRetryTimerRef.current = null;
          if (usingVisionEngineRef.current || !detectionIntervalRef.current) return;
          clearInterval(detectionIntervalRef.current);
          detectionIntervalRef.current = null;
          usingVisionEngineRef.current = false;
          setState((prev) => ({ ...prev, visionStatus: 'loading' }));
          const ms = presetRef.current.visionFallbackMs;
          visionFallbackTimerRef.current = setTimeout(() => {
            visionFallbackTimerRef.current = null;
            if (usingVisionEngineRef.current) return;
            startFallbackInterval();
          }, ms);
        }, VISION_RETRY_INTERVAL_MS);
      };

      const ms = presetRef.current.visionFallbackMs;
      visionFallbackTimerRef.current = setTimeout(() => {
        visionFallbackTimerRef.current = null;
        if (usingVisionEngineRef.current) return;
        startFallbackInterval();
      }, ms);

    } catch (error) {
      isInitializingRef.current = false;
      hadErrorRef.current = true;
      const isNotAllowed = error instanceof DOMException && error.name === 'NotAllowedError';
      const isGestureRequired = isNotAllowed || (error instanceof Error && /gesture|user.?interaction|permission/i.test(error.message));
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Camera access denied',
        isPermissionGranted: false,
        isRecovering: false,
        needsUserGesture: isGestureRequired,
      }));
    }
  }, []);

  // Reset attention for new content (e.g. new promo video); resets time-weighted ledger.
  const resetAttention = useCallback(() => {
    const now = Date.now();
    resetForPromoStart(attentionStateRef.current, now);
    promoStartTsRef.current = now;
    lastValidSampleTsRef.current = now;
    wasAttentiveRef.current = true;
    streakStartRef.current = 0;
    lastSampleTsRef.current = 0;
    sessionStatsRef.current = { min: 100, max: 0, sum: 0, count: 0 };
    setState((prev) => ({
      ...prev,
      attentionScore: 0,
      attentionStreakSec: 0,
      totalAttentiveMs: 0,
      lastFlags: [],
      sessionStats: EMPTY_SESSION_STATS,
    }));
  }, []);

  // Retry after error (e.g. user granted permission or re-enabled camera)
  const retryTracking = useCallback(() => {
    hadErrorRef.current = false;
    setState(prev => ({ ...prev, error: null, isRecovering: false, needsUserGesture: false }));
    void startTracking();
  }, [startTracking]);

  // cameraUserStart: iOS requires getUserMedia from a user gesture. This event is dispatched
  // from click/tap handlers (e.g. play button). Handler runs synchronously so gesture is preserved.
  useEffect(() => {
    const handler = () => {
      if (!enabled) return;
      const rcSettings = loadRemoteControlSettings();
      if (rcSettings.enabled) return; // RC has its own camera
      startTracking();
    };
    window.addEventListener('cameraUserStart', handler);
    return () => window.removeEventListener('cameraUserStart', handler);
  }, [enabled, startTracking]);

  // Start promo attention: reset time-weighted ledger and mark promo active (call when promo starts).
  const startPromoAttention = useCallback(() => {
    const now = Date.now();
    resetForPromoStart(attentionStateRef.current, now);
    promoActiveRef.current = true;
    promoStartTsRef.current = now;
    lastValidSampleTsRef.current = now;
    streakStartRef.current = 0;
    sessionStatsRef.current = { min: 100, max: 0, sum: 0, count: 0 };
    sessionSamplesRef.current = [];
  }, []);

  // Stop promo attention (call when promo ends; then call getAttentionResult for validation).
  const stopPromoAttention = useCallback(() => {
    promoActiveRef.current = false;
  }, []);

  // Get final attention result for validation (time-weighted score, source, cashEligible).
  const getAttentionResult = useCallback((): AttentionResult => {
    const state = attentionStateRef.current;
    const preset = presetIdRef.current;
    const required = requiredThresholdRef.current > 0 ? requiredThresholdRef.current : getPassThreshold(preset);
    const engineResult = getEngineAttentionResult(state);
    const score = engineResult.score;
    const cashEligible = isCashEligible(engineResult.source);
    const passed = score >= required && cashEligible;
    const totalMs = state.totalMs;
    const attentiveMs = state.attentiveMs;
    const totalFrames = Math.max(1, Math.round(totalMs / 100));
    const framesDetected = Math.round(attentiveMs / 100);
    return {
      score,
      passed,
      required,
      attentiveMs,
      totalMs,
      source: engineResult.source,
      sourceConfidence: engineResult.sourceConfidence,
      uiScore: engineResult.uiScore,
      cashEligible,
      framesDetected,
      totalFrames,
      samples: [...sessionSamplesRef.current],
    };
  }, []);

  // Auto start/stop based on enabled prop. On iOS, startTracking may fail without a user gesture;
  // cameraUserStart (from play button tap) provides the gesture.
  const prevEnabledRef = useRef(enabled);
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;
    if (enabled && !wasEnabled) {
      startPromoAttention();
      startTracking();
    } else if (!enabled && wasEnabled) {
      stopPromoAttention();
      stopTracking();
    }
  }, [enabled, startTracking, stopTracking, startPromoAttention, stopPromoAttention]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isInitializingRef.current = false;
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    startPromoAttention,
    stopPromoAttention,
    resetAttention,
    retryTracking,
    getAttentionResult,
    isTabVisible,
  };
}
