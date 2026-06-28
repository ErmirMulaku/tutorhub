import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MarketingResolver } from './marketing.resolver.js';
import { MarketingService } from './marketing.service.js';

@Module({
  imports: [AuthModule],
  providers: [MarketingService, MarketingResolver],
})
export class MarketingModule {}
