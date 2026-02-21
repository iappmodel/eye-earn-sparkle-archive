/**
 * Bridges alternate gaze backends (GazeCloud, WebGazer) to visionEngineSample.
 *
 * When gazeBackend is gazecloud or webgazer and RC is off, this hook starts the
 * adapter on cameraUserStart and forwards samples as visionEngineSample events.
 * useEyeTracking and useBlinkRemoteControl consume these.
 *
 * Used only when RC is OFF – when RC is on, MediaPipe provides gaze.
 */
import { useEffect, useRef } from 'react';
import { loadRemoteControlSettings } from './useBlinkRemoteControl';
import { createGazeCloudAdapter } from '@/lib/gaze/GazeCloudAdapter';
import { createWebGazerAdapter } from '@/lib/gaze/WebGazerAdapter';
import type { GazeSample } from '@/lib/gaze/types';

export function useGazeBackendBridge() {
  const adapterRef = useRef<ReturnType<typeof createGazeCloudAdapter> | ReturnType<typeof createWebGazerAdapter> | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const settings = loadRemoteControlSettings();
    const gazeBackend = settings.gazeBackend ?? 'mediapipe';

    if (gazeBackend === 'mediapipe') return;

    const startAdapter = () => {
      if (settings.enabled) return; // RC has its own camera
      if (adapterRef.current?.isActive?.()) return;

      let adapter: ReturnType<typeof createGazeCloudAdapter> | ReturnType<typeof createWebGazerAdapter>;
      if (gazeBackend === 'gazecloud') {
        adapter = createGazeCloudAdapter();
      } else {
        adapter = createWebGazerAdapter();
      }
      adapterRef.current = adapter;

      unsubRef.current = adapter.onSample((sample: GazeSample) => {
        try {
          window.dispatchEvent(
            new CustomEvent('visionEngineSample', {
              detail: {
                hasFace: sample.hasFace,
                eyeEAR: sample.eyeEAR ?? 0.2,
                eyeOpenness: sample.eyeOpenness ?? 1,
                gazePosition: sample.gazePosition,
                calibratedGazePosition: sample.calibratedGazePosition ?? sample.gazePosition,
                headYaw: sample.headYaw ?? 0,
                headPitch: sample.headPitch ?? 0,
                timestamp: sample.timestamp,
                source: sample.source,
              },
            })
          );
        } catch {
          // ignore
        }
      });

      adapter.start().catch(() => {
        // Adapter failed (e.g. GazeCloud domain not registered)
        adapterRef.current = null;
      });
    };

    const stopAdapter = () => {
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      if (adapterRef.current) {
        adapterRef.current.stop();
        adapterRef.current = null;
      }
    };

    const onCameraStart = () => {
      const s = loadRemoteControlSettings();
      if (s.enabled) return;
      if ((s.gazeBackend ?? 'mediapipe') !== 'mediapipe') {
        startAdapter();
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        stopAdapter();
      }
    };

    const onSettingsChange = () => {
      const s = loadRemoteControlSettings();
      if (s.enabled) stopAdapter();
    };

    window.addEventListener('cameraUserStart', onCameraStart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('remoteControlSettingsChanged', onSettingsChange);

    return () => {
      window.removeEventListener('cameraUserStart', onCameraStart);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('remoteControlSettingsChanged', onSettingsChange);
      stopAdapter();
    };
  }, []);
}
