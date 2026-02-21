/**
 * Slow Blink Training – validates and trains users to perform intentional slow blinks
 * (400–2000ms) for attention detection and hands-free control.
 *
 * Features:
 * - Real eye detection via camera + useVisionEngine (primary)
 * - Tap-and-hold fallback for accessibility / no camera
 * - Retry failed intervals with adaptive tolerance
 * - Practice mode for specific intervals
 * - Personalized optimal range (optimalMinMs, optimalMaxMs) for calibration
 */
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, EyeOff, Check, X, Clock, Target, Camera, Hand, RotateCcw } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVisionEngine } from '@/hooks/useVisionEngine';
import {
  loadRemoteControlSettings,
  loadCalibrationData,
  applyCalibration,
} from '@/hooks/useBlinkRemoteControl';
import { cn } from '@/lib/utils';

export interface SlowBlinkResult {
  intervals: {
    targetDuration: number;
    actualDuration: number;
    accuracy: number;
    completed: boolean;
    attempt: number;
  }[];
  averageAccuracy: number;
  /** Personalized range (ms) derived from successful blinks for calibration */
  optimalMinMs: number;
  optimalMaxMs: number;
  completedAt: string;
  /** Whether real eye detection was used (vs tap-and-hold) */
  usedRealEyes: boolean;
}

/** Derive slow blink calibration thresholds from training result */
export function deriveSlowBlinkCalibration(result: SlowBlinkResult): { slowBlinkMinMs: number; slowBlinkMaxMs: number } {
  const successful = result.intervals.filter((r) => r.completed);
  if (successful.length === 0) {
    return { slowBlinkMinMs: 400, slowBlinkMaxMs: 2000 };
  }
  const durationsMs = successful.map((r) => r.actualDuration * 1000);
  const minActual = Math.min(...durationsMs);
  const maxActual = Math.max(...durationsMs);
  return {
    slowBlinkMinMs: Math.max(350, Math.floor(minActual * 0.85)),
    slowBlinkMaxMs: Math.min(2500, Math.ceil(maxActual * 1.15)),
  };
}

interface SlowBlinkTrainingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: SlowBlinkResult) => void;
  onSkip?: () => void;
}

// Training intervals from 0.5s to 2s
const TRAINING_INTERVALS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const MAX_RETRIES_PER_INTERVAL = 2;
const CLOSED_THRESHOLD = 0.50;
const OPEN_THRESHOLD = 0.80;
const MIN_SLOW_BLINK_MS = 350;
const MAX_SLOW_BLINK_MS = 2500;
const MAX_RULER_TIME = 2.5;

type TrainingStep = 'intro' | 'camera-check' | 'training' | 'complete';
type DetectionMode = 'eyes' | 'tap';

