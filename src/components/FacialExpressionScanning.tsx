/**
 * FacialExpressionScanning – captures 8 facial expressions using MediaPipe
 * Face Mesh landmarks with real-time wireframe overlay, guided animations,
 * match validation, retry logic, and a combo expression builder.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import {
  Camera, Check, X, Smile, Heart, AlertCircle, PartyPopper,
  RotateCcw, RefreshCw, ChevronLeft, ChevronRight, RotateCw,
  Plus, Trash2, GripVertical,
} from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import type { NormalizedLandmark } from '@/hooks/useVisionEngine';
import {
  loadRemoteControlSettings,
  loadCalibrationData,
  applyCalibration,
} from '@/hooks/useBlinkRemoteControl';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FacialExpressionResult {
  expressions: {
    type: string;
    captured: boolean;
    timestamp: number;
  }[];
  combos: ExpressionCombo[];
  completedAt: string;
}

interface FacialExpressionScanningProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: FacialExpressionResult) => void;
  onSkip?: () => void;
}

interface Expression {
  id: string;
  name: string;
  instruction: string;
  icon: React.ReactNode;
  description: string;
  /** SVG guide path for the animated hint */
  guideHint: string;
}

interface ExpressionCombo {
  id: string;
  name: string;
  steps: string[]; // expression IDs
  command: string;
}

// ---------------------------------------------------------------------------
// Face mesh connection indices for drawing wireframe
// ---------------------------------------------------------------------------

const FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109,10];
const LEFT_EYE = [33,246,161,160,159,158,157,173,133,155,154,153,145,144,163,7,33];
const RIGHT_EYE = [362,398,384,385,386,387,388,466,263,249,390,373,374,380,381,382,362];
const LEFT_EYEBROW = [70,63,105,66,107,55,65,52,53,46];
const RIGHT_EYEBROW = [300,293,334,296,336,285,295,282,283,276];
const LIPS_OUTER = [61,146,91,181,84,17,314,405,321,375,291,409,270,269,267,0,37,39,40,185,61];
const LIPS_INNER = [78,95,88,178,87,14,317,402,318,324,308,415,310,311,312,13,82,81,80,191,78];
const NOSE_BRIDGE = [6,197,195,5,4,1,19,94,2];

/** All indices used when drawing the wireframe – morph these so the full line mesh plays the expression */
const ALL_DRAWN_INDICES = [...new Set([...FACE_OVAL, ...LEFT_EYE, ...RIGHT_EYE, ...LEFT_EYEBROW, ...RIGHT_EYEBROW, ...LIPS_OUTER, ...LIPS_INNER, ...NOSE_BRIDGE])];

// ---------------------------------------------------------------------------
// Expression definitions
// ---------------------------------------------------------------------------

const EXPRESSIONS: Expression[] = [
  {
    id: 'kiss',
    name: 'Kiss Face',
    instruction: "Pucker your lips like you're sending a kiss",
    icon: <Heart className="w-6 h-6" />,
    description: 'Used for reactions and emoji creation',
    guideHint: 'Pucker lips inward',
  },
  {
    id: 'happy',
    name: 'Happy',
    instruction: 'Show a big, genuine happy expression',
    icon: <Smile className="w-6 h-6" />,
    description: 'Express joy and excitement',
    guideHint: 'Wide smile, teeth showing',
  },
  {
    id: 'surprised',
    name: 'Surprised',
    instruction: 'Open your eyes wide and show surprise',
    icon: <AlertCircle className="w-6 h-6" />,
    description: 'React to unexpected moments',
    guideHint: 'Eyes wide, mouth open',
  },
  {
    id: 'smiling',
    name: 'Smiling',
    instruction: 'Give a warm, natural smile',
    icon: <PartyPopper className="w-6 h-6" />,
    description: 'Your everyday friendly expression',
    guideHint: 'Gentle, natural smile',
  },
  {
    id: 'smirk',
    name: 'Smirk',
    instruction: 'Smirk on one side of your mouth (half-smile)',
    icon: <Smile className="w-6 h-6" />,
    description: 'Used for playful or confident reactions',
    guideHint: 'One corner up',
  },
  {
    id: 'lift-lips',
    name: 'Lift Lips',
    instruction: 'Lift your upper lip to show your teeth slightly',
    icon: <AlertCircle className="w-6 h-6" />,
    description: 'Helps train subtle mouth gestures',
    guideHint: 'Upper lip lifts',
  },
  {
    id: 'tilt-left',
    name: 'Tilt Left',
    instruction: 'Turn your head slightly to the left and hold',
    icon: <RotateCcw className="w-6 h-6" />,
    description: 'Trains head tilt control',
    guideHint: 'Turn head left',
  },
  {
    id: 'tilt-right',
    name: 'Tilt Right',
    instruction: 'Turn your head slightly to the right and hold',
    icon: <RotateCcw className="w-6 h-6 scale-x-[-1]" />,
    description: 'Trains head tilt control',
    guideHint: 'Turn head right',
  },
];

/** Hold duration (ms) – user must hold expression this long to register (one match) */
const HOLD_DURATION = 1000;
const MAX_ATTEMPTS = 3;
const DETECTION_INTERVAL = 80;
/** Time (ms) expression can drop without resetting hold progress (avoids flicker reset) */
const HOLD_GRACE_MS = 450;
/** Require this many consecutive "detected" frames before starting hold (reduces false starts) */
const CONSECUTIVE_FRAMES_TO_START = 2;
/** Delay (ms) before accepting baseline samples so user can settle into neutral */
const BASELINE_SETTLE_MS = 400;
/** One match = registered, then correct sign and move on */
const SUCCESS_HOLDS_REQUIRED = 1;
/** Tutorial phase duration (ms); after this or first detection we switch to matching */
const TUTORIAL_DURATION_MS = 3000;
/** How long expression must be detected in tutorial to switch to matching (ms) */
const TUTORIAL_DETECT_MS = 500;
/** Frames to average for neutral face capture (small = lines play movement right away) */
const NEUTRAL_SAMPLES = 5;
/** Tutorial: facial lines do the movement at normal pace (1 second per cycle) */
const TUTORIAL_LOOP_MS = 1000;
/** Blend from demo to user over this many ms */
const BLEND_DURATION_MS = 1200;

type ScanStep = 'intro' | 'scanning' | 'combos' | 'complete';
type CameraStatus = 'idle' | 'starting' | 'ready' | 'error';
type ExpressionStatus = 'pending' | 'detecting' | 'matched' | 'failed';
type ExpressionPhase = 'tutorial' | 'matching';

// ---------------------------------------------------------------------------
// Utility: median of a sorted array
// ---------------------------------------------------------------------------
function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ---------------------------------------------------------------------------
// Landmark helpers
// ---------------------------------------------------------------------------

function getLm(landmarks: NormalizedLandmark[] | null, idx: number): NormalizedLandmark | null {
  if (!landmarks || idx >= landmarks.length) return null;
  return landmarks[idx];
}

