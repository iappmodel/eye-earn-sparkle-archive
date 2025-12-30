import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Eye, Target, Sparkles, Zap } from 'lucide-react';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface FocusChallengeMiniGameProps {
  isVisible: boolean;
  onComplete: () => void;
  onDismiss: () => void;
  challengeType?: 'tap-target' | 'hold-focus' | 'quick-tap';
}

const CHALLENGE_DURATION = 3000; // 3 seconds to complete

export const FocusChallengeMiniGame: React.FC<FocusChallengeMiniGameProps> = ({
  isVisible,
  onComplete,
  onDismiss,
  challengeType: propChallengeType,
}) => {
  const [challengeType] = useState(() => 
    propChallengeType || (['tap-target', 'hold-focus', 'quick-tap'] as const)[Math.floor(Math.random() * 3)]
  );
  const [progress, setProgress] = useState(0);
  const [targetPosition, setTargetPosition] = useState({ x: 50, y: 50 });
  const [tapCount, setTapCount] = useState(0);
  const [isHolding, setIsHolding] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(CHALLENGE_DURATION / 1000);
  
  const holdIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const haptic = useHapticFeedback();

  // Random target position for tap-target challenge
  const moveTarget = useCallback(() => {
    setTargetPosition({
      x: 20 + Math.random() * 60,
      y: 30 + Math.random() * 40,
    });
  }, []);

  // Initialize challenge
  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setTapCount(0);
      setIsHolding(false);
      setIsCompleted(false);
      setTimeLeft(CHALLENGE_DURATION / 1000);
      return;
    }

    if (challengeType === 'tap-target') {
      moveTarget();
    }

    // Countdown timer
    const countdownInterval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);

    // Auto-dismiss after timeout
    timeoutRef.current = setTimeout(() => {
      if (!isCompleted) {
        onDismiss();
      }
    }, CHALLENGE_DURATION + 500);

    return () => {
      clearInterval(countdownInterval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [isVisible, challengeType, moveTarget, isCompleted, onDismiss]);

  // Handle hold progress
  useEffect(() => {
    if (challengeType !== 'hold-focus') return;
    
    if (isHolding && !isCompleted) {
      holdIntervalRef.current = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + 5;
          if (newProgress >= 100) {
            clearInterval(holdIntervalRef.current!);
            handleComplete();
            return 100;
          }
          return newProgress;
        });
      }, 50);
    } else {
      if (holdIntervalRef.current) {
        clearInterval(holdIntervalRef.current);
      }
      // Decay progress when not holding
      if (progress > 0 && !isCompleted) {
        const decayInterval = setInterval(() => {
          setProgress(prev => {
            if (prev <= 0) {
              clearInterval(decayInterval);
              return 0;
            }
            return prev - 3;
          });
        }, 50);
        return () => clearInterval(decayInterval);
      }
    }

    return () => {
      if (holdIntervalRef.current) clearInterval(holdIntervalRef.current);
    };
  }, [isHolding, challengeType, isCompleted]);

  const handleComplete = useCallback(() => {
    if (isCompleted) return;
    setIsCompleted(true);
    haptic.success();
    
    // Delay to show completion animation
    setTimeout(() => {
      onComplete();
    }, 500);
  }, [isCompleted, haptic, onComplete]);

  // Handle tap on target
  const handleTargetTap = useCallback(() => {
    haptic.light();
    if (challengeType === 'tap-target') {
      setTapCount(prev => {
        const newCount = prev + 1;
        if (newCount >= 3) {
          handleComplete();
        } else {
          moveTarget();
        }
        return newCount;
      });
    }
  }, [challengeType, moveTarget, handleComplete, haptic]);

  // Handle quick tap challenge
  const handleQuickTap = useCallback(() => {
    haptic.light();
    setTapCount(prev => {
      const newCount = prev + 1;
      const newProgress = (newCount / 10) * 100;
      setProgress(newProgress);
      
      if (newCount >= 10) {
        handleComplete();
      }
      return newCount;
    });
  }, [handleComplete, haptic]);

  if (!isVisible) return null;

  const getChallengeContent = () => {
    switch (challengeType) {
      case 'tap-target':
        return (
          <div className="relative w-full h-full">
            <p className="absolute top-8 left-1/2 -translate-x-1/2 text-lg font-medium text-foreground">
              Tap the targets! ({tapCount}/3)
            </p>
            <button
              onClick={handleTargetTap}
              className={cn(
                'absolute w-14 h-14 rounded-full transition-all duration-200',
                'bg-primary shadow-lg shadow-primary/50',
                'flex items-center justify-center',
                'hover:scale-110 active:scale-95',
                'animate-bounce'
              )}
              style={{
                left: `${targetPosition.x}%`,
                top: `${targetPosition.y}%`,
                transform: 'translate(-50%, -50%)',
              }}
            >
              <Target className="w-6 h-6 text-primary-foreground" />
            </button>
          </div>
        );

      case 'hold-focus':
        return (
          <div className="flex flex-col items-center justify-center gap-6">
            <p className="text-lg font-medium text-foreground">
              Hold to refocus
            </p>
            <button
              onPointerDown={() => setIsHolding(true)}
              onPointerUp={() => setIsHolding(false)}
              onPointerLeave={() => setIsHolding(false)}
              className={cn(
                'relative w-24 h-24 rounded-full transition-all duration-200',
                'bg-gradient-to-br from-primary/20 to-primary/40',
                'border-4 border-primary/50',
                'flex items-center justify-center',
                isHolding ? 'scale-110 border-primary' : 'scale-100',
                isCompleted && 'bg-green-500/30 border-green-500'
              )}
            >
              {/* Progress ring */}
              <svg className="absolute inset-0 w-full h-full -rotate-90">
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className={cn(
                    'transition-all duration-100',
                    isCompleted ? 'text-green-500' : 'text-primary'
                  )}
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - progress / 100)}`}
                  strokeLinecap="round"
                />
              </svg>
              <Eye className={cn(
                'w-10 h-10 transition-all',
                isHolding ? 'text-primary scale-110' : 'text-muted-foreground',
                isCompleted && 'text-green-500'
              )} />
            </button>
            <p className="text-sm text-muted-foreground">
              {isCompleted ? 'Great focus!' : 'Press and hold'}
            </p>
          </div>
        );

      case 'quick-tap':
        return (
          <div className="flex flex-col items-center justify-center gap-6">
            <p className="text-lg font-medium text-foreground">
              Quick tap! ({tapCount}/10)
            </p>
            <button
              onClick={handleQuickTap}
              disabled={isCompleted}
              className={cn(
                'relative w-20 h-20 rounded-full transition-all duration-100',
                'bg-gradient-to-br from-amber-400 to-orange-500',
                'shadow-lg shadow-orange-500/50',
                'flex items-center justify-center',
                'hover:scale-105 active:scale-90',
                isCompleted && 'bg-green-500 from-green-400 to-green-600'
              )}
            >
              <Zap className={cn(
                'w-8 h-8 text-white transition-transform',
                isHolding && 'scale-125'
              )} />
            </button>
            {/* Progress bar */}
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  'h-full transition-all duration-100 rounded-full',
                  isCompleted ? 'bg-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/90 backdrop-blur-md" />
      
      {/* Challenge container */}
      <div className="relative w-full h-full p-6">
        {/* Header */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="w-4 h-4 text-primary animate-pulse" />
          <span>Focus Challenge</span>
        </div>

        {/* Timer */}
        <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-1 rounded-full bg-muted/50">
          <span className={cn(
            'text-sm font-mono tabular-nums',
            timeLeft <= 1 ? 'text-red-500' : 'text-muted-foreground'
          )}>
            {timeLeft.toFixed(1)}s
          </span>
        </div>

        {/* Challenge content */}
        <div className="h-full flex items-center justify-center">
          {getChallengeContent()}
        </div>

        {/* Skip button */}
        {!isCompleted && (
          <button
            onClick={onDismiss}
            className="absolute bottom-6 left-1/2 -translate-x-1/2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Skip challenge
          </button>
        )}

        {/* Success overlay */}
        {isCompleted && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="text-4xl animate-bounce">🎯</div>
          </div>
        )}
      </div>
    </div>
  );
};