export const SlowBlinkTraining: React.FC<SlowBlinkTrainingProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
}) => {
  const [step, setStep] = useState<TrainingStep>('intro');
  const [detectionMode, setDetectionMode] = useState<DetectionMode | null>(null);
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'starting' | 'ready' | 'error'>('idle');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [currentIntervalIndex, setCurrentIntervalIndex] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkStartTime, setBlinkStartTime] = useState<number | null>(null);
  const [blinkDuration, setBlinkDuration] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [results, setResults] = useState<SlowBlinkResult['intervals']>([]);
  const [countdown, setCountdown] = useState(3);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [rulerPosition, setRulerPosition] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rulerAnimationRef = useRef<number | null>(null);
  const slowBlinkStateRef = useRef<{ isClosed: boolean; closedAt: number }>({ isClosed: false, closedAt: 0 });
  const visionRef = useRef<{ eyeOpenness: number; hasFace: boolean }>({ eyeOpenness: 1, hasFace: false });
  const eyeCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const blinkStartTimeRef = useRef<number | null>(null);

  const { light, medium, success, error } = useHapticFeedback();

  const vision = useVisionEngine({
    enabled: isOpen && cameraStatus === 'ready' && detectionMode === 'eyes',
    videoRef,
    mirrorX: true,
    driverPriority: true,
    visionBackend: loadRemoteControlSettings().visionBackend ?? 'face_mesh',
    blinkConfig: { calibrationMode: true },
    minDetectionConfidence: 0.4,
    minTrackingConfidence: 0.4,
  });

  visionRef.current = { eyeOpenness: vision.eyeOpenness, hasFace: vision.hasFace };

  // Notify RC to suspend vision (this component owns the camera) and broadcast
  // visionEngineSample so useEyeTracking receives attention data during calibration.
  useEffect(() => {
    if (!isOpen) return;
    try {
      window.dispatchEvent(new CustomEvent('calibrationMode', { detail: { active: true } }));
    } catch {
      // ignore
    }
    return () => {
      try {
        window.dispatchEvent(new CustomEvent('calibrationMode', { detail: { active: false } }));
      } catch {
        // ignore
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || cameraStatus !== 'ready' || detectionMode !== 'eyes') return;
    if (!vision.hasFace && !vision.gazePosition) return;

    const calibration = loadCalibrationData();
    const calibratedGazePosition =
      vision.gazePosition && calibration?.isCalibrated
        ? applyCalibration(vision.gazePosition.x, vision.gazePosition.y, calibration)
        : vision.gazePosition ?? null;

    try {
      window.dispatchEvent(
        new CustomEvent('visionEngineSample', {
          detail: {
            hasFace: vision.hasFace,
            eyeEAR: vision.eyeEAR,
            eyeOpenness: vision.eyeOpenness,
            gazePosition: vision.gazePosition,
            calibratedGazePosition,
            headYaw: vision.headYaw,
            headPitch: vision.headPitch,
            timestamp: Date.now(),
            source: 'calibration' as const,
          },
        })
      );
    } catch {
      // ignore
    }
  }, [
    isOpen,
    cameraStatus,
    detectionMode,
    vision.hasFace,
    vision.eyeEAR,
    vision.eyeOpenness,
    vision.gazePosition,
    vision.headYaw,
    vision.headPitch,
  ]);

  const currentInterval = TRAINING_INTERVALS[currentIntervalIndex];

  // Audio context
  useEffect(() => {
    if (isOpen && !audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
  }, [isOpen]);

  const playBeep = useCallback((frequency: number = 800, duration: number = 100) => {
    if (!audioContextRef.current) return;
    const osc = audioContextRef.current.createOscillator();
    const gain = audioContextRef.current.createGain();
    osc.connect(gain);
    gain.connect(audioContextRef.current.destination);
    osc.frequency.value = frequency;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);
    osc.start(audioContextRef.current.currentTime);
    osc.stop(audioContextRef.current.currentTime + duration / 1000);
  }, []);

  const playTick = useCallback(() => playBeep(600, 50), [playBeep]);
  const playResultSound = useCallback(
    (isSuccess: boolean) => {
      if (isSuccess) {
        playBeep(880, 150);
        setTimeout(() => playBeep(1100, 150), 150);
      } else {
        playBeep(300, 300);
      }
    },
    [playBeep]
  );

  // Animate ruler during blink (uses ref for eyes mode so it works before state updates)
  const animateRuler = useCallback(() => {
    const start = blinkStartTimeRef.current ?? blinkStartTime;
    if (!start) return;
    const elapsed = (Date.now() - start) / 1000;
    const position = Math.min(elapsed / MAX_RULER_TIME, 1);
    setRulerPosition(position);
    setBlinkDuration(elapsed);

    const tickInterval = 0.25;
    const currentTick = Math.floor(elapsed / tickInterval);
    const prevTick = Math.floor((elapsed - 0.016) / tickInterval);
    if (currentTick > prevTick && elapsed < MAX_RULER_TIME) {
      playTick();
      light();
    }

    if (elapsed < MAX_RULER_TIME && (blinkStartTimeRef.current ?? blinkStartTime)) {
      rulerAnimationRef.current = requestAnimationFrame(animateRuler);
    }
  }, [blinkStartTime, playTick, light]);

  const startCountdown = useCallback(() => {
    setIsCountingDown(true);
    setCountdown(3);
    const iv = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(iv);
          setIsCountingDown(false);
          return 0;
        }
        playBeep(600, 100);
        light();
        return prev - 1;
      });
    }, 1000);
  }, [playBeep, light]);

  // Process blink result and advance or retry
  const processBlinkResult = useCallback(
    (duration: number) => {
      const targetDuration = currentInterval;
      const difference = Math.abs(duration - targetDuration);
      const tolerance = Math.max(0.2, 0.35 - retryCount * 0.05);
      const maxAllowedDiff = targetDuration * tolerance;
      const accuracy = Math.max(0, 1 - difference / maxAllowedDiff) * 100;
      const isSuccess = accuracy >= 50;

      const newResult = {
        targetDuration,
        actualDuration: duration,
        accuracy,
        completed: isSuccess,
        attempt: retryCount + 1,
      };
      setResults((prev) => [...prev, newResult]);
      setFeedbackType(isSuccess ? 'success' : 'error');
      setShowFeedback(true);
      playResultSound(isSuccess);
      if (isSuccess) success();
      else error();

      setTimeout(() => {
        setShowFeedback(false);
        setBlinkStartTime(null);
        setRulerPosition(0);
        setRetryCount(0);

        if (isSuccess) {
          if (currentIntervalIndex < TRAINING_INTERVALS.length - 1) {
            setCurrentIntervalIndex((prev) => prev + 1);
            startCountdown();
          } else {
            setStep('complete');
          }
        } else if (retryCount < MAX_RETRIES_PER_INTERVAL) {
          setRetryCount((prev) => prev + 1);
          setResults((prev) => prev.slice(0, -1));
          startCountdown();
        } else {
          if (currentIntervalIndex < TRAINING_INTERVALS.length - 1) {
            setCurrentIntervalIndex((prev) => prev + 1);
            startCountdown();
          } else {
            setStep('complete');
          }
        }
      }, 1500);
    },
    [
      currentInterval,
      currentIntervalIndex,
      retryCount,
      playResultSound,
      success,
      error,
      startCountdown,
    ]
  );

  // Tap-and-hold handlers
  const handleBlinkStart = useCallback(() => {
    if (isCountingDown || showFeedback) return;
    const now = Date.now();
    blinkStartTimeRef.current = now;
    setIsBlinking(true);
    setBlinkStartTime(now);
    setRulerPosition(0);
    playBeep(1000, 100);
    medium();
    rulerAnimationRef.current = requestAnimationFrame(animateRuler);
  }, [isCountingDown, showFeedback, playBeep, medium, animateRuler]);

  const handleBlinkEnd = useCallback(() => {
    const start = blinkStartTimeRef.current ?? blinkStartTime;
    if (!isBlinking || !start) return;
    if (rulerAnimationRef.current) cancelAnimationFrame(rulerAnimationRef.current);
    blinkStartTimeRef.current = null;
    const duration = (Date.now() - start) / 1000;
    setIsBlinking(false);
    setBlinkDuration(duration);
    processBlinkResult(duration);
  }, [isBlinking, blinkStartTime, processBlinkResult]);

  // Real eye detection loop (runs when training with camera)
  useEffect(() => {
    if (step !== 'training' || detectionMode !== 'eyes' || isCountingDown || showFeedback) {
      return;
    }

    eyeCheckIntervalRef.current = setInterval(() => {
      const { eyeOpenness } = visionRef.current;
      const now = Date.now();

      if (eyeOpenness < CLOSED_THRESHOLD && !slowBlinkStateRef.current.isClosed) {
        const closedAt = now;
        slowBlinkStateRef.current = { isClosed: true, closedAt };
        blinkStartTimeRef.current = closedAt;
        setIsBlinking(true);
        setBlinkStartTime(closedAt);
        setRulerPosition(0);
        setBlinkDuration(0);
        playBeep(1000, 100);
        medium();
        rulerAnimationRef.current = requestAnimationFrame(animateRuler);
      } else if (eyeOpenness > OPEN_THRESHOLD && slowBlinkStateRef.current.isClosed) {
        const duration = now - slowBlinkStateRef.current.closedAt;
        slowBlinkStateRef.current = { isClosed: false, closedAt: 0 };
        blinkStartTimeRef.current = null;
        if (rulerAnimationRef.current) cancelAnimationFrame(rulerAnimationRef.current);

        if (duration >= MIN_SLOW_BLINK_MS && duration <= MAX_SLOW_BLINK_MS) {
          setIsBlinking(false);
          setBlinkDuration(duration / 1000);
          processBlinkResult(duration / 1000);
        } else {
          setIsBlinking(false);
        }
      }
    }, 60);

    return () => {
      if (eyeCheckIntervalRef.current) {
        clearInterval(eyeCheckIntervalRef.current);
        eyeCheckIntervalRef.current = null;
      }
    };
  }, [step, detectionMode, isCountingDown, showFeedback, processBlinkResult, playBeep, medium, animateRuler]);

  const startTrainingWithMode = useCallback(
    (mode: DetectionMode) => {
      setDetectionMode(mode);
      if (mode === 'eyes') {
        setStep('camera-check');
        setCameraStatus('starting');
      } else {
        setStep('training');
        setCurrentIntervalIndex(0);
        setResults([]);
        setRetryCount(0);
        startCountdown();
      }
    },
    [startCountdown]
  );

  const startCamera = useCallback(async () => {
    setCameraError(null);
    if (streamRef.current && videoRef.current?.srcObject) {
      setCameraStatus('ready');
      return true;
    }

    const attempts: MediaStreamConstraints[] = [
      {
        audio: false,
        video: {
          facingMode: { ideal: 'user' },
          width: { ideal: 320 },
          height: { ideal: 240 },
        },
      },
      { audio: false, video: { facingMode: 'user' } },
      { audio: false, video: true },
    ];

    for (const c of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(c);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.playsInline = true;
          videoRef.current.autoplay = true;
          videoRef.current.srcObject = stream;
          await new Promise<void>((res) => {
            const v = videoRef.current!;
            const onData = () => {
              v.removeEventListener('loadeddata', onData);
              res();
            };
            v.addEventListener('loadeddata', onData);
            setTimeout(() => res(), 3000);
          });
          try {
            await videoRef.current.play();
          } catch {
            /* */
          }
        }
        setCameraStatus('ready');
        return true;
      } catch (err) {
        setCameraError(err instanceof Error ? err.message : 'Camera access failed');
      }
    }
    setCameraStatus('error');
    return false;
  }, []);

  useEffect(() => {
    if (step === 'camera-check' && cameraStatus === 'starting') {
      startCamera();
    }
  }, [step, cameraStatus, startCamera]);

  useEffect(() => {
    if (step === 'camera-check' && cameraStatus === 'ready') {
      setStep('training');
      setCurrentIntervalIndex(0);
      setResults([]);
      setRetryCount(0);
      startCountdown();
    }
  }, [step, cameraStatus, startCountdown]);

  const handleComplete = useCallback(() => {
    const avgAccuracy =
      results.length > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / results.length : 0;
    const successful = results.filter((r) => r.completed);
    const durationsMs = successful.map((r) => r.actualDuration * 1000);
    const optimalMinMs =
      durationsMs.length > 0 ? Math.max(350, Math.floor(Math.min(...durationsMs) * 0.85)) : 400;
    const optimalMaxMs =
      durationsMs.length > 0 ? Math.min(2500, Math.ceil(Math.max(...durationsMs) * 1.15)) : 2000;

    onComplete({
      intervals: results,
      averageAccuracy: avgAccuracy,
      optimalMinMs,
      optimalMaxMs,
      completedAt: new Date().toISOString(),
      usedRealEyes: detectionMode === 'eyes',
    });
  }, [results, onComplete, detectionMode]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      try {
        (videoRef.current as HTMLVideoElement & { srcObject: MediaStream | null }).srcObject = null;
      } catch {
        /* */
      }
    }
    setCameraStatus('idle');
  }, []);

  useEffect(() => {
    return () => {
      if (rulerAnimationRef.current) cancelAnimationFrame(rulerAnimationRef.current);
      if (eyeCheckIntervalRef.current) clearInterval(eyeCheckIntervalRef.current);
      stopCamera();
    };
  }, [stopCamera]);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      setDetectionMode(null);
      setCameraStatus('idle');
      setCameraError(null);
    }
  }, [isOpen, stopCamera]);

  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setCurrentIntervalIndex(0);
      setResults([]);
      setRetryCount(0);
      setIsBlinking(false);
      setBlinkStartTime(null);
      setShowFeedback(false);
      slowBlinkStateRef.current = { isClosed: false, closedAt: 0 };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const renderRuler = () => {
    const numTicks = 10;
    return (
      <div className="relative h-16 bg-muted/30 rounded-lg border border-border overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/30 to-primary/50 transition-all duration-75"
          style={{ width: `${rulerPosition * 100}%` }}
        />
        <div
          className="absolute inset-y-0 bg-primary/20 border-x-2 border-primary"
          style={{
            left: `${((currentInterval - 0.15) / MAX_RULER_TIME) * 100}%`,
            width: `${(0.3 / MAX_RULER_TIME) * 100}%`,
          }}
        />
        <div className="absolute bottom-0 left-0 right-0 px-2 flex justify-between">
          {Array.from({ length: numTicks + 1 }).map((_, i) => {
            const time = (i / numTicks) * MAX_RULER_TIME;
            const isTarget = Math.abs(time - currentInterval) < 0.02;
            const isMajor = time % 0.5 === 0;
            return (
              <div
                key={i}
                className="absolute flex flex-col items-center"
                style={{ left: `${(i / numTicks) * 100}%`, transform: 'translateX(-50%)' }}
              >
                <div
                  className={cn(
                    'w-0.5',
                    isMajor ? 'h-4' : 'h-2',
                    isTarget ? 'bg-primary' : 'bg-muted-foreground/50'
                  )}
                />
                {isMajor && (
                  <span
                    className={cn(
                      'text-xs mt-1',
                      isTarget ? 'text-primary font-bold' : 'text-muted-foreground'
                    )}
                  >
                    {time}s
                  </span>
                )}
                {isTarget && (
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                    <Target className="w-4 h-4 text-primary animate-pulse" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
        {isBlinking && (
          <div
            className="absolute top-0 bottom-8 w-1 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
            style={{ left: `${rulerPosition * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
    );
  };

  // Intro: choose mode
  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Clock className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Slow Blink Training</h2>
              <p className="text-muted-foreground">
                Learn to control your blink duration for attention detection and hands-free control
              </p>
            </div>
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground">How it works</h3>
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <Eye className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Close your eyes and hold for the target duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Match intervals from 0.5s to 2s with the timing ruler</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Retry failed intervals up to {MAX_RETRIES_PER_INTERVAL} times each</span>
                </li>
              </ul>
            </div>
            <div className="space-y-3">
              <p className="text-sm font-medium text-foreground">Choose detection mode</p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 flex flex-col gap-2 h-auto py-4"
                  onClick={() => startTrainingWithMode('eyes')}
                >
                  <Camera className="w-6 h-6" />
                  <span>Camera (real eyes)</span>
                  <span className="text-xs text-muted-foreground">Recommended</span>
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 flex flex-col gap-2 h-auto py-4"
                  onClick={() => startTrainingWithMode('tap')}
                >
                  <Hand className="w-6 h-6" />
                  <span>Tap & Hold</span>
                  <span className="text-xs text-muted-foreground">Accessibility</span>
                </Button>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={onSkip || onClose} className="flex-1">
                Skip
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Camera check (starting / error)
  if (step === 'camera-check') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            {cameraStatus === 'starting' && (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-primary/20 animate-pulse flex items-center justify-center">
                  <Camera className="w-10 h-10 text-primary" />
                </div>
                <p className="text-muted-foreground">Starting camera...</p>
                <p className="text-sm text-muted-foreground">Position your face in frame</p>
              </>
            )}
            {cameraStatus === 'error' && (
              <>
                <div className="w-20 h-20 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-10 h-10 text-red-500" />
                </div>
                <p className="text-destructive font-medium">Camera unavailable</p>
                <p className="text-sm text-muted-foreground">{cameraError || 'Could not access camera'}</p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => startTrainingWithMode('tap')}>
                    Use Tap & Hold instead
                  </Button>
                  <Button onClick={() => setStep('intro')}>Back</Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  // Complete
  if (step === 'complete') {
    const avgAccuracy =
      results.length > 0 ? results.reduce((s, r) => s + r.accuracy, 0) / results.length : 0;
    const successfulCount = results.filter((r) => r.completed).length;

    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Training Complete!</h2>
              <p className="text-muted-foreground">
                Score: <span className="text-primary font-bold">{successfulCount}/{results.length}</span> passed
                {' · '}
                Avg accuracy: <span className="text-primary font-bold">{Math.round(avgAccuracy)}%</span>
              </p>
              {detectionMode === 'eyes' && (
                <p className="text-xs text-muted-foreground mt-1">
                  Your personalized slow-blink range has been saved
                </p>
              )}
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {results.map((r, i) => (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between p-3 rounded-lg',
                    r.completed ? 'bg-green-500/10' : 'bg-red-500/10'
                  )}
                >
                  <div className="flex items-center gap-2">
                    {r.completed ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-foreground">Target: {r.targetDuration}s</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {r.actualDuration.toFixed(2)}s ({Math.round(r.accuracy)}%)
                  </div>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setStep('training');
                  setCurrentIntervalIndex(0);
                  setResults([]);
                  setRetryCount(0);
                  startCountdown();
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Practice Again
              </Button>
              <Button onClick={handleComplete} className="flex-1">
                Continue
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Training view
  const showTapButton = detectionMode === 'tap';
  const showEyesHint = detectionMode === 'eyes';

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4 overflow-auto">
      <Card className="p-6 w-full max-w-md border-primary/20">
        <div className="space-y-6">
          {detectionMode === 'eyes' && (
            <div className="relative rounded-lg overflow-hidden bg-black aspect-video max-h-32">
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                playsInline
                muted
                style={{ transform: 'scaleX(-1)' }}
              />
              <div className="absolute bottom-1 left-2 right-2 flex items-center gap-2">
                <div
                  className={cn(
                    'flex-1 h-2 rounded-full overflow-hidden',
                    vision.hasFace ? 'bg-muted' : 'bg-red-500/50'
                  )}
                >
                  <div
                    className={cn(
                      'h-full transition-all duration-75',
                      vision.eyeOpenness < CLOSED_THRESHOLD ? 'bg-primary' : 'bg-primary/50'
                    )}
                    style={{ width: `${(1 - vision.eyeOpenness) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {vision.hasFace ? 'Eyes' : 'No face'}
                </span>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Slow Blink Training</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentIntervalIndex + 1} / {TRAINING_INTERVALS.length}
              {retryCount > 0 && (
                <span className="ml-1 text-amber-600">(retry {retryCount})</span>
              )}
            </span>
          </div>

          <div className="flex justify-center gap-2">
            {TRAINING_INTERVALS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  'w-2 h-2 rounded-full transition-colors',
                  i < currentIntervalIndex ? 'bg-green-500' : i === currentIntervalIndex ? 'bg-primary' : 'bg-muted'
                )}
              />
            ))}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Target Duration</p>
            <div className="text-5xl font-bold text-primary">{currentInterval}s</div>
          </div>

          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Timing Ruler</p>
            {renderRuler()}
          </div>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">Current Duration</p>
            <div
              className={cn(
                'text-3xl font-mono font-bold',
                isBlinking ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {blinkDuration.toFixed(2)}s
            </div>
          </div>

          {isCountingDown ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">{countdown}</span>
              </div>
              <p className="text-sm text-muted-foreground">Get ready...</p>
            </div>
          ) : showFeedback ? (
            <div
              className={cn(
                'flex flex-col items-center gap-4 p-6 rounded-xl',
                feedbackType === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
              )}
            >
              {feedbackType === 'success' ? (
                <>
                  <Check className="w-12 h-12 text-green-500" />
                  <p className="text-lg font-semibold text-green-500">Perfect!</p>
                </>
              ) : (
                <>
                  <X className="w-12 h-12 text-red-500" />
                  <p className="text-lg font-semibold text-red-500">
                    {blinkDuration < currentInterval ? 'Too short!' : 'Too long!'}
                  </p>
                  {retryCount < MAX_RETRIES_PER_INTERVAL && (
                    <p className="text-sm text-muted-foreground">Try again</p>
                  )}
                </>
              )}
            </div>
          ) : showTapButton ? (
            <button
              className={cn(
                'w-full aspect-square max-w-[200px] mx-auto rounded-full transition-all duration-150 flex flex-col items-center justify-center',
                isBlinking
                  ? 'bg-primary scale-95 shadow-[0_0_30px_hsl(var(--primary)/0.5)]'
                  : 'bg-muted hover:bg-muted/80'
              )}
              onMouseDown={handleBlinkStart}
              onMouseUp={handleBlinkEnd}
              onMouseLeave={isBlinking ? handleBlinkEnd : undefined}
              onTouchStart={handleBlinkStart}
              onTouchEnd={handleBlinkEnd}
            >
              {isBlinking ? (
                <>
                  <EyeOff className="w-12 h-12 text-primary-foreground mb-2" />
                  <span className="text-sm text-primary-foreground">Eyes Closed</span>
                </>
              ) : (
                <>
                  <Eye className="w-12 h-12 text-muted-foreground mb-2" />
                  <span className="text-sm text-muted-foreground">Press & Hold</span>
                </>
              )}
            </button>
          ) : showEyesHint ? (
            <div className="flex flex-col items-center gap-4 p-6 rounded-xl bg-muted/50 border border-border">
              <Eye className="w-12 h-12 text-primary" />
              <p className="text-center text-muted-foreground">
                Close your eyes and hold for <strong>{currentInterval}s</strong>
              </p>
              <p className="text-xs text-muted-foreground">
                Keep both eyes gently closed until you hear the result
              </p>
            </div>
          ) : null}

          <Button variant="ghost" onClick={onSkip || onClose} className="w-full text-muted-foreground">
            Skip Training
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SlowBlinkTraining;