function mouthWidthRatio(lm: NormalizedLandmark[] | null): number | null {
  const top = getLm(lm, 13); const bottom = getLm(lm, 14);
  const left = getLm(lm, 61); const right = getLm(lm, 291);
  if (!top || !bottom || !left || !right) return null;
  const vert = Math.abs(top.y - bottom.y);
  const horiz = Math.abs(right.x - left.x);
  if (vert < 0.0001) return null;
  return horiz / vert;
}

function mouthOpenRatio(lm: NormalizedLandmark[] | null): number | null {
  const top = getLm(lm, 13); const bottom = getLm(lm, 14);
  if (!top || !bottom) return null;
  return Math.abs(bottom.y - top.y);
}

function mouthCornerYs(lm: NormalizedLandmark[] | null): { leftY: number; rightY: number } | null {
  const left = getLm(lm, 61); const right = getLm(lm, 291);
  if (!left || !right) return null;
  return { leftY: left.y, rightY: right.y };
}

function upperLipY(lm: NormalizedLandmark[] | null): number | null {
  const p = getLm(lm, 13);
  return p ? p.y : null;
}

function mouthWidth(lm: NormalizedLandmark[] | null): number | null {
  const left = getLm(lm, 61); const right = getLm(lm, 291);
  if (!left || !right) return null;
  return Math.abs(right.x - left.x);
}

/** Clone landmark array (and each landmark) for morphing without mutating. */
function cloneLandmarks(lm: NormalizedLandmark[] | null | undefined): NormalizedLandmark[] {
  if (!lm || !Array.isArray(lm)) return [];
  return lm.map((p) => (p ? { ...p, z: p.z ?? 0 } : { x: 0, y: 0, z: 0 }));
}

/**
 * Morph the full wireframe so all fine lines play the real movement of the expression.
 * t in [0,1]; use sin(t*PI) for 0->1->0 over one cycle. Returns new array.
 */
function morphExpression(
  landmarks: NormalizedLandmark[] | null | undefined,
  expressionId: string,
  t: number,
): NormalizedLandmark[] {
  const out = cloneLandmarks(landmarks);
  if (out.length === 0) return out;
  const s = Math.sin(t * Math.PI);
  const centerX = 0.5;
  const centerY = 0.5;

  const move = (idx: number, dx: number, dy: number) => {
    if (idx >= out.length) return;
    out[idx] = { ...out[idx], x: out[idx].x + dx * s, y: out[idx].y + dy * s, z: out[idx].z ?? 0 };
  };

  const moveIndices = (indices: number[], dx: number, dy: number) => {
    indices.forEach((idx) => move(idx, dx, dy));
  };

  const scaleFrom = (indices: number[], cx: number, cy: number, scaleX: number, scaleY: number) => {
    indices.forEach((idx) => {
      if (idx >= out.length) return;
      out[idx] = {
        ...out[idx],
        x: cx + (out[idx].x - cx) * (1 + scaleX * s),
        y: cy + (out[idx].y - cy) * (1 + scaleY * s),
        z: out[idx].z ?? 0,
      };
    });
  };

  const mouthCenterX = 0.5;
  const mouthCenterY = 0.55;

  switch (expressionId) {
    case 'kiss':
      // Whole mouth contour pulls inward (pucker) – all lip lines move toward center
      LIPS_OUTER.forEach((idx) => {
        if (idx >= out.length) return;
        const dx = (mouthCenterX - out[idx].x) * 0.35 * s;
        const dy = (mouthCenterY - out[idx].y) * 0.2 * s;
        out[idx] = { ...out[idx], x: out[idx].x + dx, y: out[idx].y + dy, z: out[idx].z ?? 0 };
      });
      LIPS_INNER.forEach((idx) => {
        if (idx >= out.length) return;
        const dx = (mouthCenterX - out[idx].x) * 0.4 * s;
        const dy = (mouthCenterY - out[idx].y) * 0.25 * s;
        out[idx] = { ...out[idx], x: out[idx].x + dx, y: out[idx].y + dy, z: out[idx].z ?? 0 };
      });
      break;
    case 'happy':
    case 'smiling':
      // Full mouth lines curve up into a smile; brows lift slightly
      [...LIPS_OUTER, ...LIPS_INNER].forEach((idx) => {
        if (idx >= out.length) return;
        const up = -0.04 * s;
        const curve = (out[idx].x - mouthCenterX) * 0.06 * s;
        out[idx] = { ...out[idx], x: out[idx].x, y: out[idx].y + up + curve, z: out[idx].z ?? 0 };
      });
      moveIndices(LEFT_EYEBROW, 0, -0.018);
      moveIndices(RIGHT_EYEBROW, 0, -0.018);
      break;
    case 'surprised':
      // Mouth opens (top up, bottom down); eyes and brows widen and lift
      moveIndices(LIPS_OUTER, 0, 0.02);
      moveIndices(LIPS_INNER, 0, 0.025);
      move(13, 0, -0.04 * s);
      move(14, 0, 0.05 * s);
      scaleFrom(LEFT_EYE, 0.35, 0.4, 0.18, 0.14);
      scaleFrom(RIGHT_EYE, 0.65, 0.4, 0.18, 0.14);
      moveIndices(LEFT_EYEBROW, 0, -0.03);
      moveIndices(RIGHT_EYEBROW, 0, -0.03);
      break;
    case 'smirk':
      // One side of mouth up, other neutral; one brow up
      LIPS_OUTER.forEach((idx) => {
        if (idx >= out.length) return;
        const isRight = out[idx].x > mouthCenterX;
        const up = isRight ? -0.045 * s : -0.01 * s;
        out[idx] = { ...out[idx], y: out[idx].y + up, z: out[idx].z ?? 0 };
      });
      LIPS_INNER.forEach((idx) => {
        if (idx >= out.length) return;
        const isRight = out[idx].x > mouthCenterX;
        const up = isRight ? -0.05 * s : -0.01 * s;
        out[idx] = { ...out[idx], y: out[idx].y + up, z: out[idx].z ?? 0 };
      });
      moveIndices(RIGHT_EYEBROW, 0, -0.022);
      moveIndices(LEFT_EYEBROW, 0, -0.006);
      break;
    case 'lift-lips':
      // Upper lip line moves up (all lip points above center)
      [...LIPS_OUTER, ...LIPS_INNER].forEach((idx) => {
        if (idx >= out.length) return;
        if (out[idx].y < mouthCenterY) {
          out[idx] = { ...out[idx], y: out[idx].y - 0.04 * s, z: out[idx].z ?? 0 };
        }
      });
      move(13, 0, -0.05 * s);
      break;
    case 'tilt-left':
      for (let i = 0; i < out.length; i++) {
        const ly = out[i].y - centerY;
        const lx = out[i].x - centerX;
        const rot = -0.06 * s;
        out[i] = { ...out[i], x: centerX + lx * Math.cos(rot) - ly * Math.sin(rot), y: centerY + lx * Math.sin(rot) + ly * Math.cos(rot), z: out[i].z ?? 0 };
      }
      break;
    case 'tilt-right':
      for (let i = 0; i < out.length; i++) {
        const ly = out[i].y - centerY;
        const lx = out[i].x - centerX;
        const rot = 0.06 * s;
        out[i] = { ...out[i], x: centerX + lx * Math.cos(rot) - ly * Math.sin(rot), y: centerY + lx * Math.sin(rot) + ly * Math.cos(rot), z: out[i].z ?? 0 };
      }
      break;
    default:
      break;
  }
  return out;
}

