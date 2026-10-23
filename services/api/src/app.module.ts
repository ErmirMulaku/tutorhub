import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { depthLimit } from './graphql/depth-limit.js';
import { createLoaders, type GraphQLContext } from './graphql/loaders.js';
import './graphql/register-enums.js';
import { AccountModule } from './account/account.module.js';
import { AiGatewayModule } from './ai-gateway/ai-gateway.module.js';
import { AnalyticsModule } from './analytics/analytics.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { EarningsModule } from './earnings/earnings.module.js';
import { EmailModule } from './email/email.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { MarketingModule } from './marketing/marketing.module.js';
import { FlagsModule } from './flags/flags.module.js';
import { HealthController } from './health/health.controller.js';
import { HelpModule } from './help/help.module.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MonitoringModule } from './monitoring/monitoring.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { OutboxModule } from './outbox/outbox.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { PrismaService } from './prisma/prisma.service.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { StripeModule } from './stripe/stripe.module.js';
import { SubjectsModule } from './subjects/subjects.module.js';
import { TutorDashboardModule } from './tutor-dashboard/tutor-dashboard.module.js';
import { TutorSettingsModule } from './tutor-settings/tutor-settings.module.js';
import { TutorsModule } from './tutors/tutors.module.js';
import { WalletModule } from './wallet/wallet.module.js';

// In dev the SDL is written to the repo-root docs/ on boot and committed
// (SPEC §9). A deployed container has no such directory — and no business
// writing to the source tree — so there we generate the schema in memory.
const isProd = process.env.NODE_ENV === 'production';
const schemaFile = isProd
  ? true
  : fileURLToPath(new URL('../../../docs/schema.graphql', import.meta.url));

/** Deepest query we accept. Our real screens go ~5 levels deep. */
const MAX_QUERY_DEPTH = 8;

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        autoSchemaFile: schemaFile,
        sortSchema: true,
        graphiql: true,
        // Fresh DataLoaders per request: batching + a per-request cache.
        context: ({ req }: { req: unknown }): GraphQLContext => ({
          req,
          loaders: createLoaders(prisma),
        }),
        // Reject over-deep queries before any resolver runs.
        validationRules: [depthLimit(MAX_QUERY_DEPTH)],
      }),
    }),
    PrismaModule,
    FlagsModule,
    StripeModule,
    EmailModule,
    AuthModule,
    AccountModule,
    TutorsModule,
    SubjectsModule,
    BookingsModule,
    OutboxModule,
    AvailabilityModule,
    CatalogModule,
    MessagingModule,
    EarningsModule,
    PaymentsModule,
    MarketingModule,
    ReviewsModule,
    AnalyticsModule,
    TutorSettingsModule,
    FavoritesModule,
    WalletModule,
    NotificationsModule,
    MonitoringModule,
    AssistantModule,
    TutorDashboardModule,
    AiGatewayModule,
    HelpModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
