import {
  Args,
  Context,
  Float,
  ID,
  Int,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Level } from '../generated/prisma/client.js';
import type { Review, Subject, Tutor } from '../generated/prisma/client.js';
import type { Loaders } from '../graphql/loaders.js';
import { ReviewModel } from '../graphql/models/review.model.js';
import { SubjectModel } from '../graphql/models/subject.model.js';
import { TutorPageModel } from '../graphql/models/tutor-page.model.js';
import { TutorModel } from '../graphql/models/tutor.model.js';
import { TutorsService, type TutorSort } from './tutors.service.js';

interface TutorPage {
  items: Tutor[];
  total: number;
  hasMore: boolean;
}

@Resolver(() => TutorModel)
export class TutorsResolver {
  constructor(private readonly tutors: TutorsService) {}

  @Query(() => TutorPageModel, { name: 'tutors' })
  async tutorsPage(
    @Args('subject', { type: () => String, nullable: true }) subject: string | undefined,
    @Args('query', { type: () => String, nullable: true }) query: string | undefined,
    @Args('level', { type: () => Level, nullable: true }) level: Level | undefined,
    @Args('maxPrice', { type: () => Int, nullable: true }) maxPrice: number | undefined,
    @Args('minRating', { type: () => Float, nullable: true }) minRating: number | undefined,
    @Args('sort', { type: () => String, nullable: true }) sort: string | undefined,
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
  ): Promise<TutorPage> {
    const { items, total } = await this.tutors.findPage({
      subject,
      query,
      level,
      maxPrice,
      minRating,
      sort: sort as TutorSort | undefined,
      limit,
      offset,
    });
    return { items, total, hasMore: offset + items.length < total };
  }

  @Query(() => TutorModel, { name: 'tutor', nullable: true })
  tutor(@Args('id', { type: () => ID }) id: string): Promise<Tutor | null> {
    return this.tutors.findPublishedOne(id);
  }

  // Batched per request (DataLoader): the discover grid's 20 tutors cost one
  // query per field instead of 20.
  @ResolveField(() => [SubjectModel])
  subjects(@Parent() tutor: Tutor, @Context('loaders') loaders: Loaders): Promise<Subject[]> {
    return loaders.subjectsByTutor.load(tutor.id);
  }

  @ResolveField(() => [ReviewModel])
  reviews(@Parent() tutor: Tutor, @Context('loaders') loaders: Loaders): Promise<Review[]> {
    return loaders.reviewsByTutor.load(tutor.id);
  }

  @ResolveField(() => Float, { nullable: true })
  rating(@Parent() tutor: Tutor, @Context('loaders') loaders: Loaders): Promise<number | null> {
    return loaders.ratingByTutor.load(tutor.id);
  }

  @ResolveField(() => Int)
  reviewCount(@Parent() tutor: Tutor, @Context('loaders') loaders: Loaders): Promise<number> {
    return loaders.reviewCountByTutor.load(tutor.id);
  }
}
