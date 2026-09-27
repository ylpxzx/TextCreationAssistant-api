import { Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, lt } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { chapters, projects, resourceGroups, resourceItems } from '../database/schema'

@Injectable()
export class ProjectAccessService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async project(projectId: string, userId: string) {
    const [project] = await this.db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.ownerUserId, userId), isNull(projects.deletedAt))).limit(1)
    if (!project) throw new NotFoundException({ code: 'PROJECT_NOT_FOUND', message: '作品不存在。' })
    return project
  }

  async chapter(chapterId: string, userId: string) {
    const [row] = await this.db.select({ chapter: chapters, project: projects }).from(chapters).innerJoin(projects, eq(projects.id, chapters.projectId)).where(and(eq(chapters.id, chapterId), eq(projects.ownerUserId, userId), isNull(chapters.deletedAt), isNull(projects.deletedAt))).limit(1)
    if (!row) throw new NotFoundException({ code: 'CHAPTER_NOT_FOUND', message: '章节不存在。' })
    return row
  }

  async previousChapter(projectId: string, orderIndex: number) {
    const [chapter] = await this.db.select().from(chapters).where(and(eq(chapters.projectId, projectId), lt(chapters.orderIndex, orderIndex), isNull(chapters.deletedAt))).orderBy(desc(chapters.orderIndex)).limit(1)
    return chapter
  }

  async group(groupId: string, userId: string) {
    const [row] = await this.db.select({ group: resourceGroups, project: projects }).from(resourceGroups).innerJoin(projects, eq(projects.id, resourceGroups.projectId)).where(and(eq(resourceGroups.id, groupId), eq(projects.ownerUserId, userId), isNull(resourceGroups.deletedAt), isNull(projects.deletedAt))).limit(1)
    if (!row) throw new NotFoundException({ code: 'RESOURCE_GROUP_NOT_FOUND', message: '资料分类不存在。' })
    return row
  }

  async item(itemId: string, userId: string) {
    const [row] = await this.db.select({ item: resourceItems, group: resourceGroups, project: projects }).from(resourceItems).innerJoin(resourceGroups, eq(resourceGroups.id, resourceItems.groupId)).innerJoin(projects, eq(projects.id, resourceGroups.projectId)).where(and(eq(resourceItems.id, itemId), eq(projects.ownerUserId, userId), isNull(resourceItems.deletedAt), isNull(resourceGroups.deletedAt), isNull(projects.deletedAt))).limit(1)
    if (!row) throw new NotFoundException({ code: 'RESOURCE_ITEM_NOT_FOUND', message: '资料不存在。' })
    return row
  }
}
