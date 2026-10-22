import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import type { TutorBooking } from '../../core/api/models';
import { timeOf } from '../../core/format';
import { daysFrom } from './calendar-range';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MAX_CHIPS = 3;

/** Port of CalendarScreen's MonthGrid: a 6-week page; clicking a day drills into it. */
@Component({
  selector: 'th-month-grid',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'cal-month' },
  template: `
    <div class="cal-month__head">
      @for (d of weekdays; track d) {
        <div>{{ d }}</div>
      }
    </div>
    <div class="cal-month__grid">
      @for (cell of cells(); track cell.key) {
        <button
          type="button"
          class="cal-month__cell"
          [class.cal-month__cell--muted]="cell.muted"
          [class.cal-month__cell--today]="cell.today"
          (click)="picked.emit(cell.date)"
        >
          <span class="cal-month__date">{{ cell.date.getDate() }}</span>
          @for (b of cell.shown; track b.id) {
            <span class="cal-month__chip cal-month__chip--{{ b.subject.name.toLowerCase() }}">
              {{ timeOf(b.startTime) }} {{ b.subject.name }}
            </span>
          }
          @if (cell.more > 0) {
            <span class="cal-month__more">+{{ cell.more }} more</span>
          }
        </button>
      }
    </div>
  `,
})
export class MonthGrid {
  readonly gridStart = input.required<Date>();
  /** The month being shown (0–11); other days are muted. */
  readonly month = input.required<number>();
  readonly eventsByDay = input.required<ReadonlyMap<string, TutorBooking[]>>();
  readonly picked = output<Date>();

  protected readonly weekdays = WEEKDAYS;
  protected readonly timeOf = timeOf;

  protected readonly cells = computed(() => {
    const todayKey = new Date().toDateString();
    return daysFrom(this.gridStart(), 42).map((date) => {
      const key = date.toDateString();
      const events = this.eventsByDay().get(key) ?? [];
      return {
        key,
        date,
        muted: date.getMonth() !== this.month(),
        today: key === todayKey,
        shown: events.slice(0, MAX_CHIPS),
        more: Math.max(0, events.length - MAX_CHIPS),
      };
    });
  });
}
