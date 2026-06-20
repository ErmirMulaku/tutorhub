import { fileURLToPath } from 'node:url';
import { Module } from '@nestjs/common';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import './graphql/register-enums.js';
import { AuthModule } from './auth/auth.module.js';
import { AvailabilityModule } from './availability/availability.module.js';
import { BookingsModule } from './bookings/bookings.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SubjectsModule } from './subjects/subjects.module.js';
import { TutorsModule } from './tutors/tutors.module.js';

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
    TutorsModule,
    SubjectsModule,
    BookingsModule,
    AvailabilityModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
