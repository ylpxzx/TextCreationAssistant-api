import { Inject, Injectable } from '@nestjs/common'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { chapters, projects } from '../database/schema'
import type { CreateProjectInput, UpdateProjectInput } from './project.schemas'
import { ProjectAccessService } from './project-access.service'

@Injectable()
export class ProjectsService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(ProjectAccessService) private readonly access: ProjectAccessService) {}

  list(userId: string) {
    return this.db.select().from(projects).where(and(eq(projects.ownerUserId, userId), isNull(projects.deletedAt))).orderBy(desc(projects.updatedAt))
  }

  async detail(projectId: string, userId: string) {
    const project = await this.access.project(projectId, userId)
    const projectChapters = await this.db.select().from(chapters).where(and(eq(chapters.projectId, projectId), isNull(chapters.deletedAt))).orderBy(chapters.orderIndex)
    return { ...project, chapters: projectChapters }
  }

  async create(userId: string, input: CreateProjectInput) {
    return this.db.transaction(async tx => {
      const [project] = await tx.insert(projects).values({ ownerUserId: userId, ...input }).returning()
      await tx.insert(chapters).values({ projectId: project.id, title: '第一章' })
      return project
    })
  }

  async update(projectId: string, userId: string, input: UpdateProjectInput) {
    await this.access.project(projectId, userId)
    const { archived, ...values } = input
    const [project] = await this.db.update(projects).set({ ...values, ...(archived === undefined ? {} : { archivedAt: archived ? new Date() : null }), updatedAt: new Date() }).where(eq(projects.id, projectId)).returning()
    return project
  }

  async remove(projectId: string, userId: string) {
    await this.access.project(projectId, userId)
    await this.db.update(projects).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(projects.id, projectId))
    return { ok: true }
  }
}
