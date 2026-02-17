/**
 * VisionContext – single camera provider for eye-tracking and remote control.
 * Owns camera lifecycle and useVisionEngine; consumers request camera and receive visionState.
 */
import React, {
  createContext,
  useContext,
  useRef,
  useCallback,
  useState,
  useEffect,
  useMemo,
} from 'react';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import { loadRemoteControlSettings } from '@/hooks/useBlinkRemoteControl';
import { logger } from '@/lib/logger';
import { analyzeSkinToneFrame } from '@/lib/skinToneFallback';
import type { VisionState } from '@/hooks/useVisionEngine';

const VISION_FALLBACK_MS = 5000;

/** Feature flag: when false, consumers use legacy camera (for rollback). */
export const USE_VISION_CONTEXT = true;

export interface VisionBlinkHandlers {
  onBlink?: () => void;
  onBlinkPattern?: (count: number) => void;
  onLeftWink?: () => void;
  onRightWink?: () => void;
}

export interface VisionContextValue {
  /** Current vision state (hasFace, eyeEAR, gazePosition, etc.) */
  visionState: VisionState;
  /** Ref to the video element (for calibration UI that needs to draw) */
  videoRef: React.RefObject<HTMLVideoElement | null>;
  /** Whether the camera is currently active */
  isActive: boolean;
  /** Request camera – call when this consumer needs vision. Returns release function. */
  requestCamera: () => () => void;
  /** Start camera (from user gesture). Called by cameraUserStart / remoteControlUserStart. */
  startCamera: () => Promise<void>;
  /** Stop camera – called when no consumers need it (internal). */
  stopCamera: () => void;
  /** True when getUserMedia failed due to missing user gesture (iOS) */
  needsUserGesture: boolean;
  /** Clear needsUserGesture after successful start */
  clearNeedsUserGesture: () => void;
  /** Register blink handlers (e.g. from Remote Control). Call with undefined to clear. */
  registerBlinkHandlers: (handlers: VisionBlinkHandlers | null) => void;
}

const VisionContext = createContext<VisionContextValue | null>(null);

export function useVision(): VisionContextValue | null {
  return useContext(VisionContext);
}

interface VisionProviderProps {
  children: React.ReactNode;
}

