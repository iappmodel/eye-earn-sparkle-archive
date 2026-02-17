/**
 * Beauty processor: applies Facetune-style beauty values to canvas/ImageData.
 * Used by Studio preview and any component that needs to render beauty effects on images or video frames.
 */

export type BeautyValues = Record<string, number>;

/** Tool IDs that affect skin smoothing (blend toward luminance, reduce texture) */
const SMOOTH_IDS = [
  'skin-smooth',
  'blemish',
  'pore-reduce',
  'wrinkle-reduce',
  'skin-matte',
  'face-contour',
] as const;

/** Tool IDs that affect global or local brightening/whitening */
const WHITEN_BRIGHTEN_IDS = [
  'skin-tone',
  'skin-glow',
  'eye-brighten',
  'eye-whiten',
  'teeth-whiten',
  'dark-circles',
] as const;

/** Tool IDs that affect contrast/shape (subtle sharpen or soft contour) */
const CONTRAST_IDS = [
  'jawline',
  'cheekbones',
  'eye-enlarge',
  'lip-fullness',
] as const;

const DEFAULT_INTENSITY = 1;

/**
 * Compute effective smoothing amount (0–1) from beauty values.
 */
function getSmoothAmount(values: BeautyValues, intensity = DEFAULT_INTENSITY): number {
  let sum = 0;
  let count = 0;
  for (const id of SMOOTH_IDS) {
    const v = values[id];
    if (v != null && v > 0) {
      sum += v / 100;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.min(1, (sum / Math.max(1, count)) * intensity);
}

/**
 * Compute effective whiten/brighten amount (0–1) from beauty values.
 */
function getWhitenAmount(values: BeautyValues, intensity = DEFAULT_INTENSITY): number {
  let sum = 0;
  let count = 0;
  for (const id of WHITEN_BRIGHTEN_IDS) {
    const v = values[id];
    if (v != null && v > 0) {
      sum += v / 100;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.min(1, (sum / Math.max(1, count)) * intensity);
}

/**
 * Compute effective contrast/shape amount (0–1) for subtle sharpen.
 */
function getContrastAmount(values: BeautyValues, intensity = DEFAULT_INTENSITY): number {
  let sum = 0;
  let count = 0;
  for (const id of CONTRAST_IDS) {
    const v = values[id];
    if (v != null && v > 0) {
      sum += v / 100;
      count++;
    }
  }
  if (count === 0) return 0;
  return Math.min(1, (sum / Math.max(1, count)) * intensity * 0.5);
}

/**
 * Apply smoothing to pixel data: blend RGB toward luminance to reduce texture.
 */
function applySmooth(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number
): void {
  if (amount <= 0) return;
  const blend = 1 - amount * 0.45;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const mid = (r + g + b) / 3;
    data[i] = Math.round(r * blend + mid * (1 - blend));
    data[i + 1] = Math.round(g * blend + mid * (1 - blend));
    data[i + 2] = Math.round(b * blend + mid * (1 - blend));
  }
}

/**
 * Apply whiten/brighten: add to R,G,B with cap at 255.
 */
function applyWhiten(data: Uint8ClampedArray, amount: number): void {
  if (amount <= 0) return;
  const add = Math.min(30, amount * 28);
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.min(255, data[i] + add);
    data[i + 1] = Math.min(255, data[i + 1] + add);
    data[i + 2] = Math.min(255, data[i + 2] + add);
  }
}

/**
 * Apply subtle contrast (midtone emphasis) for “shape” tools.
 */
function applyContrast(data: Uint8ClampedArray, amount: number): void {
  if (amount <= 0) return;
  const factor = 1 + amount * 0.15;
  const mid = 128;
  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, (data[i] - mid) * factor + mid));
    data[i + 1] = Math.max(0, Math.min(255, (data[i + 1] - mid) * factor + mid));
    data[i + 2] = Math.max(0, Math.min(255, (data[i + 2] - mid) * factor + mid));
  }
}

/**
 * Apply all beauty effects to a 2D canvas context.
 * Draw your image first, then call this to apply beauty on top.
 */
export function applyBeautyToContext(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  values: BeautyValues,
  intensity = DEFAULT_INTENSITY
): void {
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  const smoothAmount = getSmoothAmount(values, intensity);
  const whitenAmount = getWhitenAmount(values, intensity);
  const contrastAmount = getContrastAmount(values, intensity);

  if (smoothAmount > 0) applySmooth(data, width, height, smoothAmount);
  if (whitenAmount > 0) applyWhiten(data, whitenAmount);
  if (contrastAmount > 0) applyContrast(data, contrastAmount);

  ctx.putImageData(imageData, 0, 0);
}

/**
 * Apply beauty effects to ImageData (e.g. for workers or offscreen).
 * Returns a new ImageData; does not mutate the original.
 */
export function applyBeautyToImageData(
  imageData: ImageData,
  values: BeautyValues,
  intensity = DEFAULT_INTENSITY
): ImageData {
  const out = new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height
  );
  const data = out.data;
  const w = out.width;
  const h = out.height;

  const smoothAmount = getSmoothAmount(values, intensity);
  const whitenAmount = getWhitenAmount(values, intensity);
  const contrastAmount = getContrastAmount(values, intensity);

  if (smoothAmount > 0) applySmooth(data, w, h, smoothAmount);
  if (whitenAmount > 0) applyWhiten(data, whitenAmount);
  if (contrastAmount > 0) applyContrast(data, contrastAmount);

  return out;
}

/**
 * Check if any beauty effect would be applied (for toggling preview).
 */
export function hasActiveBeautyEffects(values: BeautyValues): boolean {
  const allIds = [
    ...SMOOTH_IDS,
    ...WHITEN_BRIGHTEN_IDS,
    ...CONTRAST_IDS,
    'lip-color',
    'blush',
    'highlighter',
    'eye-color',
    'eyeshadow',
  ];
  return allIds.some((id) => {
    const v = values[id];
    return v != null && v !== 0;
  });
}
