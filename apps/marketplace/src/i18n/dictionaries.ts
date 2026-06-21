import type { Locale } from './config';
import en from './en.json';
import ar from './ar.json';

/** The English dictionary is the source of truth for the message shape. */
export type Dictionary = typeof en;

const dictionaries: Record<Locale, Dictionary> = { en, ar };

/** Server-side message lookup. `ar` is type-checked to match `en`'s shape. */
export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replace `{name}` placeholders in a message template. */
export function interpolate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) =>
    key in vars ? String(vars[key]) : match,
  );
}
