import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { CatalogResolver } from './catalog.resolver.js';
import { CatalogService } from './catalog.service.js';

@Module({
  imports: [AuthModule],
  providers: [CatalogService, CatalogResolver],
})
export class CatalogModule {}
