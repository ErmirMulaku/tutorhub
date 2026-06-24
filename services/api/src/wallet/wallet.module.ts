import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { WalletResolver } from './wallet.resolver.js';
import { WalletService } from './wallet.service.js';

@Module({
  imports: [AuthModule],
  providers: [WalletService, WalletResolver],
})
export class WalletModule {}
