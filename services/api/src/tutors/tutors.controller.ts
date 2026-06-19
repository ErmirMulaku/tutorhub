import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Tutor } from '../generated/prisma/client.js';
import { CreateTutorDto } from './dto/create-tutor.dto.js';
import { UpdateTutorDto } from './dto/update-tutor.dto.js';
import { TutorsService } from './tutors.service.js';

@ApiTags('tutors')
@Controller('tutors')
export class TutorsController {
  constructor(private readonly tutors: TutorsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Tutor created.' })
  create(@Body() dto: CreateTutorDto): Promise<Tutor> {
    return this.tutors.create(dto);
  }

  @Get()
  findAll(): Promise<Tutor[]> {
    return this.tutors.findAll();
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'Tutor not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Tutor> {
    return this.tutors.findOne(id);
  }

  @Patch(':id')
  @ApiNotFoundResponse({ description: 'Tutor not found.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTutorDto): Promise<Tutor> {
    return this.tutors.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Tutor deleted.' })
  @ApiNotFoundResponse({ description: 'Tutor not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.tutors.remove(id);
  }
}
