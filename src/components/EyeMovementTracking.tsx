import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, ArrowUp, ArrowLeft, ArrowDown, Check, X, Volume2, VolumeX, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useAccessibility } from '@/contexts/AccessibilityContext';

// Arrow directions in order: right, up, left, down
const ARROW_DIRECTIONS = [
  { direction: 'right', icon: ArrowRight, startX: 0.2, startY: 0.5, endX: 0.8, endY: 0.5 },
  { direction: 'up', icon: ArrowUp, startX: 0.5, startY: 0.8, endX: 0.5, endY: 0.2 },
  { direction: 'left', icon: ArrowLeft, startX: 0.8, startY: 0.5, endX: 0.2, endY: 0.5 },
  { direction: 'down', icon: ArrowDown, startX: 0.5, startY: 0.2, endX: 0.5, endY: 0.8 },
];

// Speed variations: 1s, 0.6s, 0.3s
const SPEED_VARIATIONS = [
  { duration: 1000, label: 'Normal' },
  { duration: 600, label: 'Fast' },
  { duration: 300, label: 'Very Fast' },
];

const TOTAL_STEPS = ARROW_DIRECTIONS.length * SPEED_VARIATIONS.length; // 12

export interface EyeMovementResult {
  directions: Array<{
    direction: string;
    speeds: Array<{
      duration: number;
      completed: boolean;
      reactionTime?: number;
    }>;
  }>;
  completedAt: number;
  /** Total steps in this calibration (e.g. 12). */
  totalSteps?: number;
  /** Number of steps successfully completed. */
  completedSteps?: number;
  /** Total time spent in calibration (ms). */
  durationMs?: number;
}

interface EyeMovementTrackingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: EyeMovementResult) => void;
  onSkip?: () => void;
  /** Optional: called when arrow reaches destination, for future gaze-based calibration (gaze x,y normalized 0-1). */
  onGazeSample?: (direction: string, phase: 'start' | 'end', position: { x: number; y: number } | null) => void;
}

type CalibrationStep = 'intro' | 'countdown' | 'tracking' | 'complete';

