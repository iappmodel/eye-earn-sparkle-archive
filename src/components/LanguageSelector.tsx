import React from 'react';
import { Check, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocalization } from '@/contexts/LocalizationContext';
import { SupportedLocale } from '@/locales';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'list';
  showNativeName?: boolean;
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  showNativeName = true,
  className,
}) => {
  const { locale, setLocale, availableLocales, t } = useLocalization();

  if (variant === 'list') {
    return (
      <div className={cn('space-y-2', className)}>
        <p className="text-sm text-muted-foreground mb-3">{t('settings.selectLanguage')}</p>
        {availableLocales.map((loc) => (
          <button
            key={loc.code}
            onClick={() => setLocale(loc.code)}
            className={cn(
              'w-full flex items-center justify-between p-3 rounded-xl transition-all',
              locale === loc.code
                ? 'neu-button bg-primary/10 border border-primary/30'
                : 'neu-inset hover:bg-muted/50'
            )}
          >
            <div className="flex items-center gap-3">
              <span className="text-lg">{getLanguageFlag(loc.code)}</span>
              <div className="text-left">
                <p className={cn(
                  'font-medium',
                  locale === loc.code ? 'text-primary' : 'text-foreground'
                )}>
                  {showNativeName ? loc.nativeName : loc.name}
                </p>
                {showNativeName && (
                  <p className="text-xs text-muted-foreground">{loc.name}</p>
                )}
              </div>
            </div>
            {locale === loc.code && (
              <Check className="w-5 h-5 text-primary" />
            )}
          </button>
        ))}
      </div>
    );
  }

  return (
    <Select value={locale} onValueChange={(value) => setLocale(value as SupportedLocale)}>
      <SelectTrigger className={cn('w-full neu-inset', className)}>
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-muted-foreground" />
          <SelectValue>
            {availableLocales.find((l) => l.code === locale)?.nativeName}
          </SelectValue>
        </div>
      </SelectTrigger>
      <SelectContent>
        {availableLocales.map((loc) => (
          <SelectItem key={loc.code} value={loc.code}>
            <div className="flex items-center gap-2">
              <span>{getLanguageFlag(loc.code)}</span>
              <span>{showNativeName ? loc.nativeName : loc.name}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

function getLanguageFlag(locale: SupportedLocale): string {
  const flags: Record<SupportedLocale, string> = {
    en: '🇺🇸',
    es: '🇪🇸',
    pt: '🇧🇷',
    ar: '🇸🇦',
    hi: '🇮🇳',
  };
  return flags[locale] || '🌐';
}

export default LanguageSelector;
