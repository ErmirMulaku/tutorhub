import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { ReviewsResolver } from './reviews.resolver.js';
import { ReviewsService } from './reviews.service.js';

@Module({
  imports: [AuthModule],
  providers: [ReviewsService, ReviewsResolver],
})
export class ReviewsModule {}
