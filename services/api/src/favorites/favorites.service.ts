import { Injectable } from '@nestjs/common';
import type { Tutor } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** Saved tutors for a student (the favourites screen + profile heart toggle). */
@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(studentId: string): Promise<Tutor[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
      include: { tutor: true },
    });
    return rows.map((r) => r.tutor);
  }

  async ids(studentId: string): Promise<string[]> {
    const rows = await this.prisma.favorite.findMany({
      where: { studentId },
      select: { tutorId: true },
    });
    return rows.map((r) => r.tutorId);
  }

  /** Idempotent add (no-op if already saved). */
  async add(studentId: string, tutorId: string): Promise<Tutor[]> {
    await this.prisma.favorite.upsert({
      where: { studentId_tutorId: { studentId, tutorId } },
      create: { studentId, tutorId },
      update: {},
    });
    return this.list(studentId);
  }

  async remove(studentId: string, tutorId: string): Promise<Tutor[]> {
    await this.prisma.favorite.deleteMany({ where: { studentId, tutorId } });
    return this.list(studentId);
  }
}
