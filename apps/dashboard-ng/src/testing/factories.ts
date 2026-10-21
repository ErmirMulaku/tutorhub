import type { TutorBooking } from '../app/core/api/models';

/** A booking as the API returns it; override only what a test cares about. */
export function booking(overrides: Partial<TutorBooking> = {}): TutorBooking {
  return {
    id: 'b1',
    startTime: '2026-10-21T09:00:00.000Z',
    endTime: '2026-10-21T10:00:00.000Z',
    status: 'PENDING',
    student: { id: 's1', fullName: 'Mia Chen', avatarColor: null },
    subject: { id: 'sub1', name: 'Mathematics', level: 'ADVANCED' },
    ...overrides,
  };
}
