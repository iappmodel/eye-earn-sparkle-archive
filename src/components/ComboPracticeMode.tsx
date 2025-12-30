import React, { useState, useEffect, useCallback } from 'react';
import { 
  Play, Square, Eye, ChevronRight, Check, X, 
  Target, Sparkles, RotateCcw, Trophy
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  GestureCombo, 
  GestureStep,
  COMBO_ACTION_LABELS,
} from '@/hooks/useGestureCombos';
import { GazeDirection } from '@/hooks/useGazeDirection';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useVoiceFeedback } from '@/hooks/useVoiceFeedback';

interface ComboPracticeModeProps {
  isActive: boolean;
  onToggle: (active: boolean) => void;
  combos: GestureCombo[];
  currentSteps: GestureStep[];
  matchProgress: number;
  lastMatchedCombo: GestureCombo | null;
}

interface PracticeStats {
  attempted: number;
  successful: number;
  streak: number;
  bestStreak: number;
}

const DIRECTION_LABELS: Record<GazeDirection, string> = {
  left: 'Look Left',
  right: 'Look Right',
  up: 'Look Up',
  down: 'Look Down',
  center: 'Center',
};

export const ComboPracticeMode: React.FC<ComboPracticeModeProps> = ({
  isActive,
  onToggle,
  combos,
  currentSteps,
  matchProgress,
  lastMatchedCombo,
}) => {
  const haptics = useHapticFeedback();
  const voiceFeedback = useVoiceFeedback();
  
  const [targetCombo, setTargetCombo] = useState<GestureCombo | null>(null);
  const [stats, setStats] = useState<PracticeStats>({
    attempted: 0,
    successful: 0,
    streak: 0,
    bestStreak: 0,
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFail, setShowFail] = useState(false);

  const enabledCombos = combos.filter(c => c.enabled);

  // Pick a random target combo
  const pickNewTarget = useCallback(() => {
    if (enabledCombos.length === 0) return;
    
    const randomIndex = Math.floor(Math.random() * enabledCombos.length);
    const newTarget = enabledCombos[randomIndex];
    setTargetCombo(newTarget);
    setShowSuccess(false);
    setShowFail(false);
    
    voiceFeedback.speak(`Practice: ${newTarget.name}`, true);
  }, [enabledCombos, voiceFeedback]);

  // Check if user matched the target
  useEffect(() => {
    if (!isActive || !targetCombo || !lastMatchedCombo) return;
    
    if (lastMatchedCombo.id === targetCombo.id) {
      // Success!
      setShowSuccess(true);
      haptics.success();
      voiceFeedback.announcePracticeCombo(targetCombo.name);
      
      setStats(prev => ({
        ...prev,
        attempted: prev.attempted + 1,
        successful: prev.successful + 1,
        streak: prev.streak + 1,
        bestStreak: Math.max(prev.bestStreak, prev.streak + 1),
      }));
      
      // Pick new target after delay
      setTimeout(() => {
        pickNewTarget();
      }, 1500);
    }
  }, [isActive, targetCombo, lastMatchedCombo, haptics, voiceFeedback, pickNewTarget]);

  // Detect failed attempt (steps don't match target)
  useEffect(() => {
    if (!isActive || !targetCombo || currentSteps.length === 0) return;
    
    // Check if current steps are still a valid prefix of target
    const targetSteps = targetCombo.steps;
    let isValidPrefix = true;
    
    for (let i = 0; i < currentSteps.length && i < targetSteps.length; i++) {
      const current = currentSteps[i];
      const target = targetSteps[i];
      
      if (current.type !== target.type) {
        isValidPrefix = false;
        break;
      }
      
      if (current.type === 'direction' && target.type === 'direction') {
        if (current.direction !== target.direction) {
          isValidPrefix = false;
          break;
        }
      } else if (current.type === 'blink' && target.type === 'blink') {
        if (current.count !== target.count) {
          isValidPrefix = false;
          break;
        }
      }
    }
    
    if (!isValidPrefix && !showFail && !showSuccess) {
      setShowFail(true);
      haptics.error();
      voiceFeedback.playSound('error');
      
      setStats(prev => ({
        ...prev,
        attempted: prev.attempted + 1,
        streak: 0,
      }));
      
      // Reset after delay
      setTimeout(() => {
        setShowFail(false);
      }, 1000);
    }
  }, [isActive, targetCombo, currentSteps, showFail, showSuccess, haptics, voiceFeedback]);

  // Start practice
  const handleStart = () => {
    onToggle(true);
    pickNewTarget();
    setStats({ attempted: 0, successful: 0, streak: 0, bestStreak: 0 });
  };

  // Stop practice
  const handleStop = () => {
    onToggle(false);
    setTargetCombo(null);
    setShowSuccess(false);
    setShowFail(false);
  };

  const renderStep = (step: GestureStep, index: number, isCompleted: boolean, isCurrent: boolean) => {
    return (
      <div 
        key={index}
        className={cn(
          'px-3 py-2 rounded-lg border text-sm flex items-center gap-2 transition-all',
          isCompleted && 'bg-green-500/20 border-green-500 text-green-500',
          isCurrent && !isCompleted && 'bg-primary/20 border-primary animate-pulse',
          !isCompleted && !isCurrent && 'bg-muted/50 border-border text-muted-foreground'
        )}
      >
        {step.type === 'direction' && (
          <span>{DIRECTION_LABELS[step.direction]}</span>
        )}
        {step.type === 'blink' && (
          <div className="flex items-center gap-1">
            {Array.from({ length: step.count }).map((_, i) => (
              <Eye key={i} className="w-4 h-4" />
            ))}
            <span>{step.count}× blink</span>
          </div>
        )}
        {step.type === 'hold' && (
          <span>Hold {step.duration}ms</span>
        )}
        {isCompleted && <Check className="w-4 h-4" />}
      </div>
    );
  };

  if (!isActive) {
    return (
      <div className="p-4 rounded-lg border border-dashed border-border space-y-4">
        <div className="text-center space-y-2">
          <Target className="w-8 h-8 mx-auto text-muted-foreground" />
          <h4 className="font-medium">Practice Mode</h4>
          <p className="text-sm text-muted-foreground">
            Practice your gesture combos without triggering actual actions. 
            Perfect for learning and muscle memory!
          </p>
        </div>
        
        {enabledCombos.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground">
            Enable at least one combo to start practicing.
          </p>
        ) : (
          <Button onClick={handleStart} className="w-full">
            <Play className="w-4 h-4 mr-2" />
            Start Practice
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
        <div className="flex items-center gap-4 text-sm">
          <span>
            <span className="font-medium text-green-500">{stats.successful}</span>
            <span className="text-muted-foreground">/{stats.attempted}</span>
          </span>
          <span className="flex items-center gap-1">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="font-medium">{stats.bestStreak}</span>
          </span>
          {stats.streak > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-xs">
              🔥 {stats.streak} streak
            </span>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={handleStop}>
          <Square className="w-4 h-4 mr-1" />
          Stop
        </Button>
      </div>

      {/* Target combo */}
      {targetCombo && (
        <div className={cn(
          'p-4 rounded-lg border-2 transition-all',
          showSuccess && 'border-green-500 bg-green-500/10',
          showFail && 'border-destructive bg-destructive/10',
          !showSuccess && !showFail && 'border-primary bg-primary/5'
        )}>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h4 className="font-medium">{targetCombo.name}</h4>
            </div>
            <Button variant="ghost" size="sm" onClick={pickNewTarget}>
              <RotateCcw className="w-4 h-4" />
            </Button>
          </div>

          {/* Progress */}
          <Progress value={matchProgress * 100} className="h-2 mb-4" />

          {/* Steps */}
          <div className="flex flex-wrap items-center gap-2">
            {targetCombo.steps.map((step, i) => (
              <React.Fragment key={i}>
                {renderStep(
                  step, 
                  i, 
                  i < currentSteps.length, 
                  i === currentSteps.length
                )}
                {i < targetCombo.steps.length - 1 && (
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                )}
              </React.Fragment>
            ))}
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium text-primary">
              {COMBO_ACTION_LABELS[targetCombo.action]}
            </span>
          </div>

          {/* Success/Fail overlay */}
          {showSuccess && (
            <div className="mt-4 p-3 rounded-lg bg-green-500/20 text-green-500 text-center animate-in fade-in">
              <Check className="w-6 h-6 mx-auto mb-1" />
              <span className="font-medium">Perfect!</span>
            </div>
          )}
          {showFail && (
            <div className="mt-4 p-3 rounded-lg bg-destructive/20 text-destructive text-center animate-in fade-in">
              <X className="w-6 h-6 mx-auto mb-1" />
              <span className="font-medium">Try again</span>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <p className="text-xs text-muted-foreground text-center">
        Perform the gesture sequence shown above. Actions won't trigger during practice.
      </p>
    </div>
  );
};

export default ComboPracticeMode;
