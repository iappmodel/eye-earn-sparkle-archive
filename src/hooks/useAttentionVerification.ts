import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Attention verification hook for promotional video eye-tracking.
 *
 * Computes a real-time attention score based on:
 *  - Face presence (35%)
 *  - Eyes open (30%)
 *  - Gaze forward / toward screen center (30%)
 *  - Head pose OK (5%)
 *
 * Uses EMA smoothing + 2-second rolling window to determine `attentionOk`.
 * Designed to be fed samples from `useVisionEngine` or, when
 * subscribeToVisionEngine is true, from the global `visionEngineSample` event.
 */

export interface AttentionSample {
  tsMs: number;
  facePresent: boolean;
  eyesOpen: boolean;
  gazeForward: boolean;
  headPoseOk: boolean;
  rawScore: number;         // 0..1 unsmoothed
  smoothedScore: number;    // 0..1 EMA-smoothed
  attentionOk: boolean;     // rolling avg >= threshold
  flags: string[];          // human-readable flags: "NO_FACE", "EYES_CLOSED", etc.
}

export interface AttentionVerificationState {
  isTracking: boolean;
  currentSample: AttentionSample | null;
  attentionOk: boolean;
  confidence: number;          // 0..1
  totalWatchMs: number;        // ms with attentionOk=true
  totalElapsedMs: number;      // ms since tracking started
  attentionPercent: number;    // 0..100
  /** Current consecutive seconds with attentionOk=true */
  attentionStreakSec: number;
}

interface AttentionInput {
  hasFace: boolean;
  eyeOpenness: number;       // 0..1
  eyeEAR: number;
  gazePosition: { x: number; y: number } | null;
  headYaw: number;
  headPitch: number;
}

interface UseAttentionVerificationOptions {
  enabled?: boolean;
  /** When true, subscribe to window "visionEngineSample" and push samples automatically */
  subscribeToVisionEngine?: boolean;
  /** EAR threshold below which eyes are considered closed (default 0.18) */
  earThreshold?: number;
  /** Gaze must be within this range of center to count as "forward" (default 0.22) */
  gazeForwardRange?: number;
  /** Maximum absolute yaw for head pose OK (default 20 degrees) */
  maxYaw?: number;
  /** Maximum absolute pitch for head pose OK (default 15 degrees) */
  maxPitch?: number;
  /** EMA alpha for smoothing (default 0.2) */
  emaAlpha?: number;
  /** Rolling window duration in ms (default 2000) */
  rollingWindowMs?: number;
  /** Minimum rolling average to pass (default 0.70) */
  attentionThreshold?: number;
  /** Callback fired on each sample */
  onSample?: (sample: AttentionSample) => void;
}

const DEFAULT_OPTIONS = {
  earThreshold: 0.18,
  gazeForwardRange: 0.22,
  maxYaw: 20,
  maxPitch: 15,
  emaAlpha: 0.2,
  rollingWindowMs: 2000,
  attentionThreshold: 0.70,
};

