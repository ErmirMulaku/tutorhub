import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Student } from '../generated/prisma/client.js';
import { StudentModel } from '../graphql/models/student.model.js';
import { AccountService } from './account.service.js';

@Resolver(() => StudentModel)
@UseGuards(JwtAuthGuard)
export class AccountResolver {
  constructor(private readonly account: AccountService) {}

  @Mutation(() => StudentModel, { name: 'updateProfile' })
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Args('fullName', { type: () => String, nullable: true }) fullName: string | undefined,
    @Args('phone', { type: () => String, nullable: true }) phone: string | undefined,
    @Args('avatarColor', { type: () => String, nullable: true }) avatarColor: string | undefined,
  ): Promise<Student> {
    return this.account.updateProfile(user.studentId, { fullName, phone, avatarColor });
  }

  @Mutation(() => StudentModel, { name: 'updateNotificationPrefs' })
  updateNotificationPrefs(
    @CurrentUser() user: AuthUser,
    @Args('notifyEmail', { type: () => Boolean, nullable: true }) notifyEmail: boolean | undefined,
    @Args('notifySms', { type: () => Boolean, nullable: true }) notifySms: boolean | undefined,
    @Args('notifyReminders', { type: () => Boolean, nullable: true })
    notifyReminders: boolean | undefined,
    @Args('notifyPromos', { type: () => Boolean, nullable: true })
    notifyPromos: boolean | undefined,
  ): Promise<Student> {
    return this.account.updateNotificationPrefs(user.studentId, {
      notifyEmail,
      notifySms,
      notifyReminders,
      notifyPromos,
    });
  }

  @Mutation(() => StudentModel, { name: 'setTwoFactor' })
  setTwoFactor(@CurrentUser() user: AuthUser, @Args('enabled') enabled: boolean): Promise<Student> {
    return this.account.setTwoFactor(user.studentId, enabled);
  }

  @Mutation(() => StudentModel, { name: 'changePassword' })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Args('currentPassword') currentPassword: string,
    @Args('newPassword') newPassword: string,
  ): Promise<Student> {
    return this.account.changePassword(user.studentId, currentPassword, newPassword);
  }

  @Mutation(() => Boolean, { name: 'deleteAccount' })
  deleteAccount(@CurrentUser() user: AuthUser): Promise<boolean> {
    return this.account.deleteAccount(user.studentId);
  }
}
