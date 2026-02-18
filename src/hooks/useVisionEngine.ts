/**
 * useVisionEngine – centralized MediaPipe face detection hook.
 *
 * Supports two backends:
 *  - face_mesh: legacy @mediapipe/face_mesh (v0.4), CDN-loaded
 *  - face_landmarker: @mediapipe/tasks-vision FaceLandmarker (WASM-only, better caching)
 *
 * Both produce the same output format (multiFaceLandmarks) for EAR, gaze, blink.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { logger } from '@/lib/logger';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
  visibility?: number;
}

export interface VisionFaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisionState {
  isRunning: boolean;
  hasFace: boolean;
  landmarks: NormalizedLandmark[] | null;
  faceBox: VisionFaceBox | null;
  eyeEAR: number;
  leftEAR: number;
  rightEAR: number;
  eyeOpenness: number; // 0-1 (relative to baseline)
  gazePosition: { x: number; y: number } | null; // normalized 0..1
  blinkCount: number;
  lastBlinkTime: number | null;
  /** True once EAR baseline has been established (eyes-open samples collected). */
  baselineReady: boolean;
  headYaw: number; // degrees, negative = left, positive = right
  headPitch: number; // degrees, negative = up, positive = down
}

/** Blink detection tuning. Calibration mode uses looser thresholds and faster baseline. */
export interface BlinkDetectionConfig {
  /** Number of eyes-open samples before setting baseline (default 8). */
  baselineSampleCount?: number;
  /** Min EAR to consider "eyes open" when collecting baseline (default 0.12). */
  minEarForBaseline?: number;
  /** Close threshold = min(baseline * closeRatio, maxCloseEAR). */
  closeRatio?: number;
  maxCloseEAR?: number;
  /** Reopen threshold = baseline * reopenRatio. */
  reopenRatio?: number;
  /** Min blink duration ms (default 50). */
  minBlinkDurationMs?: number;
  /** Max blink duration ms (default 800). */
  maxBlinkDurationMs?: number;
  /** Cooldown between blinks ms (default 140). */
  blinkCooldownMs?: number;
  /** When true, use slightly looser thresholds and faster baseline adaptation for calibration flows. */
  calibrationMode?: boolean;
  /** Require this many consecutive "closed" frames before accepting a reopen (reduces false blinks). Default 1. */
  minClosedFramesForBlink?: number;
}

export type VisionBackend = 'face_mesh' | 'face_landmarker';

interface UseVisionEngineOptions {
  enabled?: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  detectionInterval?: number;
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  patternTimeout?: number;
  mirrorX?: boolean;
  invertY?: boolean;
  gazeScale?: number;
  /** Gaze smoothing 0–1 (default 0). Higher = smoother, less jitter on low-end devices. */
  gazeSmoothing?: number;
  /** If true, this instance takes priority as the driver (e.g. calibration). */
  driverPriority?: boolean;
  /** Optional blink detection tuning; calibrationMode: true is recommended for calibration UI. */
  blinkConfig?: BlinkDetectionConfig;
  /** Vision backend: face_mesh (legacy) or face_landmarker (tasks-vision). Default face_mesh. */
  visionBackend?: VisionBackend;
  /** Run EAR/gaze/blink computation in a Web Worker to keep main thread free for video (default true). */
  useWorker?: boolean;
  onBlink?: () => void;
  onBlinkPattern?: (count: number) => void;
  onLeftWink?: () => void;
  onRightWink?: () => void;
}

const FACE_MESH_VERSION = '0.4.1633559619';

let sharedFaceMesh: any | null = null;
let sharedFaceMeshPromise: Promise<any> | null = null;
const sharedFaceMeshListeners = new Set<(results: any) => void>();
let sharedFaceLandmarker: any | null = null;
let sharedFaceLandmarkerPromise: Promise<any> | null = null;
const sharedFaceLandmarkerListeners = new Set<(results: any) => void>();
let sharedDriverId: number | null = null;
let sharedDriverPriority = false;
let sharedDriverVisionBackend: VisionBackend = 'face_mesh';
let sharedInstanceSeq = 0;
let sharedProcessing = false;
let sharedFaceMeshOptions: { minDetectionConfidence: number; minTrackingConfidence: number } | null = null;
let sharedDriverLastSendTs = 0;
let sharedSendFailCount = 0;

const FACE_LANDMARKER_MODEL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const TASKS_VISION_WASM =
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm';

