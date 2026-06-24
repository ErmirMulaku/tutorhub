import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('AuthPayload')
export class AuthPayloadModel {
  @Field() accessToken!: string;
  @Field(() => ID) studentId!: string;
}
