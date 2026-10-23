import { Field, ObjectType } from '@nestjs/graphql';
import { BookingModel } from './booking.model.js';

/**
 * Relay-style cursor pagination ("connections"). Ask for `first` items, then
 * pass `pageInfo.endCursor` back as `after` to get the next page.
 */
@ObjectType('PageInfo')
export class PageInfoModel {
  @Field() hasNextPage!: boolean;
  /** Cursor of the last edge on this page; null for an empty page. */
  @Field(() => String, { nullable: true }) endCursor!: string | null;
}

@ObjectType('BookingEdge')
export class BookingEdgeModel {
  @Field() cursor!: string;
  @Field(() => BookingModel) node!: BookingModel;
}

@ObjectType('BookingConnection')
export class BookingConnectionModel {
  @Field(() => [BookingEdgeModel]) edges!: BookingEdgeModel[];
  @Field(() => PageInfoModel) pageInfo!: PageInfoModel;
}
