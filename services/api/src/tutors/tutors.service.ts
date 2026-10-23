import { Injectable } from '@nestjs/common';
import type { Level } from '@ermulaku/types';
import { EntityNotFoundError } from '../common/errors.js';
import { Prisma, type Subject, type Tutor } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateTutorDto, WorkingHoursDto } from './dto/create-tutor.dto.js';
import type { UpdateTutorDto } from './dto/update-tutor.dto.js';

/** Plain JSON for the Prisma `Json` column (DTO instances lack an index signature). */
function toJsonWorkingHours(workingHours: WorkingHoursDto[]): Prisma.InputJsonValue {
  return workingHours.map((w) => ({ day: w.day, start: w.start, end: w.end }));
}

/** Sort orders supported by the discover/search grid. */
/** Most tutors one discover page may return. */
const MAX_PAGE_SIZE = 100;

export type TutorSort = 'relevance' | 'priceAsc' | 'priceDesc' | 'rating';

export interface TutorPageFilter {
  /** Free-text subject search (case-insensitive substring). */
  subject?: string | null;
  /** Free-text search across name, headline and subject names. */
  query?: string | null;
  level?: Level | null;
  /** Upper price bound in whole currency units (e.g. 60 → 6000 cents). */
  maxPrice?: number | null;
  /** Lower bound on average rating (0–5). */
  minRating?: number | null;
  sort?: TutorSort | null;
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

  /**
   * Paginated discover/search: subject/level/free-text/price/rating filters,
   * sorted by rating (default) or price, `limit` capped at 100. Everything —
   * filter, sort, count, page — happens in Postgres.
   */
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

    // Only published tutors are discoverable — a fresh signup starts inactive
    // (empty profile, no subjects, $0/hr) until they finish onboarding and hit
    // "Publish", which flips this flag.
    const and: Prisma.TutorWhereInput[] = [{ isActive: true }];
    if (Object.keys(some).length > 0) and.push({ subjects: { some } });
    if (filter.maxPrice != null) and.push({ hourlyCents: { lte: filter.maxPrice * 100 } });
    if (filter.query != null && filter.query !== '') {
      const q = filter.query;
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { headline: { contains: q, mode: 'insensitive' } },
          { subjects: { some: { name: { contains: q, mode: 'insensitive' } } } },
        ],
      });
    }
    if (filter.minRating != null && filter.minRating > 0) {
      and.push({ ratingAvg: { gte: filter.minRating } });
    }
    const where: Prisma.TutorWhereInput = { AND: and };

    // The database filters, sorts, counts and returns one page. Rating comes
    // from the tutor's stored aggregate (ratingAvg), so sorting by it needs no
    // review rows. Tutors without reviews sort last; ties keep a stable order
    // (oldest first, then id) so a tutor can't appear on two pages.
    const sort = filter.sort ?? 'relevance';
    const orderBy: Prisma.TutorOrderByWithRelationInput[] =
      sort === 'priceAsc'
        ? [{ hourlyCents: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
        : sort === 'priceDesc'
          ? [{ hourlyCents: 'desc' }, { createdAt: 'asc' }, { id: 'asc' }]
          : [{ ratingAvg: { sort: 'desc', nulls: 'last' } }, { createdAt: 'asc' }, { id: 'asc' }];

    const [items, total] = await Promise.all([
      this.prisma.tutor.findMany({
        where,
        orderBy,
        skip: Math.max(filter.offset, 0),
        take: Math.min(Math.max(filter.limit, 1), MAX_PAGE_SIZE),
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

  /** Public marketplace profile lookup — hidden until the tutor has published. */
  findPublishedOne(id: string): Promise<Tutor | null> {
    return this.prisma.tutor.findFirst({ where: { id, isActive: true } });
  }

  subjectsOf(tutorId: string): Promise<Subject[]> {
    return this.prisma.subject.findMany({ where: { tutorId }, orderBy: { name: 'asc' } });
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
