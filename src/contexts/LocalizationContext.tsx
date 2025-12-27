import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { 
  SupportedLocale, 
  LocaleConfig, 
  locales, 
  translations, 
  TranslationKeys 
} from '@/locales';
import { format, formatDistanceToNow } from 'date-fns';
import { enUS, es, ptBR, ar, hi } from 'date-fns/locale';

type DeepKeyOf<T> = T extends object
  ? {
      [K in keyof T]-?: K extends string
        ? T[K] extends object
          ? `${K}.${DeepKeyOf<T[K]>}`
          : K
        : never;
    }[keyof T]
  : never;

type TranslationKey = DeepKeyOf<TranslationKeys>;

interface LocalizationContextType {
  locale: SupportedLocale;
  localeConfig: LocaleConfig;
  setLocale: (locale: SupportedLocale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatDate: (date: Date | string, formatStr?: string) => string;
  formatRelativeTime: (date: Date | string) => string;
  isRTL: boolean;
  availableLocales: LocaleConfig[];
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

const LOCALE_STORAGE_KEY = 'app_locale';

const dateLocales = {
  en: enUS,
  es: es,
  pt: ptBR,
  ar: ar,
  hi: hi,
};

// Currency exchange rates (would be fetched from API in production)
const exchangeRates: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  BRL: 4.97,
  SAR: 3.75,
  INR: 83.12,
};

function getNestedValue(obj: any, path: string): string {
  const keys = path.split('.');
  let result = obj;
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      return path; // Return the key if not found
    }
  }
  return typeof result === 'string' ? result : path;
}

export function LocalizationProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
      if (stored && stored in locales) {
        return stored as SupportedLocale;
      }
      // Try to detect from browser
      const browserLang = navigator.language.split('-')[0];
      if (browserLang in locales) {
        return browserLang as SupportedLocale;
      }
    }
    return 'en';
  });

  const localeConfig = locales[locale];
  const currentTranslations = translations[locale];

  useEffect(() => {
    // Update document direction for RTL support
    document.documentElement.dir = localeConfig.rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = locale;
    
    // Store preference
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  }, [locale, localeConfig.rtl]);

  const setLocale = useCallback((newLocale: SupportedLocale) => {
    setLocaleState(newLocale);
  }, []);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      let translation = getNestedValue(currentTranslations, key);
      
      // Fallback to English if translation not found
      if (translation === key && locale !== 'en') {
        translation = getNestedValue(translations.en, key);
      }

      // Replace parameters
      if (params) {
        Object.entries(params).forEach(([paramKey, value]) => {
          translation = translation.replace(`{${paramKey}}`, String(value));
        });
      }

      return translation;
    },
    [currentTranslations, locale]
  );

  const formatCurrency = useCallback(
    (amount: number, currency?: string): string => {
      const targetCurrency = currency || localeConfig.currency;
      const rate = exchangeRates[targetCurrency] || 1;
      const convertedAmount = amount * rate;

      try {
        return new Intl.NumberFormat(locale, {
          style: 'currency',
          currency: targetCurrency,
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(convertedAmount);
      } catch {
        return `${localeConfig.currencySymbol}${convertedAmount.toFixed(2)}`;
      }
    },
    [locale, localeConfig.currency, localeConfig.currencySymbol]
  );

  const formatDate = useCallback(
    (date: Date | string, formatStr?: string): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const dateLocale = dateLocales[locale];
      
      try {
        return format(dateObj, formatStr || localeConfig.dateFormat, { locale: dateLocale });
      } catch {
        return dateObj.toLocaleDateString(locale);
      }
    },
    [locale, localeConfig.dateFormat]
  );

  const formatRelativeTime = useCallback(
    (date: Date | string): string => {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      const dateLocale = dateLocales[locale];
      
      try {
        return formatDistanceToNow(dateObj, { addSuffix: true, locale: dateLocale });
      } catch {
        return dateObj.toLocaleDateString(locale);
      }
    },
    [locale]
  );

  const availableLocales = Object.values(locales);

  return (
    <LocalizationContext.Provider
      value={{
        locale,
        localeConfig,
        setLocale,
        t,
        formatCurrency,
        formatDate,
        formatRelativeTime,
        isRTL: localeConfig.rtl,
        availableLocales,
      }}
    >
      {children}
    </LocalizationContext.Provider>
  );
}

export function useLocalization() {
  const context = useContext(LocalizationContext);
  if (!context) {
    throw new Error('useLocalization must be used within a LocalizationProvider');
  }
  return context;
}
