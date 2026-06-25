import { Field, ID, ObjectType } from '@nestjs/graphql';
import { NotificationType } from '../../generated/prisma/client.js';

@ObjectType('Notification')
export class NotificationModel {
  @Field(() => ID) id!: string;
  @Field(() => NotificationType) type!: NotificationType;
  @Field(() => String, { nullable: true }) actorName!: string | null;
  @Field(() => String, { nullable: true }) detail!: string | null;
  @Field() read!: boolean;
  @Field() createdAt!: Date;
}
