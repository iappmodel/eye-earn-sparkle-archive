import { useState, useEffect, useRef, useCallback } from 'react';

interface BlinkState {
  isDetecting: boolean;
  blinkCount: number;
  lastBlinkTime: number | null;
  eyeOpenness: number; // 0-1, where 0 is closed, 1 is fully open
}

interface BlinkPattern {
  count: number;
  timestamp: number;
}

interface UseBlinkDetectionOptions {
  enabled?: boolean;
  blinkThreshold?: number; // Brightness change threshold to detect blink
  blinkCooldown?: number; // Minimum ms between blinks
  patternTimeout?: number; // Ms to wait before finalizing blink pattern
  onBlink?: () => void;
  onBlinkPattern?: (count: number) => void;
}

export function useBlinkDetection(options: UseBlinkDetectionOptions = {}) {
  const {
    enabled = false,
    blinkThreshold = 0.25,
    blinkCooldown = 150,
    patternTimeout = 600,
    onBlink,
    onBlinkPattern,
  } = options;

  const [state, setState] = useState<BlinkState>({
    isDetecting: false,
    blinkCount: 0,
    lastBlinkTime: null,
    eyeOpenness: 1,
  });

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const detectionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Blink detection state
  const baselineRef = useRef<number | null>(null);
  const eyeOpennessHistoryRef = useRef<number[]>([]);
  const blinkPatternRef = useRef<BlinkPattern>({ count: 0, timestamp: 0 });
  const patternTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastBlinkTimeRef = useRef<number>(0);
  const wasClosedRef = useRef(false);
  
  // Callback refs
  const onBlinkRef = useRef(onBlink);
  const onBlinkPatternRef = useRef(onBlinkPattern);
  
  useEffect(() => {
    onBlinkRef.current = onBlink;
  }, [onBlink]);
  
  useEffect(() => {
    onBlinkPatternRef.current = onBlinkPattern;
  }, [onBlinkPattern]);

  const calculateEyeRegionBrightness = useCallback((imageData: ImageData): number => {
    const data = imageData.data;
    let totalBrightness = 0;
    let pixelCount = 0;
    
    // Focus on upper portion where eyes typically are
    const startY = Math.floor(imageData.height * 0.15);
    const endY = Math.floor(imageData.height * 0.45);
    const startX = Math.floor(imageData.width * 0.2);
    const endX = Math.floor(imageData.width * 0.8);
    
    for (let y = startY; y < endY; y++) {
      for (let x = startX; x < endX; x++) {
        const i = (y * imageData.width + x) * 4;
        // Luminance formula
        const brightness = (data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114) / 255;
        totalBrightness += brightness;
        pixelCount++;
      }
    }
    
    return pixelCount > 0 ? totalBrightness / pixelCount : 0.5;
  }, []);

  const detectBlink = useCallback((currentBrightness: number) => {
    const now = Date.now();
    
    // Add to history for smoothing
    eyeOpennessHistoryRef.current.push(currentBrightness);
    if (eyeOpennessHistoryRef.current.length > 5) {
      eyeOpennessHistoryRef.current.shift();
    }
    
    // Calculate smoothed brightness
    const smoothedBrightness = eyeOpennessHistoryRef.current.reduce((a, b) => a + b, 0) 
      / eyeOpennessHistoryRef.current.length;
    
    // Initialize baseline
    if (baselineRef.current === null) {
      baselineRef.current = smoothedBrightness;
      return;
    }
    
    // Update baseline slowly (adapt to lighting changes)
    baselineRef.current = baselineRef.current * 0.99 + smoothedBrightness * 0.01;
    
    // Calculate eye openness relative to baseline
    const deviation = (baselineRef.current - smoothedBrightness) / baselineRef.current;
    const eyeOpenness = Math.max(0, Math.min(1, 1 - deviation * 3));
    
    // Detect blink: significant brightness drop followed by recovery
    const isClosed = deviation > blinkThreshold;
    
    if (isClosed && !wasClosedRef.current) {
      // Eyes just closed
      wasClosedRef.current = true;
    } else if (!isClosed && wasClosedRef.current) {
      // Eyes just opened - this is a blink!
      wasClosedRef.current = false;
      
      if (now - lastBlinkTimeRef.current > blinkCooldown) {
        lastBlinkTimeRef.current = now;
        
        // Increment blink pattern count
        blinkPatternRef.current.count++;
        blinkPatternRef.current.timestamp = now;
        
        console.log('[BlinkDetection] Blink detected! Pattern count:', blinkPatternRef.current.count);
        
        onBlinkRef.current?.();
        
        setState(prev => ({
          ...prev,
          blinkCount: prev.blinkCount + 1,
          lastBlinkTime: now,
        }));
        
        // Reset pattern timeout
        if (patternTimeoutRef.current) {
          clearTimeout(patternTimeoutRef.current);
        }
        
        // Set timeout to finalize pattern
        patternTimeoutRef.current = setTimeout(() => {
          if (blinkPatternRef.current.count > 0) {
            console.log('[BlinkDetection] Pattern complete:', blinkPatternRef.current.count, 'blinks');
            onBlinkPatternRef.current?.(blinkPatternRef.current.count);
            blinkPatternRef.current = { count: 0, timestamp: 0 };
          }
        }, patternTimeout);
      }
    }
    
    setState(prev => ({ ...prev, eyeOpenness }));
  }, [blinkThreshold, blinkCooldown, patternTimeout]);

  const stopDetection = useCallback(() => {
    console.log('[BlinkDetection] Stopping...');
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
      detectionIntervalRef.current = null;
    }
    
    if (patternTimeoutRef.current) {
      clearTimeout(patternTimeoutRef.current);
      patternTimeoutRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }
    
    baselineRef.current = null;
    eyeOpennessHistoryRef.current = [];
    blinkPatternRef.current = { count: 0, timestamp: 0 };
    
    setState({
      isDetecting: false,
      blinkCount: 0,
      lastBlinkTime: null,
      eyeOpenness: 1,
    });
  }, []);

  const startDetection = useCallback(async () => {
    if (streamRef.current) {
      console.log('[BlinkDetection] Already detecting');
      return;
    }
    
    try {
      console.log('[BlinkDetection] Starting camera...');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 320, height: 240 }
      });
      
      streamRef.current = stream;
      
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;
      
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 240;
      canvasRef.current = canvas;
      
      await video.play();
      
      setState(prev => ({ ...prev, isDetecting: true }));
      
      console.log('[BlinkDetection] Detection started');
      
      // Detection loop - faster for blink detection
      detectionIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !canvasRef.current) return;
        
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;
        
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        const imageData = ctx.getImageData(0, 0, 320, 240);
        const brightness = calculateEyeRegionBrightness(imageData);
        
        detectBlink(brightness);
      }, 50); // 20fps for responsive blink detection
      
    } catch (error) {
      console.error('[BlinkDetection] Error:', error);
      stopDetection();
    }
  }, [calculateEyeRegionBrightness, detectBlink, stopDetection]);

  const resetBlinkCount = useCallback(() => {
    setState(prev => ({ ...prev, blinkCount: 0 }));
    blinkPatternRef.current = { count: 0, timestamp: 0 };
  }, []);

  const getCurrentPatternCount = useCallback(() => {
    return blinkPatternRef.current.count;
  }, []);

  // Auto start/stop
  const prevEnabledRef = useRef(enabled);
  
  useEffect(() => {
    const wasEnabled = prevEnabledRef.current;
    prevEnabledRef.current = enabled;
    
    if (enabled && !wasEnabled) {
      startDetection();
    } else if (!enabled && wasEnabled) {
      stopDetection();
    }
  }, [enabled, startDetection, stopDetection]);

  // Cleanup
  useEffect(() => {
    return () => {
      stopDetection();
    };
  }, [stopDetection]);

  return {
    ...state,
    startDetection,
    stopDetection,
    resetBlinkCount,
    getCurrentPatternCount,
  };
}
