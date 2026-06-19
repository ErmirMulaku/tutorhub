import { ApiPropertyOptional } from '@nestjs/swagger';
import { BookingStatus } from '@ermulaku/types';
import { IsEnum, IsOptional, IsUUID } from 'class-validator';

export class BookingQueryDto {
  @ApiPropertyOptional({ enum: BookingStatus })
  @IsOptional()
  @IsEnum(BookingStatus)
  status?: BookingStatus;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  tutorId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  studentId?: string;
}
