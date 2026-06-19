import { PartialType } from '@nestjs/swagger';
import { CreateTutorDto } from './create-tutor.dto.js';

/** All fields optional; same validation/Swagger metadata as {@link CreateTutorDto}. */
export class UpdateTutorDto extends PartialType(CreateTutorDto) {}