const ensureSharedFaceMesh = async () => {
  if (sharedFaceMesh) return sharedFaceMesh;
  if (sharedFaceMeshPromise) return sharedFaceMeshPromise;

  sharedFaceMeshPromise = (async () => {
    try {
      const mod: any = await import('@mediapipe/face_mesh');
      const FaceMesh = mod.FaceMesh;

      const mesh = new FaceMesh({
        locateFile: (file: string) =>
          `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@${FACE_MESH_VERSION}/${file}`,
      });

      mesh.onResults((results: any) => {
        sharedFaceMeshListeners.forEach((listener) => {
          try {
            listener(results);
          } catch {
            // ignore listener errors
          }
        });
      });

      sharedFaceMesh = mesh;
      return mesh;
    } catch (err) {
      sharedFaceMeshPromise = null;
      sharedFaceMesh = null;
      throw err;
    }
  })();

  return sharedFaceMeshPromise;
};

const ensureSharedFaceLandmarker = async (
  minDetectionConfidence: number,
  minTrackingConfidence: number
) => {
  if (sharedFaceLandmarker) return sharedFaceLandmarker;
  if (sharedFaceLandmarkerPromise) return sharedFaceLandmarkerPromise;

  sharedFaceLandmarkerPromise = (async () => {
    try {
      const { FilesetResolver, FaceLandmarker } = await import('@mediapipe/tasks-vision');
      const vision = await FilesetResolver.forVisionTasks(TASKS_VISION_WASM);
      const landmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_LANDMARKER_MODEL },
        numFaces: 1,
        minFaceDetectionConfidence: minDetectionConfidence,
        minFacePresenceConfidence: minTrackingConfidence,
        minTrackingConfidence,
        runningMode: 'VIDEO',
      });
      sharedFaceLandmarker = landmarker;
      return landmarker;
    } catch (err) {
      sharedFaceLandmarkerPromise = null;
      sharedFaceLandmarker = null;
      throw err;
    }
  })();

  return sharedFaceLandmarkerPromise;
};

const LEFT_EYE: [number, number, number, number, number, number] = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE: [number, number, number, number, number, number] = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_EYE_CORNERS = [33, 133];
const RIGHT_EYE_CORNERS = [362, 263];
const LEFT_EYE_LIDS = [159, 145];
const RIGHT_EYE_LIDS = [386, 374];

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const computeEAR = (landmarks: NormalizedLandmark[] | null | undefined, eye: typeof LEFT_EYE): number => {
  if (!landmarks || landmarks.length < 400) return 0;
  const [p1, p2, p3, p4, p5, p6] = eye.map((i) => landmarks[i]);
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6 || typeof p1.x !== 'number' || typeof p4.x !== 'number') return 0;
  try {
    const vertical1 = dist(p2, p6);
    const vertical2 = dist(p3, p5);
    const horizontal = dist(p1, p4);
    return horizontal > 0 ? (vertical1 + vertical2) / (2 * horizontal) : 0;
  } catch {
    return 0;
  }
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

const averageLandmarks = (landmarks: NormalizedLandmark[], indices: number[]) => {
  let x = 0;
  let y = 0;
  let n = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (p && typeof p.x === 'number' && typeof p.y === 'number') {
      x += p.x;
      y += p.y;
      n += 1;
    }
  }
  return { x: n ? x / n : 0.5, y: n ? y / n : 0.5 };
};

const gazeFromEye = (
  landmarks: NormalizedLandmark[],
  iris: number[],
  corners: number[],
  lids: number[]
): { x: number; y: number } | null => {
  try {
    const pupil = averageLandmarks(landmarks, iris);
    const cornerA = landmarks[corners[0]];
    const cornerB = landmarks[corners[1]];
    const lidA = landmarks[lids[0]];
    const lidB = landmarks[lids[1]];
    if (!cornerA?.x || cornerA.x === undefined || !cornerB?.x || !lidA?.y || lidA.y === undefined || !lidB?.y) {
      return null;
    }
    const minX = Math.min(cornerA.x, cornerB.x);
    const maxX = Math.max(cornerA.x, cornerB.x);
    const minY = Math.min(lidA.y, lidB.y);
    const maxY = Math.max(lidA.y, lidB.y);
    const ratioX = maxX > minX ? (pupil.x - minX) / (maxX - minX) : 0.5;
    const ratioY = maxY > minY ? (pupil.y - minY) / (maxY - minY) : 0.5;
    return { x: clamp01(ratioX), y: clamp01(ratioY) };
  } catch {
    return null;
  }
};

