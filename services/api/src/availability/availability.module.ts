import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AvailabilityResolver } from './availability.resolver.js';
import { AvailabilityService } from './availability.service.js';

@Module({
  imports: [AuthModule],
  providers: [AvailabilityService, AvailabilityResolver],
  exports: [AvailabilityService],
})
export class AvailabilityModule {}
