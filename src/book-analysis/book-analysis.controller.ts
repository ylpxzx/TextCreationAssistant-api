import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Post, Req, UseGuards } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { SessionGuard } from '../auth/session.guard'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { BookAnalysisService } from './book-analysis.service'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { createShortStorySchema, type CreateShortStoryInput } from './book-analysis.schemas'

@Controller('v1/book-analyses')
@UseGuards(SessionGuard)
export class BookAnalysisController {
  constructor(@Inject(BookAnalysisService) private readonly analyses: BookAnalysisService) {}

  @Post()
  async create(@Req() request: FastifyRequest, @CurrentUser() user: AuthenticatedUser) {
    const file = await request.file()
    return this.analyses.analyze(user.id, file, request.id)
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser) { return this.analyses.list(user.id) }

  @Get(':analysisId')
  detail(@Param('analysisId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.analyses.detail(id, user.id) }

  @Post(':analysisId/originalize')
  regenerate(@Param('analysisId', ParseUUIDPipe) id: string, @Req() request: FastifyRequest, @CurrentUser() user: AuthenticatedUser) {
    return this.analyses.regenerateOriginal(id, user.id, request.id)
  }

  @Post(':analysisId/short-stories')
  createShortStory(@Param('analysisId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(createShortStorySchema)) body: CreateShortStoryInput, @Req() request: FastifyRequest, @CurrentUser() user: AuthenticatedUser) {
    return this.analyses.createShortStory(id, user.id, body, request.id)
  }
  @Delete(':analysisId')
  remove(@Param('analysisId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.analyses.remove(id, user.id) }
}
