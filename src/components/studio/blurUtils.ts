/**
 * Shared blur effect utilities for MediaBlurEditor and BlurPreviewPlayer.
 * Provides CSS filter styles and canvas-based pixelation.
 */

export type BlurType =
  | 'glass'
  | 'mosaic'
  | 'xray'
  | 'outlines'
  | 'negative'
  | 'shadow'
  | 'whitening'
  | 'blackwhite'
  | 'pixelate'
  | 'frosted'
  | 'gaussian'
  | 'vignette'
  | 'sepia'
  | 'posterize';

export interface BlurStyleInput {
  blurType: BlurType;
  blurIntensity: number; // 0-100
}

export type BlurFilterStyle = Record<string, string | number | undefined>;

/**
 * Returns CSS filter style for a blur effect.
 * Mosaic/pixelate use a blur fallback (true pixelate needs canvas).
 */
export function getBlurFilterStyle(input: BlurStyleInput): BlurFilterStyle {
  const intensity = input.blurIntensity / 100;

  switch (input.blurType) {
    case 'glass':
      return { filter: `blur(${12 * intensity}px)` };
    case 'mosaic':
    case 'pixelate':
      return {
        filter: `blur(${4 * (1 - intensity * 0.5)}px)`,
        imageRendering: 'pixelated' as const,
      };
    case 'xray':
      return { filter: `invert(${intensity}) brightness(${0.5 + intensity * 0.5})` };
    case 'outlines':
      return {
        filter: `contrast(${1 + 2 * intensity}) brightness(${1 + 0.5 * intensity}) saturate(0)`,
      };
    case 'negative':
      return { filter: `invert(${intensity}) hue-rotate(${180 * intensity}deg)` };
    case 'shadow':
      return { filter: `brightness(${1 - 0.8 * intensity})` };
    case 'whitening':
      return { filter: `brightness(${1 + intensity}) contrast(${1 - 0.5 * intensity})` };
    case 'blackwhite':
      return { filter: `grayscale(${intensity}) blur(${4 * intensity}px)` };
    case 'frosted':
      return { filter: `blur(${20 * intensity}px) saturate(${1 + 0.5 * intensity})` };
    case 'gaussian':
      return { filter: `blur(${25 * intensity}px)` };
    case 'vignette':
      return {
        filter: `brightness(${1 - 0.3 * intensity}) contrast(${1 + 0.2 * intensity})`,
      };
    case 'sepia':
      return { filter: `sepia(${intensity})` };
    case 'posterize':
      return {
        filter: `contrast(${1 + intensity}) saturate(${1 - 0.5 * intensity})`,
      };
    default:
      return { filter: `blur(${10 * intensity}px)` };
  }
}

/**
 * Applies true pixelate/mosaic effect via canvas.
 * Call from a canvas 2D context with source image/video drawn.
 */
export function applyPixelateEffect(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pixelSize: number
) {
  if (pixelSize <= 1) return;
  const scaledW = Math.max(1, Math.floor(width / pixelSize));
  const scaledH = Math.max(1, Math.floor(height / pixelSize));
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  for (let y = 0; y < height; y += pixelSize) {
    for (let x = 0; x < width; x += pixelSize) {
      const idx = (y * width + x) * 4;
      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];
      const a = data[idx + 3];
      for (let py = y; py < Math.min(y + pixelSize, height); py++) {
        for (let px = x; px < Math.min(x + pixelSize, width); px++) {
          const i = (py * width + px) * 4;
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);
}

/**
 * Get pixel size from intensity (0-100) for mosaic/pixelate.
 * Higher intensity = larger pixels = more obscured.
 */
export function getPixelSizeFromIntensity(intensity: number, maxDimension: number): number {
  const normalized = intensity / 100;
  const minPixels = 4;
  const maxPixels = Math.min(maxDimension / 8, 64);
  return Math.round(minPixels + normalized * (maxPixels - minPixels));
}
