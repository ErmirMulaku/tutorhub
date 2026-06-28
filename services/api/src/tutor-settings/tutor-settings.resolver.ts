import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import type { Tutor } from '../generated/prisma/client.js';
import { TutorSettingsModel } from '../graphql/models/tutor-settings.model.js';
import { UpdateNotificationPrefsInput, UpdateTutorProfileInput } from './dto/settings-input.js';
import { TutorSettingsService } from './tutor-settings.service.js';

@Resolver()
@UseGuards(TutorAuthGuard)
export class TutorSettingsResolver {
  constructor(private readonly settings: TutorSettingsService) {}

  @Query(() => TutorSettingsModel, { name: 'tutorSettings' })
  tutorSettings(@CurrentTutor() tutor: TutorPrincipal): Promise<Tutor> {
    return this.settings.get(tutor.tutorId);
  }

  @Mutation(() => TutorSettingsModel, { name: 'updateTutorProfile' })
  updateTutorProfile(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('input') input: UpdateTutorProfileInput,
  ): Promise<Tutor> {
    return this.settings.updateProfile(tutor.tutorId, input);
  }

  @Mutation(() => TutorSettingsModel, { name: 'updateTutorNotificationPrefs' })
  updateTutorNotificationPrefs(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('input') input: UpdateNotificationPrefsInput,
  ): Promise<Tutor> {
    return this.settings.updateNotificationPrefs(tutor.tutorId, input);
  }

  @Mutation(() => TutorSettingsModel, { name: 'publishProfile' })
  publishProfile(@CurrentTutor() tutor: TutorPrincipal): Promise<Tutor> {
    return this.settings.publish(tutor.tutorId);
  }
}
