import { Injectable } from '@nestjs/common';
import { BookingStatus, type Booking } from '../generated/prisma/client.js';
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

/** Read-only KPI aggregations for the tutor dashboard. */
@Injectable()
export class TutorDashboardService {
  constructor(private readonly prisma: PrismaService) {}

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

    const [lessonsToday, completedThisWeek, ratings, pendingCount] = await Promise.all([
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
    ]);

    return {
      lessonsToday,
      // Phase 1 proxy: completed lessons × hourly rate. Real per-booking net
      // arrives with the Payment/Payout model in the Earnings phase.
      earningsWeekCents: completedThisWeek * tutor.hourlyCents,
      avgRating: ratings._avg.rating,
      reviewCount: ratings._count,
      pendingCount,
      unreadMessages: 0, // wired in the Messaging phase
    };
  }
}
