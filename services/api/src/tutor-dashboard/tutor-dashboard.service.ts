import { Injectable } from '@nestjs/common';
import { BookingStatus, type Booking, type Subject } from '../generated/prisma/client.js';
import { MessagingService } from '../messaging/messaging.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { DAY_MS, startOfDayInZone, startOfWeekInZone } from './zoned-dates.js';

export interface DashboardSummary {
  lessonsToday: number;
  earningsWeekCents: number;
  avgRating: number | null;
  reviewCount: number;
  pendingCount: number;
  unreadMessages: number;
}

export interface StudentRef {
  id: string;
  fullName: string;
  avatarColor: string | null;
}

export interface TutorNotification {
  id: string;
  type: string;
  title: string;
  detail: string | null;
  createdAt: Date;
}

/** Read-only KPI aggregations for the tutor dashboard. */
@Injectable()
export class TutorDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messaging: MessagingService,
  ) {}

  /** Bookings on the tutor's current calendar day (their timezone), in order. */
  async todaySchedule(tutorId: string, now: Date = new Date()): Promise<Booking[]> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    const dayStart = startOfDayInZone(now, tutor.timezone);
    return this.prisma.booking.findMany({
      where: {
        tutorId,
        startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) },
        status: { notIn: [BookingStatus.CANCELLED] },
      },
      orderBy: { startTime: 'asc' },
    });
  }

  /** KPI row: lessons today, earnings this week, rating, pending, unread. */
  async summary(tutorId: string, now: Date = new Date()): Promise<DashboardSummary> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    const dayStart = startOfDayInZone(now, tutor.timezone);
    const weekStart = startOfWeekInZone(now, tutor.timezone);

    const [lessonsToday, completedThisWeek, ratings, pendingCount, unreadMessages] =
      await Promise.all([
        this.prisma.booking.count({
          where: {
            tutorId,
            startTime: { gte: dayStart, lt: new Date(dayStart.getTime() + DAY_MS) },
            status: { notIn: [BookingStatus.CANCELLED, BookingStatus.NO_SHOW] },
          },
        }),
        this.prisma.booking.count({
          where: {
            tutorId,
            status: BookingStatus.COMPLETED,
            startTime: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * DAY_MS) },
          },
        }),
        this.prisma.review.aggregate({
          where: { tutorId },
          _avg: { rating: true },
          _count: true,
        }),
        this.prisma.booking.count({ where: { tutorId, status: BookingStatus.PENDING } }),
        this.messaging.unreadCount(tutorId),
      ]);

    return {
      lessonsToday,
      // Phase 1 proxy: completed lessons × hourly rate. Real per-booking net
      // arrives with the Payment/Payout model in the Earnings phase.
      earningsWeekCents: completedThisWeek * tutor.hourlyCents,
      avgRating: ratings._avg.rating,
      reviewCount: ratings._count,
      pendingCount,
      unreadMessages,
    };
  }

  /** Distinct students the tutor has booked (for the New-lesson picker). */
  async myStudents(tutorId: string): Promise<StudentRef[]> {
    const bookings = await this.prisma.booking.findMany({
      where: { tutorId },
      select: { student: { select: { id: true, fullName: true, avatarColor: true } } },
      orderBy: { startTime: 'desc' },
    });
    const byId = new Map<string, StudentRef>();
    for (const b of bookings) if (!byId.has(b.student.id)) byId.set(b.student.id, b.student);
    return [...byId.values()];
  }

  /** The tutor's subjects (for the New-lesson picker). */
  mySubjects(tutorId: string): Promise<Subject[]> {
    return this.prisma.subject.findMany({ where: { tutorId }, orderBy: { name: 'asc' } });
  }

  /**
   * A synthesized notification feed for the topbar bell: pending booking
   * requests, unread message threads, and recent reviews — newest first.
   */
  async notifications(tutorId: string): Promise<TutorNotification[]> {
    const [pending, conversations, reviews] = await Promise.all([
      this.prisma.booking.findMany({
        where: { tutorId, status: BookingStatus.PENDING },
        include: { student: true, subject: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      this.prisma.conversation.findMany({
        where: { tutorId, messages: { some: { senderKind: 'STUDENT', readByTutor: false } } },
        include: { student: true },
        orderBy: { lastMessageAt: 'desc' },
        take: 5,
      }),
      this.prisma.review.findMany({
        where: { tutorId },
        include: { booking: { include: { student: true } } },
        orderBy: { createdAt: 'desc' },
        take: 3,
      }),
    ]);

    const items: TutorNotification[] = [
      ...pending.map((b) => ({
        id: `booking:${b.id}`,
        type: 'booking',
        title: `New booking request from ${b.student.fullName}`,
        detail: `${b.subject.name} · ${b.subject.level.toLowerCase()}`,
        createdAt: b.createdAt,
      })),
      ...conversations.map((c) => ({
        id: `message:${c.id}`,
        type: 'message',
        title: `New message from ${c.student.fullName}`,
        detail: c.subjectName,
        createdAt: c.lastMessageAt,
      })),
      ...reviews.map((r) => ({
        id: `review:${r.id}`,
        type: 'review',
        title: `${r.booking.student.fullName} left a ${r.rating}★ review`,
        detail: r.comment,
        createdAt: r.createdAt,
      })),
    ];
    return items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, 8);
  }
}
