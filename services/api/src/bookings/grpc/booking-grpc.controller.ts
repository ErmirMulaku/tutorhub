import { Controller } from '@nestjs/common';
import { GrpcMethod, RpcException } from '@nestjs/microservices';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { map, type Observable } from 'rxjs';
import { InvalidBookingTransitionError } from '../booking.errors.js';
import { BadRequestDomainError, EntityNotFoundError } from '../../common/errors.js';
import { BookingStatus, type Booking } from '../../generated/prisma/client.js';
import { BookingEvents } from '../booking-events.js';
import { BookingService } from '../booking.service.js';

const SLOT_MINUTES = 60;
const MS_PER_MINUTE = 60_000;
const NANOS_PER_MS = 1_000_000;

interface Timestamp {
  seconds: number | string;
  nanos: number;
}
interface GrpcBooking {
  id: string;
  tutorId: string;
  studentId: string;
  subjectId: string;
  startTime: Timestamp;
  status: string;
}
interface GetReq {
  id: string;
}
interface BookReq {
  tutorId: string;
  studentId: string;
  subjectId: string;
  startTime: Timestamp;
}
interface UpdateReq {
  id: string;
  status: string;
}
interface WatchReq {
  tutorId: string;
}

function toTimestamp(date: Date): Timestamp {
  const ms = date.getTime();
  return { seconds: Math.floor(ms / 1000), nanos: (ms % 1000) * NANOS_PER_MS };
}

function fromTimestamp(ts: Timestamp): Date {
  return new Date(Number(ts.seconds) * 1000 + Math.floor(ts.nanos / NANOS_PER_MS));
}

function toGrpcBooking(booking: Booking): GrpcBooking {
  return {
    id: booking.id,
    tutorId: booking.tutorId,
    studentId: booking.studentId,
    subjectId: booking.subjectId,
    startTime: toTimestamp(booking.startTime),
    status: booking.status,
  };
}

function isBookingStatus(value: string): value is BookingStatus {
  return Object.values(BookingStatus).includes(value as BookingStatus);
}

/** Translate domain errors to gRPC status codes (SPEC §9). */
function toRpcException(error: unknown): RpcException {
  if (error instanceof EntityNotFoundError) {
    return new RpcException({ code: GrpcStatus.NOT_FOUND, message: error.message });
  }
  if (error instanceof InvalidBookingTransitionError) {
    return new RpcException({ code: GrpcStatus.FAILED_PRECONDITION, message: error.message });
  }
  if (error instanceof BadRequestDomainError) {
    return new RpcException({ code: GrpcStatus.INVALID_ARGUMENT, message: error.message });
  }
  return new RpcException({
    code: GrpcStatus.UNKNOWN,
    message: error instanceof Error ? error.message : 'Unknown error',
  });
}

@Controller()
export class BookingGrpcController {
  constructor(
    private readonly bookings: BookingService,
    private readonly events: BookingEvents,
  ) {}

  @GrpcMethod('BookingService', 'GetBooking')
  async getBooking(req: GetReq): Promise<GrpcBooking> {
    try {
      return toGrpcBooking(await this.bookings.findById(req.id));
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @GrpcMethod('BookingService', 'BookLesson')
  async bookLesson(req: BookReq): Promise<GrpcBooking> {
    try {
      const start = fromTimestamp(req.startTime);
      const end = new Date(start.getTime() + SLOT_MINUTES * MS_PER_MINUTE);
      const booking = await this.bookings.create({
        tutorId: req.tutorId,
        studentId: req.studentId,
        subjectId: req.subjectId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
      });
      return toGrpcBooking(booking);
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @GrpcMethod('BookingService', 'UpdateStatus')
  async updateStatus(req: UpdateReq): Promise<GrpcBooking> {
    try {
      if (!isBookingStatus(req.status)) {
        throw new BadRequestDomainError('A concrete status is required.');
      }
      return toGrpcBooking(await this.bookings.updateStatus(req.id, req.status));
    } catch (error) {
      throw toRpcException(error);
    }
  }

  @GrpcMethod('BookingService', 'WatchBookings')
  watchBookings(req: WatchReq): Observable<GrpcBooking> {
    return this.events.forTutor(req.tutorId).pipe(map(toGrpcBooking));
  }
}
