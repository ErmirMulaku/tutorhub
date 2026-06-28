import { Injectable } from '@nestjs/common';
import { EntityNotFoundError } from '../common/errors.js';
import { PrismaService } from '../prisma/prisma.service.js';

export type ReviewFilter = 'all' | 'unreplied' | 'replied';

export interface TutorReviewRow {
  id: string;
  studentName: string;
  studentAvatarColor: string | null;
  subjectName: string;
  rating: number;
  comment: string | null;
  reply: string | null;
  createdAt: Date;
}
export interface ReviewSummary {
  average: number;
  count: number;
  distribution: number[];
}

@Injectable()
export class ReviewsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tutorId: string, filter: ReviewFilter = 'all'): Promise<TutorReviewRow[]> {
    const reviews = await this.prisma.review.findMany({
      where: {
        tutorId,
        reply: filter === 'replied' ? { not: null } : filter === 'unreplied' ? null : undefined,
      },
      orderBy: { createdAt: 'desc' },
      include: { booking: { include: { student: true, subject: true } } },
    });
    return reviews.map((r) => ({
      id: r.id,
      studentName: r.booking.student.fullName,
      studentAvatarColor: r.booking.student.avatarColor,
      subjectName: r.booking.subject.name,
      rating: r.rating,
      comment: r.comment,
      reply: r.reply,
      createdAt: r.createdAt,
    }));
  }

  async summary(tutorId: string): Promise<ReviewSummary> {
    const reviews = await this.prisma.review.findMany({
      where: { tutorId },
      select: { rating: true },
    });
    const count = reviews.length;
    const sum = reviews.reduce((s, r) => s + r.rating, 0);
    const distribution = [5, 4, 3, 2, 1].map(
      (star) => reviews.filter((r) => r.rating === star).length,
    );
    return { average: count > 0 ? sum / count : 0, count, distribution };
  }

  async reply(tutorId: string, id: string, reply: string): Promise<TutorReviewRow[]> {
    const review = await this.prisma.review.findUnique({ where: { id } });
    if (review === null || review.tutorId !== tutorId) {
      throw new EntityNotFoundError('Review', id);
    }
    await this.prisma.review.update({
      where: { id },
      data: { reply, repliedAt: new Date() },
    });
    return this.list(tutorId);
  }
}
