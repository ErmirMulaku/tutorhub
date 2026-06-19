import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType('Student')
export class StudentModel {
  @Field(() => ID) id!: string;
  @Field() fullName!: string;
  @Field() email!: string;
}
