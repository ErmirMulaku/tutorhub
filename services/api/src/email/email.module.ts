import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service.js';

/** Global so AuthService (student + tutor verification) can inject {@link EmailService}. */
@Global()
@Module({
  providers: [EmailService],
  exports: [EmailService],
})
export class EmailModule {}
