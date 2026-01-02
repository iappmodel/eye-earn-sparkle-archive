import React, { useState, useEffect, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X, Hand } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';

interface GestureTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

const TUTORIAL_KEY = 'gesture_tutorial_completed';

export const useGestureTutorial = () => {
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem(TUTORIAL_KEY);
    if (!completed) {
      // Show after a short delay
      const timer = setTimeout(() => setShowTutorial(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const completeTutorial = useCallback(() => {
    localStorage.setItem(TUTORIAL_KEY, 'true');
    setShowTutorial(false);
  }, []);

  const resetTutorial = useCallback(() => {
    localStorage.removeItem(TUTORIAL_KEY);
    setShowTutorial(true);
  }, []);

  return { showTutorial, completeTutorial, resetTutorial };
};

interface GestureStepProps {
  direction: 'up' | 'down' | 'left' | 'right' | 'double-tap' | 'triple-tap';
  title: string;
  description: string;
  isActive: boolean;
}

const GestureStep = React.forwardRef<HTMLDivElement, GestureStepProps>(
  ({ direction, title, description, isActive }, ref) => {
    const getIcon = () => {
      switch (direction) {
        case 'up': return <ArrowUp className="w-8 h-8" />;
        case 'down': return <ArrowDown className="w-8 h-8" />;
        case 'left': return <ArrowLeft className="w-8 h-8" />;
        case 'right': return <ArrowRight className="w-8 h-8" />;
        case 'double-tap':
        case 'triple-tap': return <Hand className="w-8 h-8" />;
      }
    };

    const getAnimation = () => {
      switch (direction) {
        case 'up': return 'animate-bounce';
        case 'down': return 'animate-bounce [animation-direction:reverse]';
        case 'left': return 'animate-[slide-left_1s_ease-in-out_infinite]';
        case 'right': return 'animate-[slide-right_1s_ease-in-out_infinite]';
        case 'double-tap': return 'animate-[tap_0.5s_ease-in-out_infinite]';
        case 'triple-tap': return 'animate-[tap_0.3s_ease-in-out_infinite]';
      }
    };

    return (
      <div
        ref={ref}
        className={cn(
          "flex flex-col items-center text-center transition-all duration-500",
          isActive ? "opacity-100 scale-100" : "opacity-0 scale-90 pointer-events-none absolute"
        )}
      >
        <div className={cn(
          "w-20 h-20 rounded-full flex items-center justify-center mb-4",
          "bg-primary/20 border-2 border-primary",
          isActive && getAnimation()
        )}>
          <span className="text-primary">{getIcon()}</span>
        </div>
        <h3 className="text-xl font-display font-bold text-foreground mb-2">
          {title}
        </h3>
        <p className="text-muted-foreground text-sm max-w-[250px]">
          {description}
        </p>
      </div>
    );
  }
);
GestureStep.displayName = 'GestureStep';

export const GestureTutorial = React.forwardRef<HTMLDivElement, GestureTutorialProps>(
  ({ onComplete, onSkip }, ref) => {
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
      { direction: 'up' as const, title: 'Swipe Up', description: 'Go to the next video in the feed' },
      { direction: 'down' as const, title: 'Swipe Down', description: 'Go to the previous video' },
      { direction: 'left' as const, title: 'Swipe Left', description: 'Navigate to promotional content' },
      { direction: 'right' as const, title: 'Swipe Right', description: 'Navigate to friends\' posts' },
      { direction: 'double-tap' as const, title: 'Double Tap', description: 'Toggle button visibility' },
      { direction: 'triple-tap' as const, title: 'Triple Tap', description: 'Quick access to settings' },
    ];

    const handleNext = () => {
      if (currentStep < steps.length - 1) {
        setCurrentStep(prev => prev + 1);
      } else {
        onComplete();
      }
    };

    const handlePrev = () => {
      if (currentStep > 0) {
        setCurrentStep(prev => prev - 1);
      }
    };

    return (
      <div
        ref={ref}
        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col animate-fade-in"
        // Prevent this overlay from blocking pointer events when it shouldn't
        style={{ touchAction: 'manipulation' }}
      >
        {/* Skip button */}
        <div className="absolute top-4 right-4 z-10">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            <X className="w-5 h-5" />
          </Button>
        </div>

        {/* Header */}
        <div className="pt-16 pb-8 text-center">
          <h2 className="text-2xl font-display font-bold gradient-text mb-2">
            Learn the Gestures
          </h2>
          <p className="text-muted-foreground text-sm">
            Master navigation with simple swipes
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1 rounded-full transition-all duration-300",
                i === currentStep ? "w-8 bg-primary" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>

        {/* Current step */}
        <div className="flex-1 flex items-center justify-center px-6 relative">
          {steps.map((step, i) => (
            <GestureStep
              key={step.direction}
              {...step}
              isActive={i === currentStep}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="p-6 pb-12 flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={handlePrev}
            disabled={currentStep === 0}
          >
            Previous
          </Button>
          <Button
            className="flex-1"
            onClick={handleNext}
          >
            {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
          </Button>
        </div>
      </div>
    );
  }
);
GestureTutorial.displayName = 'GestureTutorial';