// Head pose estimation: approximate yaw/pitch/roll from 2D landmarks.
// Uses nose, chin, left/right eye outer corners, left/right mouth corners.
const HEAD_POSE_LANDMARKS = {
  noseTip: 1,
  chin: 152,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftMouth: 61,
  rightMouth: 291,
  forehead: 10,
};

const estimateHeadPose = (landmarks: NormalizedLandmark[]) => {
  const nose = landmarks[HEAD_POSE_LANDMARKS.noseTip];
  const chin = landmarks[HEAD_POSE_LANDMARKS.chin];
  const lEye = landmarks[HEAD_POSE_LANDMARKS.leftEyeOuter];
  const rEye = landmarks[HEAD_POSE_LANDMARKS.rightEyeOuter];
  const lMouth = landmarks[HEAD_POSE_LANDMARKS.leftMouth];
  const rMouth = landmarks[HEAD_POSE_LANDMARKS.rightMouth];
  const forehead = landmarks[HEAD_POSE_LANDMARKS.forehead];

  if (!nose || !chin || !lEye || !rEye || !lMouth || !rMouth || !forehead) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // Yaw: horizontal displacement of nose from midpoint of eyes
  const eyeMidX = (lEye.x + rEye.x) / 2;
  const eyeWidth = Math.abs(rEye.x - lEye.x);
  const yawNorm = eyeWidth > 0.001 ? (nose.x - eyeMidX) / eyeWidth : 0;
  const yaw = yawNorm * 60; // scale to approximate degrees

  // Pitch: vertical displacement of nose from midpoint between forehead and chin
  const faceMidY = (forehead.y + chin.y) / 2;
  const faceHeight = Math.abs(chin.y - forehead.y);
  const pitchNorm = faceHeight > 0.001 ? (nose.y - faceMidY) / faceHeight : 0;
  const pitch = pitchNorm * 60;

  // Roll: angle between eye corners
  const roll = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x) * (180 / Math.PI);

  return { yaw, pitch, roll };
};

const DEFAULT_BLINK_CONFIG: Required<BlinkDetectionConfig> = {
  baselineSampleCount: 8,
  minEarForBaseline: 0.12,
  closeRatio: 0.72,
  maxCloseEAR: 0.22,
  reopenRatio: 0.85,
  minBlinkDurationMs: 50,
  maxBlinkDurationMs: 800,
  blinkCooldownMs: 140,
  calibrationMode: false,
  minClosedFramesForBlink: 1,
};

/** Calibration-mode overrides: looser thresholds, faster baseline, more tolerant. */
const CALIBRATION_BLINK_OVERRIDES: Partial<BlinkDetectionConfig> = {
  baselineSampleCount: 6,
  minEarForBaseline: 0.10,
  closeRatio: 0.70,
  maxCloseEAR: 0.20,
  reopenRatio: 0.82,
  minClosedFramesForBlink: 1,
};

/** Throttle state updates from worker so we don't setState every frame (smooth video). */
const VISION_STATE_UPDATE_THROTTLE_MS = 100;

