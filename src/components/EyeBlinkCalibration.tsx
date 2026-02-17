import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Target, Check, X, Loader2, RotateCcw, Smartphone, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import {
  loadRemoteControlSettings,
  loadCalibrationData,
  applyCalibration,
} from '@/hooks/useBlinkRemoteControl';

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const clamp = (min: number, v: number, max: number) => Math.max(min, Math.min(max, v));

type StandardFrame = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  eyeDx: number; // as proportion of rx
  eyeDy: number; // as proportion of ry
};

const DEFAULT_STANDARD_FRAME: StandardFrame = {
  cx: 100,
  cy: 140,
  rx: 82,
  ry: 118,
  eyeDx: 0.34,
  eyeDy: 0.20,
};

// 9 calibration positions in the specified order (portrait mode)
const CALIBRATION_POSITIONS_PORTRAIT = [
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

// 9 calibration positions for landscape/panorama mode
const CALIBRATION_POSITIONS_LANDSCAPE = [
  { x: 0.08, y: 0.15, label: 'Top Left' },
  { x: 0.92, y: 0.15, label: 'Top Right' },
  { x: 0.08, y: 0.5, label: 'Middle Left' },
  { x: 0.92, y: 0.5, label: 'Middle Right' },
  { x: 0.08, y: 0.85, label: 'Bottom Left' },
  { x: 0.92, y: 0.85, label: 'Bottom Right' },
  { x: 0.5, y: 0.15, label: 'Top Middle' },
  { x: 0.5, y: 0.5, label: 'Center' },
  { x: 0.5, y: 0.85, label: 'Bottom Middle' },
];

// 16-point grid for extended calibration (Phase 2) - better fit for non-linear distortion
const withLabels = <T extends { x: number; y: number }>(arr: T[]) =>
  arr.map((p, i) => ({ ...p, label: `Point ${i + 1}` }));

const CALIBRATION_POSITIONS_16_PORTRAIT = withLabels([
  { x: 0.1, y: 0.1 }, { x: 0.37, y: 0.1 }, { x: 0.63, y: 0.1 }, { x: 0.9, y: 0.1 },
  { x: 0.1, y: 0.37 }, { x: 0.37, y: 0.37 }, { x: 0.63, y: 0.37 }, { x: 0.9, y: 0.37 },
  { x: 0.1, y: 0.63 }, { x: 0.37, y: 0.63 }, { x: 0.63, y: 0.63 }, { x: 0.9, y: 0.63 },
  { x: 0.1, y: 0.9 }, { x: 0.37, y: 0.9 }, { x: 0.63, y: 0.9 }, { x: 0.9, y: 0.9 },
]);

const CALIBRATION_POSITIONS_16_LANDSCAPE = withLabels([
  { x: 0.08, y: 0.15 }, { x: 0.33, y: 0.15 }, { x: 0.67, y: 0.15 }, { x: 0.92, y: 0.15 },
  { x: 0.08, y: 0.4 }, { x: 0.33, y: 0.4 }, { x: 0.67, y: 0.4 }, { x: 0.92, y: 0.4 },
  { x: 0.08, y: 0.6 }, { x: 0.33, y: 0.6 }, { x: 0.67, y: 0.6 }, { x: 0.92, y: 0.6 },
  { x: 0.08, y: 0.85 }, { x: 0.33, y: 0.85 }, { x: 0.67, y: 0.85 }, { x: 0.92, y: 0.85 },
]);

// Blink requirements per position (cycles through 1, 2)
const getBlinkRequirement = (positionIndex: number): number => {
  return (positionIndex % 2) + 1;
};

/** Gaze sample for calibration: raw gaze (0-1) when user was looking at target */
export interface GazeCalibrationPoint {
  targetX: number;
  targetY: number;
  gazeX: number;
  gazeY: number;
}

export interface CalibrationResult {
  positions: Array<{
    position: { x: number; y: number };
    blinkData: {
      requiredBlinks: number;
      actualBlinks: number;
      timing: number[];
    };
    /** Averaged gaze when user looked at this target (for gaze calibration) */
    gazeData?: { avgX: number; avgY: number };
  }>;
  landscapePositions?: Array<{
    position: { x: number; y: number };
    blinkData: {
      requiredBlinks: number;
      actualBlinks: number;
      timing: number[];
    };
    gazeData?: { avgX: number; avgY: number };
  }>;
  eyeFrameData: {
    captured: boolean;
    timestamp: number;
  };
  gestureTraining?: Array<{
    id: string;
    completed: boolean;
    timestamp: number;
  }>;
  completedAt: number;
}

interface EyeBlinkCalibrationProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: CalibrationResult) => void;
  onSkip?: () => void;
  /** Use 16-point grid for better gaze accuracy (Phase 2) */
  extendedCalibration?: boolean;
}

type CalibrationStep =
  | 'intro'
  | 'eye-frame'
  | 'gesture-training'
  | 'blink-calibration'
  | 'rotate-prompt'
  | 'landscape-calibration'
  | 'complete';
type OrientationMode = 'portrait' | 'landscape';

type GestureTrainingId =
  | 'blink'
  | 'wink-left'
  | 'wink-right'
  | 'lips'
  | 'eyebrow-left'
  | 'eyebrow-right'
  | 'eyebrows-both'
  | 'smile'
  | 'smirk'
  | 'lip-left'
  | 'lip-right'
  | 'head-left'
  | 'head-right';

type FaceAnalysis = {
  detected: boolean;
  // Normalized 0..1 in camera frame coordinates (mirrored already)
  center: { x: number; y: number } | null;
  box: { x: number; y: number; w: number; h: number } | null;
  eyes: { left: { x: number; y: number } | null; right: { x: number; y: number } | null; confidence: number };
};

type GridStats = number[]; // 8x8 = 64 brightness samples, 0..255

const GRID_SIZE = 8;

const computeGridStats = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  region: { x: number; y: number; w: number; h: number }
): GridStats => {
  const out: number[] = new Array(GRID_SIZE * GRID_SIZE).fill(0);
  const counts: number[] = new Array(GRID_SIZE * GRID_SIZE).fill(0);

  const x0 = Math.max(0, Math.floor(region.x));
  const y0 = Math.max(0, Math.floor(region.y));
  const x1 = Math.min(width, Math.ceil(region.x + region.w));
  const y1 = Math.min(height, Math.ceil(region.y + region.h));

  const rw = Math.max(1, x1 - x0);
  const rh = Math.max(1, y1 - y0);

  for (let y = y0; y < y1; y += 2) {
    const gy = Math.min(GRID_SIZE - 1, Math.floor(((y - y0) / rh) * GRID_SIZE));
    for (let x = x0; x < x1; x += 2) {
      const gx = Math.min(GRID_SIZE - 1, Math.floor(((x - x0) / rw) * GRID_SIZE));
      const idx = gy * GRID_SIZE + gx;
      const i = (y * width + x) * 4;
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      const brightness = (r + g + b) / 3;
      out[idx] += brightness;
      counts[idx] += 1;
    }
  }

  for (let i = 0; i < out.length; i++) {
    out[i] = counts[i] ? out[i] / counts[i] : 0;
  }
  return out;
};

const diffGridStats = (a: GridStats | null, b: GridStats | null) => {
  if (!a || !b || a.length !== b.length) return 0;
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(a[i] - b[i]);
  return sum / a.length;
};

const isSkinPixel = (r: number, g: number, b: number) => {
  // Two heuristics: a quick RGB rule + a more robust YCbCr rule (helps across tones/lighting).
  const brightness = (r + g + b) / 3;
  if (brightness < 25) return false;

  const rgbHeuristic =
    r > 45 &&
    g > 25 &&
    b > 15 &&
    Math.max(r, g, b) - Math.min(r, g, b) > 12;

  // YCbCr conversion (approx)
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  const ycbcrHeuristic =
    cb >= 80 && cb <= 145 &&
    cr >= 130 && cr <= 185 &&
    brightness > 35;

  return rgbHeuristic || ycbcrHeuristic;
};