export const EyeMovementTracking: React.FC<EyeMovementTrackingProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip,
  onGazeSample,
}) => {
  const haptics = useHapticFeedback();
  const { reducedMotion, highContrast } = useAccessibility();
  const [step, setStep] = useState<CalibrationStep>('intro');
  const [soundEnabled, setSoundEnabled] = useState(true);
  
  // Tracking state
  const [currentDirectionIndex, setCurrentDirectionIndex] = useState(0);
  const [currentSpeedIndex, setCurrentSpeedIndex] = useState(0);
  const [countdownValue, setCountdownValue] = useState(3);
  const [isArrowMoving, setIsArrowMoving] = useState(false);
  const [arrowPosition, setArrowPosition] = useState({ x: 0.5, y: 0.5 });
  const [trackingResults, setTrackingResults] = useState<EyeMovementResult['directions']>([]);
  const [showDestinationDot, setShowDestinationDot] = useState(false);
  
  // Refs for timeout cleanup and stable callbacks
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const moveDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveEndRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextStepRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const calibrationStartRef = useRef<number>(0);
  
  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const crescendoIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAllTimers = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    if (moveDelayRef.current) {
      clearTimeout(moveDelayRef.current);
      moveDelayRef.current = null;
    }
    if (moveEndRef.current) {
      clearTimeout(moveEndRef.current);
      moveEndRef.current = null;
    }
    if (nextStepRef.current) {
      clearTimeout(nextStepRef.current);
      nextStepRef.current = null;
    }
  }, []);

  // Play sound effects
  const playSound = useCallback((type: 'countdown' | 'beep' | 'crescendo-start' | 'crescendo-end' | 'success') => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      switch (type) {
        case 'countdown':
          oscillator.frequency.value = 440;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.2);
          break;
        case 'beep':
          oscillator.frequency.value = 880;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.4, ctx.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.15);
          break;
        case 'success':
          oscillator.frequency.value = 523.25;
          oscillator.type = 'sine';
          gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
          oscillator.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);
          oscillator.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2);
          gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
          oscillator.start(ctx.currentTime);
          oscillator.stop(ctx.currentTime + 0.4);
          break;
      }
    } catch (e) {
      console.error('Audio error:', e);
    }
  }, [soundEnabled]);

  // Play crescendo sound during arrow movement
  const playCrescendo = useCallback((duration: number) => {
    if (!soundEnabled) return;
    
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 220;
      oscillator.type = 'sine';
      
      // Crescendo: start quiet, get louder
      gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.4, ctx.currentTime + duration / 1000);
      
      // Frequency rises during movement
      oscillator.frequency.linearRampToValueAtTime(660, ctx.currentTime + duration / 1000);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + duration / 1000);
    } catch (e) {
      console.error('Crescendo audio error:', e);
    }
  }, [soundEnabled]);

  // Start countdown before each arrow movement
  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setStep('countdown');
    setCountdownValue(reducedMotion ? 1 : 3);
    const maxCount = reducedMotion ? 1 : 3;

    const countdownInterval = setInterval(() => {
      setCountdownValue(prev => {
        if (prev <= 1) {
          if (countdownIntervalRef.current) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          setStep('tracking');
          return 0;
        }
        if (!reducedMotion) {
          playSound('countdown');
          haptics.light();
        }
        return prev - 1;
      });
    }, reducedMotion ? 500 : 1000);
    countdownIntervalRef.current = countdownInterval;

    if (!reducedMotion) {
      playSound('countdown');
      haptics.light();
    }
  }, [playSound, haptics, reducedMotion]);

  // Move arrow animation (direction/speed from state at call time; next-step uses same indices)
  const moveArrow = useCallback(() => {
    const dirIndex = Math.min(currentDirectionIndex, ARROW_DIRECTIONS.length - 1);
    const speedIndex = Math.min(currentSpeedIndex, SPEED_VARIATIONS.length - 1);
    const direction = ARROW_DIRECTIONS[dirIndex];
    const speed = SPEED_VARIATIONS[speedIndex];

    if (!direction || !speed) {
      setStep('complete');
      return;
    }

    const duration = reducedMotion ? Math.max(400, speed.duration * 0.6) : speed.duration;

    setArrowPosition({ x: direction.startX, y: direction.startY });
    setShowDestinationDot(true);
    onGazeSample?.(direction.direction, 'start', null);

    moveDelayRef.current = setTimeout(() => {
      moveDelayRef.current = null;
      setIsArrowMoving(true);
      if (!reducedMotion) playCrescendo(duration);
      setArrowPosition({ x: direction.endX, y: direction.endY });

      moveEndRef.current = setTimeout(() => {
        moveEndRef.current = null;
        setIsArrowMoving(false);
        setShowDestinationDot(false);
        playSound('beep');
        haptics.success();
        onGazeSample?.(direction.direction, 'end', null);

        setTrackingResults(prev => {
          const directionResults = prev.find(d => d.direction === direction.direction);
          const speedResult = {
            duration: speed.duration,
            completed: true,
            reactionTime: duration,
          };
          if (directionResults) {
            return prev.map(d =>
              d.direction === direction.direction
                ? { ...d, speeds: [...d.speeds, speedResult] }
                : d
            );
          }
          return [...prev, { direction: direction.direction, speeds: [speedResult] }];
        });

        nextStepRef.current = setTimeout(() => {
          nextStepRef.current = null;
          if (speedIndex < SPEED_VARIATIONS.length - 1) {
            setCurrentSpeedIndex(speedIndex + 1);
            startCountdown();
          } else if (dirIndex < ARROW_DIRECTIONS.length - 1) {
            setCurrentSpeedIndex(0);
            setCurrentDirectionIndex(dirIndex + 1);
            startCountdown();
          } else {
            playSound('success');
            setStep('complete');
          }
        }, reducedMotion ? 300 : 500);
      }, duration);
    }, reducedMotion ? 150 : 300);
  }, [currentDirectionIndex, currentSpeedIndex, playCrescendo, playSound, haptics, startCountdown, reducedMotion, onGazeSample]);

  // Handle countdown to tracking transition
  useEffect(() => {
    if (step === 'tracking' && !isArrowMoving) {
      moveArrow();
    }
  }, [step, isArrowMoving, moveArrow]);

  // Reset on close and clear any timers
  useEffect(() => {
    if (!isOpen) {
      clearAllTimers();
      setStep('intro');
      setCurrentDirectionIndex(0);
      setCurrentSpeedIndex(0);
      setCountdownValue(reducedMotion ? 1 : 3);
      setIsArrowMoving(false);
      setTrackingResults([]);
      setShowDestinationDot(false);
    }
  }, [isOpen, clearAllTimers, reducedMotion]);

  // Clear all timers on unmount
  useEffect(() => {
    return () => clearAllTimers();
  }, [clearAllTimers]);

  const handleStartCalibration = () => {
    calibrationStartRef.current = Date.now();
    startCountdown();
  };

  const handleComplete = () => {
    const completedSteps = trackingResults.reduce((acc, d) => acc + d.speeds.length, 0);
    const result: EyeMovementResult = {
      directions: trackingResults,
      completedAt: Date.now(),
      totalSteps: TOTAL_STEPS,
      completedSteps,
      durationMs: calibrationStartRef.current
        ? Date.now() - calibrationStartRef.current
        : undefined,
    };
    onComplete(result);
    onClose();
  };

  if (!isOpen) return null;

  const safeDirectionIndex = Math.min(currentDirectionIndex, ARROW_DIRECTIONS.length - 1);
  const safeSpeedIndex = Math.min(currentSpeedIndex, SPEED_VARIATIONS.length - 1);
  const currentDirection = ARROW_DIRECTIONS[safeDirectionIndex] ?? ARROW_DIRECTIONS[0];
  const currentSpeed = SPEED_VARIATIONS[safeSpeedIndex] ?? SPEED_VARIATIONS[0];
  const ArrowIcon = currentDirection?.icon || ArrowRight;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] bg-black flex flex-col"
    >
      {/* Header */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="text-white hover:bg-white/10"
        >
          <X className="w-6 h-6" />
        </Button>
        
        <div className="text-white text-sm font-medium">
          Eye Movement Tracking
        </div>
        
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setSoundEnabled(!soundEnabled)}
          className="text-white hover:bg-white/10"
        >
          {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {/* Intro Step */}
        {step === 'intro' && (
          <motion.div
            key="intro"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              animate={reducedMotion ? {} : { x: [0, 20, 0, -20, 0] }}
              transition={{ repeat: Infinity, duration: 3 }}
              className={cn(
                'w-24 h-24 rounded-full flex items-center justify-center mb-8',
                highContrast ? 'bg-primary/40 ring-2 ring-primary' : 'bg-primary/20'
              )}
            >
              <Eye className={cn('w-12 h-12', highContrast ? 'text-primary' : 'text-primary')} />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Eye Movement Tracking
            </h1>
            
            <p className="text-white/70 mb-8 max-w-sm">
              Follow the moving arrow with your eyes. The arrow will move in 4 directions, each at 3 different speeds.
            </p>
            
            <div className="space-y-4 mb-8 text-left">
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <span>Follow the arrow with your eyes</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm font-bold">3</div>
                <span>Countdown before each movement</span>
              </div>
              <div className="flex items-center gap-3 text-white/80">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold">⚡</div>
                <span>Speeds: 1s → 0.6s → 0.3s</span>
              </div>
            </div>
            
            <Button
              size="lg"
              onClick={handleStartCalibration}
              className="w-full max-w-xs"
            >
              Start Tracking
            </Button>
            
            {onSkip && (
              <Button
                variant="ghost"
                onClick={onSkip}
                className="mt-4 text-white/50"
              >
                Skip for now
              </Button>
            )}
          </motion.div>
        )}

        {/* Countdown Step */}
        {step === 'countdown' && (
          <motion.div
            key="countdown"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center"
          >
            {/* Direction indicator + overall progress */}
            <div className="absolute top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
              <div className="flex items-center gap-4">
                <div className="flex gap-1">
                  {ARROW_DIRECTIONS.map((dir, i) => (
                    <div
                      key={dir.direction}
                      className={cn(
                        'rounded-full transition-all',
                        highContrast ? 'w-3 h-3 ring-1 ring-white/50' : 'w-2 h-2',
                        i < currentDirectionIndex
                          ? 'bg-green-500'
                          : i === currentDirectionIndex
                            ? 'bg-primary scale-125'
                            : 'bg-white/30'
                      )}
                    />
                  ))}
                </div>
                <span className="text-white/70 text-sm">
                  Direction {currentDirectionIndex + 1}/4
                </span>
              </div>
              <span className="text-white/50 text-xs">
                Step {currentDirectionIndex * SPEED_VARIATIONS.length + currentSpeedIndex + 1} of {TOTAL_STEPS}
              </span>
            </div>
            
            {/* Speed indicator */}
            <div className="absolute top-32 left-1/2 -translate-x-1/2 text-white/50 text-sm">
              Speed: {currentSpeed.label} ({currentSpeed.duration / 1000}s)
            </div>

            {/* Countdown number */}
            <motion.div
              key={countdownValue}
              initial={{ scale: 2, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="text-9xl font-bold text-white"
            >
              {countdownValue}
            </motion.div>
            
            <p className="text-white/70 mt-8">
              Get ready to follow the arrow going <span className="text-primary font-bold">{currentDirection.direction}</span>
            </p>
          </motion.div>
        )}

        {/* Tracking Step */}
        {step === 'tracking' && (
          <motion.div
            key="tracking"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 relative"
          >
            {/* Progress indicators + Step X of 12 */}
            <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
              <div className="flex gap-6">
                <div className="flex gap-1">
                  {ARROW_DIRECTIONS.map((dir, i) => (
                    <div
                      key={dir.direction}
                      className={cn(
                        'rounded-full transition-all',
                        highContrast ? 'w-3.5 h-3.5 ring-1 ring-white/50' : 'w-3 h-3',
                        i < currentDirectionIndex
                          ? 'bg-green-500'
                          : i === currentDirectionIndex
                            ? 'bg-primary'
                            : 'bg-white/30'
                      )}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  {SPEED_VARIATIONS.map((speed, i) => (
                    <div
                      key={speed.duration}
                      className={cn(
                        'rounded-full transition-all',
                        highContrast ? 'w-2.5 h-2.5' : 'w-2 h-2',
                        i < currentSpeedIndex
                          ? 'bg-green-500'
                          : i === currentSpeedIndex
                            ? 'bg-amber-500'
                            : 'bg-white/30'
                      )}
                    />
                  ))}
                </div>
              </div>
              <span className="text-white/50 text-xs font-medium">
                Step {currentDirectionIndex * SPEED_VARIATIONS.length + currentSpeedIndex + 1} of {TOTAL_STEPS}
              </span>
            </div>

            {/* Destination dot */}
            {showDestinationDot && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn(
                  'absolute w-8 h-8 rounded-full border-2',
                  highContrast ? 'bg-green-500/50 border-green-400 ring-2 ring-green-400/50' : 'bg-green-500/30 border-green-500'
                )}
                style={{
                  left: `${currentDirection.endX * 100}%`,
                  top: `${currentDirection.endY * 100}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {!reducedMotion && (
                  <motion.div
                    animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                    transition={{ repeat: Infinity, duration: 0.8 }}
                    className="absolute inset-0 rounded-full border-2 border-green-500"
                  />
                )}
              </motion.div>
            )}

            {/* Moving Arrow */}
            <motion.div
              className="absolute"
              initial={false}
              animate={{
                left: `${arrowPosition.x * 100}%`,
                top: `${arrowPosition.y * 100}%`,
              }}
              transition={{
                duration: isArrowMoving ? currentSpeed.duration / 1000 : 0,
                ease: 'linear',
              }}
              style={{
                transform: 'translate(-50%, -50%)',
              }}
            >
              <motion.div
                animate={!reducedMotion && isArrowMoving ? { scale: [1, 1.2, 1] } : {}}
                transition={{ repeat: Infinity, duration: 0.3 }}
                className={cn(
                  'w-20 h-20 rounded-full border-4 flex items-center justify-center',
                  highContrast ? 'bg-primary/50 border-primary ring-2 ring-primary/50' : 'bg-primary/30 border-primary'
                )}
              >
                <ArrowIcon className="w-10 h-10 text-primary" />
              </motion.div>
            </motion.div>

            {/* Instructions */}
            <div className="absolute bottom-24 left-0 right-0 text-center px-8">
              <p className="text-white text-lg font-medium">
                {isArrowMoving ? 'Follow with your eyes!' : 'Get ready...'}
              </p>
              <p className="text-white/50 mt-2 text-sm">
                {currentDirection.direction.charAt(0).toUpperCase() + currentDirection.direction.slice(1)} • {currentSpeed.label}
              </p>
            </div>
          </motion.div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <motion.div
            key="complete"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center px-8 text-center"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-24 h-24 rounded-full bg-green-500/20 flex items-center justify-center mb-8"
            >
              <Check className="w-12 h-12 text-green-500" />
            </motion.div>
            
            <h1 className="text-2xl font-bold text-white mb-4">
              Eye Movement Calibrated!
            </h1>
            
            <p className="text-white/70 mb-8 max-w-sm">
              Your eye movement patterns have been recorded successfully. The platform can now track your gaze direction.
            </p>
            
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-2xl font-bold text-primary">4</div>
                <div className="text-xs text-white/50">Directions</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-2xl font-bold text-amber-500">
                  {trackingResults.reduce((acc, d) => acc + d.speeds.length, 0)}
                </div>
                <div className="text-xs text-white/50">Movements</div>
              </div>
              <div className="p-4 rounded-lg bg-white/5">
                <div className="text-2xl font-bold text-green-500">
                  {TOTAL_STEPS ? Math.round((trackingResults.reduce((acc, d) => acc + d.speeds.length, 0) / TOTAL_STEPS) * 100) : 100}%
                </div>
                <div className="text-xs text-white/50">Tracked</div>
              </div>
            </div>
            {calibrationStartRef.current > 0 && (
              <p className="text-white/50 text-xs mb-6">
                Calibration took {Math.round((Date.now() - calibrationStartRef.current) / 1000)}s. Behavior may vary by device and lighting.
              </p>
            )}
            
            <Button
              size="lg"
              onClick={handleComplete}
              className="w-full max-w-xs"
            >
              Continue
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default EyeMovementTracking;
