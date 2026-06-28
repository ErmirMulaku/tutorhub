import { Injectable } from '@nestjs/common';
import { BookingStatus } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface AnalyticsSummary {
  lessonsThisMonth: number;
  newStudents: number;
  repeatRatePct: number;
  utilizationPct: number;
}
export interface MonthCount {
  month: string;
  count: number;
}
export interface SubjectShare {
  name: string;
  pct: number;
}
export interface DayCount {
  day: string;
  count: number;
}
export interface StudentMix {
  returningPct: number;
  newPct: number;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CompletedBooking {
  studentId: string;
  startTime: Date;
  subject: { name: string };
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private completed(tutorId: string): Promise<CompletedBooking[]> {
    return this.prisma.booking.findMany({
      where: { tutorId, status: BookingStatus.COMPLETED },
      select: { studentId: true, startTime: true, subject: { select: { name: true } } },
    });
  }

  async summary(tutorId: string, now: Date = new Date()): Promise<AnalyticsSummary> {
    const tutor = await this.prisma.tutor.findUniqueOrThrow({ where: { id: tutorId } });
    const bookings = await this.completed(tutorId);

    const inThisMonth = (d: Date): boolean =>
      d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    const lessonsThisMonth = bookings.filter((b) => inThisMonth(b.startTime)).length;

    // First-ever booking per student → "new" if it falls in this month.
    const firstByStudent = new Map<string, Date>();
    const countByStudent = new Map<string, number>();
    for (const b of bookings) {
      const prev = firstByStudent.get(b.studentId);
      if (!prev || b.startTime < prev) firstByStudent.set(b.studentId, b.startTime);
      countByStudent.set(b.studentId, (countByStudent.get(b.studentId) ?? 0) + 1);
    }
    const newStudents = [...firstByStudent.values()].filter(inThisMonth).length;
    const distinct = countByStudent.size;
    const repeat = [...countByStudent.values()].filter((c) => c >= 2).length;
    const repeatRatePct = distinct > 0 ? Math.round((repeat / distinct) * 100) : 0;

    // Utilization this week: completed lessons ÷ (working days × max lessons/day).
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const lessonsThisWeek = bookings.filter((b) => b.startTime >= weekAgo).length;
    const workingDays = Array.isArray(tutor.workingHours) ? tutor.workingHours.length : 5;
    const capacity = Math.max(1, workingDays * tutor.maxLessonsPerDay);
    const utilizationPct = Math.min(100, Math.round((lessonsThisWeek / capacity) * 100));

    return { lessonsThisMonth, newStudents, repeatRatePct, utilizationPct };
  }

  async lessonsOverTime(tutorId: string, now: Date = new Date()): Promise<MonthCount[]> {
    const bookings = await this.completed(tutorId);
    const buckets: MonthCount[] = [];
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      buckets.push({ month: MONTHS[d.getMonth()] ?? '', count: 0 });
    }
    for (const b of bookings) {
      const monthsAgo =
        (now.getFullYear() - b.startTime.getFullYear()) * 12 +
        (now.getMonth() - b.startTime.getMonth());
      const idx = 7 - monthsAgo;
      const bucket = buckets[idx];
      if (idx >= 0 && idx < 8 && bucket) bucket.count++;
    }
    return buckets;
  }

  async topSubjects(tutorId: string): Promise<SubjectShare[]> {
    const bookings = await this.completed(tutorId);
    const total = bookings.length || 1;
    const counts = new Map<string, number>();
    for (const b of bookings) counts.set(b.subject.name, (counts.get(b.subject.name) ?? 0) + 1);
    return [...counts.entries()]
      .map(([name, c]) => ({ name, pct: Math.round((c / total) * 100) }))
      .sort((a, b) => b.pct - a.pct);
  }

  async lessonsByDayOfWeek(tutorId: string): Promise<DayCount[]> {
    const bookings = await this.completed(tutorId);
    const counts = new Array<number>(7).fill(0);
    for (const b of bookings) {
      const d = b.startTime.getDay();
      counts[d] = (counts[d] ?? 0) + 1;
    }
    // Present Monday-first to match the design.
    return [1, 2, 3, 4, 5, 6, 0].map((d) => ({ day: DOW[d] ?? '', count: counts[d] ?? 0 }));
  }

  async studentMix(tutorId: string): Promise<StudentMix> {
    const bookings = await this.completed(tutorId);
    const counts = new Map<string, number>();
    for (const b of bookings) counts.set(b.studentId, (counts.get(b.studentId) ?? 0) + 1);
    const distinct = counts.size || 1;
    const returning = [...counts.values()].filter((c) => c >= 2).length;
    const returningPct = Math.round((returning / distinct) * 100);
    return { returningPct, newPct: 100 - returningPct };
  }
}
