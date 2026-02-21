/**
 * GazeCloud API adapter – higher-accuracy gaze via GazeRecorder's cloud service.
 *
 * Requires:
 * - Domain registration at https://api.gazerecorder.com/register/
 * - Include script: https://api.gazerecorder.com/GazeCloudAPI.js
 *
 * Privacy: Video is processed by GazeRecorder; confirm their privacy policy before use.
 * Use only with explicit user opt-in.
 */
import type { GazeSample } from './types';

declare global {
  interface Window {
    GazeCloudAPI?: {
      StartEyeTracking: () => void;
      StopEyeTracking: () => void;
      OnResult: (data: GazeCloudResult) => void;
      OnCalibrationComplete?: () => void;
      OnCamDenied?: () => void;
      OnError?: (msg: string) => void;
    };
  }
}

interface GazeCloudResult {
  state: number; // 0: valid, -1: face lost, 1: uncalibrated
  docX: number;
  docY: number;
  time: number;
}

const SCRIPT_URL = 'https://api.gazerecorder.com/GazeCloudAPI.js';

export function loadGazeCloudScript(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject(new Error('Window not available'));
  if (window.GazeCloudAPI) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load GazeCloud API'));
    document.head.appendChild(script);
  });
}

export function createGazeCloudAdapter(): {
  start: () => Promise<void>;
  stop: () => void;
  isActive: () => boolean;
  onSample: (cb: (s: GazeSample) => void) => () => void;
  needsCalibration: () => boolean;
  startCalibration: () => Promise<void>;
} {
  let active = false;
  const listeners = new Set<(s: GazeSample) => void>();
  let lastState = 1; // 1 = uncalibrated by default

  const emit = (sample: GazeSample) => {
    listeners.forEach((cb) => {
      try {
        cb(sample);
      } catch {
        // ignore
      }
    });
  };

  const mapToSample = (d: GazeCloudResult): GazeSample => {
    const hasFace = d.state === 0;
    // docX, docY are document coordinates; normalize to 0-1 for viewport
    const x = typeof window !== 'undefined' ? d.docX / window.innerWidth : 0;
    const y = typeof window !== 'undefined' ? d.docY / window.innerHeight : 0;
    return {
      hasFace,
      gazePosition: hasFace ? { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) } : null,
      timestamp: d.time ?? Date.now(),
      source: 'gazecloud',
      state: d.state,
      eyeEAR: hasFace ? 0.2 : 0,
      eyeOpenness: hasFace ? 1 : 0,
    };
  };

  return {
    async start() {
      if (active) return;
      await loadGazeCloudScript();
      const api = window.GazeCloudAPI;
      if (!api) throw new Error('GazeCloud API not available');

      api.OnResult = (d) => {
        lastState = d.state;
        emit(mapToSample(d));
      };

      api.StartEyeTracking();
      active = true;
    },

    stop() {
      if (!active) return;
      window.GazeCloudAPI?.StopEyeTracking();
      active = false;
    },

    isActive: () => active,

    onSample(cb) {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },

    needsCalibration: () => lastState === 1,

    async startCalibration() {
      // GazeCloud runs its own calibration when StartEyeTracking is called
      // User clicks on calibration targets in their UI
      await this.start();
    },
  };
}
