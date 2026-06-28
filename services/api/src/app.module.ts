import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import './graphql/register-enums.js';
import { AccountModule } from './account/account.module.js';
import { AssistantModule } from './assistant/assistant.module.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { CatalogModule } from './catalog/catalog.module.js';
import { FavoritesModule } from './favorites/favorites.module.js';
import { HealthController } from './health/health.controller.js';
import { MessagingModule } from './messaging/messaging.module.js';
import { MonitoringModule } from './monitoring/monitoring.module.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SubjectsModule } from './subjects/subjects.module.js';
import { TutorDashboardModule } from './tutor-dashboard/tutor-dashboard.module.js';
import { TutorsModule } from './tutors/tutors.module.js';
import { WalletModule } from './wallet/wallet.module.js';

// Written to the repo-root docs/ on boot; committed as the GraphQL SDL (SPEC §9).
const schemaFile = fileURLToPath(new URL('../../../docs/schema.graphql', import.meta.url));

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: schemaFile,
      sortSchema: true,
      graphiql: true,
      context: ({ req }: { req: unknown }) => ({ req }),
    }),
    PrismaModule,
    AuthModule,
    AccountModule,
    TutorsModule,
    SubjectsModule,
    BookingsModule,
    AvailabilityModule,
    CatalogModule,
    MessagingModule,
    FavoritesModule,
    WalletModule,
    NotificationsModule,
    MonitoringModule,
    AssistantModule,
    TutorDashboardModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
