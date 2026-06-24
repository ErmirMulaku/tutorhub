import { Injectable } from '@nestjs/common';
import type { Notification } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** The header notification feed for the authenticated student. */
@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  list(studentId: string): Promise<Notification[]> {
    return this.prisma.notification.findMany({
      where: { studentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  unreadCount(studentId: string): Promise<number> {
    return this.prisma.notification.count({ where: { studentId, read: false } });
  }

  /** Mark one notification read (no-op if it isn't the caller's). */
  async markRead(studentId: string, id: string): Promise<Notification[]> {
    await this.prisma.notification.updateMany({
      where: { id, studentId },
      data: { read: true },
    });
    return this.list(studentId);
  }

  async markAllRead(studentId: string): Promise<Notification[]> {
    await this.prisma.notification.updateMany({
      where: { studentId, read: false },
      data: { read: true },
    });
    return this.list(studentId);
  }
}
