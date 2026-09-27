import { Body, Controller, Delete, Get, Inject, Param, ParseUUIDPipe, Patch, Post, UseGuards } from '@nestjs/common'
import { SessionGuard } from '../auth/session.guard'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { createGroupSchema, type CreateGroupInput, createItemSchema, type CreateItemInput, reorderSchema, type ReorderInput, updateGroupSchema, type UpdateGroupInput, updateItemSchema, type UpdateItemInput } from './resource.schemas'
import { ResourcesService } from './resources.service'

@Controller('v1')
@UseGuards(SessionGuard)
export class ResourcesController {
  constructor(@Inject(ResourcesService) private readonly resources: ResourcesService) {}
  @Get('projects/:projectId/resources') list(@Param('projectId', ParseUUIDPipe) projectId: string, @CurrentUser() user: AuthenticatedUser) { return this.resources.list(projectId, user.id) }
  @Post('projects/:projectId/resource-groups') createGroup(@Param('projectId', ParseUUIDPipe) projectId: string, @Body(new ZodValidationPipe(createGroupSchema)) body: CreateGroupInput, @CurrentUser() user: AuthenticatedUser) { return this.resources.createGroup(projectId, user.id, body) }
  @Patch('resource-groups/:groupId') updateGroup(@Param('groupId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateGroupSchema)) body: UpdateGroupInput, @CurrentUser() user: AuthenticatedUser) { return this.resources.updateGroup(id, user.id, body) }
  @Delete('resource-groups/:groupId') removeGroup(@Param('groupId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.resources.removeGroup(id, user.id) }
  @Post('resource-groups/:groupId/reorder') reorderGroup(@Param('groupId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput, @CurrentUser() user: AuthenticatedUser) { return this.resources.reorderGroup(id, user.id, body) }
  @Post('resource-groups/:groupId/items') createItem(@Param('groupId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput, @CurrentUser() user: AuthenticatedUser) { return this.resources.createItem(id, user.id, body) }
  @Patch('resource-items/:itemId') updateItem(@Param('itemId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemInput, @CurrentUser() user: AuthenticatedUser) { return this.resources.updateItem(id, user.id, body) }
  @Delete('resource-items/:itemId') removeItem(@Param('itemId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { return this.resources.removeItem(id, user.id) }
  @Post('resource-items/:itemId/reorder') reorderItem(@Param('itemId', ParseUUIDPipe) id: string, @Body(new ZodValidationPipe(reorderSchema)) body: ReorderInput, @CurrentUser() user: AuthenticatedUser) { return this.resources.reorderItem(id, user.id, body) }
}
