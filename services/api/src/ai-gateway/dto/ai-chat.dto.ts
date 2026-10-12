import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsObject, IsString } from 'class-validator';

/** `input`'s real shape depends on `task`; each task validates it itself. */
export class AiChatRequestDto {
  @ApiProperty({ example: 'help_question' })
  @IsString()
  @IsNotEmpty()
  task!: string;

  @ApiProperty({ example: { question: 'Can I cancel 2 hours before my lesson?' } })
  @IsObject()
  input!: Record<string, unknown>;
}
