import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SignupPayload')
export class SignupPayloadModel {
  @Field(() => ID) studentId!: string;
  @Field() requiresVerification!: boolean;
  /** Off-production only, and only without an email transport. Never in production. */
  @Field(() => String, { nullable: true }) devCode!: string | null;
  /** Set when this deployment accepts a fixed code from anyone. See AuthService.demoCode. */
  @Field(() => String, { nullable: true }) demoCode!: string | null;
}

@ObjectType('ResendPayload')
export class ResendPayloadModel {
  @Field(() => String, { nullable: true }) devCode!: string | null;
  @Field(() => String, { nullable: true }) demoCode!: string | null;
}

@ObjectType('TutorSignupPayload')
export class TutorSignupPayloadModel {
  @Field(() => ID) tutorId!: string;
  @Field() requiresVerification!: boolean;
  /** Off-production only, and only without an email transport. Never in production. */
  @Field(() => String, { nullable: true }) devCode!: string | null;
  /** Set when this deployment accepts a fixed code from anyone. See AuthService.demoCode. */
  @Field(() => String, { nullable: true }) demoCode!: string | null;
}
