import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { SessionGuard } from '../auth/session.guard'
import { createProjectSchema, type CreateProjectInput, type UpdateProjectInput, updateProjectSchema } from './project.schemas'
import { ProjectsService } from './projects.service'

@Controller('v1/projects')
@UseGuards(SessionGuard)
export class ProjectsController {
  constructor(@Inject(ProjectsService) private readonly projects: ProjectsService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.projects.list(user.id) }
  @Get(':projectId') detail(@Param('projectId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.projects.detail(id, user.id) }
  @Post() create(@Body(new ZodValidationPipe(createProjectSchema)) body: CreateProjectInput, @CurrentUser() user: AuthenticatedUser) { return this.projects.create(user.id, body) }
  @Patch(':projectId') update(@Param('projectId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateProjectSchema)) body: UpdateProjectInput, @CurrentUser() user: AuthenticatedUser) { return this.projects.update(id, user.id, body) }
  @Delete(':projectId') remove(@Param('projectId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.projects.remove(id, user.id) }
}
