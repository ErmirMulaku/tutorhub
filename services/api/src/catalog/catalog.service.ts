import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import type { Level, Service } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { CreateServiceInput, UpdateServiceInput } from './dto/service-input.js';

/**
 * Hourly rate implied by a service, in cents.
 *
 * `priceCents` buys `lessonsCount` lessons of `durationMin` each, so a package
 * and a single lesson normalise to the same per-hour number.
 */
function hourlyRateOf(
  service: Pick<Service, 'priceCents' | 'durationMin' | 'lessonsCount'>,
): number {
  const minutes = service.durationMin * service.lessonsCount;
  if (minutes <= 0) return 0;
  return Math.round((service.priceCents / minutes) * 60);
}

/**
 * Tutor catalog of priced services (all operations scoped to the owner).
 *
 * The catalog is the source of truth for what the marketplace shows. A tutor's
 * `hourlyCents` and `Subject` rows are derived from it rather than entered
 * separately: onboarding only ever collects services, so anything it does not
 * write here stays at the signup placeholder — which is how a published tutor
 * ended up listed at $0/hr with nothing to book.
 */
@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  list(tutorId: string): Promise<Service[]> {
    return this.prisma.service.findMany({ where: { tutorId }, orderBy: { createdAt: 'asc' } });
  }

  async create(tutorId: string, input: CreateServiceInput): Promise<Service> {
    const subjectId = input.subjectId ?? (await this.subjectFor(tutorId, input.name, input.level));
    const service = await this.prisma.service.create({
      data: { ...input, subjectId, tutorId },
    });
    await this.syncHourlyRate(tutorId);
    return service;
  }

  /** Load a service, throwing 404 if missing or not the tutor's. */
  private async owned(id: string, tutorId: string): Promise<Service> {
    const service = await this.prisma.service.findUnique({ where: { id } });
    if (service === null || service.tutorId !== tutorId) {
      throw new EntityNotFoundError('Service', id);
    }
    return service;
  }

  /**
   * The tutor's subject for this name/level, created if new.
   *
   * Subjects are what the marketplace lists and what a student picks when
   * booking, but nothing in the tutor-facing flow creates one — so a service is
   * the only signal that a tutor teaches something. Matched case-insensitively
   * so "Math" and "math" don't become two subjects.
   */
  private async subjectFor(tutorId: string, name: string, level: Level): Promise<string> {
    const existing = await this.prisma.subject.findFirst({
      where: { tutorId, level, name: { equals: name, mode: 'insensitive' } },
    });
    if (existing !== null) return existing.id;
    const created = await this.prisma.subject.create({ data: { tutorId, name, level } });
    return created.id;
  }

  /**
   * Recompute the tutor's headline rate from their live services.
   *
   * The cheapest live service wins, so the listing reads as a "from" price.
   * With no live services the rate is zeroed, which also blocks publishing —
   * see TutorSettingsService.publish.
   */
  private async syncHourlyRate(tutorId: string): Promise<void> {
    const live = await this.prisma.service.findMany({ where: { tutorId, isActive: true } });
    const rates = live.map(hourlyRateOf).filter((rate) => rate > 0);
    const hourlyCents = rates.length === 0 ? 0 : Math.min(...rates);
    await this.prisma.tutor.update({ where: { id: tutorId }, data: { hourlyCents } });
  }

  async update(tutorId: string, input: UpdateServiceInput): Promise<Service> {
    await this.owned(input.id, tutorId);
    const { id, ...data } = input;
    const service = await this.prisma.service.update({ where: { id }, data });
    await this.syncHourlyRate(tutorId);
    return service;
  }

  async setActive(tutorId: string, id: string, isActive: boolean): Promise<Service> {
    await this.owned(id, tutorId);
    const service = await this.prisma.service.update({ where: { id }, data: { isActive } });
    // Hiding the cheapest service changes the headline price.
    await this.syncHourlyRate(tutorId);
    return service;
  }

  async remove(tutorId: string, id: string): Promise<boolean> {
    await this.owned(id, tutorId);
    await this.prisma.service.delete({ where: { id } });
    await this.syncHourlyRate(tutorId);
    return true;
  }
}
