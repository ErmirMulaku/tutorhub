import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { TutorPrincipal } from '../auth/auth-user.js';
import { CurrentTutor } from '../auth/current-tutor.decorator.js';
import { TutorAuthGuard } from '../auth/tutor-auth.guard.js';
import { MyAvailabilityModel } from '../graphql/models/availability.model.js';
import { SlotModel } from '../graphql/models/slot.model.js';
import { AvailabilityService, type MyAvailability } from './availability.service.js';
import { BookingRulesInput, TimeOffInput, WorkingHourInput } from './dto/availability-input.js';

@Resolver()
export class AvailabilityResolver {
  constructor(private readonly availability: AvailabilityService) {}

  @Query(() => [SlotModel], { name: 'availability' })
  async getAvailability(
    @Args('tutorId', { type: () => ID }) tutorId: string,
    @Args('date') date: string,
  ): Promise<{ start: Date; end: Date }[]> {
    const slots = await this.availability.getSlots(tutorId, date);
    return slots.map((slot) => ({ start: new Date(slot.start), end: new Date(slot.end) }));
  }

  // --- Tutor self-service ---

  @Query(() => MyAvailabilityModel, { name: 'myAvailability' })
  @UseGuards(TutorAuthGuard)
  myAvailability(@CurrentTutor() tutor: TutorPrincipal): Promise<MyAvailability> {
    return this.availability.myAvailability(tutor.tutorId);
  }

  @Mutation(() => MyAvailabilityModel, { name: 'updateWorkingHours' })
  @UseGuards(TutorAuthGuard)
  updateWorkingHours(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('hours', { type: () => [WorkingHourInput] }) hours: WorkingHourInput[],
  ): Promise<MyAvailability> {
    return this.availability.updateWorkingHours(tutor.tutorId, hours);
  }

  @Mutation(() => MyAvailabilityModel, { name: 'updateBookingRules' })
  @UseGuards(TutorAuthGuard)
  updateBookingRules(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('rules') rules: BookingRulesInput,
  ): Promise<MyAvailability> {
    return this.availability.updateBookingRules(tutor.tutorId, rules);
  }

  @Mutation(() => MyAvailabilityModel, { name: 'addTimeOff' })
  @UseGuards(TutorAuthGuard)
  addTimeOff(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('input') input: TimeOffInput,
  ): Promise<MyAvailability> {
    return this.availability.addTimeOff(tutor.tutorId, input);
  }

  @Mutation(() => MyAvailabilityModel, { name: 'removeTimeOff' })
  @UseGuards(TutorAuthGuard)
  removeTimeOff(
    @CurrentTutor() tutor: TutorPrincipal,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<MyAvailability> {
    return this.availability.removeTimeOff(tutor.tutorId, id);
  }
}
