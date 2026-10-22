import { FormControl, FormGroup } from '@angular/forms';
import { endAfterStart, ianaTimezone } from './validators';

describe('validators', () => {
  describe('endAfterStart', () => {
    const window = (start: string, end: string, allowEqual = false): FormGroup =>
      new FormGroup(
        { start: new FormControl(start), end: new FormControl(end) },
        { validators: endAfterStart('start', 'end', allowEqual) },
      );

    it('accepts an end after the start', () => {
      expect(window('09:00', '17:00').errors).toBeNull();
    });

    it('rejects an end before or equal to the start', () => {
      expect(window('17:00', '09:00').errors).toEqual({ endBeforeStart: true });
      expect(window('09:00', '09:00').errors).toEqual({ endBeforeStart: true });
    });

    it('allows equal dates when asked (a one-day break)', () => {
      expect(window('2026-12-24', '2026-12-24', true).errors).toBeNull();
    });

    it('leaves missing values to `required`', () => {
      expect(window('', '09:00').errors).toBeNull();
    });
  });

  it('ianaTimezone accepts real zones and rejects made-up ones', () => {
    expect(ianaTimezone(new FormControl('Europe/Berlin'))).toBeNull();
    expect(ianaTimezone(new FormControl('Mars/Olympus'))).toEqual({ timezone: true });
    expect(ianaTimezone(new FormControl(''))).toBeNull();
  });
});
