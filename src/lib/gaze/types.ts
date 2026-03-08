/**
 * Shared types for pluggable gaze providers (MediaPipe, GazeCloud, WebGazer, etc.)
 */

export interface GazeSample {
  hasFace: boolean;
  gazePosition: { x: number; y: number } | null;
  calibratedGazePosition?: { x: number; y: number } | null;
  eyeEAR?: number;
  eyeOpenness?: number;
  headYaw?: number;
  headPitch?: number;
  timestamp: number;
  /** Provider identifier for debugging */
  source: 'mediapipe' | 'gazecloud' | 'webgazer' | 'tobii_ws';
  /** GazeCloud: 0=valid, -1=face lost, 1=uncalibrated */
  state?: number;
}

export type GazeBackend = 'mediapipe' | 'gazecloud' | 'webgazer' | 'tobii_ws';

export interface GazeProvider {
  readonly backend: GazeBackend;
  start(): Promise<void>;
  stop(): void;
  isActive(): boolean;
  /** Subscribe to gaze samples. Returns unsubscribe. */
  onSample(cb: (sample: GazeSample) => void): () => void;
  /** True if calibration is required before accurate gaze */
  needsCalibration(): boolean;
  /** Start calibration flow (if supported) */
  startCalibration?(): Promise<void>;
}
