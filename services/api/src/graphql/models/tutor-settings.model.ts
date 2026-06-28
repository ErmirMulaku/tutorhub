import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType('TutorSettings')
export class TutorSettingsModel {
  @Field() name!: string;
  @Field(() => String, { nullable: true }) headline!: string | null;
  @Field(() => String, { nullable: true }) about!: string | null;
  @Field() timezone!: string;
  @Field(() => [String]) languages!: string[];
  @Field() isActive!: boolean;
  @Field() notifyBookings!: boolean;
  @Field() notifyReminders!: boolean;
  @Field() notifyMessages!: boolean;
  @Field() notifyPayouts!: boolean;
  @Field() notifyTips!: boolean;
}
