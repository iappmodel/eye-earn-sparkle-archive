import React, { useState } from 'react';
import { X, Globe, DollarSign, Palette, Moon, Sun } from 'lucide-react';
import { NeuButton } from './NeuButton';
import { LanguageSelector } from './LanguageSelector';
import { useLocalization } from '@/contexts/LocalizationContext';
import { cn } from '@/lib/utils';

interface SettingsScreenProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  isOpen,
  onClose,
}) => {
  const { t, localeConfig, formatCurrency, isRTL } = useLocalization();
  const [isDarkMode, setIsDarkMode] = useState(() => 
    document.documentElement.classList.contains('dark')
  );

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

          {/* Theme Section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <Palette className="w-5 h-5 text-primary" />
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
