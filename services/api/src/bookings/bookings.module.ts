import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { BookingController } from './booking.controller.js';
import { BookingEvents } from './booking-events.js';
import { BookingResolver } from './booking.resolver.js';
import { BookingService } from './booking.service.js';
import { BookingsGateway } from './bookings.gateway.js';
import { BookingGrpcController } from './grpc/booking-grpc.controller.js';

@Module({
  imports: [AuthModule],
  controllers: [BookingController, BookingGrpcController],
  providers: [BookingService, BookingResolver, BookingEvents, BookingsGateway],
  exports: [BookingService],
})
export class BookingsModule {}
