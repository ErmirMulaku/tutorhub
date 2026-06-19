import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export class WorkingHoursDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Sunday … 6 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  day!: number;

  @ApiProperty({ example: '09:00', description: '24h wall-clock "HH:mm"' })
  @Matches(HH_MM)
  start!: string;

  @ApiProperty({ example: '17:00', description: '24h wall-clock "HH:mm"' })
  @Matches(HH_MM)
  end!: string;
}

export class CreateTutorDto {
  @ApiProperty({ example: 'Ana Marković' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ required: false, example: 'Classical guitarist and music-theory tutor.' })
  @IsOptional()
  @IsString()
  bio?: string;

  @ApiProperty({ example: 'Europe/Belgrade', description: 'IANA timezone' })
  @IsString()
  @MinLength(1)
  timezone!: string;

  @ApiProperty({ minimum: 0, example: 3000, description: 'Hourly rate in minor units (cents)' })
  @IsInt()
  @Min(0)
  hourlyCents!: number;

  @ApiProperty({ type: [WorkingHoursDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WorkingHoursDto)
  workingHours!: WorkingHoursDto[];

  @ApiProperty({ required: false, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
