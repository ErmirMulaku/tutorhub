import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { Router } from '@angular/router';
import { Store } from '@ngrx/store';
import type { BookingTransition } from '../../core/api/bookings-api';
import { loadOnTags } from '../../core/api/cache-tags';
import type { TutorBooking } from '../../core/api/models';
import { BookingsActions, bookingsFeature } from '../../core/bookings/bookings.store';
import { dayOf, timeOf } from '../../core/format';
import { Avatar } from '../../shared/avatar';
import { Button } from '../../shared/button';
import { Card } from '../../shared/card';
import { ErrorState } from '../../shared/error-state';
import { type Segment, SegmentedTabs } from '../../shared/segmented-tabs';
import { Skeleton } from '../../shared/skeleton';
import { StatusPill } from '../../shared/status-pill';
import { ToastService } from '../../shared/toast';

type Tab = 'upcoming' | 'pending' | 'past';
const TABS: readonly Tab[] = ['upcoming', 'pending', 'past'];

function inTab(b: TutorBooking, tab: Tab): boolean {
  if (tab === 'pending') return b.status === 'PENDING';
  if (tab === 'upcoming') return b.status === 'CONFIRMED';
  return b.status === 'COMPLETED' || b.status === 'CANCELLED' || b.status === 'NO_SHOW';
}

/** Port of features/lessons/LessonsScreen.tsx. */
@Component({
  selector: 'th-lessons-page',
  imports: [Avatar, Button, Card, ErrorState, SegmentedTabs, Skeleton, StatusPill],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './lessons-page.html',
})
export class LessonsPage {
  private readonly store = inject(Store);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** `?status=` and `?q=` — bound straight from the URL (withComponentInputBinding). */
  readonly status = input<string>();
  readonly q = input<string>();

  /** Starts from `?status=`, but the tabs can change it (React: useState(initial)). */
  protected readonly tab = linkedSignal<Tab>(() => {
    const s = this.status();
    return TABS.find((t) => t === s) ?? 'upcoming';
  });

  // useGetTutorBookingsQuery() → NgRx selectors over the store.
  private readonly bookings = this.store.selectSignal(bookingsFeature.selectLessons);
  private readonly lessonsStatus = this.store.selectSignal(bookingsFeature.selectLessonsStatus);
  protected readonly isLoading = computed(() => this.lessonsStatus() === 'loading');
  protected readonly loadFailed = computed(() => this.lessonsStatus() === 'error');
  protected readonly pendingCount = this.store.selectSignal(bookingsFeature.selectPendingCount);

  protected readonly query = computed(() => (this.q() ?? '').trim());
  /** A search matches across every status; otherwise filter by the active tab. */
  protected readonly rows = computed(() => {
    const q = this.query().toLowerCase();
    return this.bookings().filter((b) =>
      q !== ''
        ? b.student.fullName.toLowerCase().includes(q) || b.subject.name.toLowerCase().includes(q)
        : inTab(b, this.tab()),
    );
  });
  protected readonly emptyText = computed(() =>
    this.query() !== '' ? `No lessons match “${this.query()}”.` : `No ${this.tab()} lessons.`,
  );
  protected readonly segments = computed<Segment<Tab>[]>(() => [
    { key: 'upcoming', label: 'Upcoming' },
    { key: 'pending', label: 'Pending', badge: this.pendingCount() },
    { key: 'past', label: 'Past' },
  ]);

  protected readonly dayOf = dayOf;
  protected readonly timeOf = timeOf;

  constructor() {
    loadOnTags(['Booking'], () => BookingsActions.loadLessons());
  }

  protected retry(): void {
    this.store.dispatch(BookingsActions.loadLessons());
  }

  protected changeTab(next: Tab): void {
    this.tab.set(next);
    void this.router.navigate([], {
      queryParams: next === 'upcoming' ? {} : { status: next },
      replaceUrl: true,
    });
  }

  protected clearSearch(): void {
    void this.router.navigate([], { queryParams: {}, replaceUrl: true });
  }

  protected change(booking: TutorBooking, transition: BookingTransition): void {
    this.store.dispatch(BookingsActions.changeStatus({ booking, transition }));
  }

  protected say(message: string): void {
    this.toast.show(message);
  }
}
