import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Eye, EyeOff, Check, X, Clock, Target } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

export interface SlowBlinkResult {
  intervals: {
    targetDuration: number;
    actualDuration: number;
    accuracy: number;
    completed: boolean;
  }[];
  averageAccuracy: number;
  completedAt: string;
}

interface SlowBlinkTrainingProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (result: SlowBlinkResult) => void;
  onSkip?: () => void;
}

// Training intervals from 0.5s to 2s
const TRAINING_INTERVALS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

type TrainingStep = 'intro' | 'training' | 'complete';

export const SlowBlinkTraining: React.FC<SlowBlinkTrainingProps> = ({
  isOpen,
  onClose,
  onComplete,
  onSkip
}) => {
  const [step, setStep] = useState<TrainingStep>('intro');
  const [currentIntervalIndex, setCurrentIntervalIndex] = useState(0);
  const [isBlinking, setIsBlinking] = useState(false);
  const [blinkStartTime, setBlinkStartTime] = useState<number | null>(null);
  const [blinkDuration, setBlinkDuration] = useState(0);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackType, setFeedbackType] = useState<'success' | 'error'>('success');
  const [results, setResults] = useState<SlowBlinkResult['intervals']>([]);
  const [countdown, setCountdown] = useState(3);
  const [isCountingDown, setIsCountingDown] = useState(false);
  const [rulerPosition, setRulerPosition] = useState(0);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const blinkTimerRef = useRef<NodeJS.Timeout | null>(null);
  const rulerAnimationRef = useRef<number | null>(null);
  
  const { light, medium, success, error } = useHapticFeedback();

  const currentInterval = TRAINING_INTERVALS[currentIntervalIndex];

  // Initialize audio context
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

  // Play beep sound
  const playBeep = useCallback((frequency: number = 800, duration: number = 100) => {
    if (!audioContextRef.current) return;
    
    const oscillator = audioContextRef.current.createOscillator();
    const gainNode = audioContextRef.current.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContextRef.current.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(0.3, audioContextRef.current.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContextRef.current.currentTime + duration / 1000);
    
    oscillator.start(audioContextRef.current.currentTime);
    oscillator.stop(audioContextRef.current.currentTime + duration / 1000);
  }, []);

  // Play tick sound for ruler
  const playTick = useCallback(() => {
    playBeep(600, 50);
  }, [playBeep]);

  // Play success/error sound
  const playResultSound = useCallback((isSuccess: boolean) => {
    if (isSuccess) {
      playBeep(880, 150);
      setTimeout(() => playBeep(1100, 150), 150);
    } else {
      playBeep(300, 300);
    }
  }, [playBeep]);

  // Animate ruler position during blink
  const animateRuler = useCallback(() => {
    if (!blinkStartTime) return;
    
    const elapsed = (Date.now() - blinkStartTime) / 1000;
    const maxTime = 2.5; // Max ruler display time
    const position = Math.min(elapsed / maxTime, 1);
    
    setRulerPosition(position);
    setBlinkDuration(elapsed);
    
    // Play tick at each 0.25s interval
    const tickInterval = 0.25;
    const currentTick = Math.floor(elapsed / tickInterval);
    const prevTick = Math.floor((elapsed - 0.016) / tickInterval);
    if (currentTick > prevTick && elapsed < maxTime) {
      playTick();
      light();
    }
    
    if (isBlinking && elapsed < maxTime) {
      rulerAnimationRef.current = requestAnimationFrame(animateRuler);
    }
  }, [blinkStartTime, isBlinking, playTick, light]);

  // Start blink detection
  const handleBlinkStart = useCallback(() => {
    if (isCountingDown || showFeedback) return;
    
    setIsBlinking(true);
    setBlinkStartTime(Date.now());
    setRulerPosition(0);
    playBeep(1000, 100);
    medium();
    
    rulerAnimationRef.current = requestAnimationFrame(animateRuler);
  }, [isCountingDown, showFeedback, playBeep, medium, animateRuler]);

  // End blink detection
  const handleBlinkEnd = useCallback(() => {
    if (!isBlinking || !blinkStartTime) return;
    
    if (rulerAnimationRef.current) {
      cancelAnimationFrame(rulerAnimationRef.current);
    }
    
    const duration = (Date.now() - blinkStartTime) / 1000;
    setIsBlinking(false);
    setBlinkDuration(duration);
    
    // Calculate accuracy (how close to target)
    const targetDuration = currentInterval;
    const difference = Math.abs(duration - targetDuration);
    const maxAllowedDiff = targetDuration * 0.3; // 30% tolerance
    const accuracy = Math.max(0, 1 - (difference / maxAllowedDiff)) * 100;
    const isSuccess = accuracy >= 50;
    
    // Record result
    const newResult = {
      targetDuration,
      actualDuration: duration,
      accuracy,
      completed: isSuccess
    };
    setResults(prev => [...prev, newResult]);
    
    // Show feedback
    setFeedbackType(isSuccess ? 'success' : 'error');
    setShowFeedback(true);
    playResultSound(isSuccess);
    
    if (isSuccess) {
      success();
    } else {
      error();
    }
    
    // Move to next interval after feedback
    setTimeout(() => {
      setShowFeedback(false);
      setBlinkStartTime(null);
      setRulerPosition(0);
      
      if (currentIntervalIndex < TRAINING_INTERVALS.length - 1) {
        setCurrentIntervalIndex(prev => prev + 1);
        startCountdown();
      } else {
        setStep('complete');
      }
    }, 1500);
  }, [isBlinking, blinkStartTime, currentInterval, currentIntervalIndex, playResultSound, success, error]);

  // Start countdown before each interval
  const startCountdown = useCallback(() => {
    setIsCountingDown(true);
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          setIsCountingDown(false);
          return 0;
        }
        playBeep(600, 100);
        light();
        return prev - 1;
      });
    }, 1000);
  }, [playBeep, light]);

  // Start training
  const startTraining = useCallback(() => {
    setStep('training');
    setCurrentIntervalIndex(0);
    setResults([]);
    startCountdown();
  }, [startCountdown]);

  // Complete training
  const handleComplete = useCallback(() => {
    const averageAccuracy = results.length > 0
      ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length
      : 0;
    
    onComplete({
      intervals: results,
      averageAccuracy,
      completedAt: new Date().toISOString()
    });
  }, [results, onComplete]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (blinkTimerRef.current) {
        clearTimeout(blinkTimerRef.current);
      }
      if (rulerAnimationRef.current) {
        cancelAnimationFrame(rulerAnimationRef.current);
      }
    };
  }, []);

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setStep('intro');
      setCurrentIntervalIndex(0);
      setResults([]);
      setIsBlinking(false);
      setBlinkStartTime(null);
      setShowFeedback(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Render ruler graphic
  const renderRuler = () => {
    const tickMarks = [];
    const numTicks = 10; // 0 to 2.5s with 0.25s intervals
    
    for (let i = 0; i <= numTicks; i++) {
      const time = i * 0.25;
      const isTarget = Math.abs(time - currentInterval) < 0.01;
      const isMajor = time % 0.5 === 0;
      
      tickMarks.push(
        <div
          key={i}
          className="absolute flex flex-col items-center"
          style={{ left: `${(i / numTicks) * 100}%`, transform: 'translateX(-50%)' }}
        >
          <div 
            className={`w-0.5 ${isMajor ? 'h-4' : 'h-2'} ${
              isTarget ? 'bg-primary' : 'bg-muted-foreground/50'
            }`}
          />
          {isMajor && (
            <span className={`text-xs mt-1 ${isTarget ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
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
    }
    
    return (
      <div className="relative h-16 bg-muted/30 rounded-lg border border-border overflow-hidden">
        {/* Progress fill */}
        <div 
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary/30 to-primary/50 transition-all duration-75"
          style={{ width: `${rulerPosition * 100}%` }}
        />
        
        {/* Target zone indicator */}
        <div 
          className="absolute inset-y-0 bg-primary/20 border-x-2 border-primary"
          style={{ 
            left: `${((currentInterval - 0.15) / 2.5) * 100}%`,
            width: `${(0.3 / 2.5) * 100}%`
          }}
        />
        
        {/* Tick marks */}
        <div className="absolute bottom-0 left-0 right-0 px-2">
          {tickMarks}
        </div>
        
        {/* Current position indicator */}
        {isBlinking && (
          <div 
            className="absolute top-0 bottom-8 w-1 bg-primary shadow-[0_0_10px_hsl(var(--primary))]"
            style={{ left: `${rulerPosition * 100}%`, transform: 'translateX(-50%)' }}
          />
        )}
      </div>
    );
  };

  if (step === 'intro') {
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
              <Clock className="w-10 h-10 text-primary" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Slow Blink Training
              </h2>
              <p className="text-muted-foreground">
                Learn to control your blink duration for attention detection
              </p>
            </div>
            
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-foreground">How it works:</h3>
              <ul className="text-sm text-muted-foreground space-y-2 text-left">
                <li className="flex items-start gap-2">
                  <Eye className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Close your eyes and hold for the target duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <Target className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>The ruler shows your target time with beeps</span>
                </li>
                <li className="flex items-start gap-2">
                  <Clock className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <span>Practice intervals from 0.5s to 2s</span>
                </li>
              </ul>
            </div>
            
            <div className="text-sm text-muted-foreground">
              <p>Tap and hold to simulate closing your eyes</p>
              <p className="text-primary font-semibold mt-1">
                {TRAINING_INTERVALS.length} intervals to complete
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button variant="outline" onClick={onSkip || onClose} className="flex-1">
                Skip
              </Button>
              <Button onClick={startTraining} className="flex-1">
                <Eye className="w-4 h-4 mr-2" />
                Start Training
              </Button>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  if (step === 'complete') {
    const avgAccuracy = results.length > 0
      ? results.reduce((sum, r) => sum + r.accuracy, 0) / results.length
      : 0;
    
    return (
      <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <Card className="p-6 w-full max-w-md border-primary/20">
          <div className="text-center space-y-6">
            <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-green-500/20 to-emerald-500/20 flex items-center justify-center">
              <Check className="w-10 h-10 text-green-500" />
            </div>
            
            <div>
              <h2 className="text-2xl font-bold text-foreground mb-2">
                Training Complete!
              </h2>
              <p className="text-muted-foreground">
                Average Accuracy: <span className="text-primary font-bold">{Math.round(avgAccuracy)}%</span>
              </p>
            </div>
            
            <div className="space-y-2">
              {results.map((result, index) => (
                <div 
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    result.completed ? 'bg-green-500/10' : 'bg-red-500/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {result.completed ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <X className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm text-foreground">
                      Target: {result.targetDuration}s
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Actual: {result.actualDuration.toFixed(2)}s ({Math.round(result.accuracy)}%)
                  </div>
                </div>
              ))}
            </div>
            
            <Button onClick={handleComplete} className="w-full">
              Continue
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[200] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="p-6 w-full max-w-md border-primary/20">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              <span className="font-semibold text-foreground">Slow Blink Training</span>
            </div>
            <span className="text-sm text-muted-foreground">
              {currentIntervalIndex + 1} / {TRAINING_INTERVALS.length}
            </span>
          </div>
          
          {/* Progress dots */}
          <div className="flex justify-center gap-2">
            {TRAINING_INTERVALS.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index < currentIntervalIndex
                    ? 'bg-green-500'
                    : index === currentIntervalIndex
                    ? 'bg-primary'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
          
          {/* Target display */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">Target Duration</p>
            <div className="text-5xl font-bold text-primary">
              {currentInterval}s
            </div>
          </div>
          
          {/* Ruler graphic */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground text-center">Timing Ruler</p>
            {renderRuler()}
          </div>
          
          {/* Current duration display */}
          <div className="text-center">
            <p className="text-sm text-muted-foreground">Current Duration</p>
            <div className={`text-3xl font-mono font-bold ${
              isBlinking ? 'text-primary' : 'text-muted-foreground'
            }`}>
              {blinkDuration.toFixed(2)}s
            </div>
          </div>
          
          {/* Countdown or Blink button */}
          {isCountingDown ? (
            <div className="flex flex-col items-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-4xl font-bold text-primary">{countdown}</span>
              </div>
              <p className="text-sm text-muted-foreground">Get ready...</p>
            </div>
          ) : showFeedback ? (
            <div className={`flex flex-col items-center gap-4 p-6 rounded-xl ${
              feedbackType === 'success' ? 'bg-green-500/20' : 'bg-red-500/20'
            }`}>
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
                </>
              )}
            </div>
          ) : (
            <button
              className={`w-full aspect-square max-w-[200px] mx-auto rounded-full transition-all duration-150 flex flex-col items-center justify-center ${
                isBlinking 
                  ? 'bg-primary scale-95 shadow-[0_0_30px_hsl(var(--primary)/0.5)]' 
                  : 'bg-muted hover:bg-muted/80'
              }`}
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
                  <span className="text-sm text-muted-foreground">
                    Press & Hold
                  </span>
                </>
              )}
            </button>
          )}
          
          {/* Skip button */}
          <Button 
            variant="ghost" 
            onClick={onSkip || onClose} 
            className="w-full text-muted-foreground"
          >
            Skip Training
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default SlowBlinkTraining;
