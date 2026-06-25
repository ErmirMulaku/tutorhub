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

/** Sort orders supported by the discover/search grid. */
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
   * Paginated discover/search. Supports subject/level/free-text/price filters.
   * `minRating` and `relevance`/`rating` ordering depend on per-tutor review
   * aggregates, so they are applied in memory after the DB query.
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

    const and: Prisma.TutorWhereInput[] = [];
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
    const where: Prisma.TutorWhereInput = and.length > 0 ? { AND: and } : {};

    // Fetch the full matching set; ratings are needed for filter/sort and the
    // marketplace catalogue is small. Pagination is applied after sorting.
    const matched = await this.prisma.tutor.findMany({ where, orderBy: { createdAt: 'asc' } });
    const ratings = await this.ratingsFor(matched.map((t) => t.id));

    let ranked = matched;
    if (filter.minRating != null && filter.minRating > 0) {
      const min = filter.minRating;
      ranked = ranked.filter((t) => (ratings.get(t.id) ?? 0) >= min);
    }

    const sort = filter.sort ?? 'relevance';
    ranked = [...ranked].sort((a, b) => {
      switch (sort) {
        case 'priceAsc':
          return a.hourlyCents - b.hourlyCents;
        case 'priceDesc':
          return b.hourlyCents - a.hourlyCents;
        case 'rating':
        case 'relevance':
        default:
          return (ratings.get(b.id) ?? 0) - (ratings.get(a.id) ?? 0);
      }
    });

    const total = ranked.length;
    const items = ranked.slice(filter.offset, filter.offset + filter.limit);
    return { items, total };
  }

  /** Average rating per tutor id (0 when a tutor has no reviews yet). */
  private async ratingsFor(tutorIds: string[]): Promise<Map<string, number>> {
    if (tutorIds.length === 0) return new Map();
    const grouped = await this.prisma.review.groupBy({
      by: ['tutorId'],
      where: { tutorId: { in: tutorIds } },
      _avg: { rating: true },
    });
    return new Map(grouped.map((g) => [g.tutorId, g._avg.rating ?? 0]));
  }

  /** Number of reviews a tutor has received. */
  reviewCountOf(tutorId: string): Promise<number> {
    return this.prisma.review.count({ where: { tutorId } });
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
