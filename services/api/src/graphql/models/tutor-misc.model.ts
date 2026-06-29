import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';

/** A minimal student reference for the tutor's pickers (e.g. New lesson). */
@ObjectType('TutorStudentRef')
export class TutorStudentRefModel {
  @Field(() => ID) id!: string;
  @Field() fullName!: string;
  @Field(() => String, { nullable: true }) avatarColor!: string | null;
}

/** A synthesized notification-feed item (booking request, message, review). */
@ObjectType('TutorNotification')
export class TutorNotificationModel {
  @Field(() => ID) id!: string;
  @Field() type!: string; // 'booking' | 'message' | 'review'
  @Field() title!: string;
  @Field(() => String, { nullable: true }) detail!: string | null;
  @Field(() => GraphQLISODateTime) createdAt!: Date;
}
