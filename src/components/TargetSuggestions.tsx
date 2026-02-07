import React from 'react';
import { Lightbulb, Plus, Move, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useScreenTargets, TargetSuggestion } from '@/hooks/useScreenTargets';
import { COMBO_ACTION_LABELS, ComboAction } from '@/hooks/useGestureCombos';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';

interface TargetSuggestionsProps {
  className?: string;
}

export const TargetSuggestions: React.FC<TargetSuggestionsProps> = ({ className }) => {
  const { getSuggestions, addTarget, behavior } = useScreenTargets();
  const haptics = useHapticFeedback();
  const suggestions = getSuggestions();

  // Top manual actions today
  const topActions = Object.entries(behavior.manualActions)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  if (suggestions.length === 0 && topActions.length === 0) {
    return (
      <div className={cn('p-4 rounded-lg border border-dashed border-border text-center space-y-2', className)}>
        <Lightbulb className="w-6 h-6 mx-auto text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Use the app with Remote Control active to get personalized suggestions
        </p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      <h4 className="text-sm font-medium flex items-center gap-2">
        <Lightbulb className="w-4 h-4 text-primary" />
        Smart Suggestions
      </h4>

      {/* Suggestions */}
      {suggestions.map(suggestion => (
        <div
          key={suggestion.id}
          className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-2"
        >
          <div className="flex items-start gap-2">
            {suggestion.type === 'add' && <Plus className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
            {suggestion.type === 'move' && <Move className="w-4 h-4 text-primary mt-0.5 shrink-0" />}
            <p className="text-xs text-foreground">{suggestion.message}</p>
          </div>
          {suggestion.type === 'add' && suggestion.command && (
            <Button
              size="sm"
              variant="outline"
              className="w-full text-xs"
              onClick={() => {
                addTarget({
                  label: COMBO_ACTION_LABELS[suggestion.command as ComboAction] || 'Target',
                  command: suggestion.command!,
                  trigger: suggestion.trigger || 'gazeAndBlink',
                  position: suggestion.position || { x: 0.5, y: 0.5 },
                  size: 10,
                  enabled: true,
                });
                haptics.success();
              }}
            >
              <Plus className="w-3 h-3 mr-1" /> Add Target
            </Button>
          )}
        </div>
      ))}

      {/* Activity insights */}
      {topActions.length > 0 && (
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <h5 className="text-xs font-medium text-muted-foreground">Today's Activity</h5>
          <div className="space-y-1">
            {topActions.map(([action, count]) => (
              <div key={action} className="flex items-center justify-between text-xs">
                <span>{COMBO_ACTION_LABELS[action as ComboAction] || action}</span>
                <span className="text-muted-foreground">{count}×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TargetSuggestions;
