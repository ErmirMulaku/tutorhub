import { ApiProperty } from '@nestjs/swagger';
import { BookingStatus } from '@ermulaku/types';
import { IsEnum } from 'class-validator';

export class UpdateBookingStatusDto {
  @ApiProperty({ enum: BookingStatus, example: BookingStatus.Confirmed })
  @IsEnum(BookingStatus)
  status!: BookingStatus;
}
