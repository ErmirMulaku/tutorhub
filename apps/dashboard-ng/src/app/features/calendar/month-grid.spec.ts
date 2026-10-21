import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { booking } from '../../../testing/factories';
import type { TutorBooking } from '../../core/api/models';
import { mondayOf } from './calendar-range';
import { MonthGrid } from './month-grid';

/**
 * Replaces apps/dashboard's WeekCalendar.test.tsx (that component was unrouted
 * legacy code): render the real month view and check where lessons land.
 */
describe('MonthGrid', () => {
  let fixture: ComponentFixture<MonthGrid>;
  const el = (): HTMLElement => fixture.nativeElement as HTMLElement;
  const cells = (): HTMLButtonElement[] => [
    ...el().querySelectorAll<HTMLButtonElement>('.cal-month__cell'),
  ];

  async function render(
    year: number,
    month: number,
    events: Map<string, TutorBooking[]> = new Map(),
  ): Promise<void> {
    fixture = TestBed.createComponent(MonthGrid);
    fixture.componentRef.setInput('gridStart', mondayOf(new Date(year, month, 1)));
    fixture.componentRef.setInput('month', month);
    fixture.componentRef.setInput('eventsByDay', events);
    await fixture.whenStable();
  }

  it('shows six full weeks starting on a Monday, muting the neighbouring months', async () => {
    await render(2026, 5); // June 2026 starts on a Monday
    expect(cells().length).toBe(42);
    expect(cells()[0]?.querySelector('.cal-month__date')?.textContent).toBe('1');
    // 1–30 June are in the month; 1–12 July are muted.
    expect(cells().filter((c) => c.classList.contains('cal-month__cell--muted')).length).toBe(12);
  });

  it('puts a lesson on its day as a subject-coloured chip', async () => {
    const lesson = booking({ startTime: new Date(2026, 5, 10, 9, 0).toISOString() });
    await render(2026, 5, new Map([[new Date(2026, 5, 10).toDateString(), [lesson]]]));

    const day10 = cells()[9]!;
    const chip = day10.querySelector('.cal-month__chip');
    expect(chip?.classList).toContain('cal-month__chip--mathematics');
    expect(chip?.textContent).toContain('Mathematics');
    expect(el().querySelectorAll('.cal-month__chip').length).toBe(1);
  });

  it('shows at most three chips per day, then "+N more"', async () => {
    const five = ['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => booking({ id }));
    await render(2026, 5, new Map([[new Date(2026, 5, 3).toDateString(), five]]));
    const day3 = cells()[2]!;
    expect(day3.querySelectorAll('.cal-month__chip').length).toBe(3);
    expect(day3.querySelector('.cal-month__more')?.textContent).toBe('+2 more');
  });

  it('emits the clicked day (the screen drills into Day view)', async () => {
    await render(2026, 5);
    const picked: Date[] = [];
    fixture.componentInstance.picked.subscribe((d) => picked.push(d));
    cells()[15]?.click();
    expect(picked[0]?.toDateString()).toBe(new Date(2026, 5, 16).toDateString());
  });

  it('lists every October 2026 date once across the DST change', async () => {
    // React's 24-hour steps showed 25 Oct twice here (see the migration doc).
    await render(2026, 9);
    const october = cells()
      .filter((c) => !c.classList.contains('cal-month__cell--muted'))
      .map((c) => c.querySelector('.cal-month__date')?.textContent);
    expect(october).toEqual(Array.from({ length: 31 }, (_, i) => String(i + 1)));
  });
});
