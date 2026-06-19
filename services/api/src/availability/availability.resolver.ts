import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import { SlotModel } from '../graphql/models/slot.model.js';
import { AvailabilityService } from './availability.service.js';

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
}
