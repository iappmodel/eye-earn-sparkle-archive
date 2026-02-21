/**
 * Eye-tracking fallback worker: runs skin-tone analysis off the main thread.
 * Receives raw ImageData buffer; posts { type: 'result', rawScore, facePresent, lastFlags }.
 */
import { analyzeSkinToneFramePure } from '../lib/skinToneFallback';

let prevData: Uint8ClampedArray | null = null;

self.onmessage = (e: MessageEvent<{ type: string; data: ArrayBuffer; width: number; height: number }>) => {
  const msg = e.data;
  if (!msg || msg.type !== 'analyze') return;

  const { data: buffer, width, height } = msg;
  const data = new Uint8ClampedArray(buffer);

  const { result, nextPrevData } = analyzeSkinToneFramePure(data, width, height, prevData);
  prevData = nextPrevData;

  (self as Worker).postMessage({
    type: 'result',
    rawScore: result.rawScore,
    facePresent: result.facePresent,
    lastFlags: result.lastFlags ?? [],
  });
};
