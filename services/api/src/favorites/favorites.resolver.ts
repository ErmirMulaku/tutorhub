import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../auth/auth-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { Tutor } from '../generated/prisma/client.js';
import { TutorModel } from '../graphql/models/tutor.model.js';
import { FavoritesService } from './favorites.service.js';

@Resolver(() => TutorModel)
@UseGuards(JwtAuthGuard)
export class FavoritesResolver {
  constructor(private readonly favorites: FavoritesService) {}

  @Query(() => [TutorModel], { name: 'myFavorites' })
  myFavorites(@CurrentUser() user: AuthUser): Promise<Tutor[]> {
    return this.favorites.list(user.studentId);
  }

  @Query(() => [ID], { name: 'myFavoriteIds' })
  myFavoriteIds(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.favorites.ids(user.studentId);
  }

  @Mutation(() => [TutorModel], { name: 'addFavorite' })
  addFavorite(
    @CurrentUser() user: AuthUser,
    @Args('tutorId', { type: () => ID }) tutorId: string,
  ): Promise<Tutor[]> {
    return this.favorites.add(user.studentId, tutorId);
  }

  @Mutation(() => [TutorModel], { name: 'removeFavorite' })
  removeFavorite(
    @CurrentUser() user: AuthUser,
    @Args('tutorId', { type: () => ID }) tutorId: string,
  ): Promise<Tutor[]> {
    return this.favorites.remove(user.studentId, tutorId);
  }
}
