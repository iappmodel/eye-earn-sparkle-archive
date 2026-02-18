/**
 * Shared attention tracking constants, weights, and presets.
 * Used by useEyeTracking, useAttentionVerification, and UI components.
 */

import type { AttentionConfig } from '@/lib/attentionScoring';

/** Score weights: face (35%), eyes open (30%), gaze forward (30%), head pose (5%). Legacy. */
export const ATTENTION_WEIGHTS = {
  face: 0.35,
  eyesOpen: 0.30,
  gazeForward: 0.30,
  headPose: 0.05,
} as const;

/** Preset id for scoring engine config and pass thresholds. */
export type AttentionPresetId = 'strict' | 'normal' | 'relaxed';

/** Scoring engine configs: time-weighted ledger, continuous EAR, elliptical gaze, neutral warmup. */
export const ATTENTION_CONFIGS: Record<AttentionPresetId, AttentionConfig> = {
  strict: {
    faceWeight: 0.20,
    eyesWeight: 0.25,
    gazeWeight: 0.40,
    poseWeight: 0.15,
    earClosed: 0.14,
    earOpen: 0.28,
    gazeEllipseX: 0.24,
    gazeEllipseY: 0.30,
    neutralWarmupMs: 2000,
    attentiveThresholdVision: 0.66,
    attentiveThresholdFallback: 0.78,
    maxYaw: 12,
    maxPitch: 10,
  },
  normal: {
    faceWeight: 0.20,
    eyesWeight: 0.25,
    gazeWeight: 0.40,
    poseWeight: 0.15,
    earClosed: 0.12,
    earOpen: 0.26,
    gazeEllipseX: 0.30,
    gazeEllipseY: 0.36,
    neutralWarmupMs: 2500,
    attentiveThresholdVision: 0.62,
    attentiveThresholdFallback: 0.74,
    maxYaw: 20,
    maxPitch: 15,
  },
  relaxed: {
    faceWeight: 0.20,
    eyesWeight: 0.25,
    gazeWeight: 0.38,
    poseWeight: 0.17,
    earClosed: 0.10,
    earOpen: 0.24,
    gazeEllipseX: 0.36,
    gazeEllipseY: 0.42,
    neutralWarmupMs: 3000,
    attentiveThresholdVision: 0.58,
    attentiveThresholdFallback: 0.70,
    maxYaw: 28,
    maxPitch: 22,
  },
};

export interface AttentionPreset {
  id: AttentionPresetId;
  label: string;
  description: string;
  /** EAR below which eyes are considered closed */
  earThreshold: number;
  /** Gaze must be within this range of center (0.5) to count as "forward" */
  gazeForwardRange: number;
  /** Max absolute head yaw in degrees */
  maxYaw: number;
  /** Max absolute head pitch in degrees */
  maxPitch: number;
  /** Rolling average >= this (0–1) counts as attentive frame */
  attentionFrameThreshold: number;
  /** Minimum score (0–100) to pass validation for rewards */
  requiredAttentionThreshold: number;
  /** EMA alpha for smoothing (higher = more responsive) */
  emaAlpha: number;
  /** Rolling window duration in ms */
  rollingWindowMs: number;
}

export const ATTENTION_PRESETS: Record<AttentionPresetId, AttentionPreset> = {
  strict: {
    id: 'strict',
    label: 'Strict',
    description: 'Best for maximum accuracy; requires steady focus',
    earThreshold: 0.2,
    gazeForwardRange: 0.18,
    maxYaw: 12,
    maxPitch: 10,
    attentionFrameThreshold: 0.78,
    requiredAttentionThreshold: 90,
    emaAlpha: 0.25,
    rollingWindowMs: 1500,
  },
  normal: {
    id: 'normal',
    label: 'Normal',
    description: 'Balanced; good for most users',
    earThreshold: 0.18,
    gazeForwardRange: 0.22,
    maxYaw: 20,
    maxPitch: 15,
    attentionFrameThreshold: 0.7,
    requiredAttentionThreshold: 85,
    emaAlpha: 0.2,
    rollingWindowMs: 2000,
  },
  relaxed: {
    id: 'relaxed',
    label: 'Relaxed',
    description: 'More forgiving; better for accessibility',
    earThreshold: 0.14,
    gazeForwardRange: 0.28,
    maxYaw: 28,
    maxPitch: 22,
    attentionFrameThreshold: 0.6,
    requiredAttentionThreshold: 75,
    emaAlpha: 0.15,
    rollingWindowMs: 2500,
  },
};

export const DEFAULT_ATTENTION_PRESET: AttentionPresetId = 'normal';

/** Human-readable flags for attention state (aligned with useAttentionVerification). */
export type AttentionFlag = 'NO_FACE' | 'EYES_CLOSED' | 'LOOK_AWAY' | 'BAD_POSE';

export const ATTENTION_FLAG_LABELS: Record<AttentionFlag, string> = {
  NO_FACE: 'Face not detected',
  EYES_CLOSED: 'Eyes closed',
  LOOK_AWAY: 'Looking away',
  BAD_POSE: 'Head turned',
};

/** Default thresholds when not using a preset (same as "normal"). */
export const DEFAULT_ATTENTION_THRESHOLDS = ATTENTION_PRESETS.normal;

/** Storage key for selected attention preset */
export const ATTENTION_PRESET_STORAGE_KEY = 'visuai-attention-preset';

export function getAttentionPreset(id: AttentionPresetId | null | undefined): AttentionPreset {
  if (id && id in ATTENTION_PRESETS) return ATTENTION_PRESETS[id];
  return ATTENTION_PRESETS[DEFAULT_ATTENTION_PRESET];
}

export function getAttentionConfig(id: AttentionPresetId | null | undefined): AttentionConfig {
  if (id && id in ATTENTION_CONFIGS) return ATTENTION_CONFIGS[id];
  return ATTENTION_CONFIGS[DEFAULT_ATTENTION_PRESET];
}

export function loadAttentionPresetFromStorage(): AttentionPresetId {
  try {
    const saved = localStorage.getItem(ATTENTION_PRESET_STORAGE_KEY);
    if (saved && saved in ATTENTION_PRESETS) return saved as AttentionPresetId;
  } catch {
    // ignore
  }
  return DEFAULT_ATTENTION_PRESET;
}

export function saveAttentionPresetToStorage(preset: AttentionPresetId): void {
  try {
    localStorage.setItem(ATTENTION_PRESET_STORAGE_KEY, preset);
  } catch {
    // ignore
  }
}
