import { Injectable } from '@nestjs/common';
import { BadRequestDomainError } from '../common/errors.js';
import type { Tutor } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  UpdateNotificationPrefsInput,
  UpdateTutorProfileInput,
} from './dto/settings-input.js';

/** "a, b and c" — these are read mid-sentence, so commas alone would jar. */
function formatList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

@Injectable()
export class TutorSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  get(tutorId: string): Promise<Tutor> {
    return this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
  }

  updateProfile(tutorId: string, input: UpdateTutorProfileInput): Promise<Tutor> {
    return this.prisma.tutor.update({ where: { id: tutorId }, data: input });
  }

  updateNotificationPrefs(tutorId: string, input: UpdateNotificationPrefsInput): Promise<Tutor> {
    return this.prisma.tutor.update({ where: { id: tutorId }, data: input });
  }

  /**
   * Onboarding completion: make the tutor publicly bookable.
   *
   * Refuses an unusable profile. Publishing used to flip the flag
   * unconditionally, which put tutors in the marketplace at $0/hr with nothing
   * bookable — and since a booking is priced from `hourlyCents`, a rate of 0
   * meant students could book them for free.
   *
   * The reasons are returned together so the wizard can list everything that is
   * missing, rather than making the tutor rediscover them one at a time.
   */
  async publish(tutorId: string): Promise<Tutor> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({
      where: { id: tutorId },
      include: { subjects: true },
    });

    const missing: string[] = [];
    if (tutor.hourlyCents <= 0) {
      // Derived from the catalog, so this really means "no live service".
      missing.push('a live service to price your lessons');
    }
    if (tutor.subjects.length === 0) {
      missing.push('at least one subject');
    }
    if (!Array.isArray(tutor.workingHours) || tutor.workingHours.length === 0) {
      missing.push('your weekly availability');
    }
    if (missing.length > 0) {
      throw new BadRequestDomainError(`Before publishing, add ${formatList(missing)}.`);
    }

    return this.prisma.tutor.update({ where: { id: tutorId }, data: { isActive: true } });
  }
}