const analyzeFaceFrame = (imageData: ImageData): FaceAnalysis => {
  const { data, width, height } = imageData;

  // Scan for skin pixels and derive a bounding box + center.
  let minX = width, minY = height, maxX = 0, maxY = 0;
  let sumX = 0, sumY = 0, count = 0;

  // Step size: trade accuracy for speed
  for (let y = 0; y < height; y += 3) {
    for (let x = 0; x < width; x += 3) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (isSkinPixel(r, g, b)) {
        count++;
        sumX += x;
        sumY += y;
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  // Dynamic threshold: keep this forgiving so we detect faces under indoor lighting.
  const samplesX = Math.ceil(width / 3);
  const samplesY = Math.ceil(height / 3);
  const sampleTotal = Math.max(1, samplesX * samplesY);
  const skinRatio = count / sampleTotal;

  if (count < 160 && skinRatio < 0.015) {
    return {
      detected: false,
      center: null,
      box: null,
      eyes: { left: null, right: null, confidence: 0 },
    };
  }

  const cx = sumX / count;
  const cy = sumY / count;

  // Mirror X axis (camera preview is mirrored)
  const center = { x: 1 - cx / width, y: cy / height };
  const box = {
    x: clamp01(1 - maxX / width),
    y: clamp01(minY / height),
    w: clamp01((maxX - minX) / width),
    h: clamp01((maxY - minY) / height),
  };

  // Eye estimation: look for dark pixels in the upper half of face box and split left/right.
  // This is intentionally lightweight and avoids ML dependencies.
  const faceX0 = Math.floor((1 - (box.x + box.w)) * width);
  const faceY0 = Math.floor(box.y * height);
  const faceX1 = Math.floor((1 - box.x) * width);
  const faceY1 = Math.floor((box.y + box.h) * height);
  const faceW = Math.max(1, faceX1 - faceX0);
  const faceH = Math.max(1, faceY1 - faceY0);

  const eyeRegionY1 = faceY0 + Math.floor(faceH * 0.55);
  const eyeRegionY0 = faceY0 + Math.floor(faceH * 0.12);
  const midX = faceX0 + Math.floor(faceW / 2);

  const accum = {
    left: { x: 0, y: 0, n: 0 },
    right: { x: 0, y: 0, n: 0 },
  };

  for (let y = eyeRegionY0; y < eyeRegionY1; y += 2) {
    for (let x = faceX0; x < faceX1; x += 2) {
      const i = (y * width + x) * 4;
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      const brightness = (r + g + b) / 3;
      // Dark-ish pixels; avoid including pure shadows by requiring some contrast
      if (brightness < 55) {
        if (x < midX) {
          accum.left.x += x;
          accum.left.y += y;
          accum.left.n += 1;
        } else {
          accum.right.x += x;
          accum.right.y += y;
          accum.right.n += 1;
        }
      }
    }
  }

  const left = accum.left.n > 60
    ? { x: 1 - (accum.left.x / accum.left.n) / width, y: (accum.left.y / accum.left.n) / height }
    : null;
  const right = accum.right.n > 60
    ? { x: 1 - (accum.right.x / accum.right.n) / width, y: (accum.right.y / accum.right.n) / height }
    : null;

  // Confidence is based on having two distinct clusters.
  const confidence =
    left && right
      ? clamp01(Math.min(1, (accum.left.n + accum.right.n) / 1200))
      : clamp01(Math.max(accum.left.n, accum.right.n) / 1200);

  return {
    detected: true,
    center,
    box,
    eyes: { left, right, confidence },
  };
};

export const EyeBlinkCalibration: React.FC<EyeBlinkCalibrationProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
  extendedCalibration = false,
}) => {
  const haptics = useHapticFeedback();
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [soundEnabled] = useState(true);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const faceDetectorRef = useRef<any>(null);
  const faceDetectInFlightRef = useRef(false);
  const [faceDetectorAvailable, setFaceDetectorAvailable] = useState(false);
  const [eyeFrameEnteredAt, setEyeFrameEnteredAt] = useState<number>(0);
  const [standardFrame, setStandardFrame] = useState<StandardFrame>(DEFAULT_STANDARD_FRAME);
  const lastFaceAnalysisRef = useRef<FaceAnalysis | null>(null);

  // MediaPipe Face Detection (cross-platform)
  const mpFaceDetectionRef = useRef<any>(null);
  const mpReadyRef = useRef(false);
  const mpLastAnalysisRef = useRef<{ analysis: FaceAnalysis; ts: number } | null>(null);
  const mpSendInFlightRef = useRef(false);
  const mpLoopRef = useRef<number | null>(null);

  // Gesture repetition requirement (3x correct)
  const [gestureRepCount, setGestureRepCount] = useState(0);
  const gestureRepRef = useRef(0);
  const gestureCooldownUntilRef = useRef(0);
  const [blinkColorStage, setBlinkColorStage] = useState<0 | 1 | 2>(0); // 0=red, 1=yellow, 2=green
  const blinkColorStageRef = useRef<0 | 1 | 2>(0);
  const blinkStageCountRef = useRef(0); // unused (kept for stability)
  const blinkTotalSyncedRef = useRef(0); // 0..3 total
  const [blinkTotalSynced, setBlinkTotalSynced] = useState(0);
  const blinkCycleStartRef = useRef<number>(0);
  const blinkGoodJobUntilRef = useRef(0);
  const lastBlinkAtRef = useRef(0);
  const lastBlinkConsumedRef = useRef(0);
  
  // Eye frame step
  const [eyeFrameMatched, setEyeFrameMatched] = useState(false);
  const [eyeFrameProgress, setEyeFrameProgress] = useState(0);
  const [faceAnalysis, setFaceAnalysis] = useState<FaceAnalysis>({
    detected: false,
    center: null,
    box: null,
    eyes: { left: null, right: null, confidence: 0 },
  });
  const stableCenterRef = useRef<{ x: number; y: number } | null>(null);
  const stabilityRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Prefer the native FaceDetector when available (Android Chrome).
  useEffect(() => {
    try {
      const FD = (window as any).FaceDetector;
      if (!FD) {
        setFaceDetectorAvailable(false);
        return;
      }
      faceDetectorRef.current = new FD({ fastMode: true, maxDetectedFaces: 1 });
      setFaceDetectorAvailable(true);
    } catch {
      faceDetectorRef.current = null;
      setFaceDetectorAvailable(false);
    }
  }, []);

  // Initialize MediaPipe Face Detection once camera is ready.
  useEffect(() => {
    if (!isOpen) return;
    if (cameraStatus !== 'ready') return;
    if (mpReadyRef.current) return;
    let cancelled = false;

    const init = async () => {
      try {
        const mod: any = await import('@mediapipe/face_detection');
        if (cancelled) return;

        const FaceDetection = mod.FaceDetection;
        if (!FaceDetection) return;

        const fd = new FaceDetection({
          locateFile: (file: string) =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection@0.4.1646425229/${file}`,
        });
        fd.setOptions({
          modelSelection: 0,
          minDetectionConfidence: 0.5,
        });

        fd.onResults((results: any) => {
          try {
            const det = results?.detections?.[0];
            const rb = det?.locationData?.relativeBoundingBox;
            if (!rb) return;

            const xMin = rb.xMin ?? rb.xmin ?? 0;
            const yMin = rb.yMin ?? rb.ymin ?? 0;
            const w = rb.width ?? 0;
            const h = rb.height ?? 0;

            const x = clamp01(1 - (xMin + w)); // mirror X to match preview
            const y = clamp01(yMin);
            const box = { x, y, w: clamp01(w), h: clamp01(h) };
            const center = { x: clamp01(box.x + box.w / 2), y: clamp01(box.y + box.h / 2) };

            let left: { x: number; y: number } | null = null;
            let right: { x: number; y: number } | null = null;
            const kps: any[] = det?.locationData?.relativeKeypoints || [];
            // Common order: rightEye, leftEye, noseTip, mouthCenter, rightEarTragion, leftEarTragion
            if (kps[0] && typeof kps[0].x === 'number') {
              right = { x: clamp01(1 - kps[0].x), y: clamp01(kps[0].y) };
            }
            if (kps[1] && typeof kps[1].x === 'number') {
              left = { x: clamp01(1 - kps[1].x), y: clamp01(kps[1].y) };
            }

            const score = Array.isArray(det?.score) ? det.score[0] : det?.score;
            const confidence = typeof score === 'number' ? clamp01(score) : (left && right ? 0.8 : 0.4);

            mpLastAnalysisRef.current = {
              ts: Date.now(),
              analysis: {
                detected: true,
                center,
                box,
                eyes: { left, right, confidence },
              },
            };
          } catch {
            // ignore
          }
        });

        mpFaceDetectionRef.current = fd;
        mpReadyRef.current = true;

        // Start a lightweight loop (we already have the camera stream).
        const loop = () => {
          if (cancelled) return;
          const video = videoRef.current;
          if (!video || video.readyState < 2) {
            mpLoopRef.current = window.setTimeout(loop, 120) as any;
            return;
          }
          if (mpSendInFlightRef.current) {
            mpLoopRef.current = window.setTimeout(loop, 120) as any;
            return;
          }
          mpSendInFlightRef.current = true;
          fd.send({ image: video })
            .catch(() => {})
            .finally(() => {
              mpSendInFlightRef.current = false;
              mpLoopRef.current = window.setTimeout(loop, 120) as any;
            });
        };
        loop();
      } catch {
        // MediaPipe load failed; we'll use fallbacks.
      }
    };

    void init();

    return () => {
      cancelled = true;
      if (mpLoopRef.current) {
        clearTimeout(mpLoopRef.current);
        mpLoopRef.current = null;
      }
    };
  }, [isOpen, cameraStatus]);

  // Track when we enter the eye-frame step (for "unstick" fallback).
  useEffect(() => {
    if (step === 'eye-frame') setEyeFrameEnteredAt(Date.now());
  }, [step]);
  
  // Orientation mode
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('portrait');
  const [landscapeCalibrationData, setLandscapeCalibrationData] = useState<CalibrationResult['positions']>([]);
  
  // Gesture training step
  const [gestureIndex, setGestureIndex] = useState(0);
  const [gestureAccepted, setGestureAccepted] = useState(false);
  const [gesturePromptTs, setGesturePromptTs] = useState<number>(0);
  const [gestureResults, setGestureResults] = useState<NonNullable<CalibrationResult['gestureTraining']>>([]);
  const mouthBaselineRef = useRef<GridStats | null>(null);
  const browBaselineRef = useRef<GridStats | null>(null);
  const mouthOpenBaselineRef = useRef<number | null>(null);
  const browLiftBaselineRef = useRef<number | null>(null);
  const browLeftBaselineRef = useRef<number | null>(null);
  const browRightBaselineRef = useRef<number | null>(null);
  const mouthSmileBaselineRef = useRef<number | null>(null);
  const mouthCornerBaselineRef = useRef<{ leftY: number; rightY: number } | null>(null);
  const neutralFaceCenterRef = useRef<{ x: number; y: number } | null>(null);
  const motionHoldRef = useRef<{ mouthMs: number; browMs: number }>({ mouthMs: 0, browMs: 0 });
  const gestureIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Reset repetitions when gesture changes.
  useEffect(() => {
    if (step !== 'gesture-training') return;
    gestureRepRef.current = 0;
    setGestureRepCount(0);
    gestureCooldownUntilRef.current = 0;
    blinkColorStageRef.current = 0;
    setBlinkColorStage(0);
    blinkStageCountRef.current = 0;
    blinkTotalSyncedRef.current = 0;
    setBlinkTotalSynced(0);
    blinkCycleStartRef.current = Date.now();
    lastBlinkAtRef.current = 0;
    lastBlinkConsumedRef.current = 0;
    blinkGoodJobUntilRef.current = 0;
    blinkLocalClosedRef.current = false;
    blinkLocalLastRef.current = 0;
    lastEyeOpennessRef.current = 1;
    blinkOpennessBaselineRef.current = 1;
    blinkEyeBaselineRef.current = null;
    blinkPixelLastRef.current = 0;
    winkLeftClosedRef.current = false;
    winkRightClosedRef.current = false;
    winkLeftBaselineRef.current = 0.2;
    winkRightBaselineRef.current = 0.2;
    winkLeftLastRef.current = 0;
    winkRightLastRef.current = 0;
    mouthOpenBaselineRef.current = null;
    browLiftBaselineRef.current = null;
    browLeftBaselineRef.current = null;
    browRightBaselineRef.current = null;
    mouthSmileBaselineRef.current = null;
    mouthCornerBaselineRef.current = null;
  }, [step, gestureIndex]);

  // Blink calibration step
  const [currentPositionIndex, setCurrentPositionIndex] = useState(0);
  const [currentBlinkCount, setCurrentBlinkCount] = useState(0);
  const [isWaitingForBlink, setIsWaitingForBlink] = useState(false);
  const [calibrationData, setCalibrationData] = useState<CalibrationResult['positions']>([]);
  const [blinkTimings, setBlinkTimings] = useState<number[]>([]);
  const [targetVisible, setTargetVisible] = useState(false);
  const [instruction, setInstruction] = useState('');
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const debugBlinkCountRef = useRef(0);
  
  // Get current positions based on orientation
  const CALIBRATION_POSITIONS = extendedCalibration
    ? (orientationMode === 'portrait' ? CALIBRATION_POSITIONS_16_PORTRAIT : CALIBRATION_POSITIONS_16_LANDSCAPE)
    : (orientationMode === 'portrait' ? CALIBRATION_POSITIONS_PORTRAIT : CALIBRATION_POSITIONS_LANDSCAPE);
  
  // Blink detection refs
  const lastBlinkTimeRef = useRef<number>(0);
  const blinkDetectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const blinkLocalClosedRef = useRef(false);
  const blinkLocalLastRef = useRef(0);
  const lastEyeOpennessRef = useRef(1);
  const blinkOpennessBaselineRef = useRef(1);
  const blinkEyeBaselineRef = useRef<{ left: GridStats; right: GridStats } | null>(null);
  const blinkPixelLastRef = useRef(0);

  const winkLeftClosedRef = useRef(false);
  const winkRightClosedRef = useRef(false);
  const winkLeftBaselineRef = useRef<number>(0.2);
  const winkRightBaselineRef = useRef<number>(0.2);
  const winkLeftLastRef = useRef(0);
  const winkRightLastRef = useRef(0);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);

  // Play sound effect
  const playSound = useCallback((type: 'blink' | 'success' | 'error' | 'target') => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      switch (type) {
        case 'blink':
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.1);
          break;
        case 'success':
          oscillator.frequency.value = 523.25;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
        case 'error':
          oscillator.frequency.value = 200;
          oscillator.type = 'square';
          gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.3);
          break;
        case 'target':
          oscillator.frequency.value = 440;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.15);
          break;
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  }, [soundEnabled]);

  // Start camera
  const startCamera = useCallback(async () => {
    if (streamRef.current && videoRef.current?.srcObject) {
      setCameraStatus('ready');
      setCameraError(null);
      return true;
    }

    try {
      setCameraStatus('starting');
      setCameraError(null);

      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraStatus('error');
        setCameraError('Camera not supported on this browser.');
        return false;
      }

      // Mobile browsers (especially iOS Safari) can fail with fixed width/height.
      // Try a few progressively-looser constraints.
      if (!window.isSecureContext) {
        setCameraStatus('error');
        setCameraError('Camera requires HTTPS. Open the HTTPS link in Safari/Chrome (not an in-app browser).');
        return false;
      }

      const attempts: MediaStreamConstraints[] = [
        {
          audio: false,
          video: {
            facingMode: { ideal: 'user' },
            width: { ideal: 640 },
            height: { ideal: 480 },
            frameRate: { ideal: 30, max: 30 },
          },
        },
        { audio: false, video: { facingMode: 'user' } },
        { audio: false, video: true },
      ];

      let stream: MediaStream | null = null;
      let lastErr: unknown = null;
      for (const constraints of attempts) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          break;
        } catch (err) {
          lastErr = err;
        }
      }

      if (!stream) throw lastErr;
      
      streamRef.current = stream;
      
      if (videoRef.current) {
        // Reinforce iOS-friendly playback attributes.
        videoRef.current.muted = true;
        videoRef.current.playsInline = true;
        videoRef.current.autoplay = true;
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch {
          // Some browsers require a user gesture to begin playback; the stream is still attached.
        }
      }
      
      setCameraStatus('ready');
      return true;
    } catch (e) {
      console.error('Camera error:', e);
      setCameraStatus('error');
      const raw = e instanceof Error ? e.message : String(e);
      const name = (e as any)?.name as string | undefined;
      const normalized = `${name ?? ''} ${raw}`.toLowerCase();

      // Provide a more actionable message on mobile.
      if (normalized.includes('notallowed') || normalized.includes('permission')) {
        setCameraError('Permission denied. Enable Camera access for this site in your browser settings, then reload.');
      } else if (normalized.includes('notreadable') || normalized.includes('could not start video source')) {
        setCameraError('Could not start camera. Close other apps/tabs using the camera, then reload. (Avoid in-app browsers.)');
      } else if (normalized.includes('overconstrained')) {
        setCameraError('Camera constraints not supported on this device. Try again (we will pick a compatible mode).');
      } else if (normalized.includes('notfound')) {
        setCameraError('No front camera found on this device.');
      } else {
        setCameraError(raw || 'Camera access failed.');
      }
      return false;
    }
  }, []);

  // Stop camera
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      try {
        (videoRef.current as any).srcObject = null;
      } catch {
        // ignore
      }
      // Force release on some browsers
      try {
        videoRef.current.load();
      } catch {
        // ignore
      }
    }
    if (blinkDetectionIntervalRef.current) {
      clearInterval(blinkDetectionIntervalRef.current);
      blinkDetectionIntervalRef.current = null;
    }
    setCameraStatus('idle');
    setCameraError(null);
  }, []);

  const analyzeCurrentFrameSync = useCallback((): FaceAnalysis | null => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return analyzeFaceFrame(imageData);
  }, []);

  const analyzeCurrentFrame = useCallback(async (): Promise<FaceAnalysis | null> => {
    if (!videoRef.current || !canvasRef.current) return null;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Always refresh the processing canvas so downstream code can sample pixels.
    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

    // Best option: MediaPipe result (cross-platform) if it's fresh.
    const mp = mpLastAnalysisRef.current;
    if (mp && Date.now() - mp.ts < 600) {
      lastFaceAnalysisRef.current = mp.analysis;
      return mp.analysis;
    }

    // Try native detector first (more reliable than skin heuristic).
    const fd = faceDetectorRef.current;
    if (fd?.detect) {
      try {
        const faces = await fd.detect(canvas);
        const face = faces?.[0];
        const bb = face?.boundingBox;
        if (bb && typeof bb.x === 'number') {
          const W = canvas.width || 1;
          const H = canvas.height || 1;
          const wN = clamp01(bb.width / W);
          const hN = clamp01(bb.height / H);
          const xN = clamp01(1 - (bb.x + bb.width) / W); // mirror to match preview
          const yN = clamp01(bb.y / H);
          const center = { x: clamp01(xN + wN / 2), y: clamp01(yN + hN / 2) };

          // Landmarks are optional; keep eyes null if not present.
          let left: { x: number; y: number } | null = null;
          let right: { x: number; y: number } | null = null;
          const lms: any[] = face?.landmarks || [];
          for (const lm of lms) {
            const type = String(lm?.type || '').toLowerCase();
            const loc = lm?.location || lm?.locations?.[0] || lm?.positions?.[0];
            if (!loc || typeof loc.x !== 'number') continue;
            const pt = { x: clamp01(1 - loc.x / W), y: clamp01(loc.y / H) };
            if (type.includes('left') && type.includes('eye')) left = pt;
            if (type.includes('right') && type.includes('eye')) right = pt;
          }

          return {
            detected: true,
            center,
            box: { x: xN, y: yN, w: wN, h: hN },
            eyes: { left, right, confidence: left && right ? 0.9 : 0.3 },
          };
        }
      } catch {
        // fall back
      }
    }

    // Fallback: lightweight skin heuristic.
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const analysis = analyzeFaceFrame(imageData);
    lastFaceAnalysisRef.current = analysis;
    return analysis;
  }, []);

  // Blink detection logic (Vision Engine)
  const detectBlink = useCallback((): boolean => {
    if (!lastBlinkAtRef.current) return false;
    if (lastBlinkAtRef.current === lastBlinkConsumedRef.current) return false;
    lastBlinkConsumedRef.current = lastBlinkAtRef.current;
    return true;
  }, []);


  // Eye frame matching step
  useEffect(() => {
    if (step !== 'eye-frame' || !isOpen) return;
    
    const checkEyeFrame = setInterval(() => {
      if (faceDetectInFlightRef.current) return;
      faceDetectInFlightRef.current = true;
      void (async () => {
        try {
          const analysis = await analyzeCurrentFrame();
          if (analysis) setFaceAnalysis(analysis);
          const detected = analysis?.detected ?? false;
      
          if (detected) {
            setEyeFrameProgress(prev => {
              const box = analysis?.box;
              if (!box) return Math.max(0, prev - 12);

              // The guide frame is fixed on-screen; we match the user's face to it.
              // Target values are tuned for a typical selfie distance in portrait.
              const target = { x: 0.5, y: 0.52, w: 0.34, h: 0.48 };
              const center = { x: clamp01(box.x + box.w / 2), y: clamp01(box.y + box.h / 2) };

              const dx = center.x - target.x;
              const dy = center.y - target.y;
              const dist = Math.sqrt(dx * dx + dy * dy);

              // Be forgiving: the heuristic face box varies a lot by lighting/hair.
              const centerOk = dist < 0.13;
              // Only require "reasonable" size so this actually works on real phones.
              // We still use target sizes for hints, but we don't hard-fail alignment if the box is a bit off.
              const sizeOk =
                box.w > 0.18 &&
                box.w < 0.70 &&
                box.h > 0.22 &&
                box.h < 0.85;

              const left = analysis.eyes.left;
              const right = analysis.eyes.right;
              const conf = analysis.eyes.confidence;
              const haveEyes = Boolean(left && right && conf > 0.25);

              const eyesOk = (() => {
                if (!haveEyes) return false;
                const lx = (left!.x - center.x) / Math.max(0.0001, box.w);
                const ly = (left!.y - center.y) / Math.max(0.0001, box.h);
                const rx = (right!.x - center.x) / Math.max(0.0001, box.w);
                const ry = (right!.y - center.y) / Math.max(0.0001, box.h);

                const okLeft =
                  Math.abs(lx - (-0.22)) < 0.18 &&
                  Math.abs(ly - (-0.26)) < 0.28;
                const okRight =
                  Math.abs(rx - (0.22)) < 0.18 &&
                  Math.abs(ry - (-0.26)) < 0.28;
                return okLeft && okRight;
              })();

              const aligned = centerOk && sizeOk && (eyesOk || !haveEyes);

              // Stability: require the face center to remain steady while aligned.
              const stable = stableCenterRef.current;
              if (!stable) {
                stableCenterRef.current = center;
                stabilityRef.current = 0;
              } else {
                const sdx = center.x - stable.x;
                const sdy = center.y - stable.y;
                const sdist = Math.sqrt(sdx * sdx + sdy * sdy);
                const stableNow = aligned && sdist < 0.024;
                stabilityRef.current = clamp01(stabilityRef.current + (stableNow ? 0.10 : -0.08));
                stableCenterRef.current = { x: stable.x * 0.9 + center.x * 0.1, y: stable.y * 0.9 + center.y * 0.1 };
              }

              const stabilityOk = stabilityRef.current > 0.60;
              const inc = aligned ? (stabilityOk ? 12 : 7) + (eyesOk ? 3 : 0) : 0;
              const dec = aligned ? 1 : 6;
              const newProgress = Math.max(0, Math.min(100, prev + inc - dec));

              if (newProgress >= 100 && !eyeFrameMatched) {
                // Capture a "standard" frame size for this user (then keep it fixed for all next steps).
                try {
                  const b = box;
                  const nextRx = clamp(70, b.w * 200 * 0.62, 96);
                  const nextRy = clamp(96, b.h * 240 * 0.62, 136);
                  setStandardFrame((prevFrame) => ({
                    ...prevFrame,
                    rx: nextRx,
                    ry: nextRy,
                  }));
                } catch {
                  // ignore
                }
                setEyeFrameMatched(true);
                playSound('success');
                haptics.success();
                
                setTimeout(() => {
                  setGestureIndex(0);
                  setGestureAccepted(false);
                  setGesturePromptTs(Date.now());
                  setGestureResults([]);
                  setStep('gesture-training');
                }, 1000);
              }
              return newProgress;
            });
          } else {
            setEyeFrameProgress(prev => Math.max(0, prev - 10));
            stableCenterRef.current = null;
            stabilityRef.current = 0;
          }
        } finally {
          faceDetectInFlightRef.current = false;
        }
      })();
    }, 100);
    
    return () => clearInterval(checkEyeFrame);
  }, [step, isOpen, analyzeCurrentFrame, eyeFrameMatched, haptics, playSound]);

  const GESTURE_SEQUENCE: Array<{
    id: GestureTrainingId;
    title: string;
    instruction: string;
    successText: string;
  }> = [
    {
      id: 'blink',
      title: 'Both eyes blink',
      instruction: 'Align your eyes to the frame, then blink both eyes until it stops.',
      successText: 'Good job!',
    },
    {
      id: 'wink-left',
      title: 'Left eye wink',
      instruction: 'Align your face to the frame, then close only your left eye (wink). Repeat this 3 times.',
      successText: 'Left wink captured!',
    },
    {
      id: 'wink-right',
      title: 'Right eye wink',
      instruction: 'Align your face to the frame, then close only your right eye (wink). Repeat this 3 times.',
      successText: 'Right wink captured!',
    },
    {
      id: 'lips',
      title: 'Move your lips',
      instruction: 'Align your face to the frame, then pucker/move your lips. Repeat this 3 times.',
      successText: 'Lips movement captured!',
    },
    {
      id: 'smile',
      title: 'Smile',
      instruction: 'Align your face to the frame, then smile. Repeat this 3 times.',
      successText: 'Smile captured!',
    },
    {
      id: 'smirk',
      title: 'Smirk',
      instruction: 'Align your face to the frame, then smirk to one side. Repeat this 3 times.',
      successText: 'Smirk captured!',
    },
    {
      id: 'lip-left',
      title: 'Lift left lip',
      instruction: 'Align your face to the frame, then lift the left side of your lips. Repeat this 3 times.',
      successText: 'Left lip captured!',
    },
    {
      id: 'lip-right',
      title: 'Lift right lip',
      instruction: 'Align your face to the frame, then lift the right side of your lips. Repeat this 3 times.',
      successText: 'Right lip captured!',
    },
    {
      id: 'eyebrow-left',
      title: 'Lift left eyebrow',
      instruction: 'Align your face to the frame, then lift your left eyebrow. Repeat this 3 times.',
      successText: 'Left eyebrow captured!',
    },
    {
      id: 'eyebrow-right',
      title: 'Lift right eyebrow',
      instruction: 'Align your face to the frame, then lift your right eyebrow. Repeat this 3 times.',
      successText: 'Right eyebrow captured!',
    },
    {
      id: 'eyebrows-both',
      title: 'Lift both eyebrows',
      instruction: 'Align your face to the frame, then lift both eyebrows together. Repeat this 3 times.',
      successText: 'Both eyebrows captured!',
    },
    {
      id: 'head-left',
      title: 'Move your head left',
      instruction: 'Align your face to the frame, then gently move your head left. Repeat this 3 times.',
      successText: 'Head-left captured!',
    },
    {
      id: 'head-right',
      title: 'Move your head right',
      instruction: 'Align your face to the frame, then gently move your head right. Repeat this 3 times.',
      successText: 'Head-right captured!',
    },
  ];

  const currentGesture = GESTURE_SEQUENCE[gestureIndex];

  const getBlinkEyeColor = useCallback(() => {
    if (step !== 'gesture-training') return 'hsl(var(--primary))';
    if (currentGesture?.id === 'wink-left' || currentGesture?.id === 'wink-right') return 'hsl(var(--primary))';
    if (currentGesture?.id !== 'blink') return 'hsl(var(--primary))';
    return blinkColorStageRef.current === 0
      ? '#EF4444' // red
      : blinkColorStageRef.current === 1
        ? '#F59E0B' // yellow
        : '#22C55E'; // green
  }, [currentGesture?.id, step]);

  const vision = useVisionEngine({
    enabled: isOpen && cameraStatus === 'ready',
    videoRef,
    mirrorX: true,
    invertY: true,
    driverPriority: true,
    visionBackend: loadRemoteControlSettings().visionBackend ?? 'face_mesh',
    blinkConfig: { calibrationMode: true },
    onBlink: () => {
      lastBlinkAtRef.current = Date.now();
    },
  });

  // Broadcast visionEngineSample during calibration so useEyeTracking (and other consumers)
  // receive attention data. RC disables its vision when calibrationMode fires; this component
  // owns the camera and provides the sole vision pipeline during calibration.
  useEffect(() => {
    if (!isOpen || cameraStatus !== 'ready') return;
    if (!vision.hasFace && !vision.gazePosition) return;

    const calibration = loadCalibrationData();
    const calibratedGazePosition =
      vision.gazePosition && calibration?.isCalibrated
        ? applyCalibration(vision.gazePosition.x, vision.gazePosition.y, calibration)
        : vision.gazePosition ?? null;

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
            source: 'calibration' as const,
          },
        })
      );
    } catch {
      // ignore
    }
  }, [
    isOpen,
    cameraStatus,
    vision.hasFace,
    vision.eyeEAR,
    vision.eyeOpenness,
    vision.gazePosition,
    vision.headYaw,
    vision.headPitch,
  ]);

  // Fallback blink detection using eye openness (more tolerant on mobile).
  const detectBlinkFromOpenness = useCallback((): boolean => {
    const openness = vision.eyeOpenness;
    if (!Number.isFinite(openness)) return false;

    const now = Date.now();
    const wasClosed = blinkLocalClosedRef.current;

    const baseline = blinkOpennessBaselineRef.current || 1;
    // Only update baseline when eyes are relatively open to avoid drifting low.
    if (openness > baseline * 0.75) {
      blinkOpennessBaselineRef.current = baseline * 0.97 + openness * 0.03;
    }

    const dynamicClosed = openness < blinkOpennessBaselineRef.current * 0.72;
    const dynamicOpen = openness > blinkOpennessBaselineRef.current * 0.88;
    const closedNow = dynamicClosed || openness < 0.5;
    const reopenedNow = dynamicOpen || openness > 0.8;

    lastEyeOpennessRef.current = openness;

    if (!wasClosed && closedNow) {
      blinkLocalClosedRef.current = true;
      return false;
    }

    if (wasClosed && reopenedNow) {
      blinkLocalClosedRef.current = false;
      if (now - blinkLocalLastRef.current > 140) {
        blinkLocalLastRef.current = now;
        return true;
      }
    }

    return false;
  }, [vision.eyeOpenness]);

  const detectLeftWink = useCallback((): boolean => {
    const leftEAR = vision.leftEAR ?? (vision.eyeEAR ?? 0) * 0.5;
    const rightEAR = vision.rightEAR ?? (vision.eyeEAR ?? 0) * 0.5;
    if (!Number.isFinite(leftEAR) || !Number.isFinite(rightEAR)) return false;
    const now = Date.now();
    if (winkLeftBaselineRef.current < 0.1 && leftEAR > 0.12) winkLeftBaselineRef.current = leftEAR;
    if (leftEAR > winkLeftBaselineRef.current * 0.8) winkLeftBaselineRef.current = winkLeftBaselineRef.current * 0.98 + leftEAR * 0.02;
    const closeThresh = Math.min(winkLeftBaselineRef.current * 0.7, 0.2);
    const reopenThresh = winkLeftBaselineRef.current * 0.85;
    const leftClosed = leftEAR < closeThresh;
    const leftReopened = leftEAR > reopenThresh;
    const rightOpen = rightEAR > reopenThresh;
    if (!winkLeftClosedRef.current && leftClosed) {
      winkLeftClosedRef.current = true;
      return false;
    }
    if (winkLeftClosedRef.current && leftReopened && rightOpen) {
      winkLeftClosedRef.current = false;
      if (now - winkLeftLastRef.current > 220) {
        winkLeftLastRef.current = now;
        return true;
      }
    }
    return false;
  }, [vision.eyeEAR, vision.leftEAR, vision.rightEAR]);

  const detectRightWink = useCallback((): boolean => {
    const leftEAR = vision.leftEAR ?? (vision.eyeEAR ?? 0) * 0.5;
    const rightEAR = vision.rightEAR ?? (vision.eyeEAR ?? 0) * 0.5;
    if (!Number.isFinite(leftEAR) || !Number.isFinite(rightEAR)) return false;
    const now = Date.now();
    if (winkRightBaselineRef.current < 0.1 && rightEAR > 0.12) winkRightBaselineRef.current = rightEAR;
    if (rightEAR > winkRightBaselineRef.current * 0.8) winkRightBaselineRef.current = winkRightBaselineRef.current * 0.98 + rightEAR * 0.02;
    const closeThresh = Math.min(winkRightBaselineRef.current * 0.7, 0.2);
    const reopenThresh = winkRightBaselineRef.current * 0.85;
    const rightClosed = rightEAR < closeThresh;
    const rightReopened = rightEAR > reopenThresh;
    const leftOpen = leftEAR > reopenThresh;
    if (!winkRightClosedRef.current && rightClosed) {
      winkRightClosedRef.current = true;
      return false;
    }
    if (winkRightClosedRef.current && rightReopened && leftOpen) {
      winkRightClosedRef.current = false;
      if (now - winkRightLastRef.current > 220) {
        winkRightLastRef.current = now;
        return true;
      }
    }
    return false;
  }, [vision.eyeEAR, vision.leftEAR, vision.rightEAR]);

  const detectBlinkFromPixels = useCallback(
    (imageData: ImageData, boxPx: { x: number; y: number; w: number; h: number }) => {
      const now = Date.now();
      if (now - blinkPixelLastRef.current < 180) return false;

      const leftEyeRegion = {
        x: boxPx.x + boxPx.w * 0.12,
        y: boxPx.y + boxPx.h * 0.28,
        w: boxPx.w * 0.28,
        h: boxPx.h * 0.18,
      };
      const rightEyeRegion = {
        x: boxPx.x + boxPx.w * 0.60,
        y: boxPx.y + boxPx.h * 0.28,
        w: boxPx.w * 0.28,
        h: boxPx.h * 0.18,
      };

      const leftNow = computeGridStats(imageData.data, imageData.width, imageData.height, leftEyeRegion);
      const rightNow = computeGridStats(imageData.data, imageData.width, imageData.height, rightEyeRegion);

      if (!blinkEyeBaselineRef.current) {
        blinkEyeBaselineRef.current = { left: leftNow, right: rightNow };
        return false;
      }

      const leftDiff = diffGridStats(blinkEyeBaselineRef.current.left, leftNow);
      const rightDiff = diffGridStats(blinkEyeBaselineRef.current.right, rightNow);
      const diff = (leftDiff + rightDiff) / 2;

      // Refresh baseline slowly when stable.
      if (diff < 6) {
        blinkEyeBaselineRef.current = { left: leftNow, right: rightNow };
      }

      if (diff > 14) {
        blinkPixelLastRef.current = now;
        return true;
      }

      return false;
    },
    []
  );

  const upsertGestureResult = useCallback((id: string, completed: boolean) => {
    setGestureResults(prev => {
      const idx = prev.findIndex(p => p.id === id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], completed };
        return next;
      }
      return [...prev, { id, completed, timestamp: Date.now() }];
    });
  }, []);

  // Gesture training detection loop
  useEffect(() => {
    if (step !== 'gesture-training' || !isOpen) return;

    if (gestureIntervalRef.current) {
      clearInterval(gestureIntervalRef.current);
      gestureIntervalRef.current = null;
    }

    setGestureAccepted(false);
    setGesturePromptTs(Date.now());

    // (Re)initialize baselines when a gesture starts
    mouthBaselineRef.current = null;
    browBaselineRef.current = null;
    motionHoldRef.current = { mouthMs: 0, browMs: 0 };

    // Establish neutral center for head movement when entering head gestures
    if (!neutralFaceCenterRef.current && faceAnalysis.center) {
      neutralFaceCenterRef.current = faceAnalysis.center;
    }

    const blinkWindowMs = 1400;
    let localBlinkCount = 0;
    let firstBlinkTs = 0;

    gestureIntervalRef.current = setInterval(() => {
      const analysis = analyzeCurrentFrameSync();
      if (!analysis) return;
      setFaceAnalysis(analysis);

      const now = Date.now();
      const landmarks = vision.landmarks;
      const faceBox = vision.faceBox;
      const hasLandmarks = Array.isArray(landmarks) && landmarks.length > 477;
      const getLm = (i: number) => (landmarks ? landmarks[i] : undefined);
      const distLm = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.hypot(a.x - b.x, a.y - b.y);

      if (currentGesture.id === 'blink') {
        let blinked = detectBlink() || detectBlinkFromOpenness();
        if (!blinked && analysis.box) {
          const canvas = canvasRef.current;
          const ctx = canvas?.getContext('2d');
          if (canvas && ctx) {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const boxPx = {
              x: Math.floor((1 - (analysis.box.x + analysis.box.w)) * canvas.width),
              y: Math.floor(analysis.box.y * canvas.height),
              w: Math.floor(analysis.box.w * canvas.width),
              h: Math.floor(analysis.box.h * canvas.height),
            };
            blinked = detectBlinkFromPixels(imageData, boxPx);
          }
        }
        if (blinked) {
          playSound('blink');
          haptics.light();
          acceptGesture();
        }
        return;
      }

      if (!analysis.detected || !analysis.box) {
        if (!hasLandmarks) {
          // Reset baselines if face disappears
          mouthBaselineRef.current = null;
          browBaselineRef.current = null;
          neutralFaceCenterRef.current = null;
          motionHoldRef.current = { mouthMs: 0, browMs: 0 };
          return;
        }
      }

      let imageData: ImageData | null = null;
      let mouthRegion: { x: number; y: number; w: number; h: number } | null = null;
      let browRegion: { x: number; y: number; w: number; h: number } | null = null;

      if (!hasLandmarks) {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx || !analysis.box) return;
        imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        const boxPx = {
          x: Math.floor((1 - (analysis.box.x + analysis.box.w)) * canvas.width),
          y: Math.floor(analysis.box.y * canvas.height),
          w: Math.floor(analysis.box.w * canvas.width),
          h: Math.floor(analysis.box.h * canvas.height),
        };

        // Regions relative to face box
        mouthRegion = {
          x: boxPx.x + boxPx.w * 0.22,
          y: boxPx.y + boxPx.h * 0.62,
          w: boxPx.w * 0.56,
          h: boxPx.h * 0.24,
        };
        browRegion = {
          x: boxPx.x + boxPx.w * 0.18,
          y: boxPx.y + boxPx.h * 0.18,
          w: boxPx.w * 0.64,
          h: boxPx.h * 0.22,
        };
      }

      const acceptGesture = () => {
        if (now < gestureCooldownUntilRef.current) return;
        gestureCooldownUntilRef.current = now + 320;

        // Special BLINK step: 3 blinks (red -> yellow -> green), then "Good job!" and move on.
        if (currentGesture.id === 'blink') {
          blinkTotalSyncedRef.current += 1;
          debugBlinkCountRef.current += 1;
          setBlinkTotalSynced(blinkTotalSyncedRef.current);

          const nextStage = Math.min(2, blinkTotalSyncedRef.current) as 0 | 1 | 2;
          blinkColorStageRef.current = nextStage;
          setBlinkColorStage(nextStage);

          // Completed (green stage finished)
          if (blinkTotalSyncedRef.current >= 3) {
            blinkGoodJobUntilRef.current = now + 1600;
            setInstruction('Good job!');
            upsertGestureResult(currentGesture.id, true);
            setTimeout(() => {
              blinkColorStageRef.current = 0;
              setBlinkColorStage(0);
              blinkStageCountRef.current = 0;
              blinkTotalSyncedRef.current = 0;
              setBlinkTotalSynced(0);
              if (gestureIndex < GESTURE_SEQUENCE.length - 1) {
                setGestureIndex(i => i + 1);
              } else {
                setStep('blink-calibration');
                setTargetVisible(true);
                setCurrentPositionIndex(0);
                setCurrentBlinkCount(0);
                setBlinkTimings([]);
              }
            }, 900);
          }
          return;
        }

        // Require 3 correct repetitions before moving on.
        gestureRepRef.current += 1;
        const rep = gestureRepRef.current;
        setGestureRepCount(rep);

        playSound('success');
        haptics.success();
        setGestureAccepted(true);

        if (rep < 3) {
          setInstruction(`Good! Again (${rep}/3)`);
          // Reset detection baselines/counters for the next repetition.
          localBlinkCount = 0;
          firstBlinkTs = 0;
          mouthBaselineRef.current = null;
          browBaselineRef.current = null;
          mouthOpenBaselineRef.current = null;
          browLiftBaselineRef.current = null;
          browLeftBaselineRef.current = null;
          browRightBaselineRef.current = null;
          mouthSmileBaselineRef.current = null;
          mouthCornerBaselineRef.current = null;
          motionHoldRef.current = { mouthMs: 0, browMs: 0 };
          setGesturePromptTs(Date.now());
          setTimeout(() => setGestureAccepted(false), 450);
          return;
        }

        upsertGestureResult(currentGesture.id, true);
        setInstruction(`${currentGesture.successText} (3/3)`);
        setTimeout(() => {
          gestureRepRef.current = 0;
          setGestureRepCount(0);
          if (gestureIndex < GESTURE_SEQUENCE.length - 1) {
            setGestureIndex(i => i + 1);
          } else {
            // Continue to gaze+blink calibration targets for extra accuracy
            setStep('blink-calibration');
            setTargetVisible(true);
            setCurrentPositionIndex(0);
            setCurrentBlinkCount(0);
            setBlinkTimings([]);
          }
        }, 750);
      };

      // Initialize neutral on first stable detection
      if (!neutralFaceCenterRef.current && analysis.center) neutralFaceCenterRef.current = analysis.center;

      // Motion-based acceptance thresholds (tuned conservatively)
      const mouthMotionThreshold = 18;
      const browMotionThreshold = 14;
      const requiredMotionHoldMs = 350;
      const headDeltaThreshold = 0.06;

      const hasPixels = Boolean(imageData && mouthRegion && browRegion);
      const mouthOpenRatio = () => {
        const up = getLm(13);
        const low = getLm(14);
        const left = getLm(61);
        const right = getLm(291);
        if (!up || !low || !left || !right) return null;
        const vertical = distLm(up, low);
        const horizontal = distLm(left, right);
        return horizontal > 0 ? vertical / horizontal : null;
      };
      const mouthWidthRatio = () => {
        const up = getLm(13);
        const low = getLm(14);
        const left = getLm(61);
        const right = getLm(291);
        if (!up || !low || !left || !right) return null;
        const horizontal = distLm(left, right);
        const vertical = distLm(up, low);
        return vertical > 0 ? horizontal / vertical : null;
      };
      const mouthCornerYs = () => {
        const left = getLm(61);
        const right = getLm(291);
        if (!left || !right) return null;
        return { leftY: left.y, rightY: right.y };
      };
      const browLiftRatio = () => {
        const lb = getLm(105);
        const rb = getLm(334);
        const lUp = getLm(159);
        const lLow = getLm(145);
        const rUp = getLm(386);
        const rLow = getLm(374);
        if (!lb || !rb || !lUp || !lLow || !rUp || !rLow) return null;
        const leftLift = Math.abs(lUp.y - lb.y) / Math.max(0.0001, Math.abs(lLow.y - lUp.y));
        const rightLift = Math.abs(rUp.y - rb.y) / Math.max(0.0001, Math.abs(rLow.y - rUp.y));
        return (leftLift + rightLift) / 2;
      };
      const browLiftRatios = () => {
        const lb = getLm(105);
        const rb = getLm(334);
        const lUp = getLm(159);
        const lLow = getLm(145);
        const rUp = getLm(386);
        const rLow = getLm(374);
        if (!lb || !rb || !lUp || !lLow || !rUp || !rLow) return null;
        const leftLift = Math.abs(lUp.y - lb.y) / Math.max(0.0001, Math.abs(lLow.y - lUp.y));
        const rightLift = Math.abs(rUp.y - rb.y) / Math.max(0.0001, Math.abs(rLow.y - rUp.y));
        return { left: leftLift, right: rightLift, avg: (leftLift + rightLift) / 2 };
      };
      const headYaw = () => {
        const nose = getLm(1);
        if (!nose || !faceBox) return null;
        const centerX = faceBox.x + faceBox.w / 2;
        return nose.x - centerX;
      };

      if (currentGesture.id === 'blink') {
        // Landmark-based blink detection from Vision Engine.
        const blinked = detectBlink() || detectBlinkFromOpenness();
        if (blinked) {
          playSound('blink');
          haptics.light();
          acceptGesture();
        }
        return;
      }

      if (currentGesture.id === 'wink-left') {
        if (detectLeftWink()) {
          playSound('blink');
          haptics.light();
          acceptGesture();
        }
        return;
      }

      if (currentGesture.id === 'wink-right') {
        if (detectRightWink()) {
          playSound('blink');
          haptics.light();
          acceptGesture();
        }
        return;
      }

      if (currentGesture.id === 'lips') {
        if (hasLandmarks) {
          const ratio = mouthOpenRatio();
          if (ratio == null) return;
          if (mouthOpenBaselineRef.current == null) {
            mouthOpenBaselineRef.current = ratio;
            motionHoldRef.current.mouthMs = 0;
            return;
          }
          const baseline = mouthOpenBaselineRef.current;
          const delta = Math.abs(ratio - baseline);
          const moved = delta > 0.08 || ratio > baseline * 1.35 || ratio < baseline * 0.7;
          motionHoldRef.current.mouthMs = moved ? motionHoldRef.current.mouthMs + 100 : 0;
          if (motionHoldRef.current.mouthMs >= requiredMotionHoldMs) acceptGesture();
          return;
        }

        if (!hasPixels || !imageData || !mouthRegion) return;
        const current = computeGridStats(imageData.data, imageData.width, imageData.height, mouthRegion);
        if (!mouthBaselineRef.current) {
          mouthBaselineRef.current = current;
          motionHoldRef.current.mouthMs = 0;
          return;
        }
        const score = diffGridStats(mouthBaselineRef.current, current);
        motionHoldRef.current.mouthMs = score > mouthMotionThreshold ? motionHoldRef.current.mouthMs + 100 : 0;
        if (motionHoldRef.current.mouthMs >= requiredMotionHoldMs) acceptGesture();
        return;
      }

      if (currentGesture.id === 'eyebrow-left' || currentGesture.id === 'eyebrow-right' || currentGesture.id === 'eyebrows-both') {
        if (hasLandmarks) {
          const lift = browLiftRatios();
          if (!lift) return;
          if (browLeftBaselineRef.current == null || browRightBaselineRef.current == null) {
            browLeftBaselineRef.current = lift.left;
            browRightBaselineRef.current = lift.right;
            browLiftBaselineRef.current = lift.avg;
            motionHoldRef.current.browMs = 0;
            return;
          }
          const leftBase = browLeftBaselineRef.current;
          const rightBase = browRightBaselineRef.current;
          const leftMoved = lift.left > leftBase + 0.25;
          const rightMoved = lift.right > rightBase + 0.25;
          const moved =
            currentGesture.id === 'eyebrow-left'
              ? leftMoved
              : currentGesture.id === 'eyebrow-right'
                ? rightMoved
                : leftMoved && rightMoved;
          motionHoldRef.current.browMs = moved ? motionHoldRef.current.browMs + 100 : 0;
          if (motionHoldRef.current.browMs >= requiredMotionHoldMs) acceptGesture();
          return;
        }

        if (!hasPixels || !imageData || !browRegion) return;
        const current = computeGridStats(imageData.data, imageData.width, imageData.height, browRegion);
        if (!browBaselineRef.current) {
          browBaselineRef.current = current;
          motionHoldRef.current.browMs = 0;
          return;
        }
        const score = diffGridStats(browBaselineRef.current, current);
        motionHoldRef.current.browMs = score > browMotionThreshold ? motionHoldRef.current.browMs + 100 : 0;
        if (motionHoldRef.current.browMs >= requiredMotionHoldMs) acceptGesture();
        return;
      }

      if (currentGesture.id === 'head-left' || currentGesture.id === 'head-right') {
        // Prefer Vision Engine's headYaw (degrees) for reliable detection
        const visionYaw = vision.headYaw;
        if (hasLandmarks && Math.abs(visionYaw) > 0.5) {
          // headYaw is in degrees; ~8 degrees = moderate turn
          const threshold = 7; // degrees
          if (currentGesture.id === 'head-left') {
            if (visionYaw < -threshold) acceptGesture();
          } else {
            if (visionYaw > threshold) acceptGesture();
          }
          return;
        }

        // Fallback: normalized nose-center displacement
        if (hasLandmarks) {
          const dx = headYaw();
          if (dx == null) return;
          const threshold = 0.035;
          if (currentGesture.id === 'head-left') {
            if (dx < -threshold) acceptGesture();
          } else {
            if (dx > threshold) acceptGesture();
          }
          return;
        }

        if (!analysis.center || !neutralFaceCenterRef.current) return;
        const dx = analysis.center.x - neutralFaceCenterRef.current.x;
        if (currentGesture.id === 'head-left') {
          if (dx < -headDeltaThreshold) acceptGesture();
        } else {
          if (dx > headDeltaThreshold) acceptGesture();
        }
      }

      if (currentGesture.id === 'smile') {
        if (hasLandmarks) {
          const ratio = mouthWidthRatio();
          if (ratio == null) return;
          if (mouthSmileBaselineRef.current == null) {
            mouthSmileBaselineRef.current = ratio;
            motionHoldRef.current.mouthMs = 0;
            return;
          }
          const baseline = mouthSmileBaselineRef.current;
          const moved = ratio > baseline * 1.18;
          motionHoldRef.current.mouthMs = moved ? motionHoldRef.current.mouthMs + 100 : 0;
          if (motionHoldRef.current.mouthMs >= requiredMotionHoldMs) acceptGesture();
          return;
        }
      }

      if (currentGesture.id === 'smirk' || currentGesture.id === 'lip-left' || currentGesture.id === 'lip-right') {
        if (hasLandmarks) {
          const corners = mouthCornerYs();
          if (!corners) return;
          if (!mouthCornerBaselineRef.current) {
            mouthCornerBaselineRef.current = corners;
            motionHoldRef.current.mouthMs = 0;
            return;
          }
          const base = mouthCornerBaselineRef.current;
          const leftDelta = base.leftY - corners.leftY; // positive when left corner lifts (y decreases)
          const rightDelta = base.rightY - corners.rightY;

          let moved = false;
          if (currentGesture.id === 'smirk') {
            moved = Math.abs(leftDelta - rightDelta) > 0.015 && (leftDelta > 0.01 || rightDelta > 0.01);
          } else if (currentGesture.id === 'lip-left') {
            moved = leftDelta > 0.015;
          } else if (currentGesture.id === 'lip-right') {
            moved = rightDelta > 0.015;
          }

          motionHoldRef.current.mouthMs = moved ? motionHoldRef.current.mouthMs + 100 : 0;
          if (motionHoldRef.current.mouthMs >= requiredMotionHoldMs) acceptGesture();
          return;
        }
      }
    }, 100);

    return () => {
      if (gestureIntervalRef.current) {
        clearInterval(gestureIntervalRef.current);
        gestureIntervalRef.current = null;
      }
    };
  }, [
    step,
    isOpen,
    analyzeCurrentFrame,
    currentGesture?.id,
    detectBlink,
    detectBlinkFromOpenness,
    detectBlinkFromPixels,
    gestureIndex,
    haptics,
    playSound,
    upsertGestureResult,
    faceAnalysis.center,
    vision.landmarks,
    vision.faceBox,
    vision.headYaw,
  ]);

  // Use a ref for blink timings accumulation inside the interval to avoid stale closure
  const blinkTimingsAccumRef = useRef<number[]>([]);
  /** Gaze samples collected while user looks at current target (for gaze calibration) */
  const gazeSamplesRef = useRef<Array<{ x: number; y: number }>>([]);
  const visionRef = useRef(vision);
  visionRef.current = vision;

  // Blink calibration step (works for both portrait and landscape)
  useEffect(() => {
    if ((step !== 'blink-calibration' && step !== 'landscape-calibration') || !isOpen || !targetVisible) return;

    // Warm-up: on first position, wait for vision baseline so blink detection is stable
    const needWarmUp = currentPositionIndex === 0 && !vision.baselineReady;
    if (needWarmUp) {
      setInstruction('Keep your eyes open for a moment…');
      setIsWaitingForBlink(true);
      return;
    }

    const requiredBlinks = getBlinkRequirement(currentPositionIndex);
    const position = CALIBRATION_POSITIONS[currentPositionIndex];

    // Reset accumulators for this position
    blinkTimingsAccumRef.current = [];
    gazeSamplesRef.current = [];

    setInstruction(`Look at the target and blink ${requiredBlinks} time${requiredBlinks > 1 ? 's' : ''}`);
    setIsWaitingForBlink(true);
    playSound('target');

    let localBlinkCount = 0;

    // Start blink detection + gaze sampling: Vision Engine + openness fallback + pixel-diff fallback
    blinkDetectionIntervalRef.current = setInterval(() => {
      const v = visionRef.current;
      // Collect gaze samples when eyes are open (skip blink frames) for calibration
      if (v.gazePosition && v.eyeOpenness > 0.5) {
        gazeSamplesRef.current.push({ x: v.gazePosition.x, y: v.gazePosition.y });
        if (gazeSamplesRef.current.length > 100) gazeSamplesRef.current.shift();
      }

      let blinked = detectBlink() || detectBlinkFromOpenness();
      if (!blinked) {
        const analysis = analyzeCurrentFrameSync();
        if (analysis?.box && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            const imageData = ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height);
            const boxPx = {
              x: Math.floor((1 - (analysis.box.x + analysis.box.w)) * canvasRef.current.width),
              y: Math.floor(analysis.box.y * canvasRef.current.height),
              w: Math.floor(analysis.box.w * canvasRef.current.width),
              h: Math.floor(analysis.box.h * canvasRef.current.height),
            };
            blinked = detectBlinkFromPixels(imageData, boxPx);
          }
        }
      }
      if (blinked) {
        const now = Date.now();
        blinkTimingsAccumRef.current.push(now);
        localBlinkCount += 1;
        setBlinkTimings(prev => [...prev, now]);
        setCurrentBlinkCount(localBlinkCount);
        playSound('blink');
        haptics.light();
          
        if (localBlinkCount >= requiredBlinks) {
          // Position complete — stop interval immediately to prevent extra counts
          if (blinkDetectionIntervalRef.current) {
            clearInterval(blinkDetectionIntervalRef.current);
            blinkDetectionIntervalRef.current = null;
          }

          setTimeout(() => {
            const samples = gazeSamplesRef.current;
            let gazeData: { avgX: number; avgY: number } | undefined;
            if (samples.length >= 5) {
              const avgX = samples.reduce((s, p) => s + p.x, 0) / samples.length;
              const avgY = samples.reduce((s, p) => s + p.y, 0) / samples.length;
              gazeData = { avgX, avgY };
            }
            const positionData = {
              position: { x: position.x, y: position.y },
              blinkData: {
                requiredBlinks,
                actualBlinks: localBlinkCount,
                timing: [...blinkTimingsAccumRef.current],
              },
              gazeData,
            };
              
            setCalibrationData(prev => [...prev, positionData]);
            setBlinkTimings([]);
            setCurrentBlinkCount(0);
              
            if (currentPositionIndex < CALIBRATION_POSITIONS.length - 1) {
              // Move to next position
              setTargetVisible(false);
              playSound('success');
              haptics.success();
                
              setTimeout(() => {
                setCurrentPositionIndex(prev => prev + 1);
                setTargetVisible(true);
              }, 500);
            } else {
              // Portrait calibration complete - move to landscape prompt
              playSound('success');
              haptics.success();
              if (orientationMode === 'portrait') {
                setStep('rotate-prompt');
              } else {
                // Landscape complete - all done
                setStep('complete');
              }
            }
          }, 300);
        }
      }
    }, 50);
    
    return () => {
      if (blinkDetectionIntervalRef.current) {
        clearInterval(blinkDetectionIntervalRef.current);
        blinkDetectionIntervalRef.current = null;
      }
    };
  }, [
    step,
    isOpen,
    targetVisible,
    currentPositionIndex,
    vision.baselineReady,
    detectBlink,
    detectBlinkFromOpenness,
    detectBlinkFromPixels,
    analyzeCurrentFrameSync,
    haptics,
    playSound,
  ]);

  // On mobile browsers, camera permission prompts often require a direct user gesture.
  // So we *don't* auto-start the camera on open; we start it from the "Start Calibration" tap.
  useEffect(() => {
    if (!isOpen) return;
    // Start camera immediately on open per UX request.
    let cancelled = false;
    void (async () => {
      const ok = await startCamera();
      if (cancelled) {
        // If the modal was closed while getUserMedia was pending, ensure we release the camera.
        stopCamera();
        return;
      }
      if (ok) setStep('eye-frame');
    })();
    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [isOpen, startCamera, stopCamera]);

  // Stop camera on steps that don't require live video
  useEffect(() => {
    if (!isOpen) return;
    if (step === 'rotate-prompt' || step === 'complete') {
      stopCamera();
    }
  }, [step, isOpen, stopCamera]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setStep('intro');
      setEyeFrameMatched(false);
      setEyeFrameProgress(0);
      setFaceAnalysis({
        detected: false,
        center: null,
        box: null,
        eyes: { left: null, right: null, confidence: 0 },
      });
      stableCenterRef.current = null;
      stabilityRef.current = 0;
      setGestureIndex(0);
      lastBlinkAtRef.current = 0;
      lastBlinkConsumedRef.current = 0;
      setGestureAccepted(false);
      setGesturePromptTs(0);
      setGestureResults([]);
      neutralFaceCenterRef.current = null;
      mouthBaselineRef.current = null;
      browBaselineRef.current = null;
      motionHoldRef.current = { mouthMs: 0, browMs: 0 };
      setCurrentPositionIndex(0);
      setCurrentBlinkCount(0);
      setCalibrationData([]);
      setBlinkTimings([]);
      setTargetVisible(false);
      setOrientationMode('portrait');
      setLandscapeCalibrationData([]);
      stopCamera();
    }
  }, [isOpen, stopCamera]);

  // Handle starting landscape calibration
  const handleStartLandscapeCalibration = async () => {
    // If we stopped the camera during rotate prompt, restart it here (user gesture).
    if (cameraStatus !== 'ready') {
      const ok = await startCamera();
      if (!ok) return;
    }
    setOrientationMode('landscape');
    setLandscapeCalibrationData(calibrationData);
    setCalibrationData([]);
    setCurrentPositionIndex(0);
    setCurrentBlinkCount(0);
    setBlinkTimings([]);
    setStep('landscape-calibration');
    setTargetVisible(true);
  };

  const markGestureIncomplete = useCallback((id: string) => {
    const existing = gestureResults.find(r => r.id === id);
    if (!existing) upsertGestureResult(id, false);
  }, [gestureResults, upsertGestureResult]);

  const buildGestureResults = useCallback(() => {
    return GESTURE_SEQUENCE.map(g => {
      const found = gestureResults.find(r => r.id === g.id);
      return found || { id: g.id, completed: false, timestamp: Date.now() };
    });
  }, [gestureResults]);

  const handleComplete = () => {
    const result: CalibrationResult = {
      positions: orientationMode === 'landscape' ? landscapeCalibrationData : calibrationData,
      landscapePositions: orientationMode === 'landscape' ? calibrationData : undefined,
      eyeFrameData: {
        captured: eyeFrameMatched,
        timestamp: Date.now(),
      },
      gestureTraining: buildGestureResults(),
      completedAt: Date.now(),
    };

    // Save gesture thresholds learned during calibration for runtime use
    try {
      const thresholds: Record<string, number> = {};
      // If eyebrow calibration was completed successfully, we can derive a threshold
      const browLeft = gestureResults.find(r => r.id === 'eyebrow-left' && r.completed);
      const browRight = gestureResults.find(r => r.id === 'eyebrow-right' && r.completed);
      if (browLeft || browRight) {
        thresholds.eyebrowLift = 0.18; // calibrated user — use slightly tighter threshold
      }
      const headL = gestureResults.find(r => r.id === 'head-left' && r.completed);
      const headR = gestureResults.find(r => r.id === 'head-right' && r.completed);
      if (headL || headR) {
        thresholds.headTurn = 7; // calibrated — lower threshold
      }
      if (Object.keys(thresholds).length > 0) {
        localStorage.setItem('app_gesture_thresholds', JSON.stringify(thresholds));
      }
    } catch {
      // ignore
    }

    onComplete(result);
    onClose();
  };

  const handleSaveProgress = () => {
    handleComplete();
  };

  const handleSkipStep = () => {
    if (step === 'eye-frame') {
      setStep('gesture-training');
      setGestureIndex(0);
      return;
    }
    if (step === 'gesture-training' && currentGesture) {
      upsertGestureResult(currentGesture.id, false);
      if (gestureIndex < GESTURE_SEQUENCE.length - 1) {
        setGestureIndex(i => i + 1);
      } else {
        setStep('blink-calibration');
        setTargetVisible(true);
        setCurrentPositionIndex(0);
        setCurrentBlinkCount(0);
        setBlinkTimings([]);
      }
      return;
    }
    if (step === 'blink-calibration') {
      setStep('rotate-prompt');
      return;
    }
    if (step === 'rotate-prompt' || step === 'landscape-calibration') {
      setStep('complete');
    }
  };

  const handleStartCalibration = async () => {
    if (cameraStatus !== 'ready') {
      const cameraStarted = await startCamera();
      if (!cameraStarted) return;
    }
    setStep('eye-frame');
  };

  const goNext = useCallback(() => {
    if (step === 'intro') {
      void handleStartCalibration();
      return;
    }
    if (step === 'eye-frame') {
      setStep('gesture-training');
      setGestureIndex(0);
      return;
    }
    if (step === 'gesture-training' && currentGesture) {
      markGestureIncomplete(currentGesture.id);
      if (gestureIndex < GESTURE_SEQUENCE.length - 1) {
        setGestureIndex(i => i + 1);
      } else {
        setStep('blink-calibration');
        setTargetVisible(true);
        setCurrentPositionIndex(0);
        setCurrentBlinkCount(0);
        setBlinkTimings([]);
      }
      return;
    }
    if (step === 'blink-calibration') {
      setStep('rotate-prompt');
      return;
    }
    if (step === 'rotate-prompt') {
      void handleStartLandscapeCalibration();
      return;
    }
    if (step === 'landscape-calibration') {
      setStep('complete');
    }
  }, [step, currentGesture, gestureIndex, markGestureIncomplete, handleStartCalibration, handleStartLandscapeCalibration]);

  const goPrev = useCallback(() => {
    if (step === 'gesture-training') {
      if (gestureIndex > 0) {
        setGestureIndex(i => i - 1);
      } else {
        setStep('eye-frame');
      }
      return;
    }
    if (step === 'blink-calibration') {
      setStep('gesture-training');
      setGestureIndex(GESTURE_SEQUENCE.length - 1);
      return;
    }
    if (step === 'rotate-prompt') {
      setStep('blink-calibration');
      return;
    }
    if (step === 'landscape-calibration') {
      setStep('rotate-prompt');
      return;
    }
    if (step === 'eye-frame') {
      setStep('intro');
    }
  }, [step, gestureIndex]);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    touchStartRef.current = { x: t.clientX, y: t.clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
    if (dx < 0) goNext();
    else goPrev();
  };

  useEffect(() => {
    try {
      window.dispatchEvent(new CustomEvent('calibrationMode', { detail: { active: true } }));
    } catch {
      // ignore
    }
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('calibrationMode', { detail: { active: false } }));
      } catch {
        // ignore
      }
    };
  }, []);

  if (!isOpen) return null;

  const currentPosition = CALIBRATION_POSITIONS[currentPositionIndex];
  const requiredBlinks = getBlinkRequirement(currentPositionIndex);
  const eyeFrameHint =
    step !== 'eye-frame'
      ? null
      : (() => {
          if (!faceAnalysis.detected || !faceAnalysis.box) {
            return 'Make sure your face is well-lit and inside the oval.';
          }
          const target = { x: 0.5, y: 0.52, w: 0.34, h: 0.48 };
          const box = faceAnalysis.box;
          const center = { x: clamp01(box.x + box.w / 2), y: clamp01(box.y + box.h / 2) };
          const dx = center.x - target.x;
          const dy = center.y - target.y;

          const parts: string[] = [];
          if (box.w < target.w - 0.08) parts.push('Move closer');
          else if (box.w > target.w + 0.12) parts.push('Move farther');

          if (dx < -0.06) parts.push('Move right');
          else if (dx > 0.06) parts.push('Move left');

          if (dy < -0.06) parts.push('Move down');
          else if (dy > 0.06) parts.push('Move up');

          return parts.length ? parts.join(' • ') : 'Hold still…';
        })();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Camera preview (mirrored) + processing canvas */}
      {/* NOTE: pointer-events-none is critical so the preview layer doesn't swallow taps */}
      <div className="absolute inset-0 pointer-events-none">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
          autoPlay
          style={{ transform: 'scaleX(-1)' }}
        />
        <div
          className={cn(
            'absolute inset-0',
            step === 'intro'
              ? 'bg-black/25'
              : step === 'eye-frame'
                ? 'bg-black/35'
                : step === 'gesture-training'
                  ? 'bg-black/65'
                  : 'bg-black/55'
          )}
        />

        {/* Standard guide frame (same size/position across all steps) */}
        {cameraStatus === 'ready' && step !== 'intro' && (
          <div className="absolute inset-0 flex items-center justify-center">
            <svg viewBox="0 0 200 240" className="w-full h-full max-w-[520px] max-h-[78vh]">
              {(() => {
                const f = standardFrame || DEFAULT_STANDARD_FRAME;
                const cx = f.cx;
                const cy = f.cy;
                const rx = f.rx;
                const ry = f.ry;
                const eyeLx = cx - rx * f.eyeDx;
                const eyeRx = cx + rx * f.eyeDx;
                const eyeY = cy - ry * f.eyeDy;

                const blinkFast = step === 'gesture-training' && currentGesture?.id === 'blink';

                const stroke = step === 'eye-frame' ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.55)';
                const dash = step === 'eye-frame' ? '7,7' : 'none';
                const eyeStroke = step === 'gesture-training' && currentGesture?.id === 'blink'
                  ? getBlinkEyeColor()
                  : 'hsl(var(--primary))';

                const overlayTitle = (() => {
                  if (step === 'eye-frame') return 'ALIGN';
                  if (step === 'gesture-training' && currentGesture) return currentGesture.title.toUpperCase();
                  if (step === 'blink-calibration') return 'CALIBRATE';
                  if (step === 'rotate-prompt') return 'ROTATE';
                  if (step === 'landscape-calibration') return 'CALIBRATE';
                  if (step === 'complete') return 'DONE';
                  return null;
                })();

                const overlayInstruction = (() => {
                  if (step === 'eye-frame') return eyeFrameHint || 'Align your eyes to the frame';
                  if (step === 'gesture-training' && currentGesture) {
                    return currentGesture.id === 'blink'
                      ? 'Align your eyes to the frame, then blink until it stops'
                      : currentGesture.instruction;
                  }
                  if (step === 'blink-calibration') return instruction || 'Follow the target and blink as instructed';
                  if (step === 'rotate-prompt') return 'Rotate your phone to landscape';
                  if (step === 'landscape-calibration') return instruction || 'Follow the targets';
                  if (step === 'complete') return 'Calibration complete';
                  return null;
                })();

                return (
                  <>
                    {/* Face outline */}
                    <ellipse
                      cx={cx}
                      cy={cy}
                      rx={rx}
                      ry={ry}
                      fill="none"
                      stroke={stroke}
                      strokeWidth="3"
                      strokeDasharray={dash}
                    />

                    {/* Eyes */}
                    {blinkFast ? (
                      <>
                        <motion.ellipse
                          cx={eyeLx}
                          cy={eyeY}
                          rx={22}
                          ry={14}
                          fill="none"
                          stroke={eyeStroke}
                          strokeWidth="3"
                          animate={
                            { ry: [14, 2, 14] }
                          }
                          transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
                        />
                        <motion.ellipse
                          cx={eyeRx}
                          cy={eyeY}
                          rx={22}
                          ry={14}
                          fill="none"
                          stroke={eyeStroke}
                          strokeWidth="3"
                          animate={
                            { ry: [14, 2, 14] }
                          }
                          transition={{ duration: 0.65, repeat: Infinity, ease: 'easeInOut' }}
                        />
                      </>
                    ) : (
                      <>
                        <ellipse cx={eyeLx} cy={eyeY} rx={22} ry={14} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                        <ellipse cx={eyeRx} cy={eyeY} rx={22} ry={14} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="3" />
                      </>
                    )}

                    {/* Overlay title + instruction (small/subtle, top of oval) */}
                    {overlayTitle && overlayInstruction && (() => {
                      const circleTop = cy - ry;
                      const gap = 14;
                      const titleY = clamp(10, circleTop - (gap + 8), 32);
                      const instrY = clamp(16, circleTop - gap, 38);
                      return (
                        <>
                          <text
                            x={cx}
                            y={titleY}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.82)"
                            fontSize="10"
                            fontWeight="700"
                            style={{ letterSpacing: '1.5px' }}
                          >
                            {overlayTitle}
                          </text>
                          <text
                            x={cx}
                            y={instrY}
                            textAnchor="middle"
                            fill="rgba(255,255,255,0.58)"
                            fontSize="9"
                            fontWeight="600"
                          >
                            {overlayInstruction}
                          </text>
                        </>
                      );
                    })()}

                    {step === 'gesture-training' && currentGesture?.id === 'blink' && (
                      <text
                        x={cx}
                        y={cy + ry + 20}
                        textAnchor="middle"
                        fill="rgba(255,255,255,0.70)"
                        fontSize="10"
                        fontWeight="700"
                      >
                        {blinkTotalSynced === 0 ? '0/3' : `${blinkTotalSynced}/3`}
                      </text>
                    )}

                    {step === 'gesture-training' && currentGesture?.id === 'head-left' && (
                      <motion.g
                        animate={{ x: [-6, 6, -6] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                      >
                        <ellipse cx={eyeLx} cy={eyeY} rx={22} ry={14} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
                        <ellipse cx={eyeRx} cy={eyeY} rx={22} ry={14} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
                      </motion.g>
                    )}

                    {step === 'gesture-training' && currentGesture?.id === 'head-right' && (
                      <motion.g
                        animate={{ x: [6, -6, 6] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                      >
                        <ellipse cx={eyeLx} cy={eyeY} rx={22} ry={14} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
                        <ellipse cx={eyeRx} cy={eyeY} rx={22} ry={14} fill="none" stroke="hsl(var(--primary))" strokeWidth="3" />
                      </motion.g>
                    )}

                    {/* Simple mouth/eyebrow hints (same frame) */}
                    {step === 'gesture-training' && currentGesture?.id === 'lips' && (
                      <motion.ellipse
                        cx={cx}
                        cy={cy + ry * 0.18}
                        rx="22"
                        ry="10"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        animate={{ rx: [22, 14, 22], ry: [10, 14, 10] }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                      />
                    )}
                    {step === 'gesture-training' && currentGesture?.id === 'eyebrow-left' && (
                      <motion.path
                        d={`M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        animate={{
                          d: [
                            `M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`,
                            `M${cx - rx * 0.62} ${eyeY - 28} Q${cx - rx * 0.34} ${eyeY - 40} ${cx - rx * 0.06} ${eyeY - 28}`,
                            `M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`,
                          ],
                        }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                      />
                    )}
                    {step === 'gesture-training' && currentGesture?.id === 'eyebrow-right' && (
                      <motion.path
                        d={`M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        animate={{
                          d: [
                            `M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`,
                            `M${cx + rx * 0.06} ${eyeY - 28} Q${cx + rx * 0.34} ${eyeY - 40} ${cx + rx * 0.62} ${eyeY - 28}`,
                            `M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`,
                          ],
                        }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                      />
                    )}
                    {step === 'gesture-training' && currentGesture?.id === 'eyebrows-both' && (
                      <>
                        <motion.path
                          d={`M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="3"
                          strokeLinecap="round"
                          animate={{
                            d: [
                              `M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`,
                              `M${cx - rx * 0.62} ${eyeY - 28} Q${cx - rx * 0.34} ${eyeY - 40} ${cx - rx * 0.06} ${eyeY - 28}`,
                              `M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`,
                            ],
                          }}
                          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                        />
                        <motion.path
                          d={`M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="3"
                          strokeLinecap="round"
                          animate={{
                            d: [
                              `M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`,
                              `M${cx + rx * 0.06} ${eyeY - 28} Q${cx + rx * 0.34} ${eyeY - 40} ${cx + rx * 0.62} ${eyeY - 28}`,
                              `M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`,
                            ],
                          }}
                          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                        />
                      </>
                    )}
                    {step === 'gesture-training' && currentGesture?.id === 'smile' && (
                      <motion.path
                        d={`M${cx - rx * 0.38} ${cy + ry * 0.25} Q${cx} ${cy + ry * 0.32} ${cx + rx * 0.38} ${cy + ry * 0.25}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        animate={{
                          d: [
                            `M${cx - rx * 0.34} ${cy + ry * 0.22} Q${cx} ${cy + ry * 0.26} ${cx + rx * 0.34} ${cy + ry * 0.22}`,
                            `M${cx - rx * 0.42} ${cy + ry * 0.28} Q${cx} ${cy + ry * 0.36} ${cx + rx * 0.42} ${cy + ry * 0.28}`,
                            `M${cx - rx * 0.34} ${cy + ry * 0.22} Q${cx} ${cy + ry * 0.26} ${cx + rx * 0.34} ${cy + ry * 0.22}`,
                          ],
                        }}
                        transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                      />
                    )}
                    {step === 'gesture-training' && currentGesture?.id === 'smirk' && (
                      <motion.path
                        d={`M${cx - rx * 0.36} ${cy + ry * 0.25} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.36} ${cy + ry * 0.25}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        animate={{
                          d: [
                            `M${cx - rx * 0.32} ${cy + ry * 0.26} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.32} ${cy + ry * 0.24}`,
                            `M${cx - rx * 0.32} ${cy + ry * 0.26} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.40} ${cy + ry * 0.20}`,
                            `M${cx - rx * 0.32} ${cy + ry * 0.26} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.32} ${cy + ry * 0.24}`,
                          ],
                        }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                      />
                    )}
                    {step === 'gesture-training' && (currentGesture?.id === 'lip-left' || currentGesture?.id === 'lip-right') && (
                      <motion.path
                        d={`M${cx - rx * 0.36} ${cy + ry * 0.25} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.36} ${cy + ry * 0.25}`}
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="3"
                        strokeLinecap="round"
                        animate={{
                          d: currentGesture?.id === 'lip-left'
                            ? [
                                `M${cx - rx * 0.40} ${cy + ry * 0.20} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.32} ${cy + ry * 0.25}`,
                                `M${cx - rx * 0.32} ${cy + ry * 0.26} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.32} ${cy + ry * 0.25}`,
                                `M${cx - rx * 0.40} ${cy + ry * 0.20} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.32} ${cy + ry * 0.25}`,
                              ]
                            : [
                                `M${cx - rx * 0.32} ${cy + ry * 0.25} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.40} ${cy + ry * 0.20}`,
                                `M${cx - rx * 0.32} ${cy + ry * 0.26} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.32} ${cy + ry * 0.25}`,
                                `M${cx - rx * 0.32} ${cy + ry * 0.25} Q${cx} ${cy + ry * 0.28} ${cx + rx * 0.40} ${cy + ry * 0.20}`,
                              ],
                        }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
                      />
                    )}
                    {step === 'gesture-training' && currentGesture?.id === 'eyebrows' && (
                      <>
                        <motion.path
                          d={`M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="3"
                          strokeLinecap="round"
                          animate={{
                            d: [
                              `M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`,
                              `M${cx - rx * 0.62} ${eyeY - 26} Q${cx - rx * 0.34} ${eyeY - 38} ${cx - rx * 0.06} ${eyeY - 26}`,
                              `M${cx - rx * 0.62} ${eyeY - 20} Q${cx - rx * 0.34} ${eyeY - 30} ${cx - rx * 0.06} ${eyeY - 20}`,
                            ],
                          }}
                          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                        />
                        <motion.path
                          d={`M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`}
                          fill="none"
                          stroke="hsl(var(--primary))"
                          strokeWidth="3"
                          strokeLinecap="round"
                          animate={{
                            d: [
                              `M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`,
                              `M${cx + rx * 0.06} ${eyeY - 26} Q${cx + rx * 0.34} ${eyeY - 38} ${cx + rx * 0.62} ${eyeY - 26}`,
                              `M${cx + rx * 0.06} ${eyeY - 20} Q${cx + rx * 0.34} ${eyeY - 30} ${cx + rx * 0.62} ${eyeY - 20}`,
                            ],
                          }}
                          transition={{ repeat: Infinity, duration: 1.1, ease: 'easeInOut' }}
                        />
                      </>
                    )}
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </div>
      <canvas
        ref={canvasRef}
        width={320}
        height={240}
        className="hidden"
      />

      {/* Footer actions */}
      {step !== 'intro' && step !== 'complete' && (
        <div className="absolute bottom-6 left-4 right-4 z-30 pointer-events-auto flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipStep}
            className="text-white/70 hover:text-white hover:bg-white/10"
          >
            Skip
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveProgress}
            className="border-white/30 text-white hover:bg-white/10"
          >
            Save
          </Button>
        </div>
      )}

      {/* Live debug indicator */}
      {step !== 'intro' && (
        <div className="absolute bottom-20 right-4 z-30 pointer-events-none text-[11px] text-white/70 bg-black/40 px-2 py-1 rounded">
          eye: {vision?.eyeOpenness?.toFixed(2) ?? '—'} • ear: {vision?.eyeEAR?.toFixed(3) ?? '—'} • face: {vision?.hasFace ? 'y' : 'n'} • blinks: {debugBlinkCountRef.current}
        </div>
      )}

      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-30 pointer-events-auto">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </Button>
        
        <div className="text-white text-sm font-medium">
          Eye Calibration
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            try {
              window.dispatchEvent(new CustomEvent('openRemoteControlSettings', { detail: { tab: 'targets' } }));
            } catch {
              // ignore
            }
            onClose();
          }}
          className="text-white hover:bg-white/10"
        >
          <Settings className="w-5 h-5" />
        </Button>
      </div>

      {/* Steps */}
      <div className="relative z-20 flex-1 pointer-events-auto">
        <AnimatePresence mode="wait">
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center mb-8"
            >
              <Eye className="w-12 h-12 text-primary" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Eye Blink Calibration
            </h1>
            
            <p className="text-white/70 mb-8 max-w-sm">
              This calibration will teach the app to recognize your eye movements and blinks for hands-free control.
            </p>
            
            <div className="space-y-4 mb-8 text-left">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">1</div>
                <span>Match your eyes to the frame</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">2</div>
                <span>Follow targets and blink as instructed</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                <span>Blink 1, 2, or 3 times at each target</span>
              </div>
            </div>

            {/* Preview alignment frame so user can self-align immediately */}
            <div className="relative w-72 h-36 mb-8">
              <svg viewBox="0 0 200 80" className="w-full h-full">
                {/* Left eye */}
                <ellipse
                  cx="55"
                  cy="40"
                  rx="35"
                  ry="25"
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
                {/* Right eye */}
                <ellipse
                  cx="145"
                  cy="40"
                  rx="35"
                  ry="25"
                  fill="none"
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth="2"
                  strokeDasharray="6,6"
                />
                {/* Iris left */}
                <circle
                  cx="55"
                  cy="40"
                  r="10"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="2"
                />
                {/* Iris right */}
                <circle
                  cx="145"
                  cy="40"
                  r="10"
                  fill="none"
                  stroke="rgba(255,255,255,0.35)"
                  strokeWidth="2"
                />
              </svg>
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-xs text-white/60">
                Align your eyes to the frame
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={handleStartCalibration}
              className="w-full max-w-xs"
            >
              Start Calibration
            </Button>

            <div className="mt-4 text-sm text-white/60 flex items-center justify-center gap-2">
              {cameraStatus === 'starting' && <Loader2 className="w-4 h-4 animate-spin" />}
              {cameraStatus === 'starting' && <span>Starting camera…</span>}
              {cameraStatus === 'ready' && <span>Camera ready • Align your eyes to the frame</span>}
              {cameraStatus === 'error' && (
                <span>
                  Camera permission needed{cameraError ? `: ${cameraError}` : ''}
                </span>
              )}
              {cameraStatus === 'idle' && <span>Starting camera… If it doesn’t start, tap “Start Calibration”.</span>}
            </div>
            
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="mt-4 text-white/50"
              >
                Skip for now
              </Button>
            )}
          </motion.div>
        )}

        {/* Eye Frame Step */}
        {step === 'eye-frame' && (
          <motion.div
            key="eye-frame"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-8"
          >
            {/* Spacer: the guide frame is drawn over the camera (one standard frame) */}
            <div className="h-[52vh] max-h-[520px] mb-6" />
            
            {/* Progress bar */}
            <div className="w-48 h-2 rounded-full bg-white/20 overflow-hidden">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${eyeFrameProgress}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Debug + fallback (helps when mobile detection is flaky) */}
            <div className="mt-3 text-[10px] leading-snug text-white/60 text-center max-w-sm">
              <div>
                detect:{' '}
                <span className="text-white/70">
                  {faceAnalysis.detected ? 'yes' : 'no'}
                </span>
                {' '}• native:{' '}
                <span className="text-white/70">
                  {faceDetectorAvailable ? 'yes' : 'no'}
                </span>
                {' '}• stability:{' '}
                <span className="text-white/70">
                  {Math.round(stabilityRef.current * 100)}%
                </span>
              </div>
              {faceAnalysis.box && (
                <div className="opacity-80">
                  box w:{Math.round(faceAnalysis.box.w * 100)}% h:{Math.round(faceAnalysis.box.h * 100)}%
                </div>
              )}
            </div>

            {!eyeFrameMatched && cameraStatus === 'ready' && eyeFrameEnteredAt > 0 && Date.now() - eyeFrameEnteredAt > 8000 && (
              <Button
                variant="outline"
                className="mt-4 border-white/20 text-white hover:bg-white/10"
                onClick={() => {
                  try {
                    const a = lastFaceAnalysisRef.current;
                    const b = a?.box;
                    if (b) {
                      const nextRx = clamp(70, b.w * 200 * 0.62, 96);
                      const nextRy = clamp(96, b.h * 240 * 0.62, 136);
                      setStandardFrame((prevFrame) => ({ ...prevFrame, rx: nextRx, ry: nextRy }));
                    }
                  } catch {
                    // ignore
                  }
                  setEyeFrameMatched(true);
                  playSound('success');
                  haptics.success();
                  setGestureIndex(0);
                  setGestureAccepted(false);
                  setGesturePromptTs(Date.now());
                  setGestureResults([]);
                  setStep('gesture-training');
                }}
              >
                Continue
              </Button>
            )}
            
            {eyeFrameMatched && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="mt-6"
              >
                <Check className="w-12 h-12 text-green-500" />
              </motion.div>
            )}
          </motion.div>
        )}

        {/* Gesture Training Step */}
        {step === 'gesture-training' && currentGesture && (
          <motion.div
            key="gesture-training"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center px-8"
          >
            {/* Progress dots */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 flex gap-1.5">
              {GESTURE_SEQUENCE.map((g, i) => {
                const completed = gestureResults.find(r => r.id === g.id)?.completed ?? false;
                return (
                  <div
                    key={g.id}
                    className={cn(
                      'w-4 h-4 rounded-full transition-all flex items-center justify-center',
                      i === gestureIndex ? 'ring-2 ring-primary/70' : 'ring-1 ring-white/20',
                      completed ? 'bg-green-500' : 'bg-red-500/80'
                    )}
                  >
                    {completed ? (
                      <Check className="w-2.5 h-2.5 text-white" />
                    ) : (
                      <X className="w-2.5 h-2.5 text-white" />
                    )}
                  </div>
                );
              })}
            </div>

            {/* One standard frame is always shown on the camera. Keep this step text-only. */}
            <div className="h-[34vh] max-h-[340px] w-full" />

            {/* Re-center removed per UX request */}
          </motion.div>
        )}

        {/* Blink Calibration Step */}
        {step === 'blink-calibration' && (
          <motion.div
            key="blink-calibration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative"
          >
            {/* Progress indicator */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 flex gap-1.5">
              {CALIBRATION_POSITIONS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-4 h-4 rounded-full transition-all flex items-center justify-center',
                    i === currentPositionIndex ? 'ring-2 ring-primary/70' : 'ring-1 ring-white/20',
                    i < currentPositionIndex 
                      ? 'bg-green-500' 
                      : 'bg-red-500/80'
                  )}
                >
                  {i < currentPositionIndex ? (
                    <Check className="w-2.5 h-2.5 text-white" />
                  ) : (
                    <X className="w-2.5 h-2.5 text-white" />
                  )}
                </div>
              ))}
            </div>

            {/* Target dot */}
            <AnimatePresence>
              {targetVisible && currentPosition && (
                <motion.div
                  key={`target-${currentPositionIndex}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute"
                  style={{
                    left: `${currentPosition.x * 100}%`,
                    top: `${currentPosition.y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 w-20 h-20 -m-10 rounded-full border-2 border-primary"
                  />
                  
                  {/* Target circle */}
                  <div className="w-16 h-16 rounded-full bg-primary/30 border-4 border-primary flex items-center justify-center">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  
                  {/* Blink counter */}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                    {Array.from({ length: requiredBlinks }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          'w-4 h-4 rounded-full transition-all',
                          i < currentBlinkCount 
                            ? 'bg-green-500' 
                            : 'bg-white/30 border border-white/50'
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-32 left-0 right-0 text-center px-8 space-y-1">
              <p className="text-white/50 text-sm">
                Position {currentPositionIndex + 1} of {CALIBRATION_POSITIONS.length} • {currentPosition?.label}
              </p>
              {currentPositionIndex === 0 && (
                <p className={cn(
                  'text-xs transition-colors',
                  vision.baselineReady ? 'text-green-400/90' : 'text-amber-400/90'
                )}>
                  {vision.baselineReady ? '✓ Blink detection ready' : 'Warming up — keep eyes open…'}
                </p>
              )}
            </div>

            {/* Blink indicator */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {Array.from({ length: requiredBlinks }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={i < currentBlinkCount ? { scale: [1, 1.2, 1] } : {}}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                    i < currentBlinkCount 
                      ? 'bg-green-500' 
                      : 'bg-white/10 border border-white/30'
                  )}
                >
                  {i < currentBlinkCount && <Check className="w-4 h-4 text-white" />}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Rotate Prompt Step - Ask user to rotate to landscape */}
        {step === 'rotate-prompt' && (
          <motion.div
            key="rotate-prompt"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              animate={{ rotate: [0, 90, 90, 0] }}
              transition={{ repeat: Infinity, duration: 3, times: [0, 0.3, 0.7, 1] }}
              className="w-24 h-24 rounded-2xl bg-primary/20 flex items-center justify-center mb-8"
            >
              <Smartphone className="w-12 h-12 text-primary" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Portrait Mode Complete!
            </h1>
            
            <p className="text-white/70 mb-6 max-w-sm">
              Great job! Now rotate your phone to <span className="text-primary font-bold">landscape mode</span> to calibrate for horizontal viewing.
            </p>
            
            <div className="flex items-center gap-3 text-white/60 mb-8">
              <RotateCcw className="w-5 h-5" />
              <span>Turn your phone sideways</span>
            </div>
            
            <div className="flex gap-3 mb-4">
              <div className="p-3 rounded-lg bg-green-500/20 border border-green-500/30">
                <Check className="w-6 h-6 text-green-500" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-white font-medium">Portrait calibration</span>
                <span className="text-white/50 text-sm">9 positions completed</span>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={handleStartLandscapeCalibration}
              className="w-full max-w-xs"
            >
              Start Landscape Calibration
            </Button>
          </motion.div>
        )}

        {/* Landscape Calibration Step */}
        {step === 'landscape-calibration' && (
          <motion.div
            key="landscape-calibration"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative"
          >
            {/* Landscape indicator */}
            <div className="absolute top-16 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1 rounded-full bg-primary/20 border border-primary/30">
              <RotateCcw className="w-4 h-4 text-primary" />
              <span className="text-primary text-sm font-medium">Landscape Mode</span>
            </div>
            
            {/* Progress indicator */}
            <div className="absolute top-28 left-1/2 -translate-x-1/2 flex gap-1">
              {CALIBRATION_POSITIONS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'w-2 h-2 rounded-full transition-all',
                    i < currentPositionIndex 
                      ? 'bg-green-500' 
                      : i === currentPositionIndex 
                        ? 'bg-primary scale-125' 
                        : 'bg-white/30'
                  )}
                />
              ))}
            </div>

            {/* Target dot */}
            <AnimatePresence>
              {targetVisible && CALIBRATION_POSITIONS[currentPositionIndex] && (
                <motion.div
                  key={`landscape-target-${currentPositionIndex}`}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0, opacity: 0 }}
                  className="absolute"
                  style={{
                    left: `${CALIBRATION_POSITIONS[currentPositionIndex].x * 100}%`,
                    top: `${CALIBRATION_POSITIONS[currentPositionIndex].y * 100}%`,
                    transform: 'translate(-50%, -50%)',
                  }}
                >
                  {/* Outer pulse ring */}
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ repeat: Infinity, duration: 1.5 }}
                    className="absolute inset-0 w-20 h-20 -m-10 rounded-full border-2 border-primary"
                  />
                  
                  {/* Target circle */}
                  <div className="w-16 h-16 rounded-full bg-primary/30 border-4 border-primary flex items-center justify-center">
                    <Target className="w-8 h-8 text-primary" />
                  </div>
                  
                  {/* Blink counter */}
                  <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                    {Array.from({ length: requiredBlinks }).map((_, i) => (
                      <motion.div
                        key={i}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={cn(
                          'w-4 h-4 rounded-full transition-all',
                          i < currentBlinkCount 
                            ? 'bg-green-500' 
                            : 'bg-white/30 border border-white/50'
                        )}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-32 left-0 right-0 text-center px-8">
              <p className="text-white/50 text-sm">
                Position {currentPositionIndex + 1} of {CALIBRATION_POSITIONS.length} • {CALIBRATION_POSITIONS[currentPositionIndex]?.label}
              </p>
            </div>

            {/* Blink indicator */}
            <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex items-center gap-2">
              {Array.from({ length: requiredBlinks }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={i < currentBlinkCount ? { scale: [1, 1.2, 1] } : {}}
                  className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center transition-all',
                    i < currentBlinkCount 
                      ? 'bg-green-500' 
                      : 'bg-white/10 border border-white/30'
                  )}
                >
                  {i < currentBlinkCount && <Check className="w-4 h-4 text-white" />}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-8"
            >
              <Check className="w-12 h-12 text-green-500" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Calibration Complete!
            </h1>
            
            <p className="text-white/70 mb-8 max-w-sm">
              Your eye tracking and blink detection has been calibrated for both portrait and landscape modes.
            </p>
            
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-primary" />
                  <span className="text-xs text-white/50">Portrait</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {landscapeCalibrationData.length || calibrationData.length}
                </div>
                <div className="text-xs text-white/50">Positions</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Smartphone className="w-4 h-4 text-amber-500 rotate-90" />
                  <span className="text-xs text-white/50">Landscape</span>
                </div>
                <div className="text-2xl font-bold text-amber-500">
                  {orientationMode === 'landscape' ? calibrationData.length : 0}
                </div>
                <div className="text-xs text-white/50">Positions</div>
              </div>
            </div>
            
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30 mb-8">
              <div className="text-2xl font-bold text-green-500">18</div>
              <div className="text-xs text-white/50">Total Calibration Points</div>
            </div>
            
            <Button
              size="lg"
              onClick={handleComplete}
              className="w-full max-w-xs"
            >
              Continue
            </Button>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default EyeBlinkCalibration;
