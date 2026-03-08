import React, { useState, useRef, useCallback } from 'react';
import { Plus, Trash2, X, Check, Layout, Target, Smartphone, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  ScreenTarget,
  AppCommand,
  GestureTrigger,
  SimpleGestureTrigger,
  TRIGGER_LABELS,
  TRIGGER_CATEGORIES,
  TARGET_PRESETS,
  useScreenTargets,
} from '@/hooks/useScreenTargets';
import { COMBO_ACTION_LABELS, ComboAction } from '@/hooks/useGestureCombos';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

// All available commands grouped
const COMMAND_GROUPS: { label: string; actions: { value: ComboAction; label: string }[] }[] = [
  {
    label: 'Content',
    actions: [
      { value: 'like', label: 'Like' },
      { value: 'comment', label: 'Comment' },
      { value: 'share', label: 'Share' },
      { value: 'save', label: 'Save' },
      { value: 'follow', label: 'Follow' },
    ],
  },
  {
    label: 'Navigation',
    actions: [
      { value: 'nextVideo', label: 'Next Video' },
      { value: 'prevVideo', label: 'Prev Video' },
      { value: 'friendsFeed', label: 'Friends Feed' },
      { value: 'promoFeed', label: 'Promo Feed' },
    ],
  },
  {
    label: 'App',
    actions: [
      { value: 'openSettings', label: 'Settings' },
      { value: 'toggleMute', label: 'Toggle Mute' },
      { value: 'openWallet', label: 'Wallet' },
      { value: 'openProfile', label: 'Profile' },
      { value: 'openMap', label: 'Map' },
      { value: 'openMessages', label: 'Messages' },
      { value: 'openAchievements', label: 'Achievements' },
      { value: 'openSavedVideos', label: 'Saved Videos' },
      { value: 'openRouteBuilder', label: 'Route Builder' },
      { value: 'checkIn', label: 'Check In' },
      { value: 'tipCreator', label: 'Tip Creator' },
      { value: 'viewCreatorProfile', label: 'Creator Profile' },
      { value: 'report', label: 'Report Content' },
      { value: 'toggleRemoteControl', label: 'Toggle Remote' },
    ],
  },
];

// Trigger icon shorthand
const triggerIcon = (trigger: GestureTrigger): string => {
  if (typeof trigger !== 'string') return '✨';
  const map: Partial<Record<SimpleGestureTrigger, string>> = {
    singleBlink: '👁', doubleBlink: '👁👁', tripleBlink: '👁³',
    lipRaiseLeft: '👄←', lipRaiseRight: '👄→',
    faceTurnLeft: '↩️', faceTurnRight: '↪️',
    eyebrowLeftLift: '🤨←', eyebrowRightLift: '🤨→', eyebrowsBothLift: '🤨',
    smirkSmile: '😏', fullSmile: '😊', slowBlink: '😌',
    gazeActivated: '👀', gazeAndBlink: '👀👁',
    screenTap: '👆', screenDoubleTap: '👆👆',
    phoneTiltLeft: '📱←', phoneTiltRight: '📱→',
    phoneTiltForward: '📱↑', phoneTiltBack: '📱↓',
    handPinch: '🤏',
    handPoint: '☝️',
    handOpenPalm: '🖐️',
    headNod: '🙆',
  };
  return map[trigger] || '⚡';
};

// Command icon shorthand
const commandIcon = (command: AppCommand): string => {
  const map: Partial<Record<AppCommand, string>> = {
    like: '❤️', comment: '💬', share: '↗️', save: '🔖', follow: '➕',
    nextVideo: '⬇️', prevVideo: '⬆️', friendsFeed: '👥', promoFeed: '📺',
    openSettings: '⚙️', toggleMute: '🔇', openWallet: '💰', openProfile: '👤',
    openMap: '🗺️', openMessages: '✉️', openAchievements: '🏆',
    openSavedVideos: '📁', openRouteBuilder: '🛤️',
    checkIn: '📍', tipCreator: '💎', toggleRemoteControl: '📡',
    viewCreatorProfile: '👤', report: '🚩',
  };
  return map[command] || '⚡';
};

interface AddTargetFormProps {
  position: { x: number; y: number };
  onAdd: (target: Omit<ScreenTarget, 'id' | 'createdAt'>) => void;
  onCancel: () => void;
}

