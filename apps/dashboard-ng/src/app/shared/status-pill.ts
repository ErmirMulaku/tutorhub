import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STATUS_LABEL, statusTone } from '@ermulaku/dashboard-kit';
import type { BookingStatus } from '@ermulaku/types';

/** Port of components/StatusPill.tsx — reuses the `.th-pill` tone classes. */
@Component({
  selector: 'th-status-pill',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'th-pill',
    '[class.th-pill--success]': "tone() === 'success'",
    '[class.th-pill--warn]': "tone() === 'warn'",
    '[class.th-pill--danger]': "tone() === 'danger'",
  },
  template: '{{ label() }}',
})
export class StatusPill {
  readonly status = input.required<BookingStatus>();
  protected readonly tone = computed(() => statusTone(this.status()));
  protected readonly label = computed(() => STATUS_LABEL[this.status()]);
}
