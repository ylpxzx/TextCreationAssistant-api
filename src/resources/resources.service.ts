import { Inject, Injectable } from '@nestjs/common'
import { and, eq, inArray, isNull, sql } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { resourceGroups, resourceItems } from '../database/schema'
import { ProjectAccessService } from '../projects/project-access.service'
import type { CreateGroupInput, CreateItemInput, ReorderInput, UpdateGroupInput, UpdateItemInput } from './resource.schemas'

@Injectable()
export class ResourcesService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(ProjectAccessService) private readonly access: ProjectAccessService) {}

  async list(projectId: string, userId: string) {
    await this.access.project(projectId, userId)
    const groups = await this.db.select().from(resourceGroups).where(and(eq(resourceGroups.projectId, projectId), isNull(resourceGroups.deletedAt))).orderBy(resourceGroups.orderIndex)
    if (!groups.length) return []
    const items = await this.db.select().from(resourceItems).where(and(inArray(resourceItems.groupId, groups.map(group => group.id)), isNull(resourceItems.deletedAt))).orderBy(resourceItems.orderIndex)
    return groups.map(group => ({ ...group, items: items.filter(item => item.groupId === group.id) }))
  }

  async createGroup(projectId: string, userId: string, input: CreateGroupInput) {
    await this.access.project(projectId, userId)
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(resourceGroups).where(and(eq(resourceGroups.projectId, projectId), isNull(resourceGroups.deletedAt)))
    const [group] = await this.db.insert(resourceGroups).values({ projectId, ...input, orderIndex: count }).returning()
    return { ...group, items: [] }
  }

  async updateGroup(groupId: string, userId: string, input: UpdateGroupInput) {
    await this.access.group(groupId, userId)
    const [group] = await this.db.update(resourceGroups).set({ ...input, updatedAt: new Date() }).where(eq(resourceGroups.id, groupId)).returning()
    return group
  }

  async removeGroup(groupId: string, userId: string) {
    await this.access.group(groupId, userId)
    const deletedAt = new Date()
    await this.db.transaction(async tx => {
      await tx.update(resourceGroups).set({ deletedAt, updatedAt: deletedAt }).where(eq(resourceGroups.id, groupId))
      await tx.update(resourceItems).set({ deletedAt, updatedAt: deletedAt }).where(and(eq(resourceItems.groupId, groupId), isNull(resourceItems.deletedAt)))
    })
    return { ok: true }
  }

  async reorderGroup(groupId: string, userId: string, input: ReorderInput) {
    const { group } = await this.access.group(groupId, userId)
    const siblings = await this.db.select().from(resourceGroups).where(and(eq(resourceGroups.projectId, group.projectId), isNull(resourceGroups.deletedAt))).orderBy(resourceGroups.orderIndex)
    await this.reorderRows(siblings, groupId, input.orderIndex, resourceGroups)
    return { ok: true }
  }

  async createItem(groupId: string, userId: string, input: CreateItemInput) {
    await this.access.group(groupId, userId)
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(resourceItems).where(and(eq(resourceItems.groupId, groupId), isNull(resourceItems.deletedAt)))
    const [item] = await this.db.insert(resourceItems).values({ groupId, ...input, orderIndex: count }).returning()
    return item
  }

  async updateItem(itemId: string, userId: string, input: UpdateItemInput) {
    await this.access.item(itemId, userId)
    const [item] = await this.db.update(resourceItems).set({ ...input, updatedAt: new Date() }).where(eq(resourceItems.id, itemId)).returning()
    return item
  }

  async removeItem(itemId: string, userId: string) {
    await this.access.item(itemId, userId)
    await this.db.update(resourceItems).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(resourceItems.id, itemId))
    return { ok: true }
  }

  async reorderItem(itemId: string, userId: string, input: ReorderInput) {
    const { item } = await this.access.item(itemId, userId)
    const siblings = await this.db.select().from(resourceItems).where(and(eq(resourceItems.groupId, item.groupId), isNull(resourceItems.deletedAt))).orderBy(resourceItems.orderIndex)
    await this.reorderRows(siblings, itemId, input.orderIndex, resourceItems)
    return { ok: true }
  }

  async aiContext(projectId: string, userId: string) {
    await this.access.project(projectId, userId)
    const groups = await this.db.select().from(resourceGroups).where(and(eq(resourceGroups.projectId, projectId), eq(resourceGroups.useInAi, true), isNull(resourceGroups.deletedAt))).orderBy(resourceGroups.orderIndex)
    if (!groups.length) return []
    const items = await this.db.select().from(resourceItems).where(and(inArray(resourceItems.groupId, groups.map(group => group.id)), eq(resourceItems.useInAi, true), isNull(resourceItems.deletedAt))).orderBy(resourceItems.orderIndex)
    return groups.flatMap(group => items.filter(item => item.groupId === group.id && item.content.trim()).map(item => ({ sourceType: 'resource-item' as const, sourceId: item.id, label: `${group.name} / ${item.name}`, content: item.content, characterCount: item.content.length })))
  }

  private async reorderRows(rows: Array<{ id: string }>, id: string, target: number, table: typeof resourceGroups | typeof resourceItems) {
    const current = rows.find(row => row.id === id)
    if (!current) return
    const ordered = rows.filter(row => row.id !== id)
    ordered.splice(Math.min(target, ordered.length), 0, current)
    await this.db.transaction(async tx => {
      await Promise.all(ordered.map((row, orderIndex) => tx.update(table).set({ orderIndex, updatedAt: new Date() }).where(eq(table.id, row.id))))
    })
  }
}
