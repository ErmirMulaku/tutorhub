import { Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';

@ObjectType('Slot')
export class SlotModel {
  @Field(() => GraphQLISODateTime) start!: Date;
  @Field(() => GraphQLISODateTime) end!: Date;
}
