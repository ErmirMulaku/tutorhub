import { Injectable } from '@nestjs/common';
import type { BookingStatus } from '@ermulaku/types';
import type { Booking } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { assertCanTransition } from './booking-status.js';
import { BookingNotFoundError } from './booking.errors.js';

/**
 * The shared booking service — one source of truth for booking rules across all
 * transports. Status changes always go through the {@link assertCanTransition}
 * state machine.
 */
@Injectable()
export class BookingService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({ where: { id } });
    if (booking === null) {
      throw new BookingNotFoundError(id);
    }
    return booking;
  }

  /** Move a booking to `to`, enforcing the lifecycle state machine. */
  async updateStatus(id: string, to: BookingStatus): Promise<Booking> {
    const booking = await this.findById(id);
    assertCanTransition(booking.status, to);
    return this.prisma.booking.update({ where: { id }, data: { status: to } });
  }
}
