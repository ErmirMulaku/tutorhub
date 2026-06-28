import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { TutorSettingsResolver } from './tutor-settings.resolver.js';
import { TutorSettingsService } from './tutor-settings.service.js';

@Module({
  imports: [AuthModule],
  providers: [TutorSettingsService, TutorSettingsResolver],
})
export class TutorSettingsModule {}
