import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { FavoritesResolver } from './favorites.resolver.js';
import { FavoritesService } from './favorites.service.js';

@Module({
  imports: [AuthModule],
  providers: [FavoritesService, FavoritesResolver],
})
export class FavoritesModule {}
