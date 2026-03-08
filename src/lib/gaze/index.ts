/**
 * Pluggable gaze backends for eye-tracking and remote control.
 *
 * - mediapipe: Default, client-side, face + gaze + blink (useVisionEngine)
 * - gazecloud: Higher accuracy, server-side processing, requires domain registration
 * - webgazer: Client-side, self-calibration from clicks, fallback option
 * - tobii_ws: Local WebSocket bridge for Tobii streams
 */
export type { GazeSample, GazeBackend, GazeProvider } from './types';
export { createGazeCloudAdapter, loadGazeCloudScript } from './GazeCloudAdapter';
export { createWebGazerAdapter, loadWebGazer } from './WebGazerAdapter';
export { createTobiiWebSocketAdapter } from './TobiiWebSocketAdapter';
