import React, { useState, useCallback } from 'react';
import { 
  Eye, ArrowLeft, ArrowRight, ArrowUp, ArrowDown, Target, Plus, X, 
  Check, ChevronRight, Trash2, GripVertical, Clock, Sparkles
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter 
} from '@/components/ui/sheet';
import { 
  GestureStep, ComboAction, GestureCombo, addCombo, COMBO_ACTION_LABELS 
} from '@/hooks/useGestureCombos';
import { GazeDirection } from '@/hooks/useGazeDirection';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface GestureComboBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  onComboCreated?: (combo: GestureCombo) => void;
  editingCombo?: GestureCombo;
}

const DIRECTION_OPTIONS: { direction: GazeDirection; icon: React.ReactNode; label: string }[] = [
  { direction: 'left', icon: <ArrowLeft className="w-5 h-5" />, label: 'Left' },
  { direction: 'right', icon: <ArrowRight className="w-5 h-5" />, label: 'Right' },
  { direction: 'up', icon: <ArrowUp className="w-5 h-5" />, label: 'Up' },
  { direction: 'down', icon: <ArrowDown className="w-5 h-5" />, label: 'Down' },
];

const BLINK_OPTIONS: { count: 1 | 2 | 3; label: string }[] = [
  { count: 1, label: '1× Blink' },
  { count: 2, label: '2× Blink' },
  { count: 3, label: '3× Blink' },
];

const HOLD_OPTIONS: { duration: number; label: string }[] = [
  { duration: 500, label: '0.5s Hold' },
  { duration: 1000, label: '1s Hold' },
  { duration: 1500, label: '1.5s Hold' },
];

const ACTION_OPTIONS: { value: ComboAction; label: string }[] = [
  { value: 'like', label: 'Like Video' },
  { value: 'comment', label: 'Open Comments' },
  { value: 'share', label: 'Share' },
  { value: 'follow', label: 'Follow Creator' },
  { value: 'nextVideo', label: 'Next Video' },
  { value: 'prevVideo', label: 'Previous Video' },
  { value: 'friendsFeed', label: 'Friends Feed' },
  { value: 'promoFeed', label: 'Promo Feed' },
  { value: 'openSettings', label: 'Open Settings' },
  { value: 'toggleMute', label: 'Toggle Mute' },
  { value: 'save', label: 'Save Video' },
];

const StepIcon: React.FC<{ step: GestureStep }> = ({ step }) => {
  if (step.type === 'direction') {
    const option = DIRECTION_OPTIONS.find(o => o.direction === step.direction);
    return <>{option?.icon || <Target className="w-5 h-5" />}</>;
  }
  if (step.type === 'blink') {
    return (
      <div className="flex gap-0.5">
        {Array.from({ length: step.count }).map((_, i) => (
          <Eye key={i} className="w-4 h-4" />
        ))}
      </div>
    );
  }
  if (step.type === 'hold') {
    return <Clock className="w-5 h-5" />;
  }
  return null;
};

const StepLabel: React.FC<{ step: GestureStep }> = ({ step }) => {
  if (step.type === 'direction') {
    return <span>Look {step.direction}</span>;
  }
  if (step.type === 'blink') {
    return <span>{step.count}× Blink</span>;
  }
  if (step.type === 'hold') {
    return <span>Hold {step.duration}ms</span>;
  }
  return null;
};

