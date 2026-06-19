import { Module } from '@nestjs/common';
import { BookingService } from './booking.service.js';

@Module({
  providers: [BookingService],
  exports: [BookingService],
})
export class BookingsModule {}