export function useAttentionVerification(options: UseAttentionVerificationOptions = {}) {
  const {
    enabled = false,
    subscribeToVisionEngine = false,
    earThreshold = DEFAULT_OPTIONS.earThreshold,
    gazeForwardRange = DEFAULT_OPTIONS.gazeForwardRange,
    maxYaw = DEFAULT_OPTIONS.maxYaw,
    maxPitch = DEFAULT_OPTIONS.maxPitch,
    emaAlpha = DEFAULT_OPTIONS.emaAlpha,
    rollingWindowMs = DEFAULT_OPTIONS.rollingWindowMs,
    attentionThreshold = DEFAULT_OPTIONS.attentionThreshold,
    onSample,
  } = options;

  const [state, setState] = useState<AttentionVerificationState>({
    isTracking: false,
    currentSample: null,
    attentionOk: false,
    confidence: 0,
    totalWatchMs: 0,
    totalElapsedMs: 0,
    attentionPercent: 0,
    attentionStreakSec: 0,
  });

  const emaRef = useRef(0);
  const rollingBufferRef = useRef<{ ts: number; score: number }[]>([]);
  const startTimeRef = useRef(0);
  const lastSampleTsRef = useRef(0);
  const totalWatchMsRef = useRef(0);
  const streakStartRef = useRef<number>(0);
  const onSampleRef = useRef(onSample);

  useEffect(() => {
    onSampleRef.current = onSample;
  }, [onSample]);

  // Optional: subscribe to visionEngineSample and push samples automatically
  useEffect(() => {
    if (!enabled || !subscribeToVisionEngine) return;
    const handler = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (!d || typeof d.hasFace !== 'boolean') return;
      const gaze = d.calibratedGazePosition ?? d.gazePosition;
      pushSample({
        hasFace: d.hasFace,
        eyeOpenness: typeof d.eyeOpenness === 'number' ? d.eyeOpenness : (d.eyeEAR ?? 0) / 0.25,
        eyeEAR: d.eyeEAR ?? 0,
        gazePosition: gaze && typeof gaze.x === 'number' && typeof gaze.y === 'number' ? { x: gaze.x, y: gaze.y } : null,
        headYaw: d.headYaw ?? 0,
        headPitch: d.headPitch ?? 0,
      });
    };
    window.addEventListener('visionEngineSample', handler);
    return () => window.removeEventListener('visionEngineSample', handler);
  }, [enabled, subscribeToVisionEngine, pushSample]);

  const startTracking = useCallback(() => {
    emaRef.current = 0;
    rollingBufferRef.current = [];
    startTimeRef.current = Date.now();
    lastSampleTsRef.current = Date.now();
    totalWatchMsRef.current = 0;
    streakStartRef.current = 0;
    setState((prev) => ({
      ...prev,
      isTracking: true,
      totalWatchMs: 0,
      totalElapsedMs: 0,
      attentionPercent: 0,
      attentionStreakSec: 0,
    }));
  }, []);

  const stopTracking = useCallback(() => {
    setState((prev) => ({ ...prev, isTracking: false }));
  }, []);

  const pushSample = useCallback(
    (input: AttentionInput) => {
      if (!enabled) return;

      const now = Date.now();
      const dt = now - lastSampleTsRef.current;
      lastSampleTsRef.current = now;

      // Compute booleans
      const facePresent = input.hasFace;
      const eyesOpen = input.eyeEAR > earThreshold;
      const gazeForward =
        input.gazePosition != null &&
        Math.abs(input.gazePosition.x - 0.5) < gazeForwardRange &&
        Math.abs(input.gazePosition.y - 0.5) < gazeForwardRange;
      const headPoseOk =
        Math.abs(input.headYaw) < maxYaw && Math.abs(input.headPitch) < maxPitch;

      // Weighted base score
      const rawScore =
        (facePresent ? 1 : 0) * 0.35 +
        (eyesOpen ? 1 : 0) * 0.30 +
        (gazeForward ? 1 : 0) * 0.30 +
        (headPoseOk ? 1 : 0) * 0.05;

      // EMA smoothing
      emaRef.current = emaAlpha * rawScore + (1 - emaAlpha) * emaRef.current;
      const smoothedScore = emaRef.current;

      // Rolling window
      rollingBufferRef.current.push({ ts: now, score: smoothedScore });
      const cutoff = now - rollingWindowMs;
      rollingBufferRef.current = rollingBufferRef.current.filter((s) => s.ts >= cutoff);

      const rollingAvg =
        rollingBufferRef.current.length > 0
          ? rollingBufferRef.current.reduce((a, s) => a + s.score, 0) /
            rollingBufferRef.current.length
          : 0;

      const attentionOk = rollingAvg >= attentionThreshold;

      // Track total attention time and streak
      if (attentionOk && dt > 0 && dt < 500) {
        totalWatchMsRef.current += dt;
        if (streakStartRef.current === 0) streakStartRef.current = now;
      } else {
        streakStartRef.current = 0;
      }
      const attentionStreakSec = streakStartRef.current > 0 ? (now - streakStartRef.current) / 1000 : 0;

      const totalElapsedMs = now - startTimeRef.current;
      const attentionPercent =
        totalElapsedMs > 0
          ? Math.round((totalWatchMsRef.current / totalElapsedMs) * 100)
          : 0;

      // Flags
      const flags: string[] = [];
      if (!facePresent) flags.push('NO_FACE');
      if (!eyesOpen) flags.push('EYES_CLOSED');
      if (!gazeForward) flags.push('LOOK_AWAY');
      if (!headPoseOk) flags.push('BAD_POSE');

      const sample: AttentionSample = {
        tsMs: now,
        facePresent,
        eyesOpen,
        gazeForward,
        headPoseOk,
        rawScore,
        smoothedScore,
        attentionOk,
        flags,
      };

      onSampleRef.current?.(sample);

      setState({
        isTracking: true,
        currentSample: sample,
        attentionOk,
        confidence: smoothedScore,
        totalWatchMs: totalWatchMsRef.current,
        totalElapsedMs,
        attentionPercent,
        attentionStreakSec,
      });
    },
    [
      enabled,
      earThreshold,
      gazeForwardRange,
      maxYaw,
      maxPitch,
      emaAlpha,
      rollingWindowMs,
      attentionThreshold,
    ]
  );

  return {
    ...state,
    startTracking,
    stopTracking,
    pushSample,
  };
}
