import { describe, expect, it } from '@jest/globals';
import { EntityNotFoundError } from '../../../common/errors.js';
import type { BookingService } from '../../../bookings/booking.service.js';
import { ToolDispatcher } from '../../../assistant/assistant.tools.js';
import type { Principal } from '../../auth/principal.js';
import { BookingToolsProvider } from '../booking.tools.js';
import type { ToolDefinition } from '../tool-registry.js';

const owner: Principal = { id: 'student-1', kind: 'student' };

function makeProvider(bookings: Partial<BookingService>): BookingToolsProvider {
  const dispatcher = new ToolDispatcher({} as never, {} as never, bookings as BookingService);
  return new BookingToolsProvider(dispatcher, bookings as BookingService);
}

function tool(provider: BookingToolsProvider, name: string): ToolDefinition {
  const found = provider.tools.find((t) => t.name === name);
  if (found === undefined) throw new Error(`tool not registered: ${name}`);
  return found;
}

describe('BookingToolsProvider', () => {
  describe('cancelLesson', () => {
    it("denies cancelling another student's booking — surfaced as a tool error, not a crash", async () => {
      const provider = makeProvider({
        cancelForStudent: (id) => Promise.reject(new EntityNotFoundError('Booking', id)),
      });

      const result = await tool(provider, 'cancelLesson').execute(owner, { bookingId: 'b1' });

      expect(result).toEqual({ error: expect.stringContaining('Booking') as unknown });
    });

    it("cancels the caller's own booking", async () => {
      let calledWith: { id: string; studentId: string } | undefined;
      const provider = makeProvider({
        cancelForStudent: (id, studentId) => {
          calledWith = { id, studentId };
          return Promise.resolve({ id, status: 'CANCELLED' } as never);
        },
      });

      const result = await tool(provider, 'cancelLesson').execute(owner, { bookingId: 'b1' });

      expect(result).toEqual({ id: 'b1', status: 'CANCELLED' });
      expect(calledWith).toEqual({ id: 'b1', studentId: owner.id });
    });

    it('requires bookingId without calling the service', async () => {
      let called = false;
      const provider = makeProvider({
        cancelForStudent: () => {
          called = true;
          return Promise.resolve({} as never);
        },
      });

      const result = await tool(provider, 'cancelLesson').execute(owner, {});

      expect(result).toEqual({ error: 'bookingId is required.' });
      expect(called).toBe(false);
    });

    it('summarizes with the booking id', () => {
      const provider = makeProvider({});
      const summary = tool(provider, 'cancelLesson').summarize?.({ bookingId: 'b1' });
      expect(summary).toBe('Cancel booking b1?');
    });
  });

  describe('listMyLessons', () => {
    it("lists only the caller's own bookings, scoped server-side", async () => {
      let calledWith: unknown;
      const provider = makeProvider({
        findAll: (filter) => {
          calledWith = filter;
          return Promise.resolve([
            {
              id: 'b1',
              tutorId: 't1',
              subjectId: 'sub1',
              startTime: new Date('2026-07-06T09:00:00.000Z'),
              endTime: new Date('2026-07-06T10:00:00.000Z'),
              status: 'PENDING',
            },
          ] as never);
        },
      });

      const result = await tool(provider, 'listMyLessons').execute(owner, {});

      expect(calledWith).toEqual({ studentId: owner.id });
      expect(result).toEqual({
        lessons: [
          {
            id: 'b1',
            tutorId: 't1',
            subjectId: 'sub1',
            startTime: '2026-07-06T09:00:00.000Z',
            endTime: '2026-07-06T10:00:00.000Z',
            status: 'PENDING',
          },
        ],
      });
    });
  });

  describe('bookLesson (wraps ToolDispatcher, unchanged behavior)', () => {
    it('forwards args and the caller id to the dispatcher', async () => {
      let received: {
        tutorId: string;
        subjectId: string;
        startTime: Date;
        studentId: string;
      } | null = null;
      const provider = makeProvider({
        bookLesson: (input, studentId) => {
          received = { ...input, studentId };
          return Promise.resolve({
            id: 'b1',
            status: 'PENDING',
            startTime: new Date('2026-07-06T09:00:00.000Z'),
            endTime: new Date('2026-07-06T10:00:00.000Z'),
          } as never);
        },
      });
      const args = { tutorId: 't1', subjectId: 'sub1', startTime: '2026-07-06T09:00:00.000Z' };

      const result = await tool(provider, 'bookLesson').execute(owner, args);

      expect(received).toEqual({
        tutorId: 't1',
        subjectId: 'sub1',
        startTime: new Date('2026-07-06T09:00:00.000Z'),
        studentId: owner.id,
      });
      expect(result).toMatchObject({ id: 'b1', status: 'PENDING' });
    });

    it('is kind: write and requires confirmation', () => {
      const provider = makeProvider({});
      const bookLesson = tool(provider, 'bookLesson');
      expect(bookLesson.kind).toBe('write');
      expect(bookLesson.requiresConfirmation).toBe(true);
    });
  });
});
