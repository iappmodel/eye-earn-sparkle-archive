import en from './en.json';
import es from './es.json';
import pt from './pt.json';
import ar from './ar.json';
import hi from './hi.json';

export type SupportedLocale = 'en' | 'es' | 'pt' | 'ar' | 'hi';

export interface LocaleConfig {
  code: SupportedLocale;
  name: string;
  nativeName: string;
  rtl: boolean;
  currency: string;
  currencySymbol: string;
  dateFormat: string;
}

export const locales: Record<SupportedLocale, LocaleConfig> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    rtl: false,
    currency: 'USD',
    currencySymbol: '$',
    dateFormat: 'MM/dd/yyyy',
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    rtl: false,
    currency: 'EUR',
    currencySymbol: '€',
    dateFormat: 'dd/MM/yyyy',
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    rtl: false,
    currency: 'BRL',
    currencySymbol: 'R$',
    dateFormat: 'dd/MM/yyyy',
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    rtl: true,
    currency: 'SAR',
    currencySymbol: 'ر.س',
    dateFormat: 'yyyy/MM/dd',
  },
  hi: {
    code: 'hi',
    name: 'Hindi',
    nativeName: 'हिन्दी',
    rtl: false,
    currency: 'INR',
    currencySymbol: '₹',
    dateFormat: 'dd/MM/yyyy',
  },
};

export const translations: Record<SupportedLocale, typeof en> = {
  en,
  es,
  pt,
  ar,
  hi,
};

export type TranslationKeys = typeof en;
