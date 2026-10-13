import { Module } from '@nestjs/common';
import { HelpArticlesController } from './help-articles.controller.js';

@Module({ controllers: [HelpArticlesController] })
export class HelpModule {}
