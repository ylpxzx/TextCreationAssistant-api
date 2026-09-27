import { Body, Controller, Get, Inject, Param, ParseUUIDPipe, Put, Post, Query, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../auth/session.guard'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { CreativeIntelligenceService } from './creative-intelligence.service'
import { creativeStateSchema, type CreativeStateInput, scanSchema, searchSchema } from './creative-intelligence.schemas'

@Controller('v1/projects/:projectId/creative-intelligence')
@UseGuards(SessionGuard)
export class CreativeIntelligenceController {
  constructor(@Inject(CreativeIntelligenceService) private readonly service: CreativeIntelligenceService) {}
  @Get() get(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser() user: AuthenticatedUser) { return this.service.get(projectId, user.id) }
  @Put() save(@Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(creativeStateSchema)) body: CreativeStateInput, @CurrentUser() user: AuthenticatedUser) { return this.service.save(projectId, user.id, body) }
  @Post('scan') scan(@Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(scanSchema)) body: { chapterId: string }, @CurrentUser() user: AuthenticatedUser) { return this.service.scan(projectId, user.id, body.chapterId) }
  @Get('search') search(@Param('projectId', ParseUUIDPipe) projectId: string, @Query(new ZodValidationPipe(searchSchema)) query: { q: string }, @CurrentUser() user: AuthenticatedUser) { return this.service.search(projectId, user.id, query.q) }
}
