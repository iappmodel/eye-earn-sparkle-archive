/**
 * Improved skin-tone fallback for eye-tracking when MediaPipe Vision Engine is unavailable.
 * Uses multi-zone validation, eye-region darkness, HSV skin model, and liveness to reduce gaming.
 *
 * Tuning: Adjust SkinToneFallbackConfig defaults below based on real-user feedback.
 * - More false negatives (real faces rejected)? Lower thresholds, increase weights for lenient signals.
 * - More gaming (hands/photos accepted)? Raise thresholds, increase weights for strict signals.
 */

export interface SkinToneFallbackConfig {
  /** Min skin ratio in a zone to count as "has skin" (default 0.12). Lower = more permissive. */
  zoneSkinMin: number;
  /** Min horizontal zones with skin (default 2). Raise to require more face spread. */
  horizontalZonesMin: number;
  /** Min skin ratio for horizontal zone (default 0.1). Lower = more permissive. */
  horizontalZoneMin: number;
  /** Luminance diff: eyes darker than cheeks by this (default 8). Lower = more permissive for bad lighting. */
  eyeRegionDarknessMin: number;
  /** Motion diff above which we consider "live" (default 0.02). Lower = stricter liveness. */
  motionLiveThreshold: number;
  /** Motion diff below which we reject as photo (default 0.01). Raise = stricter anti-photo. */
  motionPhotoRejectThreshold: number;
  /** Min center skin ratio for facePresent (default 0.12). Lower = more permissive. */
  centerSkinMin: number;
  /** Skin ratio that gives max skinScore (default 0.25). Lower = easier to max out. */
  skinScoreMaxAt: number;
  /** Weight for zone score 0–1 (default 0.25). */
  weightZone: number;
  /** Weight for horizontal spread (default 0.2). */
  weightSpread: number;
  /** Weight for eye-region darkness (default 0.25). */
  weightEye: number;
  /** Weight for motion/liveness (default 0.15). */
  weightMotion: number;
  /** Weight for overall skin (default 0.15). */
  weightSkin: number;
  /** Partial credit for no eye region (default 0.3). Lower = stricter. */
  eyeScoreNoEyes: number;
  /** Min motionScore when below live threshold (default 0.2). Lower = stricter. */
  motionScoreMin: number;
  /** Vertical zones required for facePresent (default 2). Raise to require forehead+chin. */
  verticalZonesMin: number;
}

/** Default tuning – override via configOverride or adjust here for global tuning. */
export const DEFAULT_CONFIG: SkinToneFallbackConfig = {
  zoneSkinMin: 0.12,
  horizontalZonesMin: 2,
  horizontalZoneMin: 0.1,
  eyeRegionDarknessMin: 8,
  motionLiveThreshold: 0.02,
  motionPhotoRejectThreshold: 0.01,
  centerSkinMin: 0.12,
  skinScoreMaxAt: 0.25,
  weightZone: 0.25,
  weightSpread: 0.2,
  weightEye: 0.25,
  weightMotion: 0.15,
  weightSkin: 0.15,
  eyeScoreNoEyes: 0.3,
  motionScoreMin: 0.2,
  verticalZonesMin: 2,
};

export interface SkinToneFallbackResult {
  /** 0–1 attention score (gradient, not binary) */
  rawScore: number;
  facePresent: boolean;
  lastFlags: string[];
}

const W = 160;
const H = 160;

/** Check if pixel is skin (RGB + HSV hybrid for robustness) */
function isSkinPixel(r: number, g: number, b: number): boolean {
  // RGB rules (works for most skin tones)
  if (r < 60 || g < 40 || b < 20) return false;
  if (r <= g || r <= b) return false;
  if (Math.abs(r - g) < 15 || r - b < 15) return false;

  // HSV: hue for skin typically 0–50 (red-yellow)
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  const s = max === 0 ? 0 : (max - min) / max;
  const v = max;
  if (s < 0.1 || v < 0.2) return false; // too gray or dark

  let h = 0;
  if (max !== min) {
    const d = r === max ? (g - b) / (max - min) : g === max ? 2 + (b - r) / (max - min) : 4 + (r - g) / (max - min);
    h = (d / 6 + 1) % 1;
  }
  const hueDeg = h * 360;
  if (hueDeg > 50 && hueDeg < 340) return false; // skin is typically red-yellow

  return true;
}

/** Luminance (for eye-region darkness) */
function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

/** Sample ROI from ImageData (x, y, w, h in pixels of the full image) */
function getSkinRatio(data: Uint8ClampedArray, imgW: number, x: number, y: number, w: number, h: number): number {
  let skin = 0;
  let total = 0;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const i = (py * imgW + px) * 4;
      if (isSkinPixel(data[i], data[i + 1], data[i + 2])) skin++;
      total++;
    }
  }
  return total > 0 ? skin / total : 0;
}

/** Sample mean luminance in ROI */
function getMeanLuminance(data: Uint8ClampedArray, imgW: number, x: number, y: number, w: number, h: number): number {
  let sum = 0;
  let n = 0;
  for (let py = y; py < y + h; py++) {
    for (let px = x; px < x + w; px++) {
      const i = (py * imgW + px) * 4;
      sum += luminance(data[i], data[i + 1], data[i + 2]);
      n++;
    }
  }
  return n > 0 ? sum / n : 255;
}

