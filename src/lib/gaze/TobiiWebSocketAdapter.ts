/**
 * Tobii WebSocket adapter – consumes gaze from a local bridge process.
 *
 * Expected payload examples:
 * - { x, y, confidence }
 * - { gx, gy, confidence }
 * - { GazeX, GazeY, validity }
 * - { gaze: { x, y }, confidence }
 *
 * Coordinates can be normalized (0-1) or viewport pixels.
 */
import type { GazeSample } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type CandidatePoint = { x?: unknown; y?: unknown };

const parsePoint = (payload: unknown): { x: number; y: number } | null => {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const candidates: CandidatePoint[] = [
    { x: p.x, y: p.y },
    { x: p.gx, y: p.gy },
    { x: p.GazeX, y: p.GazeY },
    { x: (p.gaze as Record<string, unknown> | undefined)?.x, y: (p.gaze as Record<string, unknown> | undefined)?.y },
    { x: (p.data as Record<string, unknown> | undefined)?.x, y: (p.data as Record<string, unknown> | undefined)?.y },
  ];

  for (const c of candidates) {
    if (typeof c.x === 'number' && typeof c.y === 'number' && Number.isFinite(c.x) && Number.isFinite(c.y)) {
      if (c.x >= 0 && c.x <= 1 && c.y >= 0 && c.y <= 1) return { x: c.x, y: c.y };
      const w = Math.max(window.innerWidth, 1);
      const h = Math.max(window.innerHeight, 1);
      return { x: clamp01(c.x / w), y: clamp01(c.y / h) };
    }
  }

  return null;
};

const parseConfidence = (payload: unknown): number => {
  if (!payload || typeof payload !== 'object') return 0.7;
  const p = payload as Record<string, unknown>;
  const v = p.confidence ?? p.quality ?? p.validity;
  if (typeof v === 'number' && Number.isFinite(v)) return v > 1 ? clamp01(v / 100) : clamp01(v);
  return 0.7;
};

export function createTobiiWebSocketAdapter(initialUrl = 'ws://127.0.0.1:8765'): {
  start: () => Promise<void>;
  stop: () => void;
  isActive: () => boolean;
  onSample: (cb: (s: GazeSample) => void) => () => void;
  needsCalibration: () => boolean;
  startCalibration: () => Promise<void>;
  setUrl: (url: string) => void;
} {
  let active = false;
  let ws: WebSocket | null = null;
  let url = initialUrl;
  const listeners = new Set<(s: GazeSample) => void>();

  const emit = (sample: GazeSample) => {
    listeners.forEach((cb) => {
      try {
        cb(sample);
      } catch {
        // ignore listener errors
      }
    });
  };

  const close = () => {
    if (!ws) return;
    try {
      ws.close();
    } catch {
      // ignore close errors
    }
    ws = null;
  };

  return {
    setUrl(nextUrl: string) {
      url = nextUrl.trim() || 'ws://127.0.0.1:8765';
      if (active) {
        close();
        active = false;
      }
    },

    async start() {
      if (active) return;
      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(url);
        ws = socket;

        socket.onopen = () => {
          active = true;
          resolve();
        };

        socket.onerror = () => {
          reject(new Error(`Tobii WS connection error: ${url}`));
        };

        socket.onclose = () => {
          active = false;
        };

        socket.onmessage = (event) => {
          const text = typeof event.data === 'string' ? event.data : '';
          if (!text) return;
          try {
            const payload = JSON.parse(text);
            const point = parsePoint(payload);
            if (!point) return;
            const confidence = parseConfidence(payload);
            emit({
              hasFace: confidence > 0.15,
              gazePosition: point,
              calibratedGazePosition: point,
              eyeEAR: confidence > 0.15 ? 0.2 : 0,
              eyeOpenness: confidence > 0.15 ? 1 : 0,
              timestamp: Date.now(),
              source: 'tobii_ws',
            });
          } catch {
            // ignore malformed packets
          }
        };

        setTimeout(() => {
          if (!active) {
            close();
            reject(new Error(`Tobii WS connection timeout: ${url}`));
          }
        }, 3500);
      });
    },

    stop() {
      active = false;
      close();
    },

    isActive: () => active,

    onSample(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    needsCalibration: () => true,

    async startCalibration() {
      await this.start();
    },
  };
}
