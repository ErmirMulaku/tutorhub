import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('SignupPayload')
export class SignupPayloadModel {
  @Field(() => ID) studentId!: string;
  @Field() requiresVerification!: boolean;
  /** Non-production only — there is no real email transport. */
  @Field(() => String, { nullable: true }) devCode!: string | null;
}

@ObjectType('ResendPayload')
export class ResendPayloadModel {
  @Field(() => String, { nullable: true }) devCode!: string | null;
}
