import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Typed validators shared by the dashboard's forms. Each returns `null` when
 * valid, or an errors object whose key `FieldError` turns into a message.
 */

/** `end` must be later than `start` ("HH:mm" or ISO date strings compare lexically). */
export function endAfterStart(startKey: string, endKey: string, allowEqual = false): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start: unknown = group.get(startKey)?.value;
    const end: unknown = group.get(endKey)?.value;
    if (typeof start !== 'string' || typeof end !== 'string' || start === '' || end === '') {
      return null; // `required` reports missing values
    }
    const ok = allowEqual ? end >= start : end > start;
    return ok ? null : { endBeforeStart: true };
  };
}

/** A real IANA timezone ("Europe/Berlin"), checked by the runtime's own Intl data. */
export function ianaTimezone(control: AbstractControl): ValidationErrors | null {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value === '') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return null;
  } catch {
    return { timezone: true };
  }
}
