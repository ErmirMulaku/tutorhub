import { describe, expect, it } from '@jest/globals';
import type { Tutor } from '../../generated/prisma/client.js';
import type { AvailabilityService } from '../../availability/availability.service.js';
import type { BookingService } from '../../bookings/booking.service.js';
import type { TutorsService } from '../../tutors/tutors.service.js';
import { ToolDispatcher } from '../assistant.tools.js';

/** Minimal hand-rolled stubs — the dispatcher only needs a few methods. */
function makeDispatcher(overrides: {
  tutors?: Partial<TutorsService>;
  availability?: Partial<AvailabilityService>;
  bookings?: Partial<BookingService>;
}): ToolDispatcher {
  return new ToolDispatcher(
    (overrides.tutors ?? {}) as TutorsService,
    (overrides.availability ?? {}) as AvailabilityService,
    (overrides.bookings ?? {}) as BookingService,
  );
}

describe('ToolDispatcher', () => {
  it('searchTutors returns a trimmed tutor list', async () => {
    const dispatcher = makeDispatcher({
      tutors: {
        findPage: () =>
          Promise.resolve({
            total: 1,
            // Cast keeps this stub minimal — the dispatcher only reads four fields.
            items: [
              {
                id: 't1',
                name: 'Ada',
                hourlyCents: 3000,
                timezone: 'UTC',
              } as unknown as Tutor,
            ],
          }),
      },
    });

    const result = await dispatcher.execute(
      'searchTutors',
      JSON.stringify({ subject: 'math' }),
      's1',
    );
    expect(result).toEqual({
      total: 1,
      tutors: [{ id: 't1', name: 'Ada', hourlyCents: 3000, timezone: 'UTC' }],
    });
  });

  it('bookLesson forwards parsed args and the student id to BookingService', async () => {
    let received: {
      tutorId: string;
      subjectId: string;
      startTime: Date;
      studentId: string;
    } | null = null;
    const dispatcher = makeDispatcher({
      bookings: {
        bookLesson: (input, studentId) => {
          received = { ...input, studentId };
          return Promise.resolve({
            id: 'b1',
            status: 'PENDING',
            startTime: new Date('2026-07-06T09:00:00.000Z'),
            endTime: new Date('2026-07-06T10:00:00.000Z'),
          }) as ReturnType<BookingService['bookLesson']>;
        },
      },
    });

    const args = { tutorId: 't1', subjectId: 'sub1', startTime: '2026-07-06T09:00:00.000Z' };
    const result = await dispatcher.execute('bookLesson', JSON.stringify(args), 'student-9');

    expect(received).toEqual({
      tutorId: 't1',
      subjectId: 'sub1',
      startTime: new Date('2026-07-06T09:00:00.000Z'),
      studentId: 'student-9',
    });
    expect(result).toMatchObject({ id: 'b1', status: 'PENDING' });
  });

  it('reports missing required booking args without calling the service', async () => {
    const dispatcher = makeDispatcher({});
    const result = await dispatcher.execute('bookLesson', JSON.stringify({ tutorId: 't1' }), 's1');
    expect(result).toEqual({ error: 'tutorId, subjectId and startTime are required.' });
  });

  it('surfaces a service error as a tool error', async () => {
    const dispatcher = makeDispatcher({
      bookings: {
        bookLesson: () => Promise.reject(new Error('Subject sub9 not found')),
      },
    });
    const args = { tutorId: 't1', subjectId: 'sub9', startTime: '2026-07-06T09:00:00.000Z' };
    const result = await dispatcher.execute('bookLesson', JSON.stringify(args), 's1');
    expect(result).toEqual({ error: 'Subject sub9 not found' });
  });

  it('rejects an unknown tool', async () => {
    const dispatcher = makeDispatcher({});
    const result = await dispatcher.execute('deleteEverything', '{}', 's1');
    expect(result).toEqual({ error: 'Unknown tool: deleteEverything' });
  });
});
