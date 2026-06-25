import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { AccountResolver } from './account.resolver.js';
import { AccountService } from './account.service.js';

@Module({
  imports: [AuthModule],
  providers: [AccountService, AccountResolver],
})
export class AccountModule {}