/** Blend two landmark arrays: (1 - alpha) * a + alpha * b */
function blendLandmarks(a: NormalizedLandmark[], b: NormalizedLandmark[], alpha: number): NormalizedLandmark[] {
  const n = Math.min(a.length, b.length);
  const out: NormalizedLandmark[] = [];
  for (let i = 0; i < n; i++) {
    const t = Math.max(0, Math.min(1, alpha));
    out.push({
      x: a[i].x * (1 - t) + b[i].x * t,
      y: a[i].y * (1 - t) + b[i].y * t,
      z: ((a[i].z ?? 0) * (1 - t) + (b[i].z ?? 0) * t),
    });
  }
  return out;
}

/** Average of multiple landmark arrays. Tolerates variable lengths (e.g. on some mobile). */
function averageLandmarks(samples: NormalizedLandmark[][]): NormalizedLandmark[] | null {
  if (!samples?.length) return null;
  const valid = samples.filter((s) => Array.isArray(s) && s.length > 0);
  if (valid.length === 0) return null;
  const n = Math.min(...valid.map((s) => s.length));
  if (n === 0) return null;
  const out: NormalizedLandmark[] = [];
  for (let i = 0; i < n; i++) {
    let x = 0, y = 0, z = 0;
    let count = 0;
    for (const s of valid) {
      if (i >= s.length) continue;
      const p = s[i];
      if (p == null) continue;
      x += p.x;
      y += p.y;
      z += p.z ?? 0;
      count += 1;
    }
    out.push({ x: count ? x / count : 0, y: count ? y / count : 0, z: count ? z / count : 0 });
  }
  return out.length ? out : null;
}

// ---------------------------------------------------------------------------
// Face mesh wireframe renderer
// ---------------------------------------------------------------------------

