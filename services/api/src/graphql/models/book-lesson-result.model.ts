import { createUnionType, Field, GraphQLISODateTime, ObjectType } from '@nestjs/graphql';
import { BookingModel } from './booking.model.js';

/** The lesson was booked. */
@ObjectType('BookingBooked')
export class BookingBookedModel {
  @Field(() => BookingModel) booking!: BookingModel;
}

/**
 * The time is taken. An expected outcome, not a crash, so it's part of the
 * schema: the client must handle it (`... on SlotUnavailable`) and gets
 * alternatives to offer right away.
 */
@ObjectType('SlotUnavailable')
export class SlotUnavailableModel {
  @Field() message!: string;
  /** The tutor's next free start times (up to 3, within a week), free for the student too. */
  @Field(() => [GraphQLISODateTime]) nextFreeSlots!: Date[];
}

/**
 * "Errors as data": expected failures are union members with their own
 * fields; unexpected ones (bad input, not found, server errors) stay in
 * GraphQL's top-level `errors`.
 */
export const BookLessonResult = createUnionType({
  name: 'BookLessonResult',
  types: () => [BookingBookedModel, SlotUnavailableModel] as const,
  resolveType: (value: object) => ('booking' in value ? BookingBookedModel : SlotUnavailableModel),
});
