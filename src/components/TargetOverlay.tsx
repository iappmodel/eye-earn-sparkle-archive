import React, { useState, useEffect, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import {
  ScreenTarget,
  GestureTrigger,
  getTargetAtPosition,
  useScreenTargets,
  TRIGGER_LABELS,
} from '@/hooks/useScreenTargets';
import { COMBO_ACTION_LABELS, ComboAction } from '@/hooks/useGestureCombos';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TargetOverlayProps {
  enabled: boolean;
  gazePosition?: { x: number; y: number } | null;
  onTargetAction?: (command: ComboAction) => void;
  className?: string;
}

export const TargetOverlay: React.FC<TargetOverlayProps> = ({
  enabled,
  gazePosition,
  onTargetAction,
  className,
}) => {
  const { enabledTargets, recordInteraction } = useScreenTargets();
  const haptics = useHapticFeedback();
  const [hoveredTarget, setHoveredTarget] = useState<string | null>(null);
  const [activationProgress, setActivationProgress] = useState<Record<string, number>>({});
  const [successTarget, setSuccessTarget] = useState<string | null>(null);
  const gazeTimerRef = useRef<Record<string, number>>({});
  const lastFrameRef = useRef<number>(0);

  // Gaze-based hit testing
  useEffect(() => {
    if (!enabled || !gazePosition || enabledTargets.length === 0) {
      setHoveredTarget(null);
      return;
    }

    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const hit = getTargetAtPosition(enabledTargets, gazePosition.x, gazePosition.y, screenWidth, screenHeight);

    if (hit) {
      setHoveredTarget(hit.id);

      // Track gaze duration for gazeActivated triggers
      if (hit.trigger === 'gazeActivated' || hit.trigger === 'gazeAndBlink') {
        const now = Date.now();
        if (!gazeTimerRef.current[hit.id]) {
          gazeTimerRef.current[hit.id] = now;
        }
        const elapsed = now - gazeTimerRef.current[hit.id];
        const requiredTime = hit.trigger === 'gazeActivated' ? 1500 : 800; // ms
        const progress = Math.min(1, elapsed / requiredTime);

        setActivationProgress(prev => ({ ...prev, [hit.id]: progress }));

        if (progress >= 1 && hit.trigger === 'gazeActivated') {
          // Auto-activate
          triggerTarget(hit);
          gazeTimerRef.current[hit.id] = 0;
          setActivationProgress(prev => ({ ...prev, [hit.id]: 0 }));
        }
      }
    } else {
      setHoveredTarget(null);
      // Reset all timers
      gazeTimerRef.current = {};
      setActivationProgress({});
    }
  }, [enabled, gazePosition, enabledTargets]);

  const triggerTarget = useCallback((target: ScreenTarget) => {
    haptics.success();
    recordInteraction(target.id, true);
    onTargetAction?.(target.command);

    // Show success animation
    setSuccessTarget(target.id);
    setTimeout(() => setSuccessTarget(null), 800);
  }, [haptics, recordInteraction, onTargetAction]);

  if (!enabled || enabledTargets.length === 0) return null;

  return (
    <div className={cn('fixed inset-0 pointer-events-none z-[96]', className)}>
      {enabledTargets.map(target => {
        const isHovered = hoveredTarget === target.id;
        const isSuccess = successTarget === target.id;
        const progress = activationProgress[target.id] || 0;
        const sizePx = (target.size / 100) * window.innerWidth;
        const circumference = 2 * Math.PI * (sizePx / 2 - 2);

        return (
          <div
            key={target.id}
            className={cn(
              'absolute flex items-center justify-center transition-all duration-200',
              isHovered && 'scale-110',
              isSuccess && 'animate-pulse'
            )}
            style={{
              left: `${target.position.x * 100}%`,
              top: `${target.position.y * 100}%`,
              width: sizePx,
              height: sizePx,
              transform: 'translate(-50%, -50%)',
            }}
          >
            {/* Background circle */}
            <div
              className={cn(
                'absolute inset-0 rounded-full transition-all duration-200',
            isSuccess
                  ? 'bg-accent/30 border-2 border-accent'
                  : isHovered
                    ? 'bg-primary/20 border-2 border-primary shadow-[0_0_20px_hsl(var(--primary)/0.4)]'
                    : 'bg-background/10 border border-foreground/10'
              )}
            />

            {/* Activation progress ring */}
            {progress > 0 && !isSuccess && (
              <svg
                className="absolute inset-0 w-full h-full -rotate-90"
                viewBox={`0 0 ${sizePx} ${sizePx}`}
              >
                <circle
                  cx={sizePx / 2}
                  cy={sizePx / 2}
                  r={sizePx / 2 - 2}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray={`${progress * circumference} ${circumference}`}
                  className="text-primary"
                />
              </svg>
            )}

            {/* Content */}
            <div className="relative z-10 flex flex-col items-center gap-0.5">
              {isSuccess ? (
                <Check className="w-4 h-4 text-accent" />
              ) : (
                <>
                  <span className="text-[10px] font-medium text-foreground/70">
                    {COMBO_ACTION_LABELS[target.command]?.split(' ')[0] || target.label}
                  </span>
                </>
              )}
            </div>

            {/* Hover label */}
            {isHovered && !isSuccess && (
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-primary text-primary-foreground text-[9px] whitespace-nowrap animate-in fade-in">
                {TRIGGER_LABELS[target.trigger]}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TargetOverlay;
