import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../auth/session.guard'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { createModelProfileSchema, type CreateModelProfileInput, updateModelProfileSchema, type UpdateModelProfileInput } from './model-profile.schemas'
import { ModelProfilesService } from './model-profiles.service'

@Controller('v1/model-profiles')
@UseGuards(SessionGuard)
export class ModelProfilesController {
  constructor(@Inject(ModelProfilesService) private readonly profiles: ModelProfilesService) {}
  @Get() list(@CurrentUser() user: AuthenticatedUser) { return this.profiles.list(user.id) }
  @Post() create(@Body(new ZodValidationPipe(createModelProfileSchema)) body: CreateModelProfileInput, @CurrentUser() user: AuthenticatedUser) { return this.profiles.create(user.id, body) }
  @Patch(':profileId') update(@Param('profileId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateModelProfileSchema)) body: UpdateModelProfileInput, @CurrentUser() user: AuthenticatedUser) { return this.profiles.update(id, user.id, body) }
  @Post(':profileId/default') setDefault(@Param('profileId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.profiles.setDefault(id, user.id) }
  @Delete(':profileId') remove(@Param('profileId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.profiles.remove(id, user.id) }
}
