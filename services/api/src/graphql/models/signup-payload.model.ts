import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SignupPayload')
export class SignupPayloadModel {
  @Field(() => ID) studentId!: string;
  @Field() requiresVerification!: boolean;
  /** Only set when Resend isn't configured — lets local dev read the code without email. */
  @Field(() => String, { nullable: true }) devCode!: string | null;
}

@ObjectType('ResendPayload')
export class ResendPayloadModel {
  @Field(() => String, { nullable: true }) devCode!: string | null;
}

@ObjectType('TutorSignupPayload')
export class TutorSignupPayloadModel {
  @Field(() => ID) tutorId!: string;
  @Field() requiresVerification!: boolean;
  /** Only set when Resend isn't configured — lets local dev read the code without email. */
  @Field(() => String, { nullable: true }) devCode!: string | null;
}
