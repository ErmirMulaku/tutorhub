import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Booking } from '../generated/prisma/client.js';
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
  create(@Body() dto: CreateBookingDto): Promise<Booking> {
    return this.bookings.create(dto);
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
