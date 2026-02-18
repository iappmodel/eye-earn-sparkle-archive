/**
 * Vision sample worker: runs EAR, gaze, head pose, and blink detection off the main thread.
 * Main thread sends landmark arrays; worker responds with compact samples to avoid
 * per-frame setState and keep video/UI smooth.
 */

const LEFT_EYE: [number, number, number, number, number, number] = [33, 160, 158, 133, 153, 144];
const RIGHT_EYE: [number, number, number, number, number, number] = [362, 385, 387, 263, 373, 380];
const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];
const LEFT_EYE_CORNERS = [33, 133];
const RIGHT_EYE_CORNERS = [362, 263];
const LEFT_EYE_LIDS = [159, 145];
const RIGHT_EYE_LIDS = [386, 374];

const HEAD_POSE_LANDMARKS = {
  noseTip: 1,
  chin: 152,
  leftEyeOuter: 33,
  rightEyeOuter: 263,
  leftMouth: 61,
  rightMouth: 291,
  forehead: 10,
};

interface NormalizedLandmark {
  x: number;
  y: number;
  z?: number;
}

const dist = (a: NormalizedLandmark, b: NormalizedLandmark) =>
  Math.hypot(a.x - b.x, a.y - b.y);

function computeEAR(landmarks: NormalizedLandmark[], eye: number[]): number {
  if (!landmarks || landmarks.length < 400) return 0;
  const [i1, i2, i3, i4, i5, i6] = eye;
  const p1 = landmarks[i1], p2 = landmarks[i2], p3 = landmarks[i3];
  const p4 = landmarks[i4], p5 = landmarks[i5], p6 = landmarks[i6];
  if (!p1 || !p2 || !p3 || !p4 || !p5 || !p6 || typeof p1.x !== 'number' || typeof p4.x !== 'number') return 0;
  try {
    const vertical1 = dist(p2, p6);
    const vertical2 = dist(p3, p5);
    const horizontal = dist(p1, p4);
    return horizontal > 0 ? (vertical1 + vertical2) / (2 * horizontal) : 0;
  } catch {
    return 0;
  }
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

function averageLandmarks(landmarks: NormalizedLandmark[], indices: number[]) {
  let x = 0, y = 0, n = 0;
  for (const i of indices) {
    const p = landmarks[i];
    if (p && typeof p.x === 'number' && typeof p.y === 'number') {
      x += p.x; y += p.y; n += 1;
    }
  }
  return { x: n ? x / n : 0.5, y: n ? y / n : 0.5 };
}

function gazeFromEye(
  landmarks: NormalizedLandmark[],
  iris: number[],
  corners: number[],
  lids: number[]
): { x: number; y: number } | null {
  try {
    const pupil = averageLandmarks(landmarks, iris);
    const cornerA = landmarks[corners[0]];
    const cornerB = landmarks[corners[1]];
    const lidA = landmarks[lids[0]];
    const lidB = landmarks[lids[1]];
    if (!cornerA?.x || cornerA.x === undefined || !cornerB?.x || !lidA?.y || lidA.y === undefined || !lidB?.y)
      return null;
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
}

function estimateHeadPose(landmarks: NormalizedLandmark[]) {
  const nose = landmarks[HEAD_POSE_LANDMARKS.noseTip];
  const chin = landmarks[HEAD_POSE_LANDMARKS.chin];
  const lEye = landmarks[HEAD_POSE_LANDMARKS.leftEyeOuter];
  const rEye = landmarks[HEAD_POSE_LANDMARKS.rightEyeOuter];
  const lMouth = landmarks[HEAD_POSE_LANDMARKS.leftMouth];
  const rMouth = landmarks[HEAD_POSE_LANDMARKS.rightMouth];
  const forehead = landmarks[HEAD_POSE_LANDMARKS.forehead];
  if (!nose || !chin || !lEye || !rEye || !lMouth || !rMouth || !forehead)
    return { yaw: 0, pitch: 0, roll: 0 };
  const eyeMidX = (lEye.x + rEye.x) / 2;
  const eyeWidth = Math.abs(rEye.x - lEye.x);
  const yawNorm = eyeWidth > 0.001 ? (nose.x - eyeMidX) / eyeWidth : 0;
  const yaw = yawNorm * 60;
  const faceMidY = (forehead.y + chin.y) / 2;
  const faceHeight = Math.abs(chin.y - forehead.y);
  const pitchNorm = faceHeight > 0.001 ? (nose.y - faceMidY) / faceHeight : 0;
  const pitch = pitchNorm * 60;
  const roll = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x) * (180 / Math.PI);
  return { yaw, pitch, roll };
}

export interface VisionWorkerConfig {
  minEarForBaseline: number;
  closeRatio: number;
  maxCloseEAR: number;
  reopenRatio: number;
  minBlinkDurationMs: number;
  maxBlinkDurationMs: number;
  blinkCooldownMs: number;
  minClosedFramesForBlink: number;
  baselineSampleCount: number;
  calibrationMode?: boolean;
  mirrorX: boolean;
  invertY: boolean;
  gazeScale: number;
  gazeSmoothing: number;
}

export interface VisionWorkerInput {
  landmarks: NormalizedLandmark[];
  timestamp: number;
  config: VisionWorkerConfig;
}

export interface VisionWorkerOutput {
  hasFace: true;
  faceBox: { x: number; y: number; w: number; h: number };
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
}

// Blink state kept in worker
let baselineEar: number | null = null;
let baselineEarSamples: number[] = [];
let wasClosed = false;
let closedAt = 0;
let closedFramesCount = 0;
let lastBlinkTime = 0;
let wasLeftClosed = false;
let wasRightClosed = false;
let leftClosedAt = 0;
let rightClosedAt = 0;
let lastLeftWink = 0;
let lastRightWink = 0;
let gazeEma: { x: number; y: number } | null = null;

function processLandmarks(input: VisionWorkerInput): VisionWorkerOutput | null {
  const { landmarks, timestamp: now, config: cfg } = input;
  if (!landmarks || landmarks.length < 468) return null;

  let fMinX = 1, fMinY = 1, fMaxX = 0, fMaxY = 0;
  for (const lm of landmarks) {
    if (lm && typeof lm.x === 'number' && typeof lm.y === 'number') {
      fMinX = Math.min(fMinX, lm.x);
      fMinY = Math.min(fMinY, lm.y);
      fMaxX = Math.max(fMaxX, lm.x);
      fMaxY = Math.max(fMaxY, lm.y);
    }
  }
  const faceBox = {
    x: fMinX,
    y: fMinY,
    w: Math.max(0.01, fMaxX - fMinX),
    h: Math.max(0.01, fMaxY - fMinY),
  };

  const headPose = estimateHeadPose(landmarks);
  const leftEAR = computeEAR(landmarks, LEFT_EYE);
  const rightEAR = computeEAR(landmarks, RIGHT_EYE);
  const ear = (leftEAR + rightEAR) / 2;

  if (baselineEar == null) {
    if (ear > cfg.minEarForBaseline) {
      baselineEarSamples.push(ear);
      if (baselineEarSamples.length >= cfg.baselineSampleCount) {
        const sorted = [...baselineEarSamples].sort((a, b) => a - b);
        const lo = Math.floor(sorted.length * 0.15);
        const hi = Math.ceil(sorted.length * 0.85);
        const trimmed = sorted.slice(lo, hi);
        baselineEar = trimmed.length
          ? trimmed[Math.floor(trimmed.length / 2)]
          : sorted[Math.floor(sorted.length / 2)];
        baselineEarSamples = [];
      }
    }
  } else {
    const openThreshold = baselineEar * (cfg.calibrationMode ? 0.78 : 0.82);
    if (ear > openThreshold) {
      const alpha = cfg.calibrationMode ? 0.05 : 0.03;
      baselineEar = baselineEar * (1 - alpha) + ear * alpha;
    }
  }

  const baseline = baselineEar ?? ear;
  const eyeOpenness = baseline > 0 ? Math.max(0, Math.min(1, ear / baseline)) : 1;
  const closeThreshold = Math.min(baseline * cfg.closeRatio, cfg.maxCloseEAR);
  const reopenThreshold = baseline * cfg.reopenRatio;
  const closedNow = ear < closeThreshold;
  const reopenedNow = ear > reopenThreshold;
  const leftClosedNow = leftEAR < closeThreshold;
  const rightClosedNow = rightEAR < closeThreshold;
  const leftReopenedNow = leftEAR > reopenThreshold;
  const rightReopenedNow = rightEAR > reopenThreshold;

  let blinked = false;
  let leftWink = false;
  let rightWink = false;

  if (!wasLeftClosed && leftClosedNow) {
    wasLeftClosed = true;
    leftClosedAt = now;
  } else if (wasLeftClosed && leftReopenedNow && rightEAR > reopenThreshold) {
    const closeDuration = now - leftClosedAt;
    wasLeftClosed = false;
    leftClosedAt = 0;
    if (closeDuration >= 50 && closeDuration <= 800 && now - lastLeftWink > 200) {
      lastLeftWink = now;
      leftWink = true;
    }
  } else if (wasLeftClosed && now - leftClosedAt > 1500) {
    wasLeftClosed = false;
    leftClosedAt = 0;
  }

  if (!wasRightClosed && rightClosedNow) {
    wasRightClosed = true;
    rightClosedAt = now;
  } else if (wasRightClosed && rightReopenedNow && leftEAR > reopenThreshold) {
    const closeDuration = now - rightClosedAt;
    wasRightClosed = false;
    rightClosedAt = 0;
    if (closeDuration >= 50 && closeDuration <= 800 && now - lastRightWink > 200) {
      lastRightWink = now;
      rightWink = true;
    }
  } else if (wasRightClosed && now - rightClosedAt > 1500) {
    wasRightClosed = false;
    rightClosedAt = 0;
  }

  if (!wasClosed && closedNow) {
    wasClosed = true;
    closedAt = now;
    closedFramesCount = 1;
  } else if (wasClosed) {
    if (closedNow) closedFramesCount += 1;
    else if (reopenedNow) {
      const closeDuration = now - closedAt;
      const hadEnough = closedFramesCount >= cfg.minClosedFramesForBlink;
      wasClosed = false;
      closedAt = 0;
      closedFramesCount = 0;
      if (
        hadEnough &&
        closeDuration >= cfg.minBlinkDurationMs &&
        closeDuration <= cfg.maxBlinkDurationMs &&
        now - lastBlinkTime > cfg.blinkCooldownMs
      ) {
        lastBlinkTime = now;
        blinked = true;
      }
    }
  }
  if (wasClosed && now - closedAt > 2000) {
    wasClosed = false;
    closedAt = 0;
    closedFramesCount = 0;
  }

  let gazePosition: { x: number; y: number } | null = null;
  if (landmarks.length >= 478) {
    const left = gazeFromEye(landmarks, LEFT_IRIS, LEFT_EYE_CORNERS, LEFT_EYE_LIDS);
    const right = gazeFromEye(landmarks, RIGHT_IRIS, RIGHT_EYE_CORNERS, RIGHT_EYE_LIDS);
    const avg = left && right
      ? { x: (left.x + right.x) / 2, y: (left.y + right.y) / 2 }
      : left ?? right;
    if (avg) {
      let gazeX = clamp01(0.5 + (avg.x - 0.5) * cfg.gazeScale);
      let gazeY = clamp01(0.5 + (avg.y - 0.5) * cfg.gazeScale);
      if (cfg.mirrorX) gazeX = 1 - gazeX;
      if (cfg.invertY) gazeY = 1 - gazeY;
      const raw = { x: gazeX, y: gazeY };
      if (cfg.gazeSmoothing > 0 && gazeEma) {
        const a = Math.max(0.05, Math.min(0.95, cfg.gazeSmoothing));
        gazePosition = {
          x: clamp01(a * raw.x + (1 - a) * gazeEma.x),
          y: clamp01(a * raw.y + (1 - a) * gazeEma.y),
        };
      } else {
        gazePosition = raw;
      }
      gazeEma = gazePosition;
    } else {
      gazeEma = null;
    }
  } else {
    gazeEma = null;
  }

  return {
    hasFace: true,
    faceBox,
    ear,
    leftEAR,
    rightEAR,
    eyeOpenness,
    gazePosition,
    headYaw: headPose.yaw,
    headPitch: headPose.pitch,
    baselineReady: baselineEar != null,
    blinked,
    leftWink,
    rightWink,
  };
}

function resetBlinkState() {
  baselineEar = null;
  baselineEarSamples = [];
  wasClosed = false;
  closedAt = 0;
  closedFramesCount = 0;
  lastBlinkTime = 0;
  wasLeftClosed = false;
  wasRightClosed = false;
  leftClosedAt = 0;
  rightClosedAt = 0;
  gazeEma = null;
}

self.onmessage = (e: MessageEvent<VisionWorkerInput | { type: 'reset' }>) => {
  const msg = e.data;
  if (msg && (msg as { type: string }).type === 'reset') {
    resetBlinkState();
    return;
  }
  const out = processLandmarks(msg as VisionWorkerInput);
  if (out) (self as any).postMessage(out);
};
