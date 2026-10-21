import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Store } from '@ngrx/store';
import { combineLatest, distinctUntilChanged, map, startWith } from 'rxjs';
import { CacheTags } from '../../core/api/cache-tags';
import type { TutorBooking } from '../../core/api/models';
import { BookingsActions, bookingsFeature } from '../../core/bookings/bookings.store';
import { timeOf } from '../../core/format';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { type Segment, SegmentedTabs } from '../../shared/segmented-tabs';
import {
  type CalendarView,
  END_HOUR,
  ROW_H,
  START_HOUR,
  daysFrom,
  eventBox,
  rangeFor,
  rangeLabel,
  stepAnchor,
} from './calendar-range';
import { MonthGrid } from './month-grid';

/**
 * Port of features/calendar/CalendarScreen.tsx — Day / Week / Month views of
 * the tutor's bookings, from the NgRx `bookings` feature (so a live
 * `bookingChanged` patches the grid immediately).
 */
@Component({
  selector: 'th-calendar-page',
  imports: [Button, Card, ErrorState, MonthGrid, SegmentedTabs],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './calendar-page.html',
})
export class CalendarPage {
  private readonly store = inject(Store);

  protected readonly view = signal<CalendarView>('week');
  protected readonly anchor = signal(new Date());
  protected readonly views: Segment<CalendarView>[] = [
    { key: 'day', label: 'Day' },
    { key: 'week', label: 'Week' },
    { key: 'month', label: 'Month' },
  ];

  protected readonly range = computed(() => rangeFor(this.view(), this.anchor()));
  protected readonly label = computed(() => rangeLabel(this.view(), this.anchor(), this.range()));
  /** The day columns, with everything the template shows precomputed. */
  protected readonly columns = computed(() => {
    const todayKey = new Date().toDateString();
    return daysFrom(this.range().gridStart, this.range().columns).map((date) => {
      const key = date.toDateString();
      return {
        key,
        weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
        dayOfMonth: date.getDate(),
        today: key === todayKey,
        events: this.eventsByDay().get(key) ?? [],
      };
    });
  });
  protected readonly gridColumns = computed(
    () => `58px repeat(${String(this.range().columns)}, 1fr)`,
  );
  protected readonly hours = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => {
    const h = START_HOUR + i;
    return `${String(h).padStart(2, '0')}:00`;
  });
  protected readonly rowHeight = ROW_H;
  protected readonly rowHeightPx = `${String(ROW_H)}px`;

  private readonly rangeStatus = this.store.selectSignal(bookingsFeature.selectRangeStatus);
  protected readonly loadFailed = computed(() => this.rangeStatus() === 'error');
  private readonly bookings = this.store.selectSignal(bookingsFeature.selectRange);
  /** Visible events grouped by local day — built once, not re-filtered per cell. */
  protected readonly eventsByDay = computed(() => {
    const byDay = new Map<string, TutorBooking[]>();
    for (const b of this.bookings()) {
      if (b.status === 'CANCELLED') continue;
      const key = new Date(b.startTime).toDateString();
      byDay.set(key, [...(byDay.get(key) ?? []), b]);
    }
    return byDay;
  });

  protected readonly timeOf = timeOf;
  protected readonly eventBox = eventBox;

  constructor() {
    // The window to fetch follows the view and anchor. combineLatest emits
    // whenever either changes; distinctUntilChanged skips no-op moves (e.g.
    // "Today" while already on today). Combined with the 'Booking' tag, the
    // window is also reloaded after any booking mutation or live event.
    const window$ = combineLatest([toObservable(this.view), toObservable(this.anchor)]).pipe(
      map(([view, anchor]) => rangeFor(view, anchor)),
      map((r) => ({ from: r.fetchFrom.toISOString(), to: r.fetchTo.toISOString() })),
      distinctUntilChanged((a, b) => a.from === b.from && a.to === b.to),
    );
    combineLatest([window$, inject(CacheTags).changes(['Booking']).pipe(startWith(null))])
      .pipe(takeUntilDestroyed())
      .subscribe(([window]) => this.store.dispatch(BookingsActions.loadRange(window)));
  }

  protected step(dir: -1 | 1): void {
    this.anchor.update((a) => stepAnchor(this.view(), a, dir));
  }

  protected today(): void {
    this.anchor.set(new Date());
  }

  protected openDay(date: Date): void {
    this.anchor.set(date);
    this.view.set('day');
  }

  protected retry(): void {
    const r = this.range();
    this.store.dispatch(
      BookingsActions.loadRange({ from: r.fetchFrom.toISOString(), to: r.fetchTo.toISOString() }),
    );
  }
}
