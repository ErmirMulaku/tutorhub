import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType('Student')
export class StudentModel {
  @Field(() => ID) id!: string;
  @Field() fullName!: string;
  @Field() email!: string;
  @Field(() => String, { nullable: true }) phone!: string | null;
  @Field(() => String, { nullable: true }) avatarColor!: string | null;
  @Field(() => Int) walletCents!: number;
  @Field() notifyEmail!: boolean;
  @Field() notifySms!: boolean;
  @Field() notifyReminders!: boolean;
  @Field() notifyPromos!: boolean;
  @Field() twoFactorEnabled!: boolean;
  @Field() emailVerified!: boolean;
}
