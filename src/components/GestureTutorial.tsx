import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  X,
  Hand,
  Eye,
  ChevronRight,
  CheckCircle,
  Sparkles,
  Zap,
  BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { loadGestureCombos } from '@/hooks/useGestureCombos';

export const GESTURE_TUTORIAL_STORAGE_KEY = 'gesture_tutorial_completed';
export const GESTURE_TUTORIAL_SKIPPED_KEY = 'gesture_tutorial_skipped';

export interface GestureTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
  /** Called when user taps "Practice combos" – e.g. open Remote Control / Combo Guide */
  onOpenComboGuide?: () => void;
}

type StepId =
  | 'welcome'
  | 'swipe-up'
  | 'swipe-down'
  | 'swipe-left'
  | 'swipe-right'
  | 'tap-gestures'
  | 'combos'
  | 'done';

interface TutorialStep {
  id: StepId;
  title: string;
  subtitle?: string;
  /** For swipe/tap steps */
  direction?: 'up' | 'down' | 'left' | 'right' | 'double-tap' | 'triple-tap';
  description: string;
  /** Combo preview: show gaze + blink combos */
  showCombos?: boolean;
  /** Final step with CTA */
  isDone?: boolean;
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Learn the Gestures',
    subtitle: 'Navigate the app with swipes and taps',
    description: 'A quick tour of swipe navigation, tap shortcuts, and optional gaze + blink combos.',
  },
  {
    id: 'swipe-up',
    direction: 'up',
    title: 'Swipe Up',
    description: 'Go to the next video or content in the feed.',
  },
  {
    id: 'swipe-down',
    direction: 'down',
    title: 'Swipe Down',
    description: 'Go to the previous video.',
  },
  {
    id: 'swipe-left',
    direction: 'left',
    title: 'Swipe Left',
    description: 'Navigate to promotional content and discovery.',
  },
  {
    id: 'swipe-right',
    direction: 'right',
    title: 'Swipe Right',
    description: "Navigate to friends' posts and social feed.",
  },
  {
    id: 'tap-gestures',
    title: 'Double & Triple Tap',
    subtitle: 'Tap shortcuts',
    description: 'Double-tap to like or toggle button visibility. Triple-tap to open settings quickly.',
  },
  {
    id: 'combos',
    title: 'Gesture Combos',
    subtitle: 'Gaze + blinks (optional)',
    description: 'With Remote Control you can combine gaze direction and blinks for hands-free shortcuts.',
    showCombos: true,
  },
  {
    id: 'done',
    title: "You're all set",
    subtitle: 'Start exploring',
    description: 'Swipe through the feed and use double-tap to like. You can replay this tutorial anytime from Settings.',
    isDone: true,
  },
];

function StepIcon({
  direction,
  isActive,
}: {
  direction: TutorialStep['direction'];
  isActive: boolean;
}) {
  if (!direction) return null;
  const base = 'w-14 h-14 rounded-2xl flex items-center justify-center border-2 transition-all duration-300';
  const activeRing = isActive ? 'border-primary bg-primary/15 shadow-[0_0_24px_hsl(var(--primary)/0.25)]' : 'border-muted bg-muted/30';
  const getAnimation = () => {
    if (!isActive) return '';
    switch (direction) {
      case 'up':
        return 'animate-bounce';
      case 'down':
        return 'animate-bounce [animation-direction:reverse]';
      case 'left':
        return 'animate-[slide-left_1.2s_ease-in-out_infinite]';
      case 'right':
        return 'animate-[slide-right_1.2s_ease-in-out_infinite]';
      case 'double-tap':
      case 'triple-tap':
        return 'animate-[tap_0.5s_ease-in-out_infinite]';
      default:
        return '';
    }
  };
  const getIcon = () => {
    switch (direction) {
      case 'up':
        return <ArrowUp className="w-7 h-7 text-primary" />;
      case 'down':
        return <ArrowDown className="w-7 h-7 text-primary" />;
      case 'left':
        return <ArrowLeft className="w-7 h-7 text-primary" />;
      case 'right':
        return <ArrowRight className="w-7 h-7 text-primary" />;
      case 'double-tap':
      case 'triple-tap':
        return <Hand className="w-7 h-7 text-primary" />;
      default:
        return null;
    }
  };
  return (
    <div className={cn(base, activeRing, getAnimation())}>
      {getIcon()}
    </div>
  );
}

