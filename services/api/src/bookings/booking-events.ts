import { Injectable } from '@nestjs/common';
import { type Observable, Subject, filter } from 'rxjs';
import type { Booking } from '../generated/prisma/client.js';

/**
 * In-process RxJS bus for booking changes. The gRPC `WatchBookings` stream
 * subscribes here; Phase 4's Socket.IO gateway will fan the same events out to
 * the dashboard.
 */
@Injectable()
export class BookingEvents {
  private readonly changes = new Subject<Booking>();

  emit(booking: Booking): void {
    this.changes.next(booking);
  }

  forTutor(tutorId: string): Observable<Booking> {
    return this.changes.pipe(filter((booking) => booking.tutorId === tutorId));
  }
}
