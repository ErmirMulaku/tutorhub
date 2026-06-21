import { Module } from '@nestjs/common';
import { AvailabilityResolver } from './availability.resolver.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  providers: [AvailabilityService, AvailabilityResolver],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
