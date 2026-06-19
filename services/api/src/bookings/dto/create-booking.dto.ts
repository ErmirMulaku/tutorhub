import { ApiProperty } from '@nestjs/swagger';
import { IsISO8601, IsUUID } from 'class-validator';

export class CreateBookingDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  tutorId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  studentId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  subjectId!: string;

  @ApiProperty({ example: '2025-06-02T09:00:00.000Z', description: 'ISO-8601 lesson start' })
  @IsISO8601()
  startTime!: string;

  @ApiProperty({ example: '2025-06-02T10:00:00.000Z', description: 'ISO-8601 lesson end' })
  @IsISO8601()
  endTime!: string;
}
