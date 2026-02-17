import { useState, useEffect, useRef, useCallback } from 'react';
import type { AttentionFlag } from '@/constants/attention';
import {
  getAttentionPreset,
  loadAttentionPresetFromStorage,
  type AttentionPresetId,
} from '@/constants/attention';
import { loadRemoteControlSettings } from '@/hooks/useBlinkRemoteControl';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import { useVision, USE_VISION_CONTEXT } from '@/contexts/VisionContext';
import { analyzeSkinToneFrame } from '@/lib/skinToneFallback';

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

/** Result from getAttentionResult – unified across Vision and fallback paths. */
export interface AttentionResult {
  score: number;
  passed: boolean;
  framesDetected: number;
  totalFrames: number;
  /** Which path produced this result (both use same rolling-window semantics). */
  source: EyeTrackingSource;
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
  const attentionFramesRef = useRef({ detected: 0, total: 0 });
  const wasAttentiveRef = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Use refs for callbacks to prevent dependency changes
  const onAttentionLostRef = useRef(onAttentionLost);
  const onAttentionRestoredRef = useRef(onAttentionRestored);
  const isInitializingRef = useRef(false);
  const isTabVisibleRef = useRef(true);
  const usingVisionEngineRef = useRef(false);

  // EMA + rolling window for Vision Engine scoring path
  const emaRef = useRef(0);
  const rollingBufferRef = useRef<{ ts: number; score: number }[]>([]);
  // Optional extra smoothing for displayed score (reduces jitter on varying devices)
  const displayScoreEmaRef = useRef(0);
  const hadErrorRef = useRef(false);
  const recoveringTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Streak and session stats
  const streakStartRef = useRef<number>(0);
  const lastSampleTsRef = useRef<number>(0);
  const totalAttentiveMsRef = useRef<number>(0);
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
      if (!visible && wasAttentiveRef.current) {
        wasAttentiveRef.current = false;
        onAttentionLostRef.current?.();
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
    isInitializingRef.current = false;
  }, []);

  // Listen for Vision Engine samples from Remote Control (when active).
  // Uses calibrated gaze when present (fixes reward validation for users with calibration).
  // When Vision provides data, release our own camera immediately to avoid duplicates.
  useEffect(() => {
    if (!enabled) return;

    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || typeof d.hasFace !== 'boolean') return;

      // Vision Engine is providing data – release our camera if we had one (handles race)
      if (streamRef.current) {
        releaseOwnCamera();
      }
      usingVisionEngineRef.current = true;

      const facePresent = d.hasFace && isTabVisibleRef.current;
      const eyesOpen = (d.eyeEAR ?? 0) > earThreshold;
      // Prefer calibrated gaze for "forward" check when available (fixes calibration issues)
      const gazeForCheck = d.calibratedGazePosition ?? d.gazePosition;
      const gazeForward =
        gazeForCheck &&
        Math.abs(gazeForCheck.x - 0.5) < gazeForwardRange &&
        Math.abs(gazeForCheck.y - 0.5) < gazeForwardRange;
      const headPoseOk =
        Math.abs(d.headYaw ?? 0) < maxYaw && Math.abs(d.headPitch ?? 0) < maxPitch;

      // Flags for UI/insights (aligned with useAttentionVerification)
      const flags: AttentionFlag[] = [];
      if (!facePresent) flags.push('NO_FACE');
      if (!eyesOpen) flags.push('EYES_CLOSED');
      if (!gazeForward) flags.push('LOOK_AWAY');
      if (!headPoseOk) flags.push('BAD_POSE');

      const rawScore =
        (facePresent ? 1 : 0) * 0.35 +
        (eyesOpen ? 1 : 0) * 0.30 +
        (gazeForward ? 1 : 0) * 0.30 +
        (headPoseOk ? 1 : 0) * 0.05;

      emaRef.current = emaAlpha * rawScore + (1 - emaAlpha) * emaRef.current;
      const now = Date.now();
      rollingBufferRef.current.push({ ts: now, score: emaRef.current });
      rollingBufferRef.current = rollingBufferRef.current.filter((s) => s.ts >= now - rollingWindowMs);
      const rollingAvg =
        rollingBufferRef.current.length > 0
          ? rollingBufferRef.current.reduce((a, s) => a + s.score, 0) /
            rollingBufferRef.current.length
          : 0;

      // Count frames where user was actually attentive (weighted score), not just face present
      attentionFramesRef.current.total++;
      if (rollingAvg >= attentionFrameThreshold) {
        attentionFramesRef.current.detected++;
      }

      const rawScore100 = Math.round(rollingAvg * 100);
      const faceDetected = facePresent;
      const isAttentive = rollingAvg >= attentionFrameThreshold * 0.8; // slightly looser for lost/restored callbacks

      // Optional extra smoothing for displayed score (reduces device variance jitter)
      const alpha = Math.max(0.1, Math.min(0.9, scoreSmoothing));
      displayScoreEmaRef.current =
        alpha * (rawScore100 / 100) + (1 - alpha) * displayScoreEmaRef.current;
      const attentionScore = Math.round(displayScoreEmaRef.current * 100);

      // Streak and total attentive time
      const dt = lastSampleTsRef.current ? Math.min(now - lastSampleTsRef.current, 500) : 0;
      lastSampleTsRef.current = now;
      if (rollingAvg >= attentionFrameThreshold && dt > 0) {
        totalAttentiveMsRef.current += dt;
        if (streakStartRef.current === 0) streakStartRef.current = now;
      } else {
        streakStartRef.current = 0;
      }
      const attentionStreakSec = streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0;

      // Session stats (min, max, avg)
      sessionStatsRef.current.count++;
      sessionStatsRef.current.sum += attentionScore;
      sessionStatsRef.current.min = Math.min(sessionStatsRef.current.min, attentionScore);
      sessionStatsRef.current.max = Math.max(sessionStatsRef.current.max, attentionScore);
      const sessionStats: AttentionSessionStats = {
        minScore: sessionStatsRef.current.min,
        maxScore: sessionStatsRef.current.max,
        avgScore: Math.round(sessionStatsRef.current.sum / sessionStatsRef.current.count),
        sampleCount: sessionStatsRef.current.count,
      };

      if (isAttentive && !wasAttentiveRef.current) {
        wasAttentiveRef.current = true;
        onAttentionRestoredRef.current?.();
      } else if (!isAttentive && wasAttentiveRef.current) {
        wasAttentiveRef.current = false;
        onAttentionLostRef.current?.();
      }

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
        isFaceDetected: faceDetected,
        attentionScore,
        error: null,
        lastGazePosition: gazePos,
        lastCalibratedGazePosition: calibratedPos,
        isRecovering: wasError,
        lastFlags: flags,
        attentionStreakSec,
        totalAttentiveMs: totalAttentiveMsRef.current,
        sessionStats,
        source: 'vision_engine',
        visionStatus: 'active',
      }));

      if (wasError) {
        recoveringTimeoutRef.current = setTimeout(() => {
          recoveringTimeoutRef.current = null;
          setState((prev) => (prev.isRecovering ? { ...prev, isRecovering: false } : prev));
        }, 2000);
      }
    };

    window.addEventListener('visionEngineSample', handler);
    return () => {
      window.removeEventListener('visionEngineSample', handler);
      usingVisionEngineRef.current = false;
    };
  }, [enabled, earThreshold, gazeForwardRange, maxYaw, maxPitch, attentionFrameThreshold, scoreSmoothing, emaAlpha, rollingWindowMs, releaseOwnCamera]);

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

  // When using VisionContext, process visionState for attention scoring
  useEffect(() => {
    if (!useContextPath || !visionCtx) return;
    const d = visionCtx.visionState;
    if (!d.hasFace && !d.landmarks) return;

    usingVisionEngineRef.current = true;
    const facePresent = d.hasFace && isTabVisibleRef.current;
    const eyesOpen = (d.eyeEAR ?? 0) > earThreshold;
    const gazeForCheck = d.gazePosition;
    const gazeForward =
      gazeForCheck &&
      Math.abs(gazeForCheck.x - 0.5) < gazeForwardRange &&
      Math.abs(gazeForCheck.y - 0.5) < gazeForwardRange;
    const headPoseOk =
      Math.abs(d.headYaw ?? 0) < maxYaw && Math.abs(d.headPitch ?? 0) < maxPitch;

    const flags: AttentionFlag[] = [];
    if (!facePresent) flags.push('NO_FACE');
    if (!eyesOpen) flags.push('EYES_CLOSED');
    if (!gazeForward) flags.push('LOOK_AWAY');
    if (!headPoseOk) flags.push('BAD_POSE');

    const rawScore =
      (facePresent ? 1 : 0) * 0.35 +
      (eyesOpen ? 1 : 0) * 0.30 +
      (gazeForward ? 1 : 0) * 0.30 +
      (headPoseOk ? 1 : 0) * 0.05;

    emaRef.current = emaAlpha * rawScore + (1 - emaAlpha) * emaRef.current;
    const now = Date.now();
    rollingBufferRef.current.push({ ts: now, score: emaRef.current });
    rollingBufferRef.current = rollingBufferRef.current.filter((s) => s.ts >= now - rollingWindowMs);
    const rollingAvg =
      rollingBufferRef.current.length > 0
        ? rollingBufferRef.current.reduce((a, s) => a + s.score, 0) /
          rollingBufferRef.current.length
        : 0;

    attentionFramesRef.current.total++;
    if (rollingAvg >= attentionFrameThreshold) {
      attentionFramesRef.current.detected++;
    }

    const rawScore100 = Math.round(rollingAvg * 100);
    const alpha = Math.max(0.1, Math.min(0.9, scoreSmoothing));
    displayScoreEmaRef.current =
      alpha * (rawScore100 / 100) + (1 - alpha) * displayScoreEmaRef.current;
    const attentionScore = Math.round(displayScoreEmaRef.current * 100);
    const isAttentive = rollingAvg >= attentionFrameThreshold * 0.8;

    const dt = lastSampleTsRef.current ? Math.min(now - lastSampleTsRef.current, 500) : 0;
    lastSampleTsRef.current = now;
    if (rollingAvg >= attentionFrameThreshold && dt > 0) {
      totalAttentiveMsRef.current += dt;
      if (streakStartRef.current === 0) streakStartRef.current = now;
    } else {
      streakStartRef.current = 0;
    }
    const attentionStreakSec = streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0;

    sessionStatsRef.current.count++;
    sessionStatsRef.current.sum += attentionScore;
    sessionStatsRef.current.min = Math.min(sessionStatsRef.current.min, attentionScore);
    sessionStatsRef.current.max = Math.max(sessionStatsRef.current.max, attentionScore);
    const sessionStats: AttentionSessionStats = {
      minScore: sessionStatsRef.current.min,
      maxScore: sessionStatsRef.current.max,
      avgScore: Math.round(sessionStatsRef.current.sum / sessionStatsRef.current.count),
      sampleCount: sessionStatsRef.current.count,
    };

    if (isAttentive && !wasAttentiveRef.current) {
      wasAttentiveRef.current = true;
      onAttentionRestoredRef.current?.();
    } else if (!isAttentive && wasAttentiveRef.current) {
      wasAttentiveRef.current = false;
      onAttentionLostRef.current?.();
    }

    const gazePos: GazePosition | null =
      d.gazePosition && typeof d.gazePosition.x === 'number' && typeof d.gazePosition.y === 'number'
        ? { x: d.gazePosition.x, y: d.gazePosition.y }
        : null;

    setState((prev) => ({
      ...prev,
      isTracking: true,
      isPermissionGranted: true,
      isFaceDetected: facePresent,
      attentionScore,
      error: null,
      lastGazePosition: gazePos,
      lastCalibratedGazePosition: gazePos,
      lastFlags: flags,
      attentionStreakSec,
      totalAttentiveMs: totalAttentiveMsRef.current,
      sessionStats,
      source: 'vision_engine',
      visionStatus: 'active',
      needsUserGesture: visionCtx.needsUserGesture ?? false,
    }));
  }, [
    useContextPath,
    visionCtx?.visionState?.hasFace,
    visionCtx?.visionState?.eyeEAR,
    visionCtx?.visionState?.gazePosition?.x,
    visionCtx?.visionState?.gazePosition?.y,
    visionCtx?.visionState?.headYaw,
    visionCtx?.visionState?.headPitch,
    visionCtx?.visionState?.landmarks?.length,
    earThreshold,
    gazeForwardRange,
    maxYaw,
    maxPitch,
    attentionFrameThreshold,
    scoreSmoothing,
    emaAlpha,
    rollingWindowMs,
  ]);

  // When RC is off and not using context, feed our own useVisionEngine state into attention scoring (MediaPipe quality without RC)
  useEffect(() => {
    if (!useOwnVision || !streamRef.current) return;
    if (!vision.hasFace && !vision.landmarks) return;

    const d = {
      hasFace: vision.hasFace,
      eyeEAR: vision.eyeEAR,
      gazePosition: vision.gazePosition,
      calibratedGazePosition: vision.gazePosition,
      headYaw: vision.headYaw,
      headPitch: vision.headPitch,
    };

    usingVisionEngineRef.current = true;
    if (visionFallbackTimerRef.current) {
      clearTimeout(visionFallbackTimerRef.current);
      visionFallbackTimerRef.current = null;
    }
    // If we had fallen back to skin-tone, stop the interval and retry timer (Vision recovered)
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    if (visionRetryTimerRef.current) {
      clearTimeout(visionRetryTimerRef.current);
      visionRetryTimerRef.current = null;
    }

    const facePresent = d.hasFace && isTabVisibleRef.current;
    const eyesOpen = (d.eyeEAR ?? 0) > earThreshold;
    const gazeForCheck = d.calibratedGazePosition ?? d.gazePosition;
    const gazeForward =
      gazeForCheck &&
      Math.abs(gazeForCheck.x - 0.5) < gazeForwardRange &&
      Math.abs(gazeForCheck.y - 0.5) < gazeForwardRange;
    const headPoseOk =
      Math.abs(d.headYaw ?? 0) < maxYaw && Math.abs(d.headPitch ?? 0) < maxPitch;

    const flags: AttentionFlag[] = [];
    if (!facePresent) flags.push('NO_FACE');
    if (!eyesOpen) flags.push('EYES_CLOSED');
    if (!gazeForward) flags.push('LOOK_AWAY');
    if (!headPoseOk) flags.push('BAD_POSE');

    const rawScore =
      (facePresent ? 1 : 0) * 0.35 +
      (eyesOpen ? 1 : 0) * 0.30 +
      (gazeForward ? 1 : 0) * 0.30 +
      (headPoseOk ? 1 : 0) * 0.05;

    emaRef.current = emaAlpha * rawScore + (1 - emaAlpha) * emaRef.current;
    const now = Date.now();
    rollingBufferRef.current.push({ ts: now, score: emaRef.current });
    rollingBufferRef.current = rollingBufferRef.current.filter((s) => s.ts >= now - rollingWindowMs);
    const rollingAvg =
      rollingBufferRef.current.length > 0
        ? rollingBufferRef.current.reduce((a, s) => a + s.score, 0) /
          rollingBufferRef.current.length
        : 0;

    attentionFramesRef.current.total++;
    if (rollingAvg >= attentionFrameThreshold) {
      attentionFramesRef.current.detected++;
    }

    const rawScore100 = Math.round(rollingAvg * 100);
    const alpha = Math.max(0.1, Math.min(0.9, scoreSmoothing));
    displayScoreEmaRef.current =
      alpha * (rawScore100 / 100) + (1 - alpha) * displayScoreEmaRef.current;
    const attentionScore = Math.round(displayScoreEmaRef.current * 100);
    const isAttentive = rollingAvg >= attentionFrameThreshold * 0.8;

    const dt = lastSampleTsRef.current ? Math.min(now - lastSampleTsRef.current, 500) : 0;
    lastSampleTsRef.current = now;
    if (rollingAvg >= attentionFrameThreshold && dt > 0) {
      totalAttentiveMsRef.current += dt;
      if (streakStartRef.current === 0) streakStartRef.current = now;
    } else {
      streakStartRef.current = 0;
    }
    const attentionStreakSec = streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0;

    sessionStatsRef.current.count++;
    sessionStatsRef.current.sum += attentionScore;
    sessionStatsRef.current.min = Math.min(sessionStatsRef.current.min, attentionScore);
    sessionStatsRef.current.max = Math.max(sessionStatsRef.current.max, attentionScore);
    const sessionStats: AttentionSessionStats = {
      minScore: sessionStatsRef.current.min,
      maxScore: sessionStatsRef.current.max,
      avgScore: Math.round(sessionStatsRef.current.sum / sessionStatsRef.current.count),
      sampleCount: sessionStatsRef.current.count,
    };

    if (isAttentive && !wasAttentiveRef.current) {
      wasAttentiveRef.current = true;
      onAttentionRestoredRef.current?.();
    } else if (!isAttentive && wasAttentiveRef.current) {
      wasAttentiveRef.current = false;
      onAttentionLostRef.current?.();
    }

    const gazePos: GazePosition | null =
      d.gazePosition && typeof d.gazePosition.x === 'number' && typeof d.gazePosition.y === 'number'
        ? { x: d.gazePosition.x, y: d.gazePosition.y }
        : null;

    setState((prev) => ({
      ...prev,
      isTracking: true,
      isPermissionGranted: true,
      isFaceDetected: facePresent,
      attentionScore,
      error: null,
      lastGazePosition: gazePos,
      lastCalibratedGazePosition: gazePos,
      lastFlags: flags,
      attentionStreakSec,
      totalAttentiveMs: totalAttentiveMsRef.current,
      sessionStats,
      source: 'vision_engine',
      visionStatus: 'active',
    }));
  }, [
    useOwnVision,
    vision.hasFace,
    vision.eyeEAR,
    vision.gazePosition,
    vision.headYaw,
    vision.headPitch,
    vision.landmarks,
    earThreshold,
    gazeForwardRange,
    maxYaw,
    maxPitch,
    attentionFrameThreshold,
    scoreSmoothing,
    emaAlpha,
    rollingWindowMs,
  ]);

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

      // Reset rolling state so fallback starts fresh (avoids mixing with prior Vision data)
      emaRef.current = 0;
      rollingBufferRef.current = [];
      displayScoreEmaRef.current = 0;
      attentionFramesRef.current = { detected: 0, total: 0 };
      lastSampleTsRef.current = 0;
      totalAttentiveMsRef.current = 0;
      streakStartRef.current = 0;
      sessionStatsRef.current = { min: 100, max: 0, sum: 0, count: 0 };

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
        detectionIntervalRef.current = setInterval(() => {
          if (usingVisionEngineRef.current) return;

          if (!videoRef.current || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Draw current frame
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);

        // Multi-zone skin-tone + eye-region + liveness (reduces gaming)
        const imageData = ctx.getImageData(80, 40, 160, 160);
        const fallbackResult = analyzeSkinToneFrame(imageData, skinTonePrevFrameRef);
        const facePresent = fallbackResult.facePresent && isTabVisibleRef.current;
        const rawScore = facePresent ? fallbackResult.rawScore : 0;

        // Same rolling-window logic as Vision path: EMA, rolling avg, threshold
        const { rollingWindowMs: rwMs, emaAlpha: ea, attentionFrameThreshold: aft, scoreSmoothing: ss } =
          presetRef.current;
        emaRef.current = ea * rawScore + (1 - ea) * emaRef.current;
        const now = Date.now();
        rollingBufferRef.current.push({ ts: now, score: emaRef.current });
        rollingBufferRef.current = rollingBufferRef.current.filter(
          (s) => s.ts >= now - rwMs
        );
        const rollingAvg =
          rollingBufferRef.current.length > 0
            ? rollingBufferRef.current.reduce((a, s) => a + s.score, 0) /
              rollingBufferRef.current.length
            : 0;

        // Count attentive frames same as Vision: rollingAvg >= threshold
        attentionFramesRef.current.total++;
        if (rollingAvg >= aft) {
          attentionFramesRef.current.detected++;
        }

        // Display score: smoothed rolling average (aligned with Vision path)
        const rawScore100 = Math.round(rollingAvg * 100);
        const alpha = Math.max(0.1, Math.min(0.9, ss));
        displayScoreEmaRef.current =
          alpha * (rawScore100 / 100) + (1 - alpha) * displayScoreEmaRef.current;
        const attentionScore = Math.round(displayScoreEmaRef.current * 100);

        const isAttentive = rollingAvg >= aft * 0.8;

        if (isAttentive && !wasAttentiveRef.current) {
          wasAttentiveRef.current = true;
          onAttentionRestoredRef.current?.();
        } else if (!isAttentive && wasAttentiveRef.current) {
          wasAttentiveRef.current = false;
          onAttentionLostRef.current?.();
        }

        // Streak and session stats (same structure as Vision)
        const dt = lastSampleTsRef.current ? Math.min(now - lastSampleTsRef.current, 500) : 0;
        lastSampleTsRef.current = now;
        if (rollingAvg >= aft && dt > 0) {
          totalAttentiveMsRef.current += dt;
          if (streakStartRef.current === 0) streakStartRef.current = now;
        } else {
          streakStartRef.current = 0;
        }
        const attentionStreakSec =
          streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0;

        sessionStatsRef.current.count++;
        sessionStatsRef.current.sum += attentionScore;
        sessionStatsRef.current.min = Math.min(sessionStatsRef.current.min, attentionScore);
        sessionStatsRef.current.max = Math.max(sessionStatsRef.current.max, attentionScore);
        const sessionStats: AttentionSessionStats = {
          minScore: sessionStatsRef.current.min,
          maxScore: sessionStatsRef.current.max,
          avgScore: Math.round(
            sessionStatsRef.current.sum / sessionStatsRef.current.count
          ),
          sampleCount: sessionStatsRef.current.count,
        };

        setState((prev) => ({
          ...prev,
          isFaceDetected: facePresent,
          attentionScore,
          attentionStreakSec,
          totalAttentiveMs: totalAttentiveMsRef.current,
          sessionStats,
          lastFlags: (fallbackResult.lastFlags.length > 0 ? fallbackResult.lastFlags : (facePresent ? [] : ['NO_FACE'])) as AttentionFlag[],
        }));
        }, 200);
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

  // Reset attention score and rolling state for new content (e.g. new promo video)
  const resetAttention = useCallback(() => {
    attentionFramesRef.current = { detected: 0, total: 0 };
    emaRef.current = 0;
    rollingBufferRef.current = [];
    displayScoreEmaRef.current = 0;
    wasAttentiveRef.current = true;
    streakStartRef.current = 0;
    lastSampleTsRef.current = 0;
    totalAttentiveMsRef.current = 0;
    sessionStatsRef.current = { min: 100, max: 0, sum: 0, count: 0 };
    setState(prev => ({
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

  // Get final attention score for validation.
  // Both paths use the same semantics: "attentive" = rolling average >= threshold.
  const getAttentionResult = useCallback((): AttentionResult => {
    const { detected, total } = attentionFramesRef.current;
    const score = total > 0 ? Math.round((detected / total) * 100) : 0;
    const passed = score >= requiredAttentionThreshold;
    return {
      score,
      passed,
      framesDetected: detected,
      totalFrames: total,
      source: usingVisionEngineRef.current ? 'vision_engine' : 'fallback',
    };
  }, [requiredAttentionThreshold]);

  // Auto start/stop based on enabled prop. On iOS, startTracking may fail without a user gesture;
  // cameraUserStart (from play button tap) provides the gesture.
  const prevEnabledRef = useRef(enabled);
  
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;
    
    if (enabled && !wasEnabled) {
      startTracking();
    } else if (!enabled && wasEnabled) {
      stopTracking();
    }
  }, [enabled, startTracking, stopTracking]);

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
    resetAttention,
    retryTracking,
    getAttentionResult,
    isTabVisible,
  };
}
