/**
 * Pass thresholds and cash-eligibility for attention validation.
 * Used by useEyeTracking when determining reward eligibility.
 */
import {
  getAttentionPreset,
  type AttentionPresetId,
} from '@/constants/attention';

/** Source of attention data – vision = MediaPipe, fallback = skin-tone, none = no data */
export type AttentionSource = 'vision' | 'fallback' | 'none';

/**
 * Returns the minimum score (0–100) required to pass attention validation.
 */
export function getPassThreshold(presetId: AttentionPresetId | null | undefined): number {
  const preset = getAttentionPreset(presetId);
  return preset.requiredAttentionThreshold;
}

/**
 * Whether the attention source qualifies for cash (Icoin) payout.
 * Vision = high-quality MediaPipe; fallback/none = skin-tone only, do not allow Icoin.
 */
export function isCashEligible(source: AttentionSource): boolean {
  return source === 'vision';
}
