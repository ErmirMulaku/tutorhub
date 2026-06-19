import { ApiProperty } from '@nestjs/swagger';
import { Level } from '@ermulaku/types';
import { IsEnum, IsString, IsUUID, MinLength } from 'class-validator';

export class CreateSubjectDto {
  @ApiProperty({ example: 'Guitar' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: Level, example: Level.Beginner })
  @IsEnum(Level)
  level!: Level;

  @ApiProperty({ format: 'uuid', description: 'Owning tutor' })
  @IsUUID()
  tutorId!: string;
}
