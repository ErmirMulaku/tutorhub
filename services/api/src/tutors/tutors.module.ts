import { Module } from '@nestjs/common';
import { TutorsController } from './tutors.controller.js';
import { TutorsService } from './tutors.service.js';

@Module({
  controllers: [TutorsController],
  providers: [TutorsService],
})
export class TutorsModule {}