function drawFaceMesh(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  w: number,
  h: number,
  highlighted: 'eyes' | 'mouth' | 'brows' | 'head' | 'all',
) {
  const drawPath = (indices: number[], color: string, lineWidth: number, close = false) => {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    for (let i = 0; i < indices.length; i++) {
      const lm = landmarks[indices[i]];
      if (!lm) continue;
      const x = lm.x * w;
      const y = lm.y * h;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    if (close) ctx.closePath();
    ctx.stroke();
  };

  // Determine which features to highlight
  const isEyes = highlighted === 'eyes' || highlighted === 'all';
  const isMouth = highlighted === 'mouth' || highlighted === 'all';
  const isBrows = highlighted === 'brows' || highlighted === 'all';

  // Face oval (always drawn, dimmer)
  drawPath(FACE_OVAL, 'rgba(0, 229, 255, 0.25)', 1);
  drawPath(NOSE_BRIDGE, 'rgba(0, 229, 255, 0.2)', 1);

  // Eyes
  const eyeColor = isEyes ? 'rgba(0, 229, 255, 0.8)' : 'rgba(0, 229, 255, 0.2)';
  const eyeWidth = isEyes ? 1.5 : 0.8;
  drawPath(LEFT_EYE, eyeColor, eyeWidth);
  drawPath(RIGHT_EYE, eyeColor, eyeWidth);

  // Eyebrows
  const browColor = isBrows ? 'rgba(0, 229, 255, 0.8)' : 'rgba(0, 229, 255, 0.2)';
  const browWidth = isBrows ? 1.5 : 0.8;
  drawPath(LEFT_EYEBROW, browColor, browWidth);
  drawPath(RIGHT_EYEBROW, browColor, browWidth);

  // Lips
  const lipColor = isMouth ? 'rgba(0, 229, 255, 0.8)' : 'rgba(0, 229, 255, 0.2)';
  const lipWidth = isMouth ? 1.5 : 0.8;
  drawPath(LIPS_OUTER, lipColor, lipWidth);
  drawPath(LIPS_INNER, lipColor, lipWidth);

  // Draw iris dots
  if (isEyes) {
    for (const idx of [468, 473]) {
      const lm = landmarks[idx];
      if (!lm) continue;
      ctx.beginPath();
      ctx.arc(lm.x * w, lm.y * h, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 229, 255, 0.9)';
      ctx.fill();
    }
  }
}

/** Which face feature to highlight for a given expression */
function getHighlightForExpression(id: string): 'eyes' | 'mouth' | 'brows' | 'head' | 'all' {
  switch (id) {
    case 'kiss': case 'happy': case 'smiling': case 'smirk': case 'lift-lips':
      return 'mouth';
    case 'surprised':
      return 'all';
    case 'tilt-left': case 'tilt-right':
      return 'head';
    default:
      return 'all';
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const FacialExpressionScanning: React.FC<FacialExpressionScanningProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<ScanStep>('intro');
  const [currentExpressionIndex, setCurrentExpressionIndex] = useState(0);
  const [holdProgress, setHoldProgress] = useState(0);
  const [capturedExpressions, setCapturedExpressions] = useState<Set<string>>(new Set());
  const [failedExpressions, setFailedExpressions] = useState<Set<string>>(new Set());
  const [showResult, setShowResult] = useState<'matched' | 'failed' | null>(null);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [attemptCount, setAttemptCount] = useState(0);
  const [expressionPhase, setExpressionPhase] = useState<ExpressionPhase>('tutorial');
  const [successHoldCount, setSuccessHoldCount] = useState(0);
  const [userStartedFollowing, setUserStartedFollowing] = useState(false);

  // Combo builder state
  const [combos, setCombos] = useState<ExpressionCombo[]>([]);
  const [editingCombo, setEditingCombo] = useState<ExpressionCombo | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const meshCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const holdStartRef = useRef<number>(0);
  const holdIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const expressionDetectedRef = useRef(false);
  const undetectedSinceRef = useRef<number>(0);
  const consecutiveDetectedRef = useRef(0);
  const animFrameRef = useRef<number>(0);
  const tutorialDetectedSinceRef = useRef<number>(0);
  const tutorialStartRef = useRef<number>(0);
  const expressionPhaseRef = useRef<ExpressionPhase>('tutorial');
  expressionPhaseRef.current = expressionPhase;
  const successHoldCountRef = useRef(0);
  successHoldCountRef.current = successHoldCount;
  const neutralLandmarksRef = useRef<NormalizedLandmark[] | null>(null);
  const neutralSamplesRef = useRef<NormalizedLandmark[][]>([]);
  const userStartedFollowingRef = useRef(false);
  const userStartedAtRef = useRef<number>(0);
  const blendDoneRef = useRef(false);
  const baselineSettleFromRef = useRef<number>(0);

  // Baseline refs -- accumulate BASELINE_SAMPLE_COUNT samples, then lock
  const BASELINE_SAMPLE_COUNT = 5;
  const smileBaselineRef = useRef<number | null>(null);
  const smileBaselineSamplesRef = useRef<number[]>([]);
  const mouthOpenBaselineRef = useRef<number | null>(null);
  const mouthOpenBaselineSamplesRef = useRef<number[]>([]);
  const cornerBaselineRef = useRef<{ leftY: number; rightY: number } | null>(null);
  const cornerBaselineSamplesRef = useRef<{ leftY: number; rightY: number }[]>([]);
  const upperLipBaselineRef = useRef<number | null>(null);
  const upperLipBaselineSamplesRef = useRef<number[]>([]);
  const mouthWidthBaselineRef = useRef<number | null>(null);
  const mouthWidthBaselineSamplesRef = useRef<number[]>([]);

  const { medium, success, error: hapticError } = useHapticFeedback();

  const currentExpression = EXPRESSIONS[currentExpressionIndex];

  // -----------------------------------------------------------------------
  // Vision Engine
  // -----------------------------------------------------------------------
  const vision = useVisionEngine({
    enabled: isOpen && cameraStatus === 'ready',
    videoRef,
    mirrorX: true,
    driverPriority: true,
    visionBackend: loadRemoteControlSettings().visionBackend ?? 'face_mesh',
    blinkConfig: { calibrationMode: true },
    minDetectionConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });

  // Keep a ref that always points to the latest vision state so that
  // callbacks inside setInterval / rAF can read current data without
  // needing the vision object in their dependency arrays (avoids the
  // stale-closure race condition where the interval restarts every frame).
  const visionRef = useRef(vision);
  visionRef.current = vision;

  // Notify RC to suspend vision (this component owns the camera) and broadcast
  // visionEngineSample so useEyeTracking receives attention data during calibration.
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen]);

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

  const faceDetected = vision.hasFace;

  // -----------------------------------------------------------------------
  // Face mesh wireframe rendering loop
  // Tutorial: capture neutral, then draw animated morph; when user follows, blend to user.
  // Matching: draw user landmarks (user dictates timing).
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (step !== 'scanning' || cameraStatus !== 'ready') return;

    const render = () => {
      const canvas = meshCanvasRef.current;
      const video = videoRef.current;
      if (!canvas || !video) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const rect = video.getBoundingClientRect();
      if (canvas.width !== rect.width || canvas.height !== rect.height) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const v = visionRef.current;
      const phase = expressionPhaseRef.current;
      const exprId = currentExpression?.id ?? '';
      const highlight = getHighlightForExpression(exprId);

      if (!v.landmarks || !v.hasFace) {
        animFrameRef.current = requestAnimationFrame(render);
        return;
      }

      const userLm = v.landmarks;

      // Capture neutral in first frames of tutorial
      if (phase === 'tutorial' && !neutralLandmarksRef.current) {
        neutralSamplesRef.current.push(cloneLandmarks(userLm));
        if (neutralSamplesRef.current.length >= NEUTRAL_SAMPLES) {
          neutralLandmarksRef.current = averageLandmarks(neutralSamplesRef.current);
          neutralSamplesRef.current = [];
        }
      }

      const neutral = neutralLandmarksRef.current;
      const now = Date.now();

      if (phase === 'tutorial' && neutral && neutral.length > 0) {
        const tLoop = ((now - tutorialStartRef.current) % TUTORIAL_LOOP_MS) / TUTORIAL_LOOP_MS;
        if (!userStartedFollowingRef.current) {
          const demo = morphExpression(neutral, exprId, tLoop);
          drawFaceMesh(ctx, demo, canvas.width, canvas.height, highlight);
        } else {
          const blendElapsed = now - userStartedAtRef.current;
          const blendAlpha = Math.min(1, blendElapsed / BLEND_DURATION_MS);
          const demo = morphExpression(neutral, exprId, tLoop);
          const blended = blendLandmarks(demo, userLm, blendAlpha);
          drawFaceMesh(ctx, blended, canvas.width, canvas.height, highlight);
          if (blendAlpha >= 1 && !blendDoneRef.current) {
            blendDoneRef.current = true;
            setExpressionPhase('matching');
          }
        }
      } else {
        drawFaceMesh(ctx, userLm, canvas.width, canvas.height, highlight);
      }

      animFrameRef.current = requestAnimationFrame(render);
    };

    animFrameRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [step, cameraStatus, currentExpression?.id]);

  // -----------------------------------------------------------------------
  // Camera management
  // -----------------------------------------------------------------------
  const startCamera = useCallback(async () => {
    setCameraStatus('starting');
    setCameraError(null);

    if (streamRef.current && videoRef.current?.srcObject) {
      setCameraStatus('ready');
      return true;
    }

    const attempts: MediaStreamConstraints[] = [
      { audio: false, video: { facingMode: { ideal: 'user' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30, max: 30 } } },
      { audio: false, video: { facingMode: 'user' } },
      { audio: false, video: true },
    ];

    let stream: MediaStream | null = null;
    let lastErr: unknown = null;
    for (const c of attempts) {
      try { stream = await navigator.mediaDevices.getUserMedia(c); break; } catch (err) { lastErr = err; }
    }

    if (!stream) {
      setCameraStatus('error');
      setCameraError(lastErr instanceof Error ? lastErr.message : 'Camera access failed.');
      hapticError();
      return false;
    }

    streamRef.current = stream;
    if (videoRef.current) {
      videoRef.current.muted = true;
      videoRef.current.playsInline = true;
      videoRef.current.autoplay = true;
      videoRef.current.srcObject = stream;
      await new Promise<void>((resolve) => {
        const vid = videoRef.current!;
        const onData = () => { vid.removeEventListener('loadeddata', onData); resolve(); };
        vid.addEventListener('loadeddata', onData);
        setTimeout(() => { vid.removeEventListener('loadeddata', onData); resolve(); }, 3000);
      });
      try { await videoRef.current.play(); } catch { /* */ }
    }

    setCameraStatus('ready');
    return true;
  }, [hapticError]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch { /* */ }
      try { (videoRef.current as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null; } catch { /* */ }
    }
    setCameraStatus('idle');
  }, []);

  // -----------------------------------------------------------------------
  // Expression detection (no setState inside to avoid stale closures / re-renders from interval)
  // -----------------------------------------------------------------------
  const detectExpression = useCallback((): boolean => {
    const v = visionRef.current;
    const lm = v.landmarks;
    if (!lm || !v.hasFace) return false;
    const exprId = currentExpression?.id;
    if (!exprId) return false;

    const accumulateBaseline = (
      baselineRef: React.MutableRefObject<number | null>,
      samplesRef: React.MutableRefObject<number[]>,
      value: number,
    ): boolean => {
      if (baselineRef.current != null) return true;
      const now = Date.now();
      if (now - baselineSettleFromRef.current < BASELINE_SETTLE_MS) return false;
      samplesRef.current.push(value);
      if (samplesRef.current.length >= BASELINE_SAMPLE_COUNT) {
        baselineRef.current = median(samplesRef.current);
        return true;
      }
      return false;
    };

    if (exprId === 'kiss') {
      const w = mouthWidth(lm);
      if (w == null) return false;
      if (!accumulateBaseline(mouthWidthBaselineRef, mouthWidthBaselineSamplesRef, w)) return false;
      const ratio = w / mouthWidthBaselineRef.current!;
      return ratio < 0.88;
    }
    if (exprId === 'happy') {
      const ratio = mouthWidthRatio(lm);
      if (ratio == null) return false;
      if (!accumulateBaseline(smileBaselineRef, smileBaselineSamplesRef, ratio)) return false;
      const pct = ratio / smileBaselineRef.current!;
      return pct > 1.05;
    }
    if (exprId === 'surprised') {
      const openness = v.eyeOpenness;
      const mOpen = mouthOpenRatio(lm);
      if (mOpen == null) return false;
      if (!accumulateBaseline(mouthOpenBaselineRef, mouthOpenBaselineSamplesRef, mOpen)) return false;
      const mRatio = mOpen / mouthOpenBaselineRef.current!;
      return openness > 1.06 && mRatio > 1.18;
    }
    if (exprId === 'smiling') {
      const ratio = mouthWidthRatio(lm);
      if (ratio == null) return false;
      if (!accumulateBaseline(smileBaselineRef, smileBaselineSamplesRef, ratio)) return false;
      const pct = ratio / smileBaselineRef.current!;
      return pct > 1.03;
    }
    if (exprId === 'smirk') {
      const corners = mouthCornerYs(lm);
      if (!corners) return false;
      if (!cornerBaselineRef.current) {
        if (Date.now() - baselineSettleFromRef.current < BASELINE_SETTLE_MS) return false;
        cornerBaselineSamplesRef.current.push(corners);
        if (cornerBaselineSamplesRef.current.length >= BASELINE_SAMPLE_COUNT) {
          const samples = cornerBaselineSamplesRef.current;
          cornerBaselineRef.current = {
            leftY: median(samples.map((s) => s.leftY)),
            rightY: median(samples.map((s) => s.rightY)),
          };
        } else {
          return false;
        }
      }
      const leftDelta = cornerBaselineRef.current!.leftY - corners.leftY;
      const rightDelta = cornerBaselineRef.current!.rightY - corners.rightY;
      const asym = Math.abs(leftDelta - rightDelta);
      return asym > 0.006 && (leftDelta > 0.004 || rightDelta > 0.004);
    }
    if (exprId === 'lift-lips') {
      const y = upperLipY(lm);
      if (y == null) return false;
      if (!accumulateBaseline(upperLipBaselineRef, upperLipBaselineSamplesRef, y)) return false;
      const delta = upperLipBaselineRef.current! - y;
      return delta > 0.006;
    }
    if (exprId === 'tilt-left') return v.headYaw < -5;
    if (exprId === 'tilt-right') return v.headYaw > 5;
    return false;
  }, [currentExpression?.id]);

  // Ref to always hold the latest detectExpression so the detection loop
  // interval can call it without restarting every frame.
  const detectExpressionRef = useRef(detectExpression);
  detectExpressionRef.current = detectExpression;

  // Reset baselines and sample arrays when expression changes
  useEffect(() => {
    smileBaselineRef.current = null;
    smileBaselineSamplesRef.current = [];
    mouthOpenBaselineRef.current = null;
    mouthOpenBaselineSamplesRef.current = [];
    cornerBaselineRef.current = null;
    cornerBaselineSamplesRef.current = [];
    upperLipBaselineRef.current = null;
    upperLipBaselineSamplesRef.current = [];
    mouthWidthBaselineRef.current = null;
    mouthWidthBaselineSamplesRef.current = [];
    holdStartRef.current = 0;
    expressionDetectedRef.current = false;
    consecutiveDetectedRef.current = 0;
    undetectedSinceRef.current = 0;
    tutorialDetectedSinceRef.current = 0;
    neutralLandmarksRef.current = null;
    neutralSamplesRef.current = [];
    userStartedFollowingRef.current = false;
    userStartedAtRef.current = 0;
    blendDoneRef.current = false;
    baselineSettleFromRef.current = Date.now();
    setUserStartedFollowing(false);
    setHoldProgress(0);
    setAttemptCount(0);
    setShowResult(null);
    setExpressionPhase('tutorial');
    setSuccessHoldCount(0);
  }, [currentExpressionIndex]);

  // -----------------------------------------------------------------------
  // Success / Failure handlers
  // -----------------------------------------------------------------------

  const playSuccessSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch { /* */ }
  }, []);

  const playFailSound = useCallback(() => {
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.setValueAtTime(200, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.setValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
    } catch { /* */ }
  }, []);

  const markMatched = useCallback(() => {
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
    success();
    playSuccessSound();
    setCapturedExpressions((prev) => new Set([...prev, currentExpression.id]));
    setShowResult('matched');

    setTimeout(() => {
      setShowResult(null);
      if (currentExpressionIndex < EXPRESSIONS.length - 1) {
        setCurrentExpressionIndex((i) => i + 1);
      } else {
        setStep('combos');
      }
    }, 1200);
  }, [success, playSuccessSound, currentExpression, currentExpressionIndex]);

  const markFailed = useCallback(() => {
    if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; }
    hapticError();
    playFailSound();
    setFailedExpressions((prev) => new Set([...prev, currentExpression.id]));
    setShowResult('failed');
  }, [hapticError, playFailSound, currentExpression]);

  // Refs for callbacks used inside the detection loop interval, so the
  // interval doesn't need to restart when these callbacks change.
  const markMatchedRef = useRef(markMatched);
  markMatchedRef.current = markMatched;
  const markFailedRef = useRef(markFailed);
  markFailedRef.current = markFailed;

  const retryExpression = useCallback(() => {
    setShowResult(null);
    setAttemptCount(0);
    setHoldProgress(0);
    setSuccessHoldCount(0);
    successHoldCountRef.current = 0;
    setExpressionPhase('matching');
    expressionDetectedRef.current = false;
    consecutiveDetectedRef.current = 0;
    undetectedSinceRef.current = 0;
    holdStartRef.current = 0;
    smileBaselineRef.current = null;
    smileBaselineSamplesRef.current = [];
    mouthOpenBaselineRef.current = null;
    mouthOpenBaselineSamplesRef.current = [];
    cornerBaselineRef.current = null;
    cornerBaselineSamplesRef.current = [];
    upperLipBaselineRef.current = null;
    upperLipBaselineSamplesRef.current = [];
    mouthWidthBaselineRef.current = null;
    mouthWidthBaselineSamplesRef.current = [];
  }, []);

  // -----------------------------------------------------------------------
  // Tutorial phase: auto-switch to matching after TUTORIAL_DURATION_MS
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (step !== 'scanning' || cameraStatus !== 'ready' || expressionPhase !== 'tutorial') return;
    tutorialStartRef.current = Date.now();
    const t = setTimeout(() => {
      setExpressionPhase('matching');
    }, TUTORIAL_DURATION_MS);
    return () => clearTimeout(t);
  }, [step, cameraStatus, expressionPhase, currentExpressionIndex]);

  // -----------------------------------------------------------------------
  // Main detection loop
  // Tutorial: when user first holds expression for TUTORIAL_DETECT_MS, switch to matching.
  // Matching: require SUCCESS_HOLDS_REQUIRED successful holds, then register + success overlay.
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (step !== 'scanning' || !isOpen || showResult) return;
    if (cameraStatus !== 'ready') return;

    const interval = setInterval(() => {
      const detected = detectExpressionRef.current();
      const phase = expressionPhaseRef.current;

      if (phase === 'tutorial') {
        if (detected) {
          const now = Date.now();
          if (tutorialDetectedSinceRef.current === 0) tutorialDetectedSinceRef.current = now;
          if (now - tutorialDetectedSinceRef.current >= TUTORIAL_DETECT_MS && !userStartedFollowingRef.current) {
            userStartedFollowingRef.current = true;
            userStartedAtRef.current = now;
            setUserStartedFollowing(true);
          }
        } else {
          tutorialDetectedSinceRef.current = 0;
        }
        return;
      }

      if (detected) {
        undetectedSinceRef.current = 0;
        consecutiveDetectedRef.current = Math.min(
          consecutiveDetectedRef.current + 1,
          CONSECUTIVE_FRAMES_TO_START + 1,
        );
        const confirmed = consecutiveDetectedRef.current >= CONSECUTIVE_FRAMES_TO_START;
        if (confirmed && !expressionDetectedRef.current) {
          expressionDetectedRef.current = true;
          holdStartRef.current = Date.now();
          medium();
        }
        if (expressionDetectedRef.current) {
          const elapsed = Date.now() - holdStartRef.current;
          const pct = Math.min((elapsed / HOLD_DURATION) * 100, 100);
          setHoldProgress(pct);
          if (pct >= 100) {
            const nextCount = successHoldCountRef.current + 1;
            successHoldCountRef.current = nextCount;
            setSuccessHoldCount(nextCount);
            if (nextCount >= SUCCESS_HOLDS_REQUIRED) {
              clearInterval(interval);
              markMatchedRef.current();
            } else {
              expressionDetectedRef.current = false;
              consecutiveDetectedRef.current = 0;
              holdStartRef.current = 0;
              setHoldProgress(0);
            }
          }
        }
      } else {
        consecutiveDetectedRef.current = 0;
        if (expressionDetectedRef.current) {
          const now = Date.now();
          if (undetectedSinceRef.current === 0) undetectedSinceRef.current = now;
          const undetectedMs = now - undetectedSinceRef.current;
          if (undetectedMs >= HOLD_GRACE_MS) {
            expressionDetectedRef.current = false;
            undetectedSinceRef.current = 0;
            holdStartRef.current = 0;
            setHoldProgress(0);
            setAttemptCount((prev) => {
              const next = prev + 1;
              if (next >= MAX_ATTEMPTS) {
                clearInterval(interval);
                setTimeout(() => markFailedRef.current(), 100);
              }
              return next;
            });
          }
        }
      }
    }, DETECTION_INTERVAL);

    holdIntervalRef.current = interval;
    return () => { clearInterval(interval); holdIntervalRef.current = null; };
  }, [step, isOpen, showResult, cameraStatus, medium]);

  // -----------------------------------------------------------------------
  // Navigation
  // -----------------------------------------------------------------------
  const goNext = useCallback(() => {
    setShowResult(null);
    if (currentExpressionIndex < EXPRESSIONS.length - 1) {
      setCurrentExpressionIndex((i) => i + 1);
    } else {
      setStep('combos');
    }
  }, [currentExpressionIndex]);

  const goBack = useCallback(() => {
    setShowResult(null);
    if (currentExpressionIndex > 0) {
      setCurrentExpressionIndex((i) => i - 1);
    }
  }, [currentExpressionIndex]);

  // -----------------------------------------------------------------------
  // Camera lifecycle
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (step === 'scanning' && cameraStatus === 'idle') startCamera();
    return () => { if (holdIntervalRef.current) { clearInterval(holdIntervalRef.current); holdIntervalRef.current = null; } };
  }, [step, cameraStatus, startCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setStep('intro');
      setCurrentExpressionIndex(0);
      setCapturedExpressions(new Set());
      setFailedExpressions(new Set());
      setHoldProgress(0);
      setCameraError(null);
      setShowResult(null);
      setAttemptCount(0);
      setCombos([]);
      setEditingCombo(null);
    }
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (step === 'combos' || step === 'complete') stopCamera();
  }, [step, stopCamera]);

  // -----------------------------------------------------------------------
  // Combo builder helpers
  // -----------------------------------------------------------------------
  const addCombo = useCallback(() => {
    setEditingCombo({ id: `combo-${Date.now()}`, name: '', steps: [], command: '' });
  }, []);

  const saveCombo = useCallback(() => {
    if (!editingCombo || editingCombo.steps.length < 2 || !editingCombo.name.trim()) return;
    setCombos((prev) => [...prev.filter((c) => c.id !== editingCombo.id), editingCombo]);
    setEditingCombo(null);
  }, [editingCombo]);

  const removeCombo = useCallback((id: string) => {
    setCombos((prev) => prev.filter((c) => c.id !== id));
  }, []);

  // -----------------------------------------------------------------------
  // Completion
  // -----------------------------------------------------------------------
  const handleComplete = useCallback(() => {
    stopCamera();
    const result: FacialExpressionResult = {
      expressions: EXPRESSIONS.map((exp) => ({
        type: exp.id,
        captured: capturedExpressions.has(exp.id),
        timestamp: Date.now(),
      })),
      combos,
      completedAt: new Date().toISOString(),
    };
    // Save combos to localStorage
    try { localStorage.setItem('facial_expression_combos', JSON.stringify(combos)); } catch { /* */ }
    onComplete(result);
  }, [stopCamera, capturedExpressions, combos, onComplete]);

  // -----------------------------------------------------------------------
  // Derived state
  // -----------------------------------------------------------------------
  const expressionStatus = useMemo((): ExpressionStatus => {
    if (showResult === 'matched') return 'matched';
    if (showResult === 'failed') return 'failed';
    if (holdProgress > 0) return 'detecting';
    return 'pending';
  }, [showResult, holdProgress]);

  const statusText = useMemo(() => {
    if (cameraStatus === 'starting') return 'Starting camera...';
    if (cameraStatus === 'error') return cameraError || 'Camera error';
    if (showResult === 'matched') return 'Expression captured!';
    if (showResult === 'failed') return 'Not matched \u2014 Try again?';
    if (!faceDetected) return 'Position your face in the frame';
    if (expressionPhase === 'tutorial') return 'Make the expression – lines will follow you';
    if (holdProgress > 0 && holdProgress < 100) {
      const remaining = Math.ceil(((100 - holdProgress) / 100) * (HOLD_DURATION / 1000));
      return `Match the movement – ${remaining}s`;
    }
    return 'Match the movement';
  }, [cameraStatus, cameraError, showResult, faceDetected, holdProgress, expressionPhase]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  if (!isOpen) return null;

  // --- Intro ---
  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Smile className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Facial Expression Scanning</h2>
              <p className="text-muted-foreground text-sm">
                We'll scan your facial expressions using face tracking. A wireframe will follow your face in real-time.
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 text-left space-y-3">
              <h3 className="font-semibold text-foreground text-sm">Expressions to capture:</h3>
              <div className="grid grid-cols-2 gap-2">
                {EXPRESSIONS.map((exp) => (
                  <div key={exp.id} className="flex items-center gap-2 text-xs text-muted-foreground">{exp.icon}<span>{exp.name}</span></div>
                ))}
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>Hold each expression for <span className="text-primary font-semibold">1 second</span></p>
              <p>You get <span className="text-primary font-semibold">3 attempts</span> per expression</p>
              <p>After scanning, you can create <span className="text-primary font-semibold">combo triggers</span></p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onSkip || onClose} className="flex-1">Cancel</Button>
              <Button onClick={() => setStep('scanning')} className="flex-1">
                <Camera className="w-4 h-4 mr-2" />Start Scanning
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- Combo builder ---
  if (step === 'combos') {
    const capturedList = EXPRESSIONS.filter((e) => capturedExpressions.has(e.id));

    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-5 w-full max-w-md border-primary/20 max-h-[90vh] overflow-y-auto">
          <div className="space-y-5">
            <div className="text-center">
              <h2 className="text-xl font-bold text-foreground mb-1">Combo Expressions</h2>
              <p className="text-sm text-muted-foreground">
                Combine {capturedList.length} captured expressions into multi-step command triggers
              </p>
            </div>

            {/* Summary of captured */}
            <div className="flex flex-wrap gap-2 justify-center">
              {EXPRESSIONS.map((exp) => (
                <div key={exp.id} className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-full text-xs border',
                  capturedExpressions.has(exp.id) ? 'border-green-500/30 bg-green-500/10 text-green-400' : 'border-red-500/30 bg-red-500/10 text-red-400',
                )}>
                  {capturedExpressions.has(exp.id) ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                  {exp.name}
                </div>
              ))}
            </div>

            {/* Existing combos */}
            {combos.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Your combos:</h3>
                {combos.map((combo) => (
                  <div key={combo.id} className="flex items-center gap-2 p-3 rounded-xl bg-muted/30 border border-border/50">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{combo.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {combo.steps.map((s) => EXPRESSIONS.find((e) => e.id === s)?.name ?? s).join(' + ')}
                      </p>
                    </div>
                    <button onClick={() => removeCombo(combo.id)} className="p-1 rounded-full hover:bg-red-500/10">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Combo editor */}
            {editingCombo ? (
              <div className="space-y-3 p-3 rounded-xl bg-muted/20 border border-primary/20">
                <input
                  type="text"
                  placeholder="Combo name (e.g. Like + Tip)"
                  value={editingCombo.name}
                  onChange={(e) => setEditingCombo({ ...editingCombo, name: e.target.value })}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm"
                />

                <p className="text-xs text-muted-foreground">Tap expressions to add steps (min 2):</p>
                <div className="flex flex-wrap gap-2">
                  {capturedList.map((exp) => {
                    const inCombo = editingCombo.steps.includes(exp.id);
                    return (
                      <button
                        key={exp.id}
                        onClick={() => {
                          if (inCombo) {
                            setEditingCombo({ ...editingCombo, steps: editingCombo.steps.filter((s) => s !== exp.id) });
                          } else {
                            setEditingCombo({ ...editingCombo, steps: [...editingCombo.steps, exp.id] });
                          }
                        }}
                        className={cn(
                          'px-3 py-1.5 rounded-full text-xs border transition',
                          inCombo ? 'bg-primary/20 border-primary text-primary' : 'bg-muted/30 border-border text-muted-foreground',
                        )}
                      >
                        {exp.name} {inCombo && `(${editingCombo.steps.indexOf(exp.id) + 1})`}
                      </button>
                    );
                  })}
                </div>

                {editingCombo.steps.length >= 2 && (
                  <div className="flex items-center gap-1 text-xs text-primary">
                    {editingCombo.steps.map((s, i) => (
                      <React.Fragment key={`${s}-${i}`}>
                        {i > 0 && <span className="text-muted-foreground">+</span>}
                        <span className="bg-primary/10 px-2 py-0.5 rounded">{EXPRESSIONS.find((e) => e.id === s)?.name}</span>
                      </React.Fragment>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditingCombo(null)} className="flex-1">Cancel</Button>
                  <Button size="sm" onClick={saveCombo} disabled={editingCombo.steps.length < 2 || !editingCombo.name.trim()} className="flex-1">
                    Save Combo
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="outline" onClick={addCombo} className="w-full gap-2" disabled={capturedList.length < 2}>
                <Plus className="w-4 h-4" /> Create Combo Trigger
              </Button>
            )}

            {capturedList.length < 2 && (
              <p className="text-xs text-muted-foreground text-center">
                Capture at least 2 expressions to create combos
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep('scanning')} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" /> Back
              </Button>
              <Button onClick={() => setStep('complete')} className="flex-1">
                Finish <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // --- Complete ---
  if (step === 'complete') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Scanning Complete!</h2>
              <p className="text-muted-foreground text-sm">
                {capturedExpressions.size} of {EXPRESSIONS.length} expressions captured
                {combos.length > 0 && ` \u2022 ${combos.length} combo${combos.length > 1 ? 's' : ''} created`}
              </p>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {EXPRESSIONS.map((exp) => (
                <div key={exp.id} className={cn(
                  'flex flex-col items-center gap-1 p-2 rounded-lg',
                  capturedExpressions.has(exp.id) ? 'bg-green-500/10' : 'bg-red-500/10',
                )}>
                  <div className={capturedExpressions.has(exp.id) ? 'text-green-500' : 'text-red-400'}>{exp.icon}</div>
                  <span className="text-[10px] text-muted-foreground leading-tight text-center">{exp.name}</span>
                  {capturedExpressions.has(exp.id) ? <Check className="w-3 h-3 text-green-500" /> : <X className="w-3 h-3 text-red-400" />}
                </div>
              ))}
            </div>
            <Button onClick={handleComplete} className="w-full">Continue</Button>
          </div>
        </Card>
      </div>
    );
  }

  // --- Scanning screen ---
  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="p-4 w-full max-w-md border-primary/20">
        <div className="space-y-3">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {currentExpression.icon}
              <span className="font-semibold text-foreground text-sm">{currentExpression.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{currentExpressionIndex + 1} / {EXPRESSIONS.length}</span>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5">
            {EXPRESSIONS.map((exp, index) => (
              <button
                key={exp.id}
                onClick={() => { setShowResult(null); setCurrentExpressionIndex(index); }}
                className={cn(
                  'w-2.5 h-2.5 rounded-full transition-all',
                  capturedExpressions.has(exp.id) ? 'bg-green-500'
                    : failedExpressions.has(exp.id) ? 'bg-red-500'
                    : index === currentExpressionIndex ? 'bg-primary scale-125'
                    : 'bg-muted',
                )}
              />
            ))}
          </div>

          {/* Camera view */}
          <div className="relative aspect-[3/4] min-h-[240px] bg-black rounded-xl overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              width={640}
              height={480}
              className="absolute inset-0 w-full h-full object-cover block"
              style={{ transform: 'scaleX(-1)', objectPosition: 'center' }}
            />

            {/* Face mesh wireframe canvas */}
            <canvas ref={meshCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ transform: 'scaleX(-1)' }} />

            {/* Face detection indicator */}
            <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
              <div className={cn('w-2.5 h-2.5 rounded-full', faceDetected ? 'bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.6)]' : 'bg-red-500')} />
              <span className="text-[10px] text-white/70">{cameraStatus === 'starting' ? 'Starting...' : faceDetected ? 'Tracking' : 'No face'}</span>
            </div>

            {/* Hold counter: in matching, shows completed holds (1/3, 2/3, 3/3); in tutorial shows attempt dots */}
            <div className="absolute top-3 right-3 z-10">
              {expressionPhase === 'matching' ? (
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2.5 h-2.5 rounded-full', successHoldCount >= 1 ? 'bg-green-500' : 'bg-white/25')} />
                  <span className="text-[10px] text-white/80">Match</span>
                </div>
              ) : (
                <div className="flex gap-1">
                  {Array.from({ length: MAX_ATTEMPTS }).map((_, i) => (
                    <div key={i} className={cn('w-2 h-2 rounded-full', i < attemptCount ? 'bg-red-500/60' : 'bg-white/20')} />
                  ))}
                </div>
              )}
            </div>

            {/* Guide: tutorial = lines do the move, then blend to user; matching = hold */}
            <div className="absolute top-10 left-1/2 -translate-x-1/2 z-10">
              <div className="bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-full max-w-[90%] text-center">
                {expressionPhase === 'tutorial' ? (
                  userStartedFollowing ? (
                    <span className="text-[11px] text-cyan-300 font-medium">Match the movement once to register</span>
                  ) : (
                    <span className="text-[11px] text-cyan-300 font-medium">Watch – the lines show the shape to capture (1s each)</span>
                  )
                ) : (
                  <span className="text-[11px] text-cyan-300 font-medium">{currentExpression.guideHint}</span>
                )}
              </div>
            </div>

            {/* Result overlay: matched = white vignette + checkmark; failed = dark + Retry/Skip */}
            {showResult === 'matched' && (
              <div className="absolute inset-0 z-20 pointer-events-none">
                {/* White shadowed screen cover on the edges (vignette) */}
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'radial-gradient(ellipse at center, transparent 25%, rgba(255,255,255,0.35) 60%, rgba(255,255,255,0.6) 100%)',
                    boxShadow: 'inset 0 0 100px 50px rgba(255,255,255,0.12)',
                  }}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-white/90 shadow-xl flex items-center justify-center animate-scale-in border-4 border-green-500">
                    <Check className="w-12 h-12 text-green-600" strokeWidth={3} />
                  </div>
                  <p className="text-foreground font-bold mt-4 text-lg drop-shadow">Matched!</p>
                </div>
              </div>
            )}
            {showResult === 'failed' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 z-20">
                <div className="w-20 h-20 rounded-full bg-red-500/20 border-4 border-red-500 flex items-center justify-center animate-scale-in">
                  <X className="w-10 h-10 text-red-400" />
                </div>
                <p className="text-red-400 font-semibold mt-3">Not matched</p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="outline" onClick={retryExpression} className="gap-1.5">
                    <RotateCw className="w-3.5 h-3.5" /> Retry
                  </Button>
                  <Button size="sm" variant="ghost" onClick={goNext} className="gap-1.5 text-muted-foreground">
                    Skip <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )}

            {/* Hold progress ring */}
            {holdProgress > 0 && holdProgress < 100 && !showResult && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <svg className="w-56 h-72 -rotate-90">
                  <ellipse cx="112" cy="144" rx="96" ry="128" fill="none" stroke="currentColor" strokeWidth="3" className="text-primary/20" />
                  <ellipse cx="112" cy="144" rx="96" ry="128" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray={`${holdProgress * 7.03} 703`} className="text-primary transition-all" />
                </svg>
              </div>
            )}

            {/* Camera error */}
            {cameraStatus === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 p-4 z-20">
                <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
                <p className="text-sm text-red-300 text-center mb-4">{cameraError}</p>
                <Button size="sm" variant="outline" onClick={() => { stopCamera(); setTimeout(() => startCamera(), 300); }} className="gap-2">
                  <RefreshCw className="w-4 h-4" /> Retry Camera
                </Button>
              </div>
            )}

            {/* Status bar */}
            {cameraStatus !== 'error' && (
              <div className="absolute bottom-3 left-3 right-3 text-center z-10">
                <div className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-medium',
                  showResult === 'matched' ? 'bg-green-500/80 text-green-950'
                    : showResult === 'failed' ? 'bg-red-500/80 text-red-950'
                    : !faceDetected ? 'bg-yellow-500/80 text-yellow-950'
                    : holdProgress > 0 ? 'bg-primary/80 text-primary-foreground'
                    : 'bg-green-500/80 text-green-950',
                )}>
                  {statusText}
                </div>
              </div>
            )}
          </div>

          {/* Instruction */}
          <div className="text-center">
            <p className="text-sm font-medium text-foreground">{currentExpression.instruction}</p>
            <p className="text-xs text-muted-foreground">{currentExpression.description}</p>
          </div>

          {/* Progress bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Hold Progress</span>
              <span>{Math.round(holdProgress)}%</span>
            </div>
            <Progress value={holdProgress} className="h-1.5" />
          </div>

          {/* Navigation buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={goBack} disabled={currentExpressionIndex === 0} className="gap-1">
              <ChevronLeft className="w-4 h-4" /> Back
            </Button>
            <Button variant="outline" size="sm" onClick={onSkip || onClose} className="flex-1 gap-1">
              <X className="w-4 h-4" /> Cancel
            </Button>
            <Button variant="outline" size="sm" onClick={goNext} className="gap-1">
              Next <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default FacialExpressionScanning;
