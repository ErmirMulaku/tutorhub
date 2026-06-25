import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Notification } from '../generated/prisma/client.js';
import { NotificationModel } from '../graphql/models/notification.model.js';
import { NotificationsService } from './notifications.service.js';

@Resolver(() => NotificationModel)
@UseGuards(JwtAuthGuard)
export class NotificationsResolver {
  constructor(private readonly service: NotificationsService) {}

  @Query(() => [NotificationModel], { name: 'notifications' })
  notifications(@CurrentUser() user: AuthUser): Promise<Notification[]> {
    return this.service.list(user.studentId);
  }

  @Query(() => Int, { name: 'unreadNotificationCount' })
  unreadNotificationCount(@CurrentUser() user: AuthUser): Promise<number> {
    return this.service.unreadCount(user.studentId);
  }

  @Mutation(() => [NotificationModel], { name: 'markNotificationRead' })
  markNotificationRead(
    @CurrentUser() user: AuthUser,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Notification[]> {
    return this.service.markRead(user.studentId, id);
  }

  @Mutation(() => [NotificationModel], { name: 'markAllNotificationsRead' })
  markAllNotificationsRead(@CurrentUser() user: AuthUser): Promise<Notification[]> {
    return this.service.markAllRead(user.studentId);
  }
}
