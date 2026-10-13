import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChatMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(4000)
  content!: string;
}

/** Full conversation history; the last message is the new turn. */
export class ChatInputDto {
  @ApiProperty({ type: [ChatMessageDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => ChatMessageDto)
  messages!: ChatMessageDto[];
}
