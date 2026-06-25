import { Injectable } from '@nestjs/common';
import { BadRequestDomainError } from '../common/errors.js';
import type { Student } from '../generated/prisma/client.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import { PrismaService } from '../prisma/prisma.service.js';

export interface UpdateProfileInput {
  fullName?: string | null;
  phone?: string | null;
  avatarColor?: string | null;
}

export interface NotificationPrefsInput {
  notifyEmail?: boolean | null;
  notifySms?: boolean | null;
  notifyReminders?: boolean | null;
  notifyPromos?: boolean | null;
}

/** Self-service account settings for the authenticated student. */
@Injectable()
export class AccountService {
  constructor(private readonly prisma: PrismaService) {}

  updateProfile(studentId: string, input: UpdateProfileInput): Promise<Student> {
    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        fullName: input.fullName ?? undefined,
        phone: input.phone ?? undefined,
        avatarColor: input.avatarColor ?? undefined,
      },
    });
  }

  updateNotificationPrefs(studentId: string, input: NotificationPrefsInput): Promise<Student> {
    return this.prisma.student.update({
      where: { id: studentId },
      data: {
        notifyEmail: input.notifyEmail ?? undefined,
        notifySms: input.notifySms ?? undefined,
        notifyReminders: input.notifyReminders ?? undefined,
        notifyPromos: input.notifyPromos ?? undefined,
      },
    });
  }

  setTwoFactor(studentId: string, enabled: boolean): Promise<Student> {
    return this.prisma.student.update({
      where: { id: studentId },
      data: { twoFactorEnabled: enabled },
    });
  }

  async changePassword(
    studentId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<Student> {
    const student = await this.prisma.student.findUniqueOrThrow({ where: { id: studentId } });
    // Students created via dev-login/seed have no password set yet; allow setting one.
    if (student.passwordHash !== null && !verifyPassword(currentPassword, student.passwordHash)) {
      throw new BadRequestDomainError('Current password is incorrect.');
    }
    return this.prisma.student.update({
      where: { id: studentId },
      data: { passwordHash: hashPassword(newPassword) },
    });
  }

  /**
   * Permanently delete the account. Bookings are removed first (their payments
   * and reviews cascade); favourites, payment methods, notifications and
   * verification codes cascade off the student; owned gift cards are detached.
   */
  async deleteAccount(studentId: string): Promise<boolean> {
    await this.prisma.$transaction([
      this.prisma.booking.deleteMany({ where: { studentId } }),
      this.prisma.student.delete({ where: { id: studentId } }),
    ]);
    return true;
  }
}
