import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, Query, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../auth/session.guard'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { createChapterSchema, type CreateChapterInput, reorderChapterSchema, type ReorderChapterInput, restoreRevisionSchema, type RestoreRevisionInput, revisionListSchema, type RevisionListInput, updateChapterSchema, type UpdateChapterInput } from './chapter.schemas'
import { ChaptersService } from './chapters.service'

@Controller('v1')
@UseGuards(SessionGuard)
export class ChaptersController {
  constructor(@Inject(ChaptersService) private readonly chapters: ChaptersService) {}
  @Post('projects/:projectId/chapters') create(@Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(createChapterSchema)) body: CreateChapterInput, @CurrentUser() user: AuthenticatedUser) { return this.chapters.create(projectId, user.id, body) }
  @Patch('chapters/:chapterId') update(@Param('chapterId', ParseUUIDPipe) chapterId: string, @Body(new ZodValidationPipe(updateChapterSchema)) body: UpdateChapterInput, @CurrentUser() user: AuthenticatedUser) { return this.chapters.update(chapterId, user.id, body) }
  @Delete('chapters/:chapterId') remove(@Param('chapterId', ParseUUIDPipe) chapterId: string, @CurrentUser() user: AuthenticatedUser) { return this.chapters.remove(chapterId, user.id) }
  @Post('chapters/:chapterId/reorder') reorder(@Param('chapterId', ParseUUIDPipe) chapterId: string, @Body(new ZodValidationPipe(reorderChapterSchema)) body: ReorderChapterInput, @CurrentUser() user: AuthenticatedUser) { return this.chapters.reorder(chapterId, user.id, body) }
  @Get('chapters/:chapterId/revisions') revisions(@Param('chapterId', ParseUUIDPipe) chapterId: string, @Query(new ZodValidationPipe(revisionListSchema)) query: RevisionListInput, @CurrentUser() user: AuthenticatedUser) { return this.chapters.revisions(chapterId, user.id, query) }
  @Get('chapters/:chapterId/revisions/:revisionId') revision(@Param('chapterId', ParseUUIDPipe) chapterId: string, @Param('revisionId', ParseUUIDPipe) revisionId: string, @CurrentUser() user: AuthenticatedUser) { return this.chapters.revision(chapterId, revisionId, user.id) }
  @Post('chapters/:chapterId/revisions/:revisionId/restore') restoreRevision(@Param('chapterId', ParseUUIDPipe) chapterId: string, @Param('revisionId', ParseUUIDPipe) revisionId: string, @Body(new ZodValidationPipe(restoreRevisionSchema)) body: RestoreRevisionInput, @CurrentUser() user: AuthenticatedUser) { return this.chapters.restoreRevision(chapterId, revisionId, user.id, body) }
}