export const GestureTutorial: React.FC<GestureTutorialProps> = ({
  onComplete,
  onSkip,
  onOpenComboGuide,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const haptics = useHapticFeedback();
  const containerRef = useRef<HTMLDivElement>(null);

  const step = TUTORIAL_STEPS[currentStep];
  const isFirst = currentStep === 0;
  const isLast = currentStep === TUTORIAL_STEPS.length - 1;
  const progress = ((currentStep + 1) / TUTORIAL_STEPS.length) * 100;

  const goNext = useCallback(() => {
    haptics.light();
    setIsAnimating(true);
    setTimeout(() => {
      if (isLast) {
        onComplete();
      } else {
        setCurrentStep((prev) => Math.min(prev + 1, TUTORIAL_STEPS.length - 1));
      }
      setIsAnimating(false);
    }, 180);
  }, [isLast, onComplete, haptics]);

  const goPrev = useCallback(() => {
    if (currentStep > 0) {
      haptics.light();
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep((prev) => Math.max(0, prev - 1));
        setIsAnimating(false);
      }, 180);
    }
  }, [currentStep, haptics]);

  const handleSkip = useCallback(() => {
    haptics.light();
    onSkip();
  }, [onSkip, haptics]);

  const goToStep = useCallback(
    (index: number) => {
      if (index === currentStep) return;
      haptics.light();
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentStep(index);
        setIsAnimating(false);
      }, 180);
    },
    [currentStep, haptics]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleSkip();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, handleSkip]);

  const combos = step?.showCombos ? loadGestureCombos().filter((c) => c.enabled).slice(0, 4) : [];

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex flex-col bg-background/98 backdrop-blur-xl animate-in fade-in duration-300"
      role="dialog"
      aria-modal="true"
      aria-labelledby="gesture-tutorial-title"
      aria-describedby="gesture-tutorial-desc"
    >
      {/* Top bar: progress + skip */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSkip}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Skip tutorial"
        >
          <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Step dots */}
      <div className="flex justify-center gap-1.5 px-4 pb-4">
        {TUTORIAL_STEPS.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => goToStep(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-200',
              i === currentStep ? 'w-6 bg-primary' : i < currentStep ? 'w-1.5 bg-primary/50' : 'w-1.5 bg-muted'
            )}
            aria-label={`Go to step ${i + 1}`}
          />
        ))}
      </div>

      {/* Content */}
      <div
        className={cn(
          'flex-1 flex flex-col items-center justify-center px-6 text-center transition-all duration-200',
          isAnimating && 'opacity-0 scale-[0.98]'
        )}
      >
        {step?.id === 'welcome' && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/15 border-2 border-primary flex items-center justify-center animate-pulse">
              <Sparkles className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 id="gesture-tutorial-title" className="text-2xl font-display font-bold gradient-text mb-1">
                {step.title}
              </h2>
              {step.subtitle && (
                <p className="text-muted-foreground text-sm mb-2">{step.subtitle}</p>
              )}
              <p id="gesture-tutorial-desc" className="text-muted-foreground text-sm max-w-[280px] mx-auto">
                {step.description}
              </p>
            </div>
          </div>
        )}

        {step?.direction && step.id !== 'tap-gestures' && (
          <div className="flex flex-col items-center gap-5">
            <StepIcon direction={step.direction} isActive={true} />
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">{step.title}</h2>
              <p className="text-muted-foreground text-sm max-w-[260px] mx-auto">{step.description}</p>
            </div>
          </div>
        )}

        {step?.id === 'tap-gestures' && (
          <div className="flex flex-col items-center gap-5">
            <div className="flex gap-4">
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl border-2 border-primary bg-primary/15 flex items-center justify-center animate-[tap_0.6s_ease-in-out_infinite]">
                  <Hand className="w-7 h-7 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Double-tap</span>
              </div>
              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-2xl border-2 border-primary bg-primary/15 flex items-center justify-center animate-[tap_0.35s_ease-in-out_infinite]">
                  <Hand className="w-7 h-7 text-primary" />
                </div>
                <span className="text-xs font-medium text-muted-foreground">Triple-tap</span>
              </div>
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">{step.title}</h2>
              {step.subtitle && (
                <p className="text-muted-foreground text-xs mb-1">{step.subtitle}</p>
              )}
              <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">{step.description}</p>
            </div>
          </div>
        )}

        {step?.showCombos && (
          <div className="flex flex-col items-center gap-4 w-full max-w-[300px]">
            <div className="w-14 h-14 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 flex items-center justify-center">
              <Zap className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">{step.title}</h2>
              {step.subtitle && (
                <p className="text-muted-foreground text-xs mb-1">{step.subtitle}</p>
              )}
              <p className="text-muted-foreground text-sm mb-4">{step.description}</p>
            </div>
            {combos.length > 0 && (
              <div className="w-full space-y-2 text-left">
                {combos.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/50 border border-border/50"
                  >
                    <Eye className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1">{c.name}</span>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
            {onOpenComboGuide && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  haptics.light();
                  onOpenComboGuide();
                  goNext();
                }}
                className="w-full"
              >
                <BookOpen className="w-4 h-4 mr-2" />
                Practice combos in Remote Control
              </Button>
            )}
          </div>
        )}

        {step?.isDone && (
          <div className="flex flex-col items-center gap-4">
            <div className="w-20 h-20 rounded-2xl bg-primary/15 border-2 border-primary flex items-center justify-center">
              <CheckCircle className="w-10 h-10 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-display font-bold text-foreground mb-1">{step.title}</h2>
              {step.subtitle && (
                <p className="text-muted-foreground text-sm mb-1">{step.subtitle}</p>
              )}
              <p className="text-muted-foreground text-sm max-w-[280px] mx-auto">{step.description}</p>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="p-4 pb-6 flex gap-3">
        {!isFirst ? (
          <Button variant="outline" className="flex-1" onClick={goPrev}>
            Back
          </Button>
        ) : (
          <Button variant="ghost" className="flex-1 text-muted-foreground" onClick={handleSkip}>
            Skip
          </Button>
        )}
        <Button className="flex-1 min-w-[120px]" onClick={goNext}>
          {isLast ? (
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

      <p className="text-center text-xs text-muted-foreground pb-2">
        Use arrow keys or tap to navigate
      </p>
    </div>
  );
};
