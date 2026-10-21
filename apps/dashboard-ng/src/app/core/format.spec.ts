import { BookingStatus } from '@ermulaku/types';
import { STATUS_LABEL, money, statusTone } from './format';

describe('format helpers', () => {
  it('formats cents as whole US dollars', () => {
    expect(money(124_000)).toBe('$1,240');
    expect(money(0)).toBe('$0');
  });

  it('maps every booking status to a pill tone', () => {
    expect(statusTone(BookingStatus.Confirmed)).toBe('success');
    expect(statusTone(BookingStatus.Pending)).toBe('warn');
    expect(statusTone(BookingStatus.Cancelled)).toBe('danger');
    expect(statusTone(BookingStatus.NoShow)).toBe('danger');
    expect(statusTone(BookingStatus.Completed)).toBe('neutral');
  });

  it('has a label for every status in @ermulaku/types', () => {
    for (const status of Object.values(BookingStatus)) {
      expect(STATUS_LABEL[status]).toBeTruthy();
    }
  });
});
