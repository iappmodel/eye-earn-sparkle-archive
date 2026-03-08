/**
 * Bridges alternate gaze backends (GazeCloud, WebGazer, Tobii WS) to visionEngineSample.
 *
 * When gazeBackend is gazecloud/webgazer/tobii_ws and RC is off, this hook starts the
 * adapter on cameraUserStart and forwards samples as visionEngineSample events.
 * useEyeTracking and useBlinkRemoteControl consume these.
 *
 * Used only when RC is OFF – when RC is on, MediaPipe provides gaze.
 */
import { useEffect, useRef } from 'react';
import { loadRemoteControlSettings } from './useBlinkRemoteControl';
import { createGazeCloudAdapter } from '@/lib/gaze/GazeCloudAdapter';
import { createWebGazerAdapter } from '@/lib/gaze/WebGazerAdapter';
import { createTobiiWebSocketAdapter } from '@/lib/gaze/TobiiWebSocketAdapter';
import type { GazeSample } from '@/lib/gaze/types';

export function useGazeBackendBridge() {
  const adapterRef = useRef<
    ReturnType<typeof createGazeCloudAdapter> |
    ReturnType<typeof createWebGazerAdapter> |
    ReturnType<typeof createTobiiWebSocketAdapter> |
    null
  >(null);
  const unsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const emitTobiiStatus = (
      status: 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected',
      message?: string
    ) => {
      try {
        window.dispatchEvent(
          new CustomEvent('tobiiWsBridgeStatus', {
            detail: { status, message, timestamp: Date.now() },
          })
        );
      } catch {
        // ignore
      }
    };

    let activeBackend: 'gazecloud' | 'webgazer' | 'tobii_ws' | null = null;

    const stopAdapter = () => {
      if (activeBackend === 'tobii_ws') {
        emitTobiiStatus('disconnected', 'Bridge stopped');
      }
      if (unsubRef.current) {
        unsubRef.current();
        unsubRef.current = null;
      }
      if (adapterRef.current) {
        adapterRef.current.stop();
        adapterRef.current = null;
      }
      activeBackend = null;
    };

    const startAdapter = () => {
      const settings = loadRemoteControlSettings();
      const gazeBackend = settings.gazeBackend ?? 'mediapipe';
      if (settings.enabled) return; // RC has its own camera
      if (gazeBackend === 'mediapipe') {
        emitTobiiStatus('idle', 'MediaPipe selected');
        stopAdapter();
        return;
      }
      if (adapterRef.current?.isActive?.()) return;

      let adapter:
        | ReturnType<typeof createGazeCloudAdapter>
        | ReturnType<typeof createWebGazerAdapter>
        | ReturnType<typeof createTobiiWebSocketAdapter>;
      if (gazeBackend === 'gazecloud') {
        adapter = createGazeCloudAdapter();
      } else if (gazeBackend === 'webgazer') {
        adapter = createWebGazerAdapter();
      } else {
        emitTobiiStatus('connecting', settings.tobiiWsUrl ?? 'ws://127.0.0.1:8765');
        adapter = createTobiiWebSocketAdapter(settings.tobiiWsUrl ?? 'ws://127.0.0.1:8765');
      }
      adapterRef.current = adapter;
      activeBackend = gazeBackend;

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

      adapter.start().then(() => {
        if (gazeBackend === 'tobii_ws') {
          emitTobiiStatus('connected', settings.tobiiWsUrl ?? 'ws://127.0.0.1:8765');
        }
      }).catch((error) => {
        // Adapter failed (e.g. WS not running, GazeCloud domain not registered)
        if (gazeBackend === 'tobii_ws') {
          const message = error instanceof Error ? error.message : 'Unknown bridge error';
          emitTobiiStatus('error', message);
        }
        if (unsubRef.current) {
          unsubRef.current();
          unsubRef.current = null;
        }
        adapterRef.current = null;
        activeBackend = null;
      });
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
      if (s.enabled) {
        stopAdapter();
        emitTobiiStatus('idle', 'Remote Control camera is active');
      } else {
        stopAdapter();
        if ((s.gazeBackend ?? 'mediapipe') !== 'tobii_ws') {
          emitTobiiStatus('idle', 'Tobii WS not selected');
        }
        startAdapter();
      }
    };

    const onTobiiWsTest = () => {
      const s = loadRemoteControlSettings();
      if (s.enabled) {
        emitTobiiStatus('idle', 'Disable Remote Control camera to test WS bridge');
        return;
      }
      if ((s.gazeBackend ?? 'mediapipe') !== 'tobii_ws') {
        emitTobiiStatus('idle', 'Select Tobii WS backend first');
        return;
      }
      stopAdapter();
      startAdapter();
    };

    window.addEventListener('cameraUserStart', onCameraStart);
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('remoteControlSettingsChanged', onSettingsChange);
    window.addEventListener('tobiiWsBridgeTest', onTobiiWsTest);

    return () => {
      window.removeEventListener('cameraUserStart', onCameraStart);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('remoteControlSettingsChanged', onSettingsChange);
      window.removeEventListener('tobiiWsBridgeTest', onTobiiWsTest);
      stopAdapter();
    };
  }, []);
}
