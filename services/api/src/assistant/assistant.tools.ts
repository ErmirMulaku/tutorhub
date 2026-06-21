import { Injectable, Logger } from '@nestjs/common';
import type { ChatCompletionTool } from 'openai/resources/chat/completions';
import { Level } from '@ermulaku/types';
import { AvailabilityService } from '../availability/availability.service.js';
import { BookingService } from '../bookings/booking.service.js';
import { TutorsService } from '../tutors/tutors.service.js';

/** OpenAI function/tool schemas the model may call. */
export const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'searchTutors',
      description: 'Find tutors, optionally filtered by subject (substring) and/or level.',
      parameters: {
        type: 'object',
        properties: {
          subject: { type: 'string', description: 'Subject name or fragment, e.g. "math".' },
          level: { type: 'string', enum: ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'] },
          limit: { type: 'integer', minimum: 1, maximum: 10 },
        },
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'getAvailability',
      description: "List a tutor's bookable 1-hour slots on a date (their timezone).",
      parameters: {
        type: 'object',
        properties: {
          tutorId: { type: 'string', description: 'Tutor id from searchTutors.' },
          date: { type: 'string', description: 'Day as YYYY-MM-DD.' },
        },
        required: ['tutorId', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bookLesson',
      description: 'Book a lesson in an available slot for the current student.',
      parameters: {
        type: 'object',
        properties: {
          tutorId: { type: 'string' },
          subjectId: { type: 'string', description: 'A subject id offered by the tutor.' },
          startTime: { type: 'string', description: 'Slot start as an ISO-8601 UTC instant.' },
        },
        required: ['tutorId', 'subjectId', 'startTime'],
      },
    },
  },
];

function asObject(raw: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function asString(obj: Record<string, unknown>, key: string): string | undefined {
  const value = obj[key];
  return typeof value === 'string' && value !== '' ? value : undefined;
}

function asLevel(value: unknown): Level | undefined {
  return typeof value === 'string' && (Object.values(Level) as string[]).includes(value)
    ? (value as Level)
    : undefined;
}

/**
 * Executes the model's chosen tool against the real service layer. The model
 * only *decides*; every call runs server-side with the same validation as any
 * other request, and booking is scoped to the supplied student.
 */
@Injectable()
export class ToolDispatcher {
  private readonly logger = new Logger(ToolDispatcher.name);

  constructor(
    private readonly tutors: TutorsService,
    private readonly availability: AvailabilityService,
    private readonly bookings: BookingService,
  ) {}

  async execute(name: string, rawArgs: string, studentId: string): Promise<unknown> {
    const args = asObject(rawArgs);
    this.logger.log(`tool ${name} ${JSON.stringify(args)}`);
    try {
      switch (name) {
        case 'searchTutors':
          return await this.searchTutors(args);
        case 'getAvailability':
          return await this.getAvailability(args);
        case 'bookLesson':
          return await this.bookLesson(args, studentId);
        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Tool execution failed' };
    }
  }

  private async searchTutors(args: Record<string, unknown>): Promise<unknown> {
    const limit = typeof args['limit'] === 'number' ? Math.min(10, Math.max(1, args['limit'])) : 5;
    const page = await this.tutors.findPage({
      subject: asString(args, 'subject') ?? null,
      level: asLevel(args['level']) ?? null,
      limit,
      offset: 0,
    });
    return {
      total: page.total,
      tutors: page.items.map((t) => ({
        id: t.id,
        name: t.name,
        hourlyCents: t.hourlyCents,
        timezone: t.timezone,
      })),
    };
  }

  private async getAvailability(args: Record<string, unknown>): Promise<unknown> {
    const tutorId = asString(args, 'tutorId');
    const date = asString(args, 'date');
    if (!tutorId || !date) return { error: 'tutorId and date are required.' };

    const tutor = await this.tutors.findOne(tutorId);
    const slots = await this.availability.getSlots(tutorId, date);
    return {
      timezone: tutor.timezone,
      subjects: (await this.tutors.subjectsOf(tutorId)).map((s) => ({ id: s.id, name: s.name })),
      slots: slots.map((s) => ({ start: s.start, end: s.end })),
    };
  }

  private async bookLesson(args: Record<string, unknown>, studentId: string): Promise<unknown> {
    const tutorId = asString(args, 'tutorId');
    const subjectId = asString(args, 'subjectId');
    const startTime = asString(args, 'startTime');
    if (!tutorId || !subjectId || !startTime) {
      return { error: 'tutorId, subjectId and startTime are required.' };
    }
    const booking = await this.bookings.bookLesson(
      { tutorId, subjectId, startTime: new Date(startTime) },
      studentId,
    );
    return {
      id: booking.id,
      status: booking.status,
      startTime: booking.startTime.toISOString(),
      endTime: booking.endTime.toISOString(),
    };
  }
}
