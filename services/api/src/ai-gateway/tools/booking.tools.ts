import { Inject, Injectable } from '@nestjs/common';
import type { PrincipalKind } from '../../auth/auth-user.js';
import { BookingService } from '../../bookings/booking.service.js';
import { ToolDispatcher, TOOLS as LEGACY_TOOL_SPECS } from '../../assistant/assistant.tools.js';
import type { Principal } from '../auth/principal.js';
import type { ToolDefinition } from './tool-registry.js';

const STUDENT_ONLY: PrincipalKind[] = ['student'];
type LegacyToolName = 'searchTutors' | 'getAvailability' | 'bookLesson';

function argString(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value : '';
}

function summarizeBookLesson(args: Record<string, unknown>): string {
  const when = argString(args, 'startTime');
  const formatted =
    when !== '' && !Number.isNaN(new Date(when).getTime()) ? new Date(when).toUTCString() : when;
  return `Book this lesson: tutor ${argString(args, 'tutorId')}, subject ${argString(args, 'subjectId')}, ${formatted}.`;
}

/**
 * Supplies the booking-related tool definitions for the new registry.
 *
 * `searchTutors` / `getAvailability` / `bookLesson` wrap the existing
 * `ToolDispatcher` directly — reusing it rather than reimplementing is what
 * guarantees "moved into the registry unchanged in behavior" (Phase 2 plan).
 * `cancelLesson` / `listMyLessons` are new tools with no legacy equivalent
 * (the old assistant never supported cancelling), built straight on
 * `BookingService`'s already-ownership-scoped, state-machine-enforced
 * student methods.
 */
@Injectable()
export class BookingToolsProvider {
  readonly tools: ToolDefinition[];

  constructor(
    @Inject(ToolDispatcher) dispatcher: ToolDispatcher,
    @Inject(BookingService) bookings: BookingService,
  ) {
    const fromLegacy = (name: LegacyToolName): ToolDefinition => {
      const spec = LEGACY_TOOL_SPECS.find((tool) => tool.name === name);
      if (spec === undefined) {
        throw new Error(`Missing legacy tool spec: ${name}`);
      }
      const isWrite = name === 'bookLesson';
      return {
        name: spec.name,
        description: spec.description,
        inputSchema: spec.inputSchema,
        kind: isWrite ? 'write' : 'read',
        allowedKinds: STUDENT_ONLY,
        requiresConfirmation: isWrite,
        execute: (principal, args) => dispatcher.execute(name, JSON.stringify(args), principal.id),
        summarize: isWrite ? summarizeBookLesson : undefined,
      };
    };

    this.tools = [
      fromLegacy('searchTutors'),
      fromLegacy('getAvailability'),
      fromLegacy('bookLesson'),
      {
        name: 'cancelLesson',
        description: "Cancel one of the current student's own upcoming lessons.",
        inputSchema: {
          type: 'object',
          properties: {
            bookingId: { type: 'string', description: 'Booking id, from listMyLessons.' },
          },
          required: ['bookingId'],
        },
        kind: 'write',
        allowedKinds: STUDENT_ONLY,
        requiresConfirmation: true,
        execute: async (principal: Principal, args: Record<string, unknown>): Promise<unknown> => {
          const bookingId = argString(args, 'bookingId');
          if (bookingId === '') {
            return { error: 'bookingId is required.' };
          }
          try {
            const booking = await bookings.cancelForStudent(bookingId, principal.id);
            return { id: booking.id, status: booking.status };
          } catch (err) {
            return { error: err instanceof Error ? err.message : 'Cancellation failed.' };
          }
        },
        summarize: (args) => `Cancel booking ${argString(args, 'bookingId')}?`,
      },
      {
        name: 'listMyLessons',
        description:
          "List the current student's own lessons (id, tutor, subject, time, status) — " +
          'use this to find a bookingId before cancelling or asking about a specific lesson.',
        inputSchema: { type: 'object', properties: {} },
        kind: 'read',
        allowedKinds: STUDENT_ONLY,
        requiresConfirmation: false,
        execute: async (principal: Principal): Promise<unknown> => {
          const all = await bookings.findAll({ studentId: principal.id });
          return {
            lessons: all.map((booking) => ({
              id: booking.id,
              tutorId: booking.tutorId,
              subjectId: booking.subjectId,
              startTime: booking.startTime.toISOString(),
              endTime: booking.endTime.toISOString(),
              status: booking.status,
            })),
          };
        },
      },
    ];
  }
}
