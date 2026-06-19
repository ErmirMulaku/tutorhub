import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingController } from './booking.controller.js';
import { BookingResolver } from './booking.resolver.js';
import { BookingService } from './booking.service.js';

@Module({
  imports: [AuthModule],
  controllers: [BookingController],
  providers: [BookingService, BookingResolver],
  exports: [BookingService],
})
export class BookingsModule {}
