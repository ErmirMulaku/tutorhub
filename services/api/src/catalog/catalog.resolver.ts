import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import type { Service } from '../generated/prisma/client.js';
import { ServiceModel } from '../graphql/models/service.model.js';
import { CatalogService } from './catalog.service.js';
import { CreateServiceInput, UpdateServiceInput } from './dto/service-input.js';

@Resolver(() => ServiceModel)
@UseGuards(TutorAuthGuard)
export class CatalogResolver {
  constructor(private readonly catalog: CatalogService) {}

  @Query(() => [ServiceModel], { name: 'myServices' })
  myServices(@CurrentTutor() tutor: TutorPrincipal): Promise<Service[]> {
    return this.catalog.list(tutor.tutorId);
  }

  @Mutation(() => ServiceModel, { name: 'createService' })
  createService(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('input') input: CreateServiceInput,
  ): Promise<Service> {
    return this.catalog.create(tutor.tutorId, input);
  }

  @Mutation(() => ServiceModel, { name: 'updateService' })
  updateService(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('input') input: UpdateServiceInput,
  ): Promise<Service> {
    return this.catalog.update(tutor.tutorId, input);
  }

  @Mutation(() => ServiceModel, { name: 'setServiceActive' })
  setServiceActive(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
    @Args('isActive') isActive: boolean,
  ): Promise<Service> {
    return this.catalog.setActive(tutor.tutorId, id, isActive);
  }

  @Mutation(() => Boolean, { name: 'deleteService' })
  deleteService(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<boolean> {
    return this.catalog.remove(tutor.tutorId, id);
  }
}
