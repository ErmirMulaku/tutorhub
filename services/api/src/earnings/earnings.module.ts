import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { EarningsResolver } from './earnings.resolver.js';
import { EarningsService } from './earnings.service.js';

@Module({
  imports: [AuthModule],
  providers: [EarningsService, EarningsResolver],
})
export class EarningsModule {}
