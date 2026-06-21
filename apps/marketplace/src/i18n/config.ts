/**
 * Locale configuration. A deliberately tiny, dependency-free i18n layer:
 * locale-prefixed routes (`/en`, `/ar`), per-locale text direction, and JSON
 * message dictionaries loaded on the server. Arabic exercises the RTL path
 * (`dir="rtl"` + the UI's CSS logical properties).
 */

export const locales = ['en', 'ar'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

/** Text direction per locale, applied to `<html dir>`. */
export const direction: Record<Locale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  ar: 'rtl',
};

/** Human label for the locale switcher (shown in the locale's own script). */
export const localeName: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
};

/** ISO 4217 currency used when formatting prices in each locale. */
export const localeCurrency: Record<Locale, string> = {
  en: 'USD',
  ar: 'AED',
};

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}
