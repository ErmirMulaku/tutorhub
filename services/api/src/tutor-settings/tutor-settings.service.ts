import { Injectable } from '@nestjs/common';
import type { Tutor } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type {
  UpdateNotificationPrefsInput,
  UpdateTutorProfileInput,
} from './dto/settings-input.js';

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

  /** Onboarding completion: make the tutor publicly bookable. */
  publish(tutorId: string): Promise<Tutor> {
    return this.prisma.tutor.update({ where: { id: tutorId }, data: { isActive: true } });
  }
}