/** Frame diff for liveness (compare to previous frame) */
function getFrameDiff(current: Uint8ClampedArray, prev: Uint8ClampedArray | null): number {
  if (!prev || current.length !== prev.length) return 0.5; // assume motion on first frame
  let diff = 0;
  const step = 16; // sample every 16th pixel for speed
  for (let i = 0; i < current.length; i += step) {
    diff += Math.abs(current[i] - prev[i]) + Math.abs(current[i + 1] - prev[i + 1]) + Math.abs(current[i + 2] - prev[i + 2]);
  }
  const maxDiff = (current.length / step) * 3 * 255;
  return maxDiff > 0 ? Math.min(1, diff / (maxDiff * 0.1)) : 0;
}

/**
 * Pure analysis: same logic as analyzeSkinToneFrame but takes/returns prev data instead of a ref.
 * Used by the eye-tracking Web Worker so inference runs off the main thread.
 */
export function analyzeSkinToneFramePure(
  data: Uint8ClampedArray,
  imgW: number,
  imgH: number,
  prevData: Uint8ClampedArray | null,
  configOverride?: Partial<SkinToneFallbackConfig>
): { result: SkinToneFallbackResult; nextPrevData: Uint8ClampedArray } {
  const c = { ...DEFAULT_CONFIG, ...configOverride };

  const cx = Math.floor((imgW - W) / 2);
  const cy = Math.floor((imgH - H) / 2);
  const zoneH = Math.floor(H / 3);
  const top = getSkinRatio(data, imgW, cx, cy, W, zoneH);
  const mid = getSkinRatio(data, imgW, cx, cy + zoneH, W, zoneH);
  const bottom = getSkinRatio(data, imgW, cx, cy + zoneH * 2, W, zoneH);
  const zoneW = Math.floor(W / 3);
  const left = getSkinRatio(data, imgW, cx, cy, zoneW, H);
  const center = getSkinRatio(data, imgW, cx + zoneW, cy, zoneW, H);
  const right = getSkinRatio(data, imgW, cx + zoneW * 2, cy, zoneW, H);
  const eyeY = cy + Math.floor(zoneH * 0.5);
  const eyeH = Math.floor(zoneH * 0.8);
  const eyeLum = getMeanLuminance(data, imgW, cx, eyeY, W, eyeH);
  const cheekLum = getMeanLuminance(data, imgW, cx, cy + zoneH * 1.5, W, zoneH);
  const hasEyeRegion = eyeLum < cheekLum - c.eyeRegionDarknessMin;
  const zonesWithSkin = [top, mid, bottom].filter((r) => r > c.zoneSkinMin).length;
  const horizontalSpread =
    [left, center, right].filter((r) => r > c.horizontalZoneMin).length >= c.horizontalZonesMin;
  const motion = getFrameDiff(data, prevData);
  const centerSkin = getSkinRatio(data, imgW, cx, cy, W, H);

  const zoneScore = Math.min(1, zonesWithSkin / c.verticalZonesMin);
  const spreadScore = horizontalSpread ? 1 : 0.5;
  const eyeScore = hasEyeRegion ? 1 : c.eyeScoreNoEyes;
  const motionScore =
    motion > c.motionLiveThreshold
      ? 1
      : Math.max(c.motionScoreMin, motion / c.motionLiveThreshold);
  const skinScore = Math.min(1, centerSkin / c.skinScoreMaxAt);
  const rawScore =
    zoneScore * c.weightZone +
    spreadScore * c.weightSpread +
    eyeScore * c.weightEye +
    motionScore * c.weightMotion +
    skinScore * c.weightSkin;
  const facePresent =
    zonesWithSkin >= c.verticalZonesMin &&
    horizontalSpread &&
    centerSkin > c.centerSkinMin;

  const flags: string[] = [];
  if (zonesWithSkin < c.verticalZonesMin) flags.push('NO_FACE');
  else if (!horizontalSpread) flags.push('LOOK_AWAY');
  else if (!hasEyeRegion) flags.push('BAD_POSE');
  else if (motion < c.motionPhotoRejectThreshold) flags.push('NO_FACE');

  return {
    result: {
      rawScore: Math.max(0, Math.min(1, rawScore)),
      facePresent,
      lastFlags: flags.length > 0 ? flags : [],
    },
    nextPrevData: new Uint8ClampedArray(data),
  };
}

/**
 * Analyze a frame for face presence using multi-zone skin, eye-region, and liveness.
 * Returns a gradient score (0–1) to make gaming harder than binary present/absent.
 * @param config - Optional partial config override for tuning from real-user feedback.
 */
export function analyzeSkinToneFrame(
  imageData: ImageData,
  prevFrameRef: { data: Uint8ClampedArray | null },
  configOverride?: Partial<SkinToneFallbackConfig>
): SkinToneFallbackResult {
  const { data, width: imgW, height: imgH } = imageData;
  const { result, nextPrevData } = analyzeSkinToneFramePure(
    data,
    imgW,
    imgH,
    prevFrameRef.data,
    configOverride
  );
  prevFrameRef.data = nextPrevData;
  return result;
}
