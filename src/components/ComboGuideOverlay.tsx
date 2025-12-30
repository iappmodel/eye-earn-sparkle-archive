import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Eye, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  GestureCombo, 
  GestureStep, 
  loadGestureCombos, 
  COMBO_ACTION_LABELS 
} from '@/hooks/useGestureCombos';

interface ComboGuideOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  initialComboId?: string;
}

const ComboGuideOverlay: React.FC<ComboGuideOverlayProps> = ({
  isOpen,
  onClose,
  initialComboId,
}) => {
  const [combos, setCombos] = useState<GestureCombo[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [animationPhase, setAnimationPhase] = useState<'idle' | 'executing' | 'complete'>('idle');

  useEffect(() => {
    if (isOpen) {
      const loadedCombos = loadGestureCombos();
      setCombos(loadedCombos);
      
      if (initialComboId) {
        const index = loadedCombos.findIndex(c => c.id === initialComboId);
        if (index >= 0) setCurrentIndex(index);
      }
      
      setCurrentStepIndex(0);
      setAnimationPhase('idle');
    }
  }, [isOpen, initialComboId]);

  const currentCombo = combos[currentIndex];

  // Animation loop
  useEffect(() => {
    if (!isOpen || !isPlaying || !currentCombo) return;

    const stepDuration = 1200;
    const pauseBetweenCycles = 1500;
    
    const timer = setInterval(() => {
      setCurrentStepIndex(prev => {
        if (prev >= currentCombo.steps.length) {
          setAnimationPhase('complete');
          return 0;
        }
        setAnimationPhase('executing');
        return prev + 1;
      });
    }, stepDuration);

    return () => clearInterval(timer);
  }, [isOpen, isPlaying, currentCombo]);

  // Reset animation when changing combos
  useEffect(() => {
    setCurrentStepIndex(0);
    setAnimationPhase('idle');
  }, [currentIndex]);

  const goToPrev = () => {
    setCurrentIndex(prev => (prev - 1 + combos.length) % combos.length);
  };

  const goToNext = () => {
    setCurrentIndex(prev => (prev + 1) % combos.length);
  };

  if (!isOpen || !currentCombo) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h2 className="text-xl font-bold text-foreground">Combo Guide</h2>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsPlaying(!isPlaying)}
            >
              {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col items-center justify-center p-4 overflow-hidden">
          {/* Combo Info */}
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-foreground mb-2">
              {currentCombo.name}
            </h3>
            <p className="text-muted-foreground mb-2">{currentCombo.description}</p>
            <Badge variant={currentCombo.enabled ? "default" : "secondary"}>
              {COMBO_ACTION_LABELS[currentCombo.action]}
            </Badge>
          </div>

          {/* Animation Area */}
          <div className="relative w-64 h-64 mb-8">
            {/* Eye Container */}
            <div className="absolute inset-0 flex items-center justify-center">
              <EyeAnimation
                steps={currentCombo.steps}
                currentStepIndex={currentStepIndex}
                isPlaying={isPlaying}
              />
            </div>
          </div>

          {/* Steps Timeline */}
          <div className="w-full max-w-md">
            <div className="flex items-center justify-center gap-2 mb-4">
              {currentCombo.steps.map((step, index) => (
                <StepIndicator
                  key={index}
                  step={step}
                  index={index}
                  isActive={index < currentStepIndex}
                  isCurrent={index === currentStepIndex - 1}
                />
              ))}
            </div>
            
            {/* Current Step Description */}
            <div className="text-center h-8">
              <AnimatePresence mode="wait">
                {currentStepIndex > 0 && currentStepIndex <= currentCombo.steps.length && (
                  <motion.p
                    key={currentStepIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="text-lg font-medium text-primary"
                  >
                    {getStepDescription(currentCombo.steps[currentStepIndex - 1])}
                  </motion.p>
                )}
                {currentStepIndex === 0 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-muted-foreground"
                  >
                    Watch the demonstration...
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between p-4 border-t border-border">
          <Button variant="outline" onClick={goToPrev} className="gap-2">
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          <div className="flex items-center gap-1">
            {combos.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-2 h-2 rounded-full transition-colors ${
                  index === currentIndex 
                    ? 'bg-primary' 
                    : 'bg-muted-foreground/30 hover:bg-muted-foreground/50'
                }`}
              />
            ))}
          </div>
          
          <Button variant="outline" onClick={goToNext} className="gap-2">
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

// Eye Animation Component
interface EyeAnimationProps {
  steps: GestureStep[];
  currentStepIndex: number;
  isPlaying: boolean;
}

const EyeAnimation: React.FC<EyeAnimationProps> = ({
  steps,
  currentStepIndex,
  isPlaying,
}) => {
  const currentStep = currentStepIndex > 0 ? steps[currentStepIndex - 1] : null;
  
  // Calculate pupil position based on direction
  const getPupilPosition = () => {
    if (!currentStep || currentStep.type !== 'direction') {
      return { x: 0, y: 0 };
    }
    
    const offset = 20;
    switch (currentStep.direction) {
      case 'up': return { x: 0, y: -offset };
      case 'down': return { x: 0, y: offset };
      case 'left': return { x: -offset, y: 0 };
      case 'right': return { x: offset, y: 0 };
      default: return { x: 0, y: 0 };
    }
  };

  const isBlinking = currentStep?.type === 'blink';
  const blinkCount = isBlinking ? (currentStep as { type: 'blink'; count: number }).count : 0;
  const pupilPos = getPupilPosition();

  return (
    <div className="relative">
      {/* Glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
        animate={{
          scale: isPlaying ? [1, 1.2, 1] : 1,
          opacity: isPlaying ? [0.3, 0.5, 0.3] : 0.3,
        }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      
      {/* Eye Socket */}
      <motion.div
        className="relative w-48 h-32 bg-card border-4 border-border rounded-[50%] overflow-hidden shadow-lg"
        animate={{
          scaleY: isBlinking ? [1, 0.1, 1, 0.1, 1, 0.1, 1].slice(0, blinkCount * 2 + 1) : 1,
        }}
        transition={{
          duration: 0.8,
          times: blinkCount === 1 
            ? [0, 0.3, 1] 
            : blinkCount === 2 
              ? [0, 0.15, 0.3, 0.45, 1]
              : [0, 0.1, 0.2, 0.3, 0.4, 0.5, 1],
        }}
      >
        {/* Iris */}
        <motion.div
          className="absolute top-1/2 left-1/2 w-20 h-20 -ml-10 -mt-10 rounded-full"
          style={{
            background: 'radial-gradient(circle at 30% 30%, hsl(var(--primary)), hsl(var(--primary) / 0.7))',
          }}
          animate={{
            x: pupilPos.x,
            y: pupilPos.y,
          }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          {/* Pupil */}
          <motion.div
            className="absolute top-1/2 left-1/2 w-10 h-10 -ml-5 -mt-5 bg-foreground rounded-full"
            animate={{
              scale: isBlinking ? 0.8 : 1,
            }}
          >
            {/* Highlight */}
            <div className="absolute top-1 left-2 w-3 h-3 bg-background/80 rounded-full" />
          </motion.div>
        </motion.div>
      </motion.div>

      {/* Direction Arrows */}
      <AnimatePresence>
        {currentStep?.type === 'direction' && (
          <DirectionArrow direction={(currentStep as { type: 'direction'; direction: string }).direction} />
        )}
      </AnimatePresence>

      {/* Blink Indicator */}
      <AnimatePresence>
        {isBlinking && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute -bottom-12 left-1/2 -translate-x-1/2 flex gap-2"
          >
            {Array.from({ length: blinkCount }).map((_, i) => (
              <motion.div
                key={i}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.2 }}
                className="w-4 h-4 bg-primary rounded-full"
              />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Direction Arrow Component
const DirectionArrow: React.FC<{ direction: string }> = ({ direction }) => {
  const getArrowStyle = () => {
    switch (direction) {
      case 'up':
        return { top: '-60px', left: '50%', transform: 'translateX(-50%) rotate(-90deg)' };
      case 'down':
        return { bottom: '-60px', left: '50%', transform: 'translateX(-50%) rotate(90deg)' };
      case 'left':
        return { left: '-60px', top: '50%', transform: 'translateY(-50%) rotate(180deg)' };
      case 'right':
        return { right: '-60px', top: '50%', transform: 'translateY(-50%)' };
      default:
        return {};
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0 }}
      className="absolute text-primary"
      style={getArrowStyle()}
    >
      <motion.svg
        width="40"
        height="40"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        animate={{ x: [0, 5, 0] }}
        transition={{ duration: 0.6, repeat: Infinity }}
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </motion.svg>
    </motion.div>
  );
};

// Step Indicator Component
interface StepIndicatorProps {
  step: GestureStep;
  index: number;
  isActive: boolean;
  isCurrent: boolean;
}

const StepIndicator: React.FC<StepIndicatorProps> = ({
  step,
  index,
  isActive,
  isCurrent,
}) => {
  const getIcon = () => {
    switch (step.type) {
      case 'direction':
        return getDirectionIcon((step as { type: 'direction'; direction: string }).direction);
      case 'blink':
        return `${(step as { type: 'blink'; count: number }).count}×`;
      case 'hold':
        return '⏱';
      default:
        return '?';
    }
  };

  const getDirectionIcon = (dir: string) => {
    switch (dir) {
      case 'up': return '↑';
      case 'down': return '↓';
      case 'left': return '←';
      case 'right': return '→';
      default: return '•';
    }
  };

  return (
    <motion.div
      className={`
        w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold
        border-2 transition-colors
        ${isCurrent 
          ? 'bg-primary text-primary-foreground border-primary scale-110' 
          : isActive 
            ? 'bg-primary/20 text-primary border-primary/50'
            : 'bg-muted text-muted-foreground border-border'
        }
      `}
      animate={{
        scale: isCurrent ? 1.1 : 1,
      }}
    >
      {step.type === 'blink' ? (
        <div className="flex items-center gap-0.5">
          <Eye className="h-4 w-4" />
          <span className="text-xs">{(step as { type: 'blink'; count: number }).count}</span>
        </div>
      ) : (
        getIcon()
      )}
    </motion.div>
  );
};

// Helper function
const getStepDescription = (step: GestureStep): string => {
  switch (step.type) {
    case 'direction':
      return `Look ${(step as { type: 'direction'; direction: string }).direction.toUpperCase()}`;
    case 'blink':
      const count = (step as { type: 'blink'; count: number }).count;
      return `Blink ${count} time${count > 1 ? 's' : ''}`;
    case 'hold':
      return `Hold for ${(step as { type: 'hold'; duration: number }).duration}ms`;
    default:
      return 'Unknown step';
  }
};

export default ComboGuideOverlay;