export const GestureComboBuilder: React.FC<GestureComboBuilderProps> = ({
  isOpen,
  onClose,
  onComboCreated,
  editingCombo,
}) => {
  const haptics = useHapticFeedback();
  
  const [name, setName] = useState(editingCombo?.name || '');
  const [description, setDescription] = useState(editingCombo?.description || '');
  const [steps, setSteps] = useState<GestureStep[]>(editingCombo?.steps || []);
  const [action, setAction] = useState<ComboAction>(editingCombo?.action || 'like');
  const [showStepPicker, setShowStepPicker] = useState(false);
  const [stepPickerTab, setStepPickerTab] = useState<'direction' | 'blink' | 'hold'>('direction');

  const resetForm = useCallback(() => {
    setName('');
    setDescription('');
    setSteps([]);
    setAction('like');
    setShowStepPicker(false);
  }, []);

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const addStep = (step: GestureStep) => {
    if (steps.length >= 5) {
      haptics.error();
      return; // Max 5 steps
    }
    setSteps([...steps, step]);
    setShowStepPicker(false);
    haptics.light();
  };

  const removeStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
    haptics.light();
  };

  const moveStep = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= steps.length) return;
    const newSteps = [...steps];
    const [removed] = newSteps.splice(fromIndex, 1);
    newSteps.splice(toIndex, 0, removed);
    setSteps(newSteps);
    haptics.light();
  };

  const generateDescription = (): string => {
    if (steps.length === 0) return '';
    return steps.map((step, i) => {
      if (step.type === 'direction') return `Look ${step.direction}`;
      if (step.type === 'blink') return `blink ${step.count}×`;
      if (step.type === 'hold') return `hold for ${step.duration}ms`;
      return '';
    }).join(', then ');
  };

  const handleCreate = () => {
    if (!name.trim() || steps.length < 2) {
      haptics.error();
      return;
    }

    const newCombo = addCombo({
      name: name.trim(),
      description: description.trim() || generateDescription(),
      steps,
      action,
      enabled: true,
    });

    haptics.success();
    onComboCreated?.(newCombo);
    handleClose();
  };

  const isValid = name.trim().length > 0 && steps.length >= 2;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <SheetContent side="bottom" className="h-[90vh] flex flex-col">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-500" />
            {editingCombo ? 'Edit Combo' : 'Create Custom Combo'}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Name input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Combo Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Quick Save"
              maxLength={30}
            />
          </div>

          {/* Description input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Description (optional)</label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={generateDescription() || 'Auto-generated from steps'}
              maxLength={100}
            />
            {!description && steps.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Will use: "{generateDescription()}"
              </p>
            )}
          </div>

          {/* Steps builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Gesture Sequence</label>
              <span className="text-xs text-muted-foreground">{steps.length}/5 steps</span>
            </div>

            {/* Steps display */}
            <div className="min-h-[80px] p-4 rounded-lg border-2 border-dashed border-border bg-muted/30">
              {steps.length === 0 ? (
                <div className="text-center text-muted-foreground text-sm py-4">
                  Add at least 2 gesture steps to create a combo
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2">
                  {steps.map((step, index) => (
                    <div key={index} className="flex items-center gap-1">
                      <div className={cn(
                        'group relative px-3 py-2 rounded-lg bg-background border border-border',
                        'flex items-center gap-2 transition-all hover:border-primary'
                      )}>
                        <button
                          className="opacity-50 hover:opacity-100 cursor-grab active:cursor-grabbing"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            // Simple drag implementation with buttons
                          }}
                        >
                          <GripVertical className="w-3 h-3" />
                        </button>
                        
                        <div className="flex items-center gap-1.5 text-sm">
                          <span className="text-primary">
                            <StepIcon step={step} />
                          </span>
                          <StepLabel step={step} />
                        </div>

                        <button
                          onClick={() => removeStep(index)}
                          className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive/80"
                        >
                          <X className="w-3 h-3" />
                        </button>

                        {/* Move buttons */}
                        <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-0.5">
                          {index > 0 && (
                            <button
                              onClick={() => moveStep(index, index - 1)}
                              className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs"
                            >
                              ←
                            </button>
                          )}
                          {index < steps.length - 1 && (
                            <button
                              onClick={() => moveStep(index, index + 1)}
                              className="w-5 h-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs"
                            >
                              →
                            </button>
                          )}
                        </div>
                      </div>

                      {index < steps.length - 1 && (
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                  ))}

                  {/* Add step button */}
                  {steps.length < 5 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowStepPicker(true)}
                      className="border-dashed"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      Add Step
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Step picker */}
            {showStepPicker && (
              <div className="p-4 rounded-lg border border-primary bg-primary/5 space-y-4 animate-in fade-in slide-in-from-bottom-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Add Step</h4>
                  <button onClick={() => setShowStepPicker(false)}>
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Step type tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setStepPickerTab('direction')}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      stepPickerTab === 'direction' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    Look Direction
                  </button>
                  <button
                    onClick={() => setStepPickerTab('blink')}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      stepPickerTab === 'blink' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    Blink Pattern
                  </button>
                  <button
                    onClick={() => setStepPickerTab('hold')}
                    className={cn(
                      'px-3 py-2 rounded-lg text-sm font-medium transition-all',
                      stepPickerTab === 'hold' 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted hover:bg-muted/80'
                    )}
                  >
                    Hold Gaze
                  </button>
                </div>

                {/* Direction options */}
                {stepPickerTab === 'direction' && (
                  <div className="grid grid-cols-4 gap-2">
                    {DIRECTION_OPTIONS.map(({ direction, icon, label }) => (
                      <button
                        key={direction}
                        onClick={() => addStep({ type: 'direction', direction })}
                        className={cn(
                          'p-4 rounded-lg border border-border bg-background',
                          'flex flex-col items-center gap-2 transition-all',
                          'hover:border-primary hover:bg-primary/5'
                        )}
                      >
                        <span className="text-primary">{icon}</span>
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Blink options */}
                {stepPickerTab === 'blink' && (
                  <div className="grid grid-cols-3 gap-2">
                    {BLINK_OPTIONS.map(({ count, label }) => (
                      <button
                        key={count}
                        onClick={() => addStep({ type: 'blink', count })}
                        className={cn(
                          'p-4 rounded-lg border border-border bg-background',
                          'flex flex-col items-center gap-2 transition-all',
                          'hover:border-primary hover:bg-primary/5'
                        )}
                      >
                        <div className="flex gap-0.5">
                          {Array.from({ length: count }).map((_, i) => (
                            <Eye key={i} className="w-5 h-5 text-primary" />
                          ))}
                        </div>
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                )}

                {/* Hold options */}
                {stepPickerTab === 'hold' && (
                  <div className="grid grid-cols-3 gap-2">
                    {HOLD_OPTIONS.map(({ duration, label }) => (
                      <button
                        key={duration}
                        onClick={() => addStep({ type: 'hold', duration })}
                        className={cn(
                          'p-4 rounded-lg border border-border bg-background',
                          'flex flex-col items-center gap-2 transition-all',
                          'hover:border-primary hover:bg-primary/5'
                        )}
                      >
                        <Clock className="w-5 h-5 text-primary" />
                        <span className="text-xs">{label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Quick add buttons */}
            {steps.length < 5 && !showStepPicker && (
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-muted-foreground w-full">Quick add:</span>
                {DIRECTION_OPTIONS.map(({ direction, icon, label }) => (
                  <button
                    key={direction}
                    onClick={() => addStep({ type: 'direction', direction })}
                    className="px-2 py-1 rounded border border-border text-xs flex items-center gap-1 hover:border-primary transition-colors"
                  >
                    {icon}
                    {label}
                  </button>
                ))}
                {BLINK_OPTIONS.map(({ count, label }) => (
                  <button
                    key={count}
                    onClick={() => addStep({ type: 'blink', count })}
                    className="px-2 py-1 rounded border border-border text-xs flex items-center gap-1 hover:border-primary transition-colors"
                  >
                    <Eye className="w-3 h-3" />
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Action selector */}
          <div className="space-y-3">
            <label className="text-sm font-medium">Action to Perform</label>
            <div className="grid grid-cols-3 gap-2">
              {ACTION_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => {
                    setAction(value);
                    haptics.light();
                  }}
                  className={cn(
                    'px-3 py-3 rounded-lg border text-sm transition-all text-center',
                    action === value
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/50'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          {steps.length >= 2 && (
            <div className="p-4 rounded-lg bg-gradient-to-r from-primary/10 to-amber-500/10 border border-primary/20">
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Preview
              </h4>
              <div className="flex items-center gap-2 flex-wrap">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-1">
                    <div className="px-2 py-1 rounded bg-background text-xs flex items-center gap-1">
                      <StepIcon step={step} />
                      <StepLabel step={step} />
                    </div>
                    {i < steps.length - 1 && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    )}
                  </div>
                ))}
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
                <span className="text-sm font-medium text-primary">{COMBO_ACTION_LABELS[action]}</span>
              </div>
            </div>
          )}
        </div>

        <SheetFooter className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} className="flex-1">
            Cancel
          </Button>
          <Button 
            onClick={handleCreate} 
            disabled={!isValid}
            className="flex-1"
          >
            <Check className="w-4 h-4 mr-2" />
            {editingCombo ? 'Save Changes' : 'Create Combo'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default GestureComboBuilder;
