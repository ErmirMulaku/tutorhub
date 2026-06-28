import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('TutorAuthPayload')
export class TutorAuthPayloadModel {
  @Field() accessToken!: string;
  @Field(() => ID) tutorId!: string;
}
