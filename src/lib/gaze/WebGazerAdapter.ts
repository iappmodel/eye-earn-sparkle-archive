/**
 * WebGazer.js adapter – client-side gaze tracking with self-calibration.
 *
 * Uses standard webcams, no video sent to servers. Self-calibrates from user
 * clicks and cursor movements. Generally less accurate than MediaPipe but useful
 * as fallback for users where MediaPipe performs poorly.
 *
 * @see https://webgazer.cs.brown.edu/
 * @see https://github.com/brownhci/WebGazer
 */
import type { GazeSample } from './types';

type WebGazerInstance = {
  begin: () => WebGazerInstance;
  pause: () => WebGazerInstance;
  resume: () => WebGazerInstance;
  end: () => void;
  addMouseEventListeners: () => WebGazerInstance;
  removeMouseEventListeners: () => WebGazerInstance;
  getPrediction: (regModelIndex?: number) => Promise<{ x: number; y: number } | null>;
};

const POLL_INTERVAL_MS = 100;

export async function loadWebGazer(): Promise<WebGazerInstance> {
  const mod = await import('webgazer');
  return mod.default as WebGazerInstance;
}

export function createWebGazerAdapter(): {
  start: () => Promise<void>;
  stop: () => void;
  isActive: () => boolean;
  onSample: (cb: (s: GazeSample) => void) => () => void;
  needsCalibration: () => boolean;
  startCalibration: () => Promise<void>;
} {
  let active = false;
  let webgazer: WebGazerInstance | null = null;
  let pollTimer: ReturnType<typeof setInterval> | null = null;
  const listeners = new Set<(s: GazeSample) => void>();
  let calibrationEnabled = false;

  const emit = (sample: GazeSample) => {
    listeners.forEach((cb) => {
      try {
        cb(sample);
      } catch {
        // ignore
      }
    });
  };

  const poll = async () => {
    if (!webgazer || !active) return;
    try {
      const pred = await webgazer.getPrediction();
      if (pred && typeof pred.x === 'number' && typeof pred.y === 'number') {
        const x = Math.max(0, Math.min(1, pred.x / (typeof window !== 'undefined' ? window.innerWidth : 1920)));
        const y = Math.max(0, Math.min(1, pred.y / (typeof window !== 'undefined' ? window.innerHeight : 1080)));
        emit({
          hasFace: true,
          gazePosition: { x, y },
          timestamp: Date.now(),
          source: 'webgazer',
          eyeEAR: 0.2,
          eyeOpenness: 1,
        });
      } else {
        emit({
          hasFace: false,
          gazePosition: null,
          timestamp: Date.now(),
          source: 'webgazer',
        });
      }
    } catch {
      emit({
        hasFace: false,
        gazePosition: null,
        timestamp: Date.now(),
        source: 'webgazer',
      });
    }
  };

  return {
    async start() {
      if (active) return;
      webgazer = await loadWebGazer();
      webgazer.begin();
      if (calibrationEnabled) {
        webgazer.addMouseEventListeners();
      }
      active = true;
      pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    },

    stop() {
      active = false;
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      if (webgazer) {
        webgazer.removeMouseEventListeners?.();
        webgazer.pause();
        webgazer = null;
      }
    },

    isActive: () => active,

    onSample(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    needsCalibration: () => true, // WebGazer always benefits from calibration

    async startCalibration() {
      calibrationEnabled = true;
      if (webgazer) {
        webgazer.addMouseEventListeners();
      }
      await this.start();
    },
  };
}
