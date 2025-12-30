import React, { useState, useEffect } from 'react';
import { X, Globe, DollarSign, Palette, Moon, Sun, Sparkles, RotateCcw, Move } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { LanguageSelector } from './LanguageSelector';
import { useLocalization } from '@/contexts/LocalizationContext';
import { useAccessibility, ThemePack } from '@/contexts/AccessibilityContext';
import { clearAllPositions, getRepositionedCount } from './DraggableButton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

// Theme configuration with icons and labels
const themeOptions: { id: ThemePack; label: string; icon: React.ReactNode; description: string }[] = [
  { 
    id: 'default', 
    label: 'Cyberpunk', 
    icon: <Sparkles className="w-5 h-5" />, 
    description: 'Neon purple & magenta' 
  },
  { 
    id: 'lunar', 
    label: 'Lunar', 
    icon: <Moon className="w-5 h-5" />, 
    description: 'Soft moonlight glow' 
  },
];

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, localeConfig, formatCurrency, isRTL } = useLocalization();
  const { themePack, setThemePack } = useAccessibility();
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  const [repositionedCount, setRepositionedCount] = useState(0);

  // Update count when screen opens
  useEffect(() => {
    if (isOpen) {
      setRepositionedCount(getRepositionedCount());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const toggleDarkMode = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', newMode ? 'dark' : 'light');
  };

  const handleResetButtonPositions = () => {
    clearAllPositions();
    setRepositionedCount(0);
    toast.success('All button positions reset');
    // Trigger a page reload to apply changes
    window.location.reload();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-lg animate-slide-up">
      <div className={cn(
        "max-w-md mx-auto h-full flex flex-col p-6 overflow-y-auto pb-24",
        isRTL && "rtl"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="font-display text-2xl font-bold">{t('settings.title')}</h1>
          <NeuButton onClick={onClose} size="sm">
            <X className="w-5 h-5" />
          </NeuButton>
        </div>

        <div className="space-y-6">
          {/* Theme Pack Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Theme Pack</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {themeOptions.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setThemePack(theme.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-2 p-4 rounded-xl transition-all duration-300",
                    "border backdrop-blur-sm",
                    themePack === theme.id
                      ? "border-primary bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.3)]"
                      : "border-border/50 bg-card/50 hover:border-primary/50 hover:bg-card/80"
                  )}
                >
                  {/* Theme icon */}
                  <div className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center",
                    "transition-all duration-300",
                    themePack === theme.id
                      ? "bg-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.5)]"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {theme.icon}
                  </div>
                  
                  {/* Theme label */}
                  <span className={cn(
                    "font-display text-sm font-semibold",
                    themePack === theme.id ? "text-primary" : "text-foreground"
                  )}>
                    {theme.label}
                  </span>
                  
                  {/* Theme description */}
                  <span className="text-xs text-muted-foreground text-center">
                    {theme.description}
                  </span>
                  
                  {/* Active indicator */}
                  {themePack === theme.id && (
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-primary animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </section>

          {/* Language Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">{t('settings.language')}</h2>
            </div>
            <LanguageSelector variant="list" />
          </section>

          {/* Currency Display */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-5 h-5 text-icoin" />
              <h2 className="font-display text-lg font-semibold">{t('settings.currency')}</h2>
            </div>
            <div className="neu-inset rounded-xl p-4">
              <p className="text-sm text-muted-foreground mb-2">
                {t('profile.preferences')}
              </p>
              <div className="flex items-center justify-between">
                <span className="font-medium">{localeConfig.currency}</span>
                <span className="text-lg font-bold">
                  {formatCurrency(100)}
                </span>
              </div>
            </div>
          </section>

          {/* Dark Mode Toggle */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              {isDarkMode ? <Moon className="w-5 h-5 text-primary" /> : <Sun className="w-5 h-5 text-icoin" />}
              <h2 className="font-display text-lg font-semibold">{t('settings.theme')}</h2>
            </div>
            <button
              onClick={toggleDarkMode}
              className="w-full flex items-center justify-between p-4 rounded-xl neu-inset hover:bg-muted/50 transition-all"
            >
              <div className="flex items-center gap-3">
                {isDarkMode ? (
                  <Moon className="w-5 h-5 text-primary" />
                ) : (
                  <Sun className="w-5 h-5 text-icoin" />
                )}
                <span className="font-medium">
                  {isDarkMode ? t('settings.darkMode') : t('settings.lightMode')}
                </span>
              </div>
              <div className={cn(
                "w-12 h-7 rounded-full p-1 transition-all",
                isDarkMode ? "bg-primary" : "bg-muted"
              )}>
                <div className={cn(
                  "w-5 h-5 rounded-full bg-background shadow-md transition-transform",
                  isDarkMode && "translate-x-5"
                )} />
              </div>
            </button>
          </section>

          {/* Button Layout Reset */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Move className="w-5 h-5 text-primary" />
              <h2 className="font-display text-lg font-semibold">Button Positions</h2>
            </div>
            <div className="neu-inset rounded-xl p-4 space-y-3">
              <p className="text-sm text-muted-foreground">
                {repositionedCount > 0 
                  ? `${repositionedCount} button${repositionedCount > 1 ? 's' : ''} repositioned`
                  : 'No buttons have been repositioned'}
              </p>
              <button
                onClick={handleResetButtonPositions}
                disabled={repositionedCount === 0}
                className={cn(
                  'w-full flex items-center justify-center gap-2 p-3 rounded-xl transition-all',
                  repositionedCount > 0
                    ? 'bg-destructive/10 text-destructive border border-destructive/30 hover:bg-destructive/20'
                    : 'bg-muted/30 text-muted-foreground cursor-not-allowed'
                )}
              >
                <RotateCcw className="w-4 h-4" />
                <span className="font-medium">Reset All Positions</span>
              </button>
              <p className="text-xs text-muted-foreground/70 text-center">
                Hold any button for 2 seconds to drag it
              </p>
            </div>
          </section>

          {/* RTL Indicator (for RTL languages) */}
          {isRTL && (
            <div className="p-4 rounded-xl bg-primary/10 border border-primary/30">
              <p className="text-sm text-primary text-center">
                🌐 RTL Layout Active
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SettingsScreen;
