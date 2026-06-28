import type { TutorBookingStatus } from '../store/api';

/** "$1,240" from cents (whole dollars; the design shows no decimals on KPIs). */
export function money(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

/** "14:00" from an ISO timestamp. */
export function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

/** "Mon 28 Jun" from an ISO timestamp. */
export function dayOf(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  });
}

/** Map a booking status to a pill tone class suffix (success/warn/neutral/danger). */
export function statusTone(status: TutorBookingStatus): 'success' | 'warn' | 'danger' | 'neutral' {
  switch (status) {
    case 'CONFIRMED':
      return 'success';
    case 'PENDING':
      return 'warn';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
    default:
      return 'neutral';
  }
}

export const STATUS_LABEL: Record<TutorBookingStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  NO_SHOW: 'No-show',
};
