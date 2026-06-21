import { Injectable } from '@nestjs/common';
import type { Level } from '@ermulaku/types';
import { EntityNotFoundError } from '../common/errors.js';
import { Prisma, type Review, type Subject, type Tutor } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTutorDto, WorkingHoursDto } from './dto/create-tutor.dto.js';
import type { UpdateTutorDto } from './dto/update-tutor.dto.js';

/** Plain JSON for the Prisma `Json` column (DTO instances lack an index signature). */
function toJsonWorkingHours(workingHours: WorkingHoursDto[]): Prisma.InputJsonValue {
  return workingHours.map((w) => ({ day: w.day, start: w.start, end: w.end }));
}

export interface TutorPageFilter {
  /** Free-text subject search (case-insensitive substring). */
  subject?: string | null;
  level?: Level | null;
  limit: number;
  offset: number;
}

@Injectable()
export class TutorsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateTutorDto): Promise<Tutor> {
    return this.prisma.tutor.create({
      data: {
        name: dto.name,
        bio: dto.bio ?? null,
        timezone: dto.timezone,
        hourlyCents: dto.hourlyCents,
        isActive: dto.isActive ?? true,
        workingHours: toJsonWorkingHours(dto.workingHours),
      },
    });
  }

  findAll(): Promise<Tutor[]> {
    return this.prisma.tutor.findMany({ orderBy: { createdAt: 'asc' } });
  }

  /** Paginated, optionally filtered by subject name and/or level (GraphQL `tutors`). */
  async findPage(filter: TutorPageFilter): Promise<{ items: Tutor[]; total: number }> {
    // Only constrain on fields that were actually supplied. GraphQL nullable
    // variables arrive as `null` (not `undefined`), so guard with `!= null`.
    const some: Prisma.SubjectWhereInput = {};
    if (filter.subject != null && filter.subject !== '') {
      some.name = { contains: filter.subject, mode: 'insensitive' };
    }
    if (filter.level != null) {
      some.level = filter.level;
    }
    const where: Prisma.TutorWhereInput =
      Object.keys(some).length > 0 ? { subjects: { some } } : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.tutor.findMany({
        where,
        skip: filter.offset,
        take: filter.limit,
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.tutor.count({ where }),
    ]);
    return { items, total };
  }

  async findOne(id: string): Promise<Tutor> {
    const tutor = await this.findOneOrNull(id);
    if (tutor === null) {
      throw new EntityNotFoundError('Tutor', id);
    }
    return tutor;
  }

  findOneOrNull(id: string): Promise<Tutor | null> {
    return this.prisma.tutor.findUnique({ where: { id } });
  }

  subjectsOf(tutorId: string): Promise<Subject[]> {
    return this.prisma.subject.findMany({ where: { tutorId }, orderBy: { name: 'asc' } });
  }

  reviewsOf(tutorId: string): Promise<Review[]> {
    return this.prisma.review.findMany({ where: { tutorId } });
  }

  async ratingOf(tutorId: string): Promise<number | null> {
    const { _avg } = await this.prisma.review.aggregate({
      where: { tutorId },
      _avg: { rating: true },
    });
    return _avg.rating;
  }

  async update(id: string, dto: UpdateTutorDto): Promise<Tutor> {
    await this.findOne(id);
    const data: Prisma.TutorUpdateInput = {
      name: dto.name,
      bio: dto.bio,
      timezone: dto.timezone,
      hourlyCents: dto.hourlyCents,
      isActive: dto.isActive,
    };
    if (dto.workingHours !== undefined) {
      data.workingHours = toJsonWorkingHours(dto.workingHours);
    }
    return this.prisma.tutor.update({ where: { id }, data });
  }

  async remove(id: string): Promise<void> {
    await this.findOne(id);
    await this.prisma.tutor.delete({ where: { id } });
  }
}
