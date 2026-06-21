import { Module } from '@nestjs/common';
import { TutorsController } from './tutors.controller.js';
import { TutorsResolver } from './tutors.resolver.js';
import { TutorsService } from './tutors.service.js';

@Module({
  controllers: [TutorsController],
  providers: [TutorsService, TutorsResolver],
  exports: [TutorsService],
})
export class TutorsModule {}
