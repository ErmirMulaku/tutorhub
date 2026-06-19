import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BookingsModule } from './bookings/bookings.module.js';
import { HealthController } from './health/health.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { SubjectsModule } from './subjects/subjects.module.js';
import { TutorsModule } from './tutors/tutors.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    TutorsModule,
    SubjectsModule,
    BookingsModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