const AddTargetForm: React.FC<AddTargetFormProps> = ({ position, onAdd, onCancel }) => {
  const [label, setLabel] = useState('');
  const [command, setCommand] = useState<AppCommand>('like');
  const [trigger, setTrigger] = useState<GestureTrigger>('singleBlink');
  const [useCombined, setUseCombined] = useState(false);
  const [combinedSteps, setCombinedSteps] = useState<SimpleGestureTrigger[]>([]);
  const [size, setSize] = useState(10);
  const dragStepIndexRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const [reorderIndex, setReorderIndex] = useState<number | null>(null);

  const handleAdd = () => {
    onAdd({
      label: label || COMBO_ACTION_LABELS[command] || 'Target',
      command,
      trigger: useCombined && combinedSteps.length
        ? { type: 'combined', steps: combinedSteps }
        : trigger,
      position,
      size,
      enabled: true,
    });
  };

  return (
    <div className="space-y-4 p-4 rounded-lg border border-primary bg-background animate-in fade-in slide-in-from-bottom-2">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">New Target</h4>
        <button onClick={onCancel}><X className="w-4 h-4" /></button>
      </div>

      <Input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Label (auto from command)"
        className="h-8 text-sm"
      />

      {/* Command selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">Command</label>
        <div className="max-h-32 overflow-y-auto space-y-2">
          {COMMAND_GROUPS.map(group => (
            <div key={group.label}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{group.label}</div>
              <div className="flex flex-wrap gap-1">
                {group.actions.map(a => (
                  <button
                    key={a.value}
                    onClick={() => setCommand(a.value)}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] border transition-all',
                      command === a.value
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {commandIcon(a.value)} {a.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Trigger selection */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground">Trigger Gesture</label>
          <button
            type="button"
            onClick={() => {
              if (!useCombined) {
                setUseCombined(true);
                setCombinedSteps(typeof trigger === 'string' ? [trigger] : []);
              } else {
                setUseCombined(false);
                if (combinedSteps.length) setTrigger(combinedSteps[0]);
              }
            }}
            className={cn(
              'px-2 py-1 rounded text-[11px] border transition-all',
              useCombined ? 'border-primary bg-primary/10 text-primary font-medium' : 'border-border text-muted-foreground'
            )}
          >
            Combined
          </button>
        </div>
        {useCombined && (
          <div className="flex flex-wrap items-center gap-1 text-[10px]">
            <span className="text-muted-foreground">Long-press to reorder</span>
            {combinedSteps.length === 0 && (
              <span className="text-muted-foreground">Add steps below</span>
            )}
            {combinedSteps.map((step, i) => (
              <span
                key={`${step}-${i}`}
                draggable
                onDragStart={() => { dragStepIndexRef.current = i; }}
                onDragEnd={() => { dragStepIndexRef.current = null; }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  const from = dragStepIndexRef.current;
                  if (from == null || from === i) return;
                  setCombinedSteps(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(from, 1);
                    next.splice(i, 0, moved);
                    return next;
                  });
                  dragStepIndexRef.current = null;
                }}
                onTouchStart={() => {
                  if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
                  longPressTimerRef.current = window.setTimeout(() => {
                    setReorderIndex(i);
                  }, 350);
                }}
                onTouchEnd={() => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onTouchCancel={() => {
                  if (longPressTimerRef.current) {
                    window.clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onClick={() => {
                  if (reorderIndex == null) return;
                  if (reorderIndex === i) {
                    setReorderIndex(null);
                    return;
                  }
                  setCombinedSteps(prev => {
                    const next = [...prev];
                    const [moved] = next.splice(reorderIndex, 1);
                    next.splice(i, 0, moved);
                    return next;
                  });
                  setReorderIndex(null);
                }}
                className={cn(
                  'flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/50 cursor-move',
                  reorderIndex === i && 'ring-1 ring-primary/60'
                )}
                title="Drag to reorder"
              >
                <GripVertical className="w-3 h-3 text-muted-foreground/60" />
                {TRIGGER_LABELS[step]}
                <button
                  type="button"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation();
                    setCombinedSteps(prev => prev.filter((_, idx) => idx !== i));
                  }}
                >
                  ×
                </button>
              </span>
            ))}
            {combinedSteps.length > 0 && (
              <button
                type="button"
                className="px-2 py-0.5 rounded border border-border text-muted-foreground"
                onClick={() => setCombinedSteps([])}
              >
                Clear
              </button>
            )}
          </div>
        )}
        <div className="max-h-32 overflow-y-auto space-y-2">
          {TRIGGER_CATEGORIES.map(cat => (
            <div key={cat.label}>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{cat.label}</div>
              <div className="flex flex-wrap gap-1">
                {cat.triggers.map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      if (useCombined) {
                        setCombinedSteps((prev) => [...prev, t]);
                      } else {
                        setTrigger(t);
                      }
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] border transition-all',
                      !useCombined && trigger === t
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {triggerIcon(t)} {TRIGGER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Size */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground">Size:</label>
        <input
          type="range"
          min={5}
          max={20}
          value={size}
          onChange={(e) => setSize(Number(e.target.value))}
          className="flex-1"
        />
        <span className="text-xs w-8 text-right">{size}%</span>
      </div>

      <Button onClick={handleAdd} size="sm" className="w-full">
        <Check className="w-3 h-3 mr-1" /> Add Target
      </Button>
    </div>
  );
};

interface TargetEditorProps {
  className?: string;
}

export const TargetEditor: React.FC<TargetEditorProps> = ({ className }) => {
  const { targets, addTarget, removeTarget, updateTarget, applyPreset, clearAll } = useScreenTargets();
  const haptics = useHapticFeedback();
  const canvasRef = useRef<HTMLDivElement>(null);
  const editDragIndexRef = useRef<number | null>(null);
  const editLongPressTimerRef = useRef<number | null>(null);
  const [editReorderIndex, setEditReorderIndex] = useState<number | null>(null);
  const [addingAt, setAddingAt] = useState<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [showPresets, setShowPresets] = useState(false);
  const [editingTarget, setEditingTarget] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');

  const handleCanvasTap = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (dragging || editingTarget) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const x = (clientX - rect.left) / rect.width;
    const y = (clientY - rect.top) / rect.height;

    // Check if tapping on existing target
    const hit = targets.find(t => {
      const dx = x - t.position.x;
      const dy = y - t.position.y;
      return Math.sqrt(dx * dx + dy * dy) <= t.size / 100 + 0.02;
    });

    if (hit) {
      setEditingTarget(hit.id);
      setEditLabel(hit.label);
      haptics.light();
    } else {
      setAddingAt({ x: Math.max(0.05, Math.min(0.95, x)), y: Math.max(0.05, Math.min(0.95, y)) });
      haptics.light();
    }
  }, [targets, dragging, editingTarget, haptics]);

  const handleDragStart = useCallback((targetId: string, e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragging(targetId);
  }, []);

  const handleDragMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    const x = Math.max(0.05, Math.min(0.95, (clientX - rect.left) / rect.width));
    const y = Math.max(0.05, Math.min(0.95, (clientY - rect.top) / rect.height));
    updateTarget(dragging, { position: { x, y } });
  }, [dragging, updateTarget]);

  const handleDragEnd = useCallback(() => {
    if (dragging) haptics.light();
    setDragging(null);
  }, [dragging, haptics]);

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowPresets(true)} className="flex-1">
          <Layout className="w-3 h-3 mr-1" /> Presets
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            clearAll();
            haptics.light();
          }}
          disabled={targets.length === 0}
        >
          <Trash2 className="w-3 h-3 mr-1" /> Clear
        </Button>
      </div>

      {/* Phone Canvas */}
      <div
        ref={canvasRef}
        className={cn(
          'relative w-full aspect-[9/16] rounded-2xl border-2 border-border bg-muted/20 overflow-hidden',
          'cursor-crosshair select-none',
          dragging && 'cursor-grabbing'
        )}
        onClick={handleCanvasTap}
        onMouseMove={handleDragMove}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onTouchMove={handleDragMove}
        onTouchEnd={handleDragEnd}
      >
        {/* Phone frame hint */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-border" />
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full border border-border" />

        {/* Empty state */}
        {targets.length === 0 && !addingAt && (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
            <Smartphone className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">Tap to place a target</p>
          </div>
        )}

        {/* Targets */}
        {targets.map(target => {
          const sizePx = `${target.size * 2}%`;
          const isEditing = editingTarget === target.id;
          return (
            <div
              key={target.id}
              className={cn(
                'absolute rounded-full flex items-center justify-center transition-all',
                'border-2 cursor-grab active:cursor-grabbing',
                target.enabled
                  ? 'bg-primary/20 border-primary/60 shadow-[0_0_12px_hsl(var(--primary)/0.3)]'
                  : 'bg-muted/30 border-border/50',
                isEditing && 'ring-2 ring-primary ring-offset-2 ring-offset-background z-10',
                dragging === target.id && 'scale-110 opacity-80'
              )}
              style={{
                left: `${target.position.x * 100}%`,
                top: `${target.position.y * 100}%`,
                width: sizePx,
                height: sizePx,
                transform: 'translate(-50%, -50%)',
              }}
              onMouseDown={(e) => handleDragStart(target.id, e)}
              onTouchStart={(e) => handleDragStart(target.id, e)}
              onClick={(e) => { e.stopPropagation(); setEditingTarget(target.id); }}
            >
              <span className="text-[10px] leading-none text-center pointer-events-none select-none">
                {commandIcon(target.command)}
              </span>
              {/* Trigger badge */}
              <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-primary text-primary-foreground text-[8px] flex items-center justify-center">
                {triggerIcon(target.trigger).charAt(0)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Target count */}
      <p className="text-xs text-muted-foreground text-center">{targets.length} target{targets.length !== 1 ? 's' : ''} placed</p>

      {/* Adding form */}
      {addingAt && (
        <AddTargetForm
          position={addingAt}
          onAdd={(t) => {
            addTarget(t);
            setAddingAt(null);
            haptics.success();
          }}
          onCancel={() => setAddingAt(null)}
        />
      )}

      {/* Editing panel */}
      {editingTarget && (() => {
        const target = targets.find(t => t.id === editingTarget);
        if (!target) return null;
        return (
          <div className="p-3 rounded-lg border border-border bg-background space-y-3 animate-in fade-in">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">
                {commandIcon(target.command)} {target.label}
              </h4>
              <div className="flex gap-1">
                <button
                  onClick={() => {
                    removeTarget(target.id);
                    setEditingTarget(null);
                    haptics.light();
                  }}
                  className="p-1 text-destructive hover:bg-destructive/10 rounded"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
                <button
                  onClick={() => {
                    setEditingTarget(null);
                    setEditLabel('');
                  }}
                  className="p-1 rounded hover:bg-muted"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>

            {/* Label */}
            <div className="space-y-1">
              <label className="text-[11px] text-muted-foreground">Label</label>
              <div className="flex gap-2">
                <Input
                  value={editLabel}
                  onChange={(e) => setEditLabel(e.target.value)}
                  className="h-8 text-sm"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    updateTarget(target.id, { label: editLabel.trim() || target.label });
                    haptics.light();
                  }}
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Command */}
            <div className="space-y-2">
              <label className="text-[11px] text-muted-foreground">Command</label>
              <div className="flex flex-wrap gap-1">
                {COMMAND_GROUPS.flatMap(g => g.actions).map(a => (
                  <button
                    key={a.value}
                    onClick={() => {
                      updateTarget(target.id, { command: a.value });
                      if (!editLabel.trim()) setEditLabel(COMBO_ACTION_LABELS[a.value] || a.label);
                      haptics.light();
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] border transition-all',
                      target.command === a.value
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {commandIcon(a.value)} {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Trigger */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] text-muted-foreground">Trigger</label>
                <button
                  type="button"
                  onClick={() => {
                    const isCombined = typeof target.trigger !== 'string' && target.trigger.type === 'combined';
                    if (!isCombined) {
                      const base = typeof target.trigger === 'string' ? [target.trigger] : [];
                      updateTarget(target.id, { trigger: { type: 'combined', steps: base } });
                    } else {
                      const steps = target.trigger.steps;
                      updateTarget(target.id, { trigger: steps[0] || 'singleBlink' });
                    }
                    haptics.light();
                  }}
                  className={cn(
                    'px-2 py-1 rounded text-[11px] border transition-all',
                    typeof target.trigger !== 'string' && target.trigger.type === 'combined'
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground'
                  )}
                >
                  Combined
                </button>
              </div>
              {typeof target.trigger !== 'string' && target.trigger.type === 'combined' && (
                <div className="flex flex-wrap items-center gap-1 text-[10px]">
                  <span className="text-muted-foreground">Long-press to reorder</span>
                  {target.trigger.steps.length === 0 && (
                    <span className="text-muted-foreground">Add steps below</span>
                  )}
                  {target.trigger.steps.map((step, i) => (
                    <span
                      key={`${step}-${i}`}
                      draggable
                      onDragStart={() => { editDragIndexRef.current = i; }}
                      onDragEnd={() => { editDragIndexRef.current = null; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = editDragIndexRef.current;
                        if (from == null || from === i) return;
                        const next = [...target.trigger.steps];
                        const [moved] = next.splice(from, 1);
                        next.splice(i, 0, moved);
                        updateTarget(target.id, { trigger: { type: 'combined', steps: next } });
                        editDragIndexRef.current = null;
                      }}
                      onTouchStart={() => {
                        if (editLongPressTimerRef.current) window.clearTimeout(editLongPressTimerRef.current);
                        editLongPressTimerRef.current = window.setTimeout(() => {
                          setEditReorderIndex(i);
                        }, 350);
                      }}
                      onTouchEnd={() => {
                        if (editLongPressTimerRef.current) {
                          window.clearTimeout(editLongPressTimerRef.current);
                          editLongPressTimerRef.current = null;
                        }
                      }}
                      onTouchCancel={() => {
                        if (editLongPressTimerRef.current) {
                          window.clearTimeout(editLongPressTimerRef.current);
                          editLongPressTimerRef.current = null;
                        }
                      }}
                      onClick={() => {
                        if (editReorderIndex == null) return;
                        if (editReorderIndex === i) {
                          setEditReorderIndex(null);
                          return;
                        }
                        const next = [...target.trigger.steps];
                        const [moved] = next.splice(editReorderIndex, 1);
                        next.splice(i, 0, moved);
                        updateTarget(target.id, { trigger: { type: 'combined', steps: next } });
                        setEditReorderIndex(null);
                      }}
                      className={cn(
                        'flex items-center gap-1 px-2 py-0.5 rounded border border-border bg-muted/50 cursor-move',
                        editReorderIndex === i && 'ring-1 ring-primary/60'
                      )}
                      title="Drag to reorder"
                    >
                      <GripVertical className="w-3 h-3 text-muted-foreground/60" />
                      {TRIGGER_LABELS[step]}
                      <button
                        type="button"
                        className="text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          const next = target.trigger.steps.filter((_, idx) => idx !== i);
                          updateTarget(target.id, { trigger: { type: 'combined', steps: next } });
                        }}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                  {target.trigger.steps.length > 0 && (
                    <button
                      type="button"
                      className="px-2 py-0.5 rounded border border-border text-muted-foreground"
                      onClick={() => updateTarget(target.id, { trigger: { type: 'combined', steps: [] } })}
                    >
                      Clear
                    </button>
                  )}
                </div>
              )}
              <div className="flex flex-wrap gap-1">
                {TRIGGER_CATEGORIES.flatMap(c => c.triggers).map(t => (
                  <button
                    key={t}
                    onClick={() => {
                      if (typeof target.trigger !== 'string' && target.trigger.type === 'combined') {
                        updateTarget(target.id, { trigger: { type: 'combined', steps: [...target.trigger.steps, t] } });
                      } else {
                        updateTarget(target.id, { trigger: t });
                      }
                      haptics.light();
                    }}
                    className={cn(
                      'px-2 py-1 rounded text-[11px] border transition-all',
                      typeof target.trigger === 'string' && target.trigger === t
                        ? 'border-primary bg-primary/10 text-primary font-medium'
                        : 'border-border hover:border-primary/50'
                    )}
                  >
                    {triggerIcon(t)} {TRIGGER_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            {/* Size */}
            <div className="flex items-center gap-2">
              <label className="text-[11px] text-muted-foreground">Size</label>
              <input
                type="range"
                min={5}
                max={25}
                value={target.size}
                onChange={(e) => updateTarget(target.id, { size: Number(e.target.value) })}
                className="flex-1"
              />
              <span className="text-[11px] w-10 text-right text-muted-foreground">{target.size}%</span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>Position: ({Math.round(target.position.x * 100)}%, {Math.round(target.position.y * 100)}%)</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs">Enabled:</label>
              <button
                onClick={() => {
                  updateTarget(target.id, { enabled: !target.enabled });
                  haptics.light();
                }}
                className={cn(
                  'px-2 py-0.5 rounded text-xs border transition-all',
                  target.enabled ? 'bg-primary/10 border-primary text-primary' : 'bg-muted border-border'
                )}
              >
                {target.enabled ? 'On' : 'Off'}
              </button>
            </div>
          </div>
        );
      })()}

      {/* Presets Sheet */}
      <Sheet open={showPresets} onOpenChange={setShowPresets}>
        <SheetContent side="bottom" className="h-[50vh]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Layout className="w-4 h-4" /> Preset Layouts
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-3 mt-4 overflow-y-auto max-h-[35vh]">
            {TARGET_PRESETS.map(preset => (
              <button
                key={preset.id}
                onClick={() => {
                  applyPreset(preset.id);
                  setShowPresets(false);
                  haptics.success();
                }}
                className="w-full p-4 rounded-lg border border-border hover:border-primary/50 text-left transition-all"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{preset.name}</h4>
                  <span className="text-xs text-muted-foreground">{preset.targets.length} targets</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{preset.description}</p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {preset.targets.map((t, i) => (
                    <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-[10px]">
                      {commandIcon(t.command)} {t.label}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default TargetEditor;
