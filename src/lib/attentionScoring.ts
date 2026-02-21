/**
 * Attention scoring engine: time-weighted ledger, rolling window, EMA.
 * Used by useEyeTracking for vision and fallback samples.
 */
import type { AttentionSource } from '@/constants/attentionPass';

export type { AttentionSource };

/** Scoring engine config (matches ATTENTION_CONFIGS in constants/attention). */
export interface AttentionConfig {
  faceWeight: number;
  eyesWeight: number;
  gazeWeight: number;
  poseWeight: number;
  earClosed: number;
  earOpen: number;
  gazeEllipseX: number;
  gazeEllipseY: number;
  neutralWarmupMs: number;
  attentiveThresholdVision: number;
  attentiveThresholdFallback: number;
  maxYaw: number;
  maxPitch: number;
}

export interface AttentionSample {
  hasFace: boolean;
  eyeEAR?: number;
  gazePosition?: { x: number; y: number } | null;
  calibratedGazePosition?: { x: number; y: number } | null;
  headYaw?: number;
  headPitch?: number;
  rawFallbackScore?: number;
}

export interface AttentionState {
  attentiveMs: number;
  totalMs: number;
  uiEma: number;
  lastSource: AttentionSource;
  lastSourceConfidence: number;
  neutralGaze: { x: number; y: number } | null;
  useCalibratedGaze: boolean;
  ledger: Array<{ t: number; attentive: boolean }>;
  windowMs: number;
}

const DEFAULT_WINDOW_MS = 2000;

export function createAttentionState(emaAlpha: number): AttentionState {
  return {
    attentiveMs: 0,
    totalMs: 0,
    uiEma: 0,
    lastSource: 'none',
    lastSourceConfidence: 0,
    neutralGaze: null,
    useCalibratedGaze: false,
    ledger: [],
    windowMs: DEFAULT_WINDOW_MS,
  };
}

export function resetForPromoStart(state: AttentionState, _now: number): void {
  state.attentiveMs = 0;
  state.totalMs = 0;
  state.uiEma = 0;
  state.ledger = [];
}

function trimLedger(state: AttentionState, now: number): void {
  const cutoff = now - state.windowMs;
  state.ledger = state.ledger.filter((e) => e.t > cutoff);
}

export function computeRawAttention(
  sample: AttentionSample,
  cfg: AttentionConfig,
  _neutralGaze: { x: number; y: number } | null,
  useCalibrated: boolean
): number {
  if (sample.rawFallbackScore !== undefined) return sample.rawFallbackScore;
  if (!sample.hasFace) return 0;

  const gaze = useCalibrated ? sample.calibratedGazePosition : sample.gazePosition;
  const gazePos = gaze ?? { x: 0.5, y: 0.5 };
  const gazeX = Math.abs(gazePos.x - 0.5);
  const gazeY = Math.abs(gazePos.y - 0.5);
  const inEllipse =
    (gazeX * gazeX) / (cfg.gazeEllipseX * cfg.gazeEllipseX) +
    (gazeY * gazeY) / (cfg.gazeEllipseY * cfg.gazeEllipseY) <=
    1;

  const ear = sample.eyeEAR ?? 0;
  const eyesOpen = ear >= cfg.earOpen ? 1 : ear <= cfg.earClosed ? 0 : (ear - cfg.earClosed) / (cfg.earOpen - cfg.earClosed);
  const gazeScore = inEllipse ? 1 : 0;
  const poseScore =
    Math.abs(sample.headYaw ?? 0) <= cfg.maxYaw && Math.abs(sample.headPitch ?? 0) <= cfg.maxPitch ? 1 : 0;

  return (
    (sample.hasFace ? cfg.faceWeight : 0) +
    eyesOpen * cfg.eyesWeight +
    gazeScore * cfg.gazeWeight +
    poseScore * cfg.poseWeight
  );
}

export function applyAttentionSample(
  sample: AttentionSample,
  state: AttentionState,
  cfg: AttentionConfig,
  source: AttentionSource,
  sourceConfidence: number
): void {
  const now = Date.now();
  state.lastSource = source;
  state.lastSourceConfidence = sourceConfidence;

  const threshold =
    source === 'vision' ? cfg.attentiveThresholdVision : cfg.attentiveThresholdFallback;
  const raw = sample.rawFallbackScore ?? computeRawAttention(sample, cfg, state.neutralGaze, state.useCalibratedGaze);
  const attentive = sample.hasFace && raw >= threshold;

  trimLedger(state, now);
  state.ledger.push({ t: now, attentive });

  const span = state.ledger.length >= 2 ? state.ledger[state.ledger.length - 1].t - state.ledger[0].t : 0;
  let attentiveSpan = 0;
  for (let i = 1; i < state.ledger.length; i++) {
    const dt = state.ledger[i].t - state.ledger[i - 1].t;
    if (state.ledger[i].attentive && state.ledger[i - 1].attentive) attentiveSpan += dt;
  }
  state.totalMs = span;
  state.attentiveMs = attentiveSpan;

  const score01 = Math.max(0, Math.min(1, raw));
  state.uiEma = state.uiEma * (1 - 0.2) + score01 * 0.2;
}

export function getAttentionResult(state: AttentionState): {
  score: number;
  source: AttentionSource;
  sourceConfidence: number;
  uiScore: number;
} {
  const score =
    state.totalMs > 0 ? Math.round((state.attentiveMs / state.totalMs) * 100) : 0;
  return {
    score: Math.max(0, Math.min(100, score)),
    source: state.lastSource,
    sourceConfidence: state.lastSourceConfidence,
    uiScore: Math.round(state.uiEma * 100),
  };
}
