import { useState, useEffect, useRef, useCallback } from 'react';

interface EyeTrackingState {
  isTracking: boolean;
  isFaceDetected: boolean;
  attentionScore: number;
  isPermissionGranted: boolean;
  error: string | null;
}

interface UseEyeTrackingOptions {
  enabled?: boolean;
  onAttentionLost?: () => void;
  onAttentionRestored?: () => void;
  requiredAttentionThreshold?: number;
}

export function useEyeTracking(options: UseEyeTrackingOptions = {}) {
  const {
    enabled = false,
    onAttentionLost,
    onAttentionRestored,
    requiredAttentionThreshold = 85,
  } = options;

  const [state, setState] = useState<EyeTrackingState>({
    isTracking: false,
    isFaceDetected: false,
    attentionScore: 0,
    isPermissionGranted: false,
    error: null,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const attentionFramesRef = useRef({ detected: 0, total: 0 });
  const wasAttentiveRef = useRef(true);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  
  // Use refs for callbacks to prevent dependency changes
  const onAttentionLostRef = useRef(onAttentionLost);
  const onAttentionRestoredRef = useRef(onAttentionRestored);
  const isInitializingRef = useRef(false);
  const isTabVisibleRef = useRef(true);

  // Update callback refs when they change
  useEffect(() => {
    onAttentionLostRef.current = onAttentionLost;
  }, [onAttentionLost]);

  useEffect(() => {
    onAttentionRestoredRef.current = onAttentionRestored;
  }, [onAttentionRestored]);

  // Track tab visibility
  const [isTabVisible, setIsTabVisible] = useState(true);

  useEffect(() => {
    const handleVisibilityChange = () => {
      const visible = document.visibilityState === 'visible';
      setIsTabVisible(visible);
      isTabVisibleRef.current = visible;
      if (!visible && wasAttentiveRef.current) {
        wasAttentiveRef.current = false;
        onAttentionLostRef.current?.();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  // Stop tracking - defined first so startTracking can reference it
  const stopTracking = useCallback(() => {
    console.log('[EyeTracking] Stopping...');
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    isInitializingRef.current = false;

    setState(prev => ({
      ...prev,
      isTracking: false,
      isFaceDetected: false,
    }));
  }, []);

  // Request camera permission and start tracking
  const startTracking = useCallback(async () => {
    // Guard against multiple simultaneous calls
    if (isInitializingRef.current || streamRef.current) {
      console.log('[EyeTracking] Already tracking or initializing, skipping...');
      return;
    }

    isInitializingRef.current = true;

    try {
      console.log('[EyeTracking] Requesting camera access...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      
      // Check if we should still be tracking (might have been disabled during async call)
      if (!isInitializingRef.current) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      
      streamRef.current = stream;

      // Create hidden video element for camera feed
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;

      // Create canvas for face detection
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvasRef.current = canvas;

      await video.play();

      setState(prev => ({
        ...prev,
        isTracking: true,
        isPermissionGranted: true,
        error: null,
      }));

      console.log('[EyeTracking] Camera started, beginning face detection...');

      // Start face detection loop using canvas analysis
      detectionIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        // Draw current frame
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        
        // Simple face detection heuristic
        const imageData = ctx.getImageData(80, 40, 160, 160);
        const data = imageData.data;
        
        let skinTonePixels = 0;
        let totalPixels = 0;
        
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          
          if (r > 60 && g > 40 && b > 20 && 
              r > g && r > b && 
              Math.abs(r - g) > 15 &&
              r - b > 15) {
            skinTonePixels++;
          }
          totalPixels++;
        }
        
        const skinRatio = skinTonePixels / totalPixels;
        const faceDetected = skinRatio > 0.15 && isTabVisibleRef.current;

        attentionFramesRef.current.total++;
        if (faceDetected) {
          attentionFramesRef.current.detected++;
        }

        const attentionScore = Math.round(
          (attentionFramesRef.current.detected / attentionFramesRef.current.total) * 100
        );

        // Check attention state changes using refs for callbacks
        if (faceDetected && !wasAttentiveRef.current) {
          wasAttentiveRef.current = true;
          onAttentionRestoredRef.current?.();
        } else if (!faceDetected && wasAttentiveRef.current) {
          wasAttentiveRef.current = false;
          onAttentionLostRef.current?.();
        }

        setState(prev => ({
          ...prev,
          isFaceDetected: faceDetected,
          attentionScore,
        }));
      }, 200);

    } catch (error) {
      console.error('[EyeTracking] Error starting:', error);
      isInitializingRef.current = false;
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Camera access denied',
        isPermissionGranted: false,
      }));
    }
  }, []);

  // Reset attention score for new content
  const resetAttention = useCallback(() => {
    attentionFramesRef.current = { detected: 0, total: 0 };
    wasAttentiveRef.current = true;
    setState(prev => ({ ...prev, attentionScore: 0 }));
  }, []);

  // Get final attention score for validation
  const getAttentionResult = useCallback(() => {
    const { detected, total } = attentionFramesRef.current;
    const score = total > 0 ? Math.round((detected / total) * 100) : 0;
    const passed = score >= requiredAttentionThreshold;
    
    console.log(`[EyeTracking] Final score: ${score}% (threshold: ${requiredAttentionThreshold}%)`);
    
    return { score, passed, framesDetected: detected, totalFrames: total };
  }, [requiredAttentionThreshold]);

  // Auto start/stop based on enabled prop - use ref to track previous enabled state
  const prevEnabledRef = useRef(enabled);
  
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;
    
    // Only act on actual changes to the enabled prop
    if (enabled && !wasEnabled) {
      startTracking();
    } else if (!enabled && wasEnabled) {
      stopTracking();
    }
  }, [enabled, startTracking, stopTracking]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isInitializingRef.current = false;
      stopTracking();
    };
  }, [stopTracking]);

  return {
    ...state,
    startTracking,
    stopTracking,
    resetAttention,
    getAttentionResult,
    isTabVisible,
  };
}
