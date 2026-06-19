import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import type { Subject } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateSubjectDto } from './dto/create-subject.dto.js';
import type { UpdateSubjectDto } from './dto/update-subject.dto.js';

@Injectable()
export class SubjectsService {
  constructor(private readonly prisma: PrismaService) {}

  private async assertTutorExists(tutorId: string): Promise<void> {
    const tutor = await this.prisma.tutor.findUnique({ where: { id: tutorId } });
    if (tutor === null) {
      throw new EntityNotFoundError('Tutor', tutorId);
    }
  }

  async create(dto: CreateSubjectDto): Promise<Subject> {
    await this.assertTutorExists(dto.tutorId);
    return this.prisma.subject.create({
      data: { name: dto.name, level: dto.level, tutorId: dto.tutorId },
    });
  }

  findAll(tutorId?: string): Promise<Subject[]> {
    return this.prisma.subject.findMany({
      where: tutorId === undefined ? {} : { tutorId },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string): Promise<Subject> {
    const subject = await this.prisma.subject.findUnique({ where: { id } });
    if (subject === null) {
      throw new EntityNotFoundError('Subject', id);
    }
    return subject;
  }

  async update(id: string, dto: UpdateSubjectDto): Promise<Subject> {
    await this.findOne(id);
    if (dto.tutorId !== undefined) {
      await this.assertTutorExists(dto.tutorId);
    }
    return this.prisma.subject.update({
      where: { id },
      data: { name: dto.name, level: dto.level, tutorId: dto.tutorId },
    });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.subject.delete({ where: { id } });
  }
}