export function VisionProvider({ children }: VisionProviderProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const requestCountRef = useRef(0);
  const [isActive, setIsActive] = useState(false);
  const [needsUserGesture, setNeedsUserGesture] = useState(false);
  const [settings, setSettings] = useState(loadRemoteControlSettings);

  const loadSettings = useCallback(() => {
    setSettings(loadRemoteControlSettings());
  }, []);

  const blinkHandlersRef = useRef<VisionBlinkHandlers | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const skinTonePrevFrameRef = useRef<{ data: Uint8ClampedArray | null }>({ data: null });
  const lastVisionFaceRef = useRef(0);
  const fallbackIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fallbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const registerBlinkHandlers = useCallback((handlers: VisionBlinkHandlers | null) => {
    blinkHandlersRef.current = handlers;
  }, []);

  const onBlink = useCallback(() => blinkHandlersRef.current?.onBlink?.(), []);
  const onBlinkPattern = useCallback((count: number) => blinkHandlersRef.current?.onBlinkPattern?.(count), []);
  const onLeftWink = useCallback(() => blinkHandlersRef.current?.onLeftWink?.(), []);
  const onRightWink = useCallback(() => blinkHandlersRef.current?.onRightWink?.(), []);

  useEffect(() => {
    loadSettings();
    const handler = () => loadSettings();
    window.addEventListener('remoteControlSettingsChanged', handler);
    return () => window.removeEventListener('remoteControlSettingsChanged', handler);
  }, [loadSettings]);

  const startCameraInternal = useCallback(async () => {
    if (streamRef.current) return;

    try {
      logger.log('[VisionContext] Starting camera...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 },
      });

      streamRef.current = stream;

      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;

      await video.play();

      setIsActive(true);
      setNeedsUserGesture(false);
      logger.log('[VisionContext] Camera started');
    } catch (error) {
      logger.error('[VisionContext] Camera error:', error);
      const err = error as Error;
      if (
        err?.name === 'NotAllowedError' ||
        err?.message?.toLowerCase().includes('permission') ||
        err?.message?.toLowerCase().includes('gesture')
      ) {
        setNeedsUserGesture(true);
      }
    }
  }, []);

  const stopCameraInternal = useCallback(() => {
    if (fallbackIntervalRef.current) {
      clearInterval(fallbackIntervalRef.current);
      fallbackIntervalRef.current = null;
    }
    if (fallbackTimeoutRef.current) {
      clearTimeout(fallbackTimeoutRef.current);
      fallbackTimeoutRef.current = null;
    }
    skinTonePrevFrameRef.current = { data: null };
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    setIsActive(false);
    logger.log('[VisionContext] Camera stopped');
  }, []);

  const requestCamera = useCallback(() => {
    requestCountRef.current += 1;
    if (requestCountRef.current === 1) {
      void startCameraInternal();
    }

    return () => {
      requestCountRef.current = Math.max(0, requestCountRef.current - 1);
      if (requestCountRef.current === 0) {
        stopCameraInternal();
      }
    };
  }, [startCameraInternal, stopCameraInternal]);

  const startCamera = useCallback(async () => {
    requestCountRef.current = Math.max(1, requestCountRef.current + 1);
    await startCameraInternal();
  }, [startCameraInternal]);

  const stopCamera = useCallback(() => {
    requestCountRef.current = 0;
    stopCameraInternal();
  }, [stopCameraInternal]);

  const clearNeedsUserGesture = useCallback(() => {
    setNeedsUserGesture(false);
  }, []);

  const vision = useVisionEngine({
    enabled: isActive && !!videoRef.current,
    videoRef,
    patternTimeout: settings.blinkPatternTimeout ?? 600,
    mirrorX: settings.mirrorX ?? true,
    invertY: settings.invertY ?? true,
    gazeScale: settings.gazeReach ?? 1.6,
    gazeSmoothing: 0.25,
    visionBackend: settings.visionBackend ?? 'face_mesh',
    onBlink,
    onBlinkPattern,
    onLeftWink,
    onRightWink,
  });

  const [fallbackState, setFallbackState] = useState<{
    hasFace: boolean;
    rawScore: number;
  } | null>(null);

  useEffect(() => {
    if (!isActive || !videoRef.current) {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      setFallbackState(null);
      skinTonePrevFrameRef.current = { data: null };
      return;
    }
    if (vision.hasFace) {
      lastVisionFaceRef.current = Date.now();
      setFallbackState(null);
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (fallbackTimeoutRef.current) {
        clearTimeout(fallbackTimeoutRef.current);
        fallbackTimeoutRef.current = null;
      }
      return;
    }
    if (lastVisionFaceRef.current === 0) lastVisionFaceRef.current = Date.now();
    const elapsed = Date.now() - lastVisionFaceRef.current;
    if (elapsed < VISION_FALLBACK_MS) {
      fallbackTimeoutRef.current = setTimeout(() => {
        fallbackTimeoutRef.current = null;
        const v = videoRef.current;
        if (!v || v.readyState < 2) return;
        if (!canvasRef.current) {
          const c = document.createElement('canvas');
          c.width = 320;
          c.height = 240;
          canvasRef.current = c;
        }
        setFallbackState({ hasFace: false, rawScore: 0 });
        fallbackIntervalRef.current = setInterval(() => {
          const video = videoRef.current;
          const canv = canvasRef.current;
          if (!video || video.readyState < 2 || !canv) return;
          const ctx = canv.getContext('2d');
          if (!ctx) return;
          ctx.drawImage(video, 0, 0, 320, 240);
          const imageData = ctx.getImageData(80, 40, 160, 160);
          const result = analyzeSkinToneFrame(imageData, skinTonePrevFrameRef);
          setFallbackState({ hasFace: result.facePresent, rawScore: result.rawScore });
        }, 200);
      }, Math.max(0, VISION_FALLBACK_MS - elapsed));
      return () => {
        if (fallbackTimeoutRef.current) {
          clearTimeout(fallbackTimeoutRef.current);
          fallbackTimeoutRef.current = null;
        }
      };
    }
    if (!canvasRef.current) {
      const c = document.createElement('canvas');
      c.width = 320;
      c.height = 240;
      canvasRef.current = c;
    }
    setFallbackState({ hasFace: false, rawScore: 0 });
    fallbackIntervalRef.current = setInterval(() => {
      const video = videoRef.current;
      const canv = canvasRef.current;
      if (!video || video.readyState < 2 || !canv) return;
      const ctx = canv.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, 320, 240);
      const imageData = ctx.getImageData(80, 40, 160, 160);
      const result = analyzeSkinToneFrame(imageData, skinTonePrevFrameRef);
      setFallbackState({ hasFace: result.facePresent, rawScore: result.rawScore });
    }, 200);
    return () => {
      if (fallbackIntervalRef.current) {
        clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      skinTonePrevFrameRef.current = { data: null };
      setFallbackState(null);
    };
  }, [isActive, vision.hasFace]);

  const mergedVision: VisionState = useMemo(() => {
    if (fallbackState) {
      return {
        ...vision,
        hasFace: fallbackState.hasFace,
        eyeEAR: fallbackState.hasFace ? 0.2 : 0,
        gazePosition: null,
        headYaw: 0,
        headPitch: 0,
      };
    }
    return vision;
  }, [vision, fallbackState]);

  useEffect(() => {
    const handler = () => {
      if (requestCountRef.current > 0) {
        void startCameraInternal();
      }
    };

    window.addEventListener('cameraUserStart', handler);
    window.addEventListener('remoteControlUserStart', handler);
    return () => {
      window.removeEventListener('cameraUserStart', handler);
      window.removeEventListener('remoteControlUserStart', handler);
    };
  }, [startCameraInternal]);

  const value = useMemo<VisionContextValue>(
    () => ({
      visionState: mergedVision,
      videoRef,
      isActive,
      requestCamera,
      startCamera,
      stopCamera,
      needsUserGesture,
      clearNeedsUserGesture,
      registerBlinkHandlers,
    }),
    [
      mergedVision,
      isActive,
      requestCamera,
      startCamera,
      stopCamera,
      needsUserGesture,
      clearNeedsUserGesture,
      registerBlinkHandlers,
    ]
  );

  return (
    <VisionContext.Provider value={value}>
      {children}
    </VisionContext.Provider>
  );
}