export function useVisionEngine(options: UseVisionEngineOptions) {
  const {
    enabled = false,
    videoRef,
    detectionInterval = 80,
    minDetectionConfidence = 0.6,
    minTrackingConfidence = 0.6,
    patternTimeout = 600,
    mirrorX = false,
    invertY = false,
    gazeScale = 1.6,
    gazeSmoothing = 0,
    driverPriority = false,
    visionBackend = 'face_mesh',
    useWorker = true,
    blinkConfig: blinkConfigOpt,
    onBlink,
    onBlinkPattern,
    onLeftWink,
    onRightWink,
  } = options;

  const blinkConfigResolved = useMemo<Required<BlinkDetectionConfig>>(
    () => ({
      ...DEFAULT_BLINK_CONFIG,
      ...blinkConfigOpt,
      ...(blinkConfigOpt?.calibrationMode ? CALIBRATION_BLINK_OVERRIDES : {}),
    }),
    [blinkConfigOpt]
  );

  const [state, setState] = useState<VisionState>({
    isRunning: false,
    hasFace: false,
    landmarks: null,
    faceBox: null,
    eyeEAR: 0,
    leftEAR: 0,
    rightEAR: 0,
    eyeOpenness: 1,
    gazePosition: null,
    blinkCount: 0,
    lastBlinkTime: null,
    baselineReady: false,
    headYaw: 0,
    headPitch: 0,
  });

  const faceMeshRef = useRef<any>(null);
  const faceLandmarkerRef = useRef<any>(null);
  const processingRef = useRef(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const instanceIdRef = useRef<number>(++sharedInstanceSeq);
  const enabledRef = useRef(enabled);
  const optionsRef = useRef({ mirrorX, invertY, gazeScale, gazeSmoothing });
  const patternTimeoutMsRef = useRef(patternTimeout);
  const driverPriorityRef = useRef(driverPriority);
  const visionBackendRef = useRef(visionBackend);
  const blinkConfigRef = useRef(blinkConfigResolved);

  const baselineEarRef = useRef<number | null>(null);
  const baselineEarSamples = useRef<number[]>([]); // collect initial samples before setting baseline
  const wasClosedRef = useRef(false);
  const closedAtRef = useRef(0); // timestamp when eyes closed
  const closedFramesCountRef = useRef(0); // consecutive frames below close threshold
  const lastBlinkTimeRef = useRef(0);
  const noFaceFramesRef = useRef(0); // count consecutive no-face frames

  const blinkPatternRef = useRef<{ count: number; timestamp: number }>({ count: 0, timestamp: 0 });
  const patternTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const onBlinkRef = useRef(onBlink);
  const onBlinkPatternRef = useRef(onBlinkPattern);
  const onLeftWinkRef = useRef(onLeftWink);
  const onRightWinkRef = useRef(onRightWink);

  const wasLeftClosedRef = useRef(false);
  const wasRightClosedRef = useRef(false);
  const leftClosedAtRef = useRef(0);
  const rightClosedAtRef = useRef(0);
  const lastLeftWinkRef = useRef(0);
  const lastRightWinkRef = useRef(0);
  const gazeEmaRef = useRef<{ x: number; y: number } | null>(null);

  const workerRef = useRef<Worker | null>(null);
  const setStateRef = useRef(setState);
  setStateRef.current = setState;
  const lastWorkerStateTs = useRef(0);

  useEffect(() => {
    onBlinkRef.current = onBlink;
  }, [onBlink]);

  useEffect(() => {
    onBlinkPatternRef.current = onBlinkPattern;
  }, [onBlinkPattern]);

  useEffect(() => {
    onLeftWinkRef.current = onLeftWink;
  }, [onLeftWink]);

  useEffect(() => {
    onRightWinkRef.current = onRightWink;
  }, [onRightWink]);

  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    optionsRef.current = { mirrorX, invertY, gazeScale, gazeSmoothing };
  }, [mirrorX, invertY, gazeScale, gazeSmoothing]);

  useEffect(() => {
    patternTimeoutMsRef.current = patternTimeout;
  }, [patternTimeout]);

  useEffect(() => {
    driverPriorityRef.current = driverPriority;
  }, [driverPriority]);

  useEffect(() => {
    visionBackendRef.current = visionBackend;
  }, [visionBackend]);

  useEffect(() => {
    blinkConfigRef.current = blinkConfigResolved;
  }, [blinkConfigResolved]);

  // Create vision sample worker so gaze/EAR/blink run off main thread (keeps video smooth).
  useEffect(() => {
    if (!enabled || !useWorker) return;
    let worker: Worker;
    try {
      worker = new Worker(new URL('../workers/visionSample.worker.ts', import.meta.url), { type: 'module' });
    } catch {
      return;
    }
    workerRef.current = worker;
    const onMessage = (e: MessageEvent) => {
      const out = e.data as {
        hasFace: true;
        faceBox: VisionFaceBox;
        ear: number;
        leftEAR: number;
        rightEAR: number;
        eyeOpenness: number;
        gazePosition: { x: number; y: number } | null;
        headYaw: number;
        headPitch: number;
        baselineReady: boolean;
        blinked: boolean;
        leftWink: boolean;
        rightWink: boolean;
      };
      if (!out || !out.hasFace) return;

      if (out.blinked) {
        const cfg = blinkConfigRef.current;
        const now = Date.now();
        if (now - lastBlinkTimeRef.current > cfg.blinkCooldownMs) {
          lastBlinkTimeRef.current = now;
          blinkPatternRef.current.count += 1;
          blinkPatternRef.current.timestamp = now;
          onBlinkRef.current?.();
          setStateRef.current((prev) => ({
            ...prev,
            blinkCount: prev.blinkCount + 1,
            lastBlinkTime: now,
          }));
          if (patternTimeoutRef.current) clearTimeout(patternTimeoutRef.current);
          patternTimeoutRef.current = setTimeout(() => {
            if (blinkPatternRef.current.count > 0) {
              onBlinkPatternRef.current?.(blinkPatternRef.current.count);
              blinkPatternRef.current = { count: 0, timestamp: 0 };
            }
          }, patternTimeoutMsRef.current);
        }
      }
      if (out.leftWink) onLeftWinkRef.current?.();
      if (out.rightWink) onRightWinkRef.current?.();

      const now = Date.now();
      if (now - lastWorkerStateTs.current < VISION_STATE_UPDATE_THROTTLE_MS) return;
      lastWorkerStateTs.current = now;
      setStateRef.current((prev) => ({
        ...prev,
        hasFace: true,
        landmarks: null, // not passed back from worker to keep messages small
        faceBox: out.faceBox,
        eyeEAR: out.ear,
        leftEAR: out.leftEAR,
        rightEAR: out.rightEAR,
        eyeOpenness: out.eyeOpenness,
        gazePosition: out.gazePosition,
        baselineReady: out.baselineReady,
        headYaw: out.headYaw,
        headPitch: out.headPitch,
      }));
    };
    worker.addEventListener('message', onMessage);
    return () => {
      worker.removeEventListener('message', onMessage);
      worker.terminate();
      workerRef.current = null;
    };
  }, [enabled, useWorker]);

  const handleResults = useCallback((results: any) => {
    if (!enabledRef.current) return;

    const landmarks = results?.multiFaceLandmarks?.[0] as NormalizedLandmark[] | undefined;
    if (!landmarks || landmarks.length < 468) {
      noFaceFramesRef.current += 1;
      if (noFaceFramesRef.current > 15) {
        baselineEarRef.current = null;
        baselineEarSamples.current = [];
        wasClosedRef.current = false;
        closedAtRef.current = 0;
        closedFramesCountRef.current = 0;
        wasLeftClosedRef.current = false;
        wasRightClosedRef.current = false;
        leftClosedAtRef.current = 0;
        rightClosedAtRef.current = 0;
        gazeEmaRef.current = null;
        workerRef.current?.postMessage({ type: 'reset' });
      }
      setState((prev) => ({
        ...prev,
        hasFace: false,
        landmarks: null,
        faceBox: null,
        eyeEAR: 0,
        leftEAR: 0,
        rightEAR: 0,
        eyeOpenness: 1,
        gazePosition: null,
        baselineReady: false,
        headYaw: 0,
        headPitch: 0,
      }));
      return;
    }

    noFaceFramesRef.current = 0;

    // Offload EAR/gaze/blink to worker when available; main thread only receives compact samples.
    const w = workerRef.current;
    if (w) {
      const cfg = blinkConfigRef.current;
      const opts = optionsRef.current;
      try {
        w.postMessage({
          landmarks: landmarks.map((l) => ({ x: l.x, y: l.y })),
          timestamp: Date.now(),
          config: {
            minEarForBaseline: cfg.minEarForBaseline,
            closeRatio: cfg.closeRatio,
            maxCloseEAR: cfg.maxCloseEAR,
            reopenRatio: cfg.reopenRatio,
            minBlinkDurationMs: cfg.minBlinkDurationMs,
            maxBlinkDurationMs: cfg.maxBlinkDurationMs,
            blinkCooldownMs: cfg.blinkCooldownMs,
            minClosedFramesForBlink: cfg.minClosedFramesForBlink ?? 1,
            baselineSampleCount: cfg.baselineSampleCount,
            calibrationMode: cfg.calibrationMode,
            mirrorX: opts.mirrorX,
            invertY: opts.invertY,
            gazeScale: opts.gazeScale,
            gazeSmoothing: opts.gazeSmoothing,
          },
        });
      } catch (err) {
        logger.warn('[VisionEngine] Worker postMessage error:', err);
      }
      return;
    }

    try {
    // Face bounds from landmarks
    let fMinX = 1, fMinY = 1, fMaxX = 0, fMaxY = 0;
    for (const lm of landmarks) {
      if (lm && typeof lm.x === 'number' && typeof lm.y === 'number') {
        fMinX = Math.min(fMinX, lm.x);
        fMinY = Math.min(fMinY, lm.y);
        fMaxX = Math.max(fMaxX, lm.x);
        fMaxY = Math.max(fMaxY, lm.y);
      }
    }
    const faceBox: VisionFaceBox = {
      x: fMinX,
      y: fMinY,
      w: Math.max(0.01, fMaxX - fMinX),
      h: Math.max(0.01, fMaxY - fMinY),
    };

    // Head pose estimation
    const headPose = estimateHeadPose(landmarks);

    // EAR-based blink detection with configurable baseline and validation
    const leftEAR = computeEAR(landmarks, LEFT_EYE);
    const rightEAR = computeEAR(landmarks, RIGHT_EYE);
    const ear = (leftEAR + rightEAR) / 2;
    const cfg = blinkConfigRef.current;

    // Robust baseline: collect N eyes-open samples, then set baseline (median to reject outliers)
    if (baselineEarRef.current == null) {
      if (ear > cfg.minEarForBaseline) {
        baselineEarSamples.current.push(ear);
        if (baselineEarSamples.current.length >= cfg.baselineSampleCount) {
          const sorted = [...baselineEarSamples.current].sort((a, b) => a - b);
          // Use median; optionally trim extremes for stability across lighting
          const lo = Math.floor(sorted.length * 0.15);
          const hi = Math.ceil(sorted.length * 0.85);
          const trimmed = sorted.slice(lo, hi);
          baselineEarRef.current = trimmed.length
            ? trimmed[Math.floor(trimmed.length / 2)]
            : sorted[Math.floor(sorted.length / 2)];
          baselineEarSamples.current = [];
        }
      }
    } else {
      const openThreshold = baselineEarRef.current * (cfg.calibrationMode ? 0.78 : 0.82);
      if (ear > openThreshold) {
        // Slow EMA when eyes are open (calibration mode adapts slightly faster)
        const alpha = cfg.calibrationMode ? 0.05 : 0.03;
        baselineEarRef.current = baselineEarRef.current * (1 - alpha) + ear * alpha;
      }
    }

    const baseline = baselineEarRef.current ?? ear;
    const eyeOpenness = baseline > 0 ? Math.max(0, Math.min(1, ear / baseline)) : 1;

    // Blink detection: configurable close/reopen thresholds
    const closeThreshold = Math.min(baseline * cfg.closeRatio, cfg.maxCloseEAR);
    const reopenThreshold = baseline * cfg.reopenRatio;
    const closedNow = ear < closeThreshold;
    const reopenedNow = ear > reopenThreshold;

    const leftClosedNow = leftEAR < closeThreshold;
    const rightClosedNow = rightEAR < closeThreshold;
    const leftReopenedNow = leftEAR > reopenThreshold;
    const rightReopenedNow = rightEAR > reopenThreshold;

    const now = Date.now();
    let blinked = false;

    // Per-eye wink detection (one eye closes and reopens while the other stays open)
    if (!wasLeftClosedRef.current && leftClosedNow) {
      wasLeftClosedRef.current = true;
      leftClosedAtRef.current = now;
    } else if (wasLeftClosedRef.current && leftReopenedNow && rightEAR > reopenThreshold) {
      const closeDuration = now - leftClosedAtRef.current;
      wasLeftClosedRef.current = false;
      leftClosedAtRef.current = 0;
      if (closeDuration >= 50 && closeDuration <= 800 && now - lastLeftWinkRef.current > 200) {
        lastLeftWinkRef.current = now;
        onLeftWinkRef.current?.();
      }
    } else if (wasLeftClosedRef.current && (now - leftClosedAtRef.current > 1500)) {
      wasLeftClosedRef.current = false;
      leftClosedAtRef.current = 0;
    }

    if (!wasRightClosedRef.current && rightClosedNow) {
      wasRightClosedRef.current = true;
      rightClosedAtRef.current = now;
    } else if (wasRightClosedRef.current && rightReopenedNow && leftEAR > reopenThreshold) {
      const closeDuration = now - rightClosedAtRef.current;
      wasRightClosedRef.current = false;
      rightClosedAtRef.current = 0;
      if (closeDuration >= 50 && closeDuration <= 800 && now - lastRightWinkRef.current > 200) {
        lastRightWinkRef.current = now;
        onRightWinkRef.current?.();
      }
    } else if (wasRightClosedRef.current && (now - rightClosedAtRef.current > 1500)) {
      wasRightClosedRef.current = false;
      rightClosedAtRef.current = 0;
    }

    if (!wasClosedRef.current && closedNow) {
      wasClosedRef.current = true;
      closedAtRef.current = now;
      closedFramesCountRef.current = 1;
    } else if (wasClosedRef.current) {
      if (closedNow) {
        closedFramesCountRef.current += 1;
      } else if (reopenedNow) {
        const closeDuration = now - closedAtRef.current;
        const minClosedFrames = cfg.minClosedFramesForBlink ?? 1;
        const hadEnoughClosedFrames = closedFramesCountRef.current >= minClosedFrames;
        wasClosedRef.current = false;
        closedAtRef.current = 0;
        closedFramesCountRef.current = 0;
        if (
          hadEnoughClosedFrames &&
          closeDuration >= cfg.minBlinkDurationMs &&
          closeDuration <= cfg.maxBlinkDurationMs
        ) {
          blinked = true;
        }
      }
    }
    if (wasClosedRef.current && now - closedAtRef.current > 2000) {
      wasClosedRef.current = false;
      closedAtRef.current = 0;
      closedFramesCountRef.current = 0;
    }

    if (blinked) {
      if (now - lastBlinkTimeRef.current > cfg.blinkCooldownMs) {
        lastBlinkTimeRef.current = now;

        blinkPatternRef.current.count += 1;
        blinkPatternRef.current.timestamp = now;

        onBlinkRef.current?.();
        setState((prev) => ({
          ...prev,
          blinkCount: prev.blinkCount + 1,
          lastBlinkTime: now,
        }));

        if (patternTimeoutRef.current) {
          clearTimeout(patternTimeoutRef.current);
        }
        patternTimeoutRef.current = setTimeout(() => {
          if (blinkPatternRef.current.count > 0) {
            onBlinkPatternRef.current?.(blinkPatternRef.current.count);
            blinkPatternRef.current = { count: 0, timestamp: 0 };
          }
        }, patternTimeoutMsRef.current);
      }
    }

    let gazePosition: { x: number; y: number } | null = null;
    if (landmarks.length >= 478) {
      const left = gazeFromEye(landmarks, LEFT_IRIS, LEFT_EYE_CORNERS, LEFT_EYE_LIDS);
      const right = gazeFromEye(landmarks, RIGHT_IRIS, RIGHT_EYE_CORNERS, RIGHT_EYE_LIDS);
      const avg = left && right
        ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
        : left ?? right;
      if (avg) {
        const { mirrorX: optMirrorX, invertY: optInvertY, gazeScale: optScale, gazeSmoothing: smooth } = optionsRef.current;
        let gazeX = clamp01(0.5 + (avg.x - 0.5) * optScale);
        let gazeY = clamp01(0.5 + (avg.y - 0.5) * optScale);
        if (optMirrorX) gazeX = 1 - gazeX;
        if (optInvertY) gazeY = 1 - gazeY;
        const raw = { x: gazeX, y: gazeY };
        if (smooth > 0 && gazeEmaRef.current) {
          const a = Math.max(0.05, Math.min(0.95, smooth));
          gazePosition = {
            x: clamp01(a * raw.x + (1 - a) * gazeEmaRef.current.x),
            y: clamp01(a * raw.y + (1 - a) * gazeEmaRef.current.y),
          };
        } else {
          gazePosition = raw;
        }
        gazeEmaRef.current = gazePosition;
      } else {
        gazeEmaRef.current = null;
      }
    } else {
      gazeEmaRef.current = null;
    }

    setState((prev) => ({
      ...prev,
      hasFace: true,
      landmarks,
      faceBox,
      eyeEAR: ear,
      leftEAR,
      rightEAR,
      eyeOpenness,
      gazePosition,
      baselineReady: baselineEarRef.current != null,
      headYaw: headPose.yaw,
      headPitch: headPose.pitch,
    }));
    } catch (err) {
      // One bad frame (e.g. malformed landmarks on some devices) should not crash the app
      logger.warn('[VisionEngine] handleResults error:', err);
    }
  }, []);

  const ensureFaceMesh = useCallback(async () => {
    if (faceMeshRef.current) return faceMeshRef.current;

    const mesh = await ensureSharedFaceMesh();
    const desired = { minDetectionConfidence, minTrackingConfidence };
    if (
      !sharedFaceMeshOptions ||
      sharedFaceMeshOptions.minDetectionConfidence !== desired.minDetectionConfidence ||
      sharedFaceMeshOptions.minTrackingConfidence !== desired.minTrackingConfidence
    ) {
      mesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence,
        minTrackingConfidence,
      });
      sharedFaceMeshOptions = desired;
    }

    faceMeshRef.current = mesh;
    return mesh;
  }, [minDetectionConfidence, minTrackingConfidence]);

  const ensureFaceLandmarker = useCallback(async () => {
    if (faceLandmarkerRef.current) return faceLandmarkerRef.current;

    const landmarker = await ensureSharedFaceLandmarker(minDetectionConfidence, minTrackingConfidence);
    faceLandmarkerRef.current = landmarker;
    return landmarker;
  }, [minDetectionConfidence, minTrackingConfidence]);

  useEffect(() => {
    const listeners = visionBackend === 'face_landmarker' ? sharedFaceLandmarkerListeners : sharedFaceMeshListeners;
    listeners.add(handleResults);
    return () => {
      listeners.delete(handleResults);
    };
  }, [handleResults, visionBackend]);

  const start = useCallback(async () => {
    if (!enabled) return;
    if (intervalRef.current) return;

    const video = videoRef.current;
    if (!video) return;
    if (video.readyState < 2) return;

    const backend = visionBackendRef.current;
    try {
      if (backend === 'face_landmarker') {
        await ensureFaceLandmarker();
      } else {
        await ensureFaceMesh();
      }
    } catch (err) {
      logger.warn(`[VisionEngine] Failed to initialize ${backend}:`, err);
      return;
    }
    setState((prev) => ({ ...prev, isRunning: true }));

    // Claim driver slot; priority instances (calibration) always take over
    if (sharedDriverId == null || driverPriorityRef.current) {
      sharedDriverId = instanceIdRef.current;
      sharedDriverPriority = driverPriorityRef.current;
      sharedDriverVisionBackend = backend;
    }

    let lastVideoTs = 0;

    intervalRef.current = setInterval(async () => {
      if (!enabled || !videoRef.current || processingRef.current) return;

      const myId = instanceIdRef.current;

      if (sharedDriverId !== myId) {
        if (driverPriorityRef.current && !sharedDriverPriority) {
          sharedDriverId = myId;
          sharedDriverPriority = true;
          sharedDriverVisionBackend = visionBackendRef.current;
        } else {
          const now = Date.now();
          if (now - sharedDriverLastSendTs > 800 && !sharedDriverPriority) {
            sharedDriverId = myId;
            sharedDriverPriority = driverPriorityRef.current;
            sharedDriverVisionBackend = visionBackendRef.current;
          } else {
            return;
          }
        }
      }

      if (sharedProcessing) return;
      const v = videoRef.current;
      if (!v || v.readyState < 2) return;

      processingRef.current = true;
      sharedProcessing = true;
      try {
        if (sharedDriverVisionBackend === 'face_landmarker') {
          const lm = faceLandmarkerRef.current;
          if (lm) {
            lastVideoTs += detectionInterval;
            const result = lm.detectForVideo(v, lastVideoTs);
            const payload = { multiFaceLandmarks: result.faceLandmarks ?? [] };
            sharedFaceLandmarkerListeners.forEach((listener) => {
              try {
                listener(payload);
              } catch {
                // ignore
              }
            });
          }
          sharedSendFailCount = 0;
        } else {
          await faceMeshRef.current?.send({ image: v });
          sharedSendFailCount = 0;
        }
      } catch (err) {
        sharedSendFailCount += 1;
        if (sharedDriverVisionBackend === 'face_mesh' && sharedSendFailCount >= 5) {
          logger.warn('[VisionEngine] Too many send failures, recreating FaceMesh');
          sharedFaceMesh = null;
          sharedFaceMeshPromise = null;
          faceMeshRef.current = null;
          sharedSendFailCount = 0;
          try {
            const mesh = await ensureSharedFaceMesh();
            mesh.setOptions({
              maxNumFaces: 1,
              refineLandmarks: true,
              minDetectionConfidence: 0.6,
              minTrackingConfidence: 0.6,
            });
            faceMeshRef.current = mesh;
          } catch {
            // Will retry on next interval
          }
        }
      } finally {
        processingRef.current = false;
        sharedProcessing = false;
        sharedDriverLastSendTs = Date.now();
      }
    }, detectionInterval);
  }, [enabled, detectionInterval, ensureFaceMesh, ensureFaceLandmarker, videoRef]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (sharedDriverId === instanceIdRef.current) {
      sharedDriverId = null;
      sharedDriverPriority = false;
    }
    if (patternTimeoutRef.current) {
      clearTimeout(patternTimeoutRef.current);
      patternTimeoutRef.current = null;
    }
    baselineEarRef.current = null;
    baselineEarSamples.current = [];
    wasClosedRef.current = false;
    closedAtRef.current = 0;
    closedFramesCountRef.current = 0;
    lastBlinkTimeRef.current = 0;
    noFaceFramesRef.current = 0;
    blinkPatternRef.current = { count: 0, timestamp: 0 };
    setState((prev) => ({ ...prev, isRunning: false }));
  }, []);

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    let mounted = true;
    const tryStart = async () => {
      if (!mounted) return;
      await start();
      if (!intervalRef.current && enabled) {
        // Retry shortly if video isn't ready yet.
        setTimeout(tryStart, 120);
      }
    };

    void tryStart();
    return () => {
      mounted = false;
      stop();
    };
  }, [enabled, start, stop]);

  return state;
}
