// Hidden Buttons Manager - Quick access to restore hidden buttons
import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, RotateCcw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { getHiddenButtons, setHiddenButtons } from './LongPressButtonWrapper';
import { toast } from 'sonner';

// Button labels mapping
const BUTTON_LABELS: Record<string, string> = {
  'like': 'Like',
  'comment': 'Comments',
  'share': 'Share',
  'follow': 'Follow',
  'wallet': 'Wallet',
  'profile': 'Profile',
  'settings': 'Settings',
  'tip': 'Tip',
  'save': 'Save',
  'report': 'Report',
  'mute': 'Mute',
  'visibility-toggle': 'Visibility Toggle',
  'achievements-button': 'Achievements',
};

interface HiddenButtonsManagerProps {
  className?: string;
}

export const HiddenButtonsManager: React.FC<HiddenButtonsManagerProps> = ({ className }) => {
  const [hiddenButtons, setHiddenButtonsState] = useState<string[]>(() => getHiddenButtons());
  const { light, success } = useHapticFeedback();

  // Listen for changes
  useEffect(() => {
    const handleChange = (e: CustomEvent) => {
      setHiddenButtonsState(e.detail);
    };
    window.addEventListener('hiddenButtonsChanged', handleChange as EventListener);
    return () => window.removeEventListener('hiddenButtonsChanged', handleChange as EventListener);
  }, []);

  const handleRestoreButton = (buttonId: string) => {
    light();
    const newHidden = hiddenButtons.filter(id => id !== buttonId);
    setHiddenButtons(newHidden);
    setHiddenButtonsState(newHidden);
    toast.success(`${BUTTON_LABELS[buttonId] || buttonId} restored`);
  };

  const handleRestoreAll = () => {
    success();
    setHiddenButtons([]);
    setHiddenButtonsState([]);
    toast.success('All buttons restored');
  };

  if (hiddenButtons.length === 0) {
    return (
      <div className={cn('p-4 rounded-xl bg-muted/30 border border-border/30', className)}>
        <div className="flex items-center gap-3 text-muted-foreground">
          <Sparkles className="w-5 h-5" />
          <span className="text-sm">All buttons are visible</span>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden buttons list */}
      <div className="space-y-2">
        {hiddenButtons.map(buttonId => (
          <div
            key={buttonId}
            className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/30"
          >
            <div className="flex items-center gap-3">
              <EyeOff className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {BUTTON_LABELS[buttonId] || buttonId}
              </span>
            </div>
            <button
              onClick={() => handleRestoreButton(buttonId)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              Restore
            </button>
          </div>
        ))}
      </div>

      {/* Restore all button */}
      {hiddenButtons.length > 1 && (
        <button
          onClick={handleRestoreAll}
          className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="font-medium">Restore All ({hiddenButtons.length})</span>
        </button>
      )}
    </div>
  );
};

export default HiddenButtonsManager;
