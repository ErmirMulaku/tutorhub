import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SignupPayload')
export class SignupPayloadModel {
  @Field(() => ID) studentId!: string;
  @Field() requiresVerification!: boolean;
  /** Off-production only, and only without an email transport. Never in production. */
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
  /** Off-production only, and only without an email transport. Never in production. */
  @Field(() => String, { nullable: true }) devCode!: string | null;
}
