import type { JSX } from 'react';
import type { TutorBookingStatus } from '../store/api';
import { STATUS_LABEL, statusTone } from '../lib/format';

/** Booking status pill, reusing @ermulaku/ui's `.th-pill` tones. */
export function StatusPill({ status }: { status: TutorBookingStatus }): JSX.Element {
  const tone = statusTone(status);
  return (
    <span className={`th-pill${tone === 'neutral' ? '' : ` th-pill--${tone}`}`}>
      {STATUS_LABEL[status]}
    </span>
  );
}
