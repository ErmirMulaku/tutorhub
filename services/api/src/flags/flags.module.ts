import { Global, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { FeatureFlagService } from './feature-flag.service.js';

/** Global: any module can ask "is this flag on?" without importing this one. */
@Global()
@Module({
  providers: [
    {
      provide: FeatureFlagService,
      // A factory, so the injectable clock (`now`, used by tests) keeps its default.
      useFactory: (prisma: PrismaService) => new FeatureFlagService(prisma),
      inject: [PrismaService],
    },
  ],
  exports: [FeatureFlagService],
})
export class FlagsModule {}
