import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { loadHelpArticles, type HelpArticle } from '../ai-gateway/rag/articles.js';

/**
 * Public, read-only access to the same help-center articles the `chat`
 * task's `search_help_articles` tool retrieves — this is what a citation in
 * the unified chat links to. No auth: help-center content is public.
 */
@ApiTags('help')
@Controller('help/articles')
export class HelpArticlesController {
  @Get(':id')
  @ApiOkResponse({ description: 'One help-center article.' })
  async get(@Param('id') id: string): Promise<HelpArticle> {
    const articles = await loadHelpArticles();
    const article = articles.find((a) => a.id === id);
    if (article === undefined) {
      throw new NotFoundException(`Help article "${id}" not found.`);
    }
    return article;
  }
}
