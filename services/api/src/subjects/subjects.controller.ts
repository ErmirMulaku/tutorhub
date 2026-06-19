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
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { Subject } from '../generated/prisma/client.js';
import { CreateSubjectDto } from './dto/create-subject.dto.js';
import { UpdateSubjectDto } from './dto/update-subject.dto.js';
import { SubjectsService } from './subjects.service.js';

@ApiTags('subjects')
@Controller('subjects')
export class SubjectsController {
  constructor(private readonly subjects: SubjectsService) {}

  @Post()
  @ApiCreatedResponse({ description: 'Subject created.' })
  @ApiNotFoundResponse({ description: 'Owning tutor not found.' })
  create(@Body() dto: CreateSubjectDto): Promise<Subject> {
    return this.subjects.create(dto);
  }

  @Get()
  @ApiQuery({ name: 'tutorId', required: false, format: 'uuid' })
  findAll(
    @Query('tutorId', new ParseUUIDPipe({ optional: true })) tutorId?: string,
  ): Promise<Subject[]> {
    return this.subjects.findAll(tutorId);
  }

  @Get(':id')
  @ApiNotFoundResponse({ description: 'Subject not found.' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Subject> {
    return this.subjects.findOne(id);
  }

  @Patch(':id')
  @ApiNotFoundResponse({ description: 'Subject (or owning tutor) not found.' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateSubjectDto): Promise<Subject> {
    return this.subjects.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({ description: 'Subject deleted.' })
  @ApiNotFoundResponse({ description: 'Subject not found.' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.subjects.remove(id);
  }
}
