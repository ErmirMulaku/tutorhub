import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiUnprocessableEntityResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Booking } from '../generated/prisma/client.js';
import { studentPrincipal } from '../idempotency/idempotency.service.js';
import { BookingService } from './booking.service.js';
import { BookingQueryDto } from './dto/booking-query.dto.js';
import { CreateBookingDto } from './dto/create-booking.dto.js';
import { UpdateBookingStatusDto } from './dto/update-booking-status.dto.js';

@ApiTags('bookings')
@Controller('bookings')
export class BookingController {
  constructor(private readonly bookings: BookingService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Booking created (status PENDING).' })
  @ApiNotFoundResponse({ description: 'Referenced tutor, student or subject not found.' })
  @ApiConflictResponse({ description: 'SLOT_UNAVAILABLE or REQUEST_IN_PROGRESS.' })
  @ApiUnprocessableEntityResponse({ description: 'Idempotency-Key reused for another request.' })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Retrying with the same key returns the first booking instead of a new one.',
  })
  create(
    @Body() dto: CreateBookingDto,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
  ): Promise<Booking> {
    if (idempotencyKey === undefined) return this.bookings.create(dto);
    if (idempotencyKey.length === 0 || idempotencyKey.length > 255) {
      throw new BadRequestException('Idempotency-Key must be 1–255 characters.');
    }
    // NOTE: this REST endpoint is still unauthenticated (known gap), so the
    // "principal" is the student the body claims to book for.
    return this.bookings.create(dto, {
      key: idempotencyKey,
      principal: studentPrincipal(dto.studentId),
    });
  }

  @Get()
  findAll(@Query() query: BookingQueryDto): Promise<Booking[]> {
    return this.bookings.findAll(query);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'Booking not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Booking> {
    return this.bookings.findById(id);
  }

  @Patch(':id/status')
  @ApiNotFoundResponse({ description: 'Booking not found.' })
  @ApiConflictResponse({ description: 'Illegal status transition.' })
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateBookingStatusDto,
  ): Promise<Booking> {
    return this.bookings.updateStatus(id, dto.status);
  }
}
