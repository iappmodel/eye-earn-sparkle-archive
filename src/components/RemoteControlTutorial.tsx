import React, { useState, useEffect, useCallback } from 'react';
import { 
  Eye, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Target, 
  CheckCircle, ChevronRight, X, Sparkles, Zap, Hand, MousePointer
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

const TUTORIAL_SEEN_KEY = 'app_remote_control_tutorial_seen';

export const getTutorialSeen = (): boolean => {
  try {
    return localStorage.getItem(TUTORIAL_SEEN_KEY) === 'true';
  } catch {
    return false;
  }
};

export const setTutorialSeen = (seen: boolean) => {
  localStorage.setItem(TUTORIAL_SEEN_KEY, String(seen));
};

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  animation?: string;
  highlight?: 'gaze' | 'blink' | 'combo' | 'settings';
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Remote Control',
    description: 'Control the app hands-free using just your eyes and blinks. This tutorial will guide you through the setup.',
    icon: <Eye className="w-12 h-12 text-primary" />,
    animation: 'animate-pulse',
  },
  {
    id: 'camera',
    title: 'Camera Access',
    description: "We'll use your front camera to track your eye movements and detect blinks. Your privacy is protected - all processing happens on your device.",
    icon: <Target className="w-12 h-12 text-primary" />,
    highlight: 'gaze',
  },
  {
    id: 'gaze-tracking',
    title: 'Gaze Tracking',
    description: 'Look at any button on the screen and stare for a moment. The button will glow to show it\'s selected and ready for your command.',
    icon: (
      <div className="relative">
        <div className="w-16 h-16 rounded-full border-4 border-primary/30 flex items-center justify-center">
          <div className="w-8 h-8 rounded-full bg-primary/20 animate-ping" />
          <Target className="w-6 h-6 text-primary absolute" />
        </div>
      </div>
    ),
    highlight: 'gaze',
  },
  {
    id: 'blink-commands',
    title: 'Blink Commands',
    description: 'Once a button is highlighted, blink to execute commands:\n• 1 blink = Tap\n• 2 blinks = Long press\n• 3 blinks = Toggle',
    icon: (
      <div className="flex items-center gap-2">
        {[1, 2, 3].map((count) => (
          <div key={count} className="flex flex-col items-center gap-1">
            <div className="flex gap-0.5">
              {Array.from({ length: count }).map((_, i) => (
                <Eye key={i} className="w-5 h-5 text-primary" />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{count}×</span>
          </div>
        ))}
      </div>
    ),
    highlight: 'blink',
  },
  {
    id: 'gaze-navigation',
    title: 'Gaze Navigation',
    description: 'Quickly look to the edges of the screen to navigate:\n• Look left → Friends feed\n• Look right → Promo feed\n• Look up → Previous video\n• Look down → Next video',
    icon: (
      <div className="relative w-20 h-20">
        <ArrowUp className="absolute top-0 left-1/2 -translate-x-1/2 w-5 h-5 text-primary animate-bounce" />
        <ArrowDown className="absolute bottom-0 left-1/2 -translate-x-1/2 w-5 h-5 text-primary animate-bounce" />
        <ArrowLeft className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-pulse" />
        <ArrowRight className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-5 text-primary animate-pulse" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 rounded-full border-2 border-muted" />
        </div>
      </div>
    ),
    highlight: 'gaze',
  },
  {
    id: 'gesture-combos',
    title: 'Gesture Combos',
    description: 'Combine gaze and blinks for powerful shortcuts:\n• Look right + 2 blinks = Like\n• Look left + 2 blinks = Share\n• Look up + 3 blinks = Save',
    icon: (
      <div className="flex items-center gap-2">
        <ArrowRight className="w-6 h-6 text-primary" />
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <div className="flex gap-0.5">
          <Eye className="w-5 h-5 text-primary" />
          <Eye className="w-5 h-5 text-primary" />
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
        <Zap className="w-6 h-6 text-amber-500" />
      </div>
    ),
    highlight: 'combo',
  },
  {
    id: 'calibration',
    title: 'Calibration',
    description: 'For best accuracy, calibrate the system by looking at the corners of your screen. You can recalibrate anytime from settings.',
    icon: (
      <div className="relative w-20 h-20 border-2 border-dashed border-muted rounded-lg">
        <div className="absolute -top-1 -left-1 w-3 h-3 rounded-full bg-primary animate-ping" />
        <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-muted" />
        <div className="absolute -bottom-1 -left-1 w-3 h-3 rounded-full bg-muted" />
        <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-muted" />
      </div>
    ),
    highlight: 'settings',
  },
  {
    id: 'ready',
    title: "You're Ready!",
    description: 'The Remote Control is now set up. Tap the remote control button in the sidebar to activate it anytime. Enjoy hands-free browsing!',
    icon: <Sparkles className="w-12 h-12 text-amber-500" />,
    animation: 'animate-bounce',
  },
];

interface RemoteControlTutorialProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export const RemoteControlTutorial: React.FC<RemoteControlTutorialProps> = ({
  isOpen,
  onClose,
  onComplete,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const haptics = useHapticFeedback();

  const step = TUTORIAL_STEPS[currentStep];
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const handleNext = useCallback(() => {
    haptics.light();
    setIsAnimating(true);
    
    setTimeout(() => {
      if (isLastStep) {
        setTutorialSeen(true);
        onComplete();
      } else {
        setCurrentStep(prev => prev + 1);
      }
      setIsAnimating(false);
    }, 200);
  }, [isLastStep, onComplete, haptics]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      haptics.light();
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(prev => prev - 1);
        setIsAnimating(false);
      }, 200);
    }
  }, [currentStep, haptics]);

  const handleSkip = useCallback(() => {
    setTutorialSeen(true);
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStep(0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[300] bg-background/98 backdrop-blur-md flex items-center justify-center p-4">
      {/* Close button */}
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4"
        onClick={handleSkip}
      >
        <X className="w-5 h-5" />
      </Button>

      {/* Progress bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-muted">
        <div 
          className="h-full bg-primary transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step indicators */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
        {TUTORIAL_STEPS.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setIsAnimating(true);
              setTimeout(() => {
                setCurrentStep(i);
                setIsAnimating(false);
              }, 200);
            }}
            className={cn(
              'w-2 h-2 rounded-full transition-all',
              i === currentStep 
                ? 'w-6 bg-primary' 
                : i < currentStep 
                  ? 'bg-primary/50' 
                  : 'bg-muted'
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div 
        className={cn(
          'max-w-md w-full text-center space-y-6 transition-all duration-200',
          isAnimating && 'opacity-0 scale-95'
        )}
      >
        {/* Icon */}
        <div className={cn(
          'flex justify-center',
          step.animation
        )}>
          {step.icon}
        </div>

        {/* Text */}
        <div className="space-y-3">
          <h2 className="text-2xl font-bold">{step.title}</h2>
          <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Demo animation based on highlight */}
        {step.highlight === 'gaze' && (
          <div className="flex justify-center py-4">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-muted flex items-center justify-center">
                <Hand className="w-8 h-8 text-muted-foreground" />
              </div>
              <div 
                className="absolute -inset-2 rounded-2xl border-2 border-primary animate-pulse opacity-40"
                style={{ 
                  boxShadow: '0 0 20px hsl(var(--primary) / 0.3)'
                }}
              />
              <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-xs text-primary font-medium">
                👁 Staring...
              </div>
            </div>
          </div>
        )}

        {step.highlight === 'blink' && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <Eye className="w-6 h-6 text-primary" />
                <span className="text-xs">Tap</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex gap-0.5">
                  <Eye className="w-5 h-5 text-primary" />
                  <Eye className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs">Long Press</span>
              </div>
              <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
                <div className="flex gap-0.5">
                  <Eye className="w-4 h-4 text-primary" />
                  <Eye className="w-4 h-4 text-primary" />
                  <Eye className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xs">Toggle</span>
              </div>
            </div>
          </div>
        )}

        {step.highlight === 'combo' && (
          <div className="flex justify-center py-4">
            <div className="flex items-center gap-2 px-4 py-3 rounded-full bg-muted/50">
              <ArrowRight className="w-5 h-5 text-primary" />
              <span className="text-muted-foreground">+</span>
              <div className="flex gap-0.5">
                <Eye className="w-4 h-4 text-primary" />
                <Eye className="w-4 h-4 text-primary" />
              </div>
              <span className="text-muted-foreground">=</span>
              <span className="text-sm font-medium">❤️ Like</span>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex items-center gap-3 pt-4">
          {currentStep > 0 ? (
            <Button
              variant="outline"
              onClick={handlePrev}
              className="flex-1"
            >
              Back
            </Button>
          ) : (
            <Button
              variant="ghost"
              onClick={handleSkip}
              className="flex-1 text-muted-foreground"
            >
              Skip Tutorial
            </Button>
          )}
          
          <Button
            onClick={handleNext}
            className="flex-1"
          >
            {isLastStep ? (
              <>
                <CheckCircle className="w-4 h-4 mr-2" />
                Get Started
              </>
            ) : (
              <>
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Keyboard hint */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-xs text-muted-foreground">
        Use arrow keys or tap to navigate
      </div>
    </div>
  );
};

// Hook to check if tutorial should show
export const useRemoteControlTutorial = () => {
  const [shouldShow, setShouldShow] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const seen = getTutorialSeen();
    setShouldShow(!seen);
  }, []);

  const openTutorial = useCallback(() => {
    setIsOpen(true);
  }, []);

  const closeTutorial = useCallback(() => {
    setIsOpen(false);
  }, []);

  const completeTutorial = useCallback(() => {
    setTutorialSeen(true);
    setIsOpen(false);
    setShouldShow(false);
  }, []);

  const resetTutorial = useCallback(() => {
    setTutorialSeen(false);
    setShouldShow(true);
  }, []);

  return {
    shouldShowTutorial: shouldShow,
    isTutorialOpen: isOpen,
    openTutorial,
    closeTutorial,
    completeTutorial,
    resetTutorial,
  };
};
