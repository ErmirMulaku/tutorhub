import { Field, GraphQLISODateTime, ID, ObjectType } from '@nestjs/graphql';
import { BookingStatus } from '../../generated/prisma/client.js';
import { StudentModel } from './student.model.js';
import { SubjectModel } from './subject.model.js';
import { TutorModel } from './tutor.model.js';

@ObjectType('Booking')
export class BookingModel {
  @Field(() => ID) id!: string;
  @Field(() => GraphQLISODateTime) startTime!: Date;
  @Field(() => GraphQLISODateTime) endTime!: Date;
  @Field(() => BookingStatus) status!: BookingStatus;

  // Resolved fields (see BookingResolver).
  @Field(() => TutorModel) tutor!: TutorModel;
  @Field(() => SubjectModel) subject!: SubjectModel;
  @Field(() => StudentModel) student!: StudentModel;
}
