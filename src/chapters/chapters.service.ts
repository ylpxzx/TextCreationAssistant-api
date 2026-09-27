import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, desc, eq, isNull, lt, sql } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { chapterRevisions, chapters, projects } from '../database/schema'
import { ProjectAccessService } from '../projects/project-access.service'
import type { CreateChapterInput, ReorderChapterInput, RestoreRevisionInput, RevisionListInput, UpdateChapterInput } from './chapter.schemas'

@Injectable()
export class ChaptersService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(ProjectAccessService) private readonly access: ProjectAccessService) {}

  async create(projectId: string, userId: string, input: CreateChapterInput) {
    await this.access.project(projectId, userId)
    const [{ count }] = await this.db.select({ count: sql<number>`count(*)::int` }).from(chapters).where(and(eq(chapters.projectId, projectId), isNull(chapters.deletedAt)))
    const [chapter] = await this.db.insert(chapters).values({ projectId, title: input.title || `第${count + 1}章`, orderIndex: count }).returning()
    return chapter
  }

  async update(chapterId: string, userId: string, input: UpdateChapterInput) {
    const { chapter } = await this.access.chapter(chapterId, userId)
    if (chapter.version !== input.version) throw new ConflictException({ code: 'CHAPTER_VERSION_CONFLICT', message: '章节已在其他位置更新，请重新载入。', details: { currentVersion: chapter.version } })
    const wordCount = input.plainText === undefined ? chapter.wordCount : input.plainText.replace(/\s/g, '').length
    const { version: _expected, ...changes } = input
    const saved = await this.db.transaction(async tx => {
      await tx.insert(chapterRevisions).values({ chapterId, version: chapter.version, title: chapter.title, contentJson: chapter.contentJson, plainText: chapter.plainText }).onConflictDoNothing()
      const [updated] = await tx.update(chapters).set({ ...changes, wordCount, version: chapter.version + 1, updatedAt: new Date() }).where(and(eq(chapters.id, chapterId), eq(chapters.version, chapter.version), isNull(chapters.deletedAt))).returning()
      if (!updated) throw new ConflictException({ code: 'CHAPTER_VERSION_CONFLICT', message: '章节已在其他位置更新，请重新载入。' })
      const [{ total }] = await tx.select({ total: sql<number>`coalesce(sum(${chapters.wordCount}), 0)::int` }).from(chapters).where(and(eq(chapters.projectId, chapter.projectId), isNull(chapters.deletedAt)))
      await tx.update(projects).set({ totalWords: total, updatedAt: new Date() }).where(eq(projects.id, chapter.projectId))
      return updated
    })
    return saved
  }

  async remove(chapterId: string, userId: string) {
    const { chapter } = await this.access.chapter(chapterId, userId)
    await this.db.transaction(async tx => {
      await tx.update(chapters).set({ deletedAt: new Date(), updatedAt: new Date() }).where(eq(chapters.id, chapterId))
      const remaining = await tx.select({ id: chapters.id }).from(chapters).where(and(eq(chapters.projectId, chapter.projectId), isNull(chapters.deletedAt))).orderBy(chapters.orderIndex)
      await Promise.all(remaining.map((item, orderIndex) => tx.update(chapters).set({ orderIndex }).where(eq(chapters.id, item.id))))
      const [{ total }] = await tx.select({ total: sql<number>`coalesce(sum(${chapters.wordCount}), 0)::int` }).from(chapters).where(and(eq(chapters.projectId, chapter.projectId), isNull(chapters.deletedAt)))
      await tx.update(projects).set({ totalWords: total, updatedAt: new Date() }).where(eq(projects.id, chapter.projectId))
    })
    return { ok: true }
  }

  async reorder(chapterId: string, userId: string, input: ReorderChapterInput) {
    const { chapter } = await this.access.chapter(chapterId, userId)
    const siblings = await this.db.select().from(chapters).where(and(eq(chapters.projectId, chapter.projectId), isNull(chapters.deletedAt))).orderBy(chapters.orderIndex)
    const ordered = siblings.filter(item => item.id !== chapterId)
    ordered.splice(Math.min(input.orderIndex, ordered.length), 0, chapter)
    await this.db.transaction(async tx => { await Promise.all(ordered.map((item, index) => tx.update(chapters).set({ orderIndex: index, updatedAt: new Date() }).where(eq(chapters.id, item.id)))) })
    return { ok: true }
  }

  async revisions(chapterId: string, userId: string, input: RevisionListInput) {
    await this.access.chapter(chapterId, userId)
    const conditions = [eq(chapterRevisions.chapterId, chapterId)]
    if (input.beforeVersion !== undefined) conditions.push(lt(chapterRevisions.version, input.beforeVersion))
    const rows = await this.db.select().from(chapterRevisions).where(and(...conditions)).orderBy(desc(chapterRevisions.version)).limit(input.limit + 1)
    const hasMore = rows.length > input.limit
    const page = rows.slice(0, input.limit)
    return {
      items: page.map(({ contentJson: _contentJson, plainText, ...revision }) => ({ ...revision, wordCount: plainText.replace(/\s/g, '').length, excerpt: plainText.slice(0, 120) })),
      nextBeforeVersion: hasMore ? page.at(-1)?.version : null,
    }
  }

  async revision(chapterId: string, revisionId: string, userId: string) {
    await this.access.chapter(chapterId, userId)
    const [revision] = await this.db.select().from(chapterRevisions).where(and(eq(chapterRevisions.id, revisionId), eq(chapterRevisions.chapterId, chapterId))).limit(1)
    if (!revision) throw new NotFoundException({ code: 'CHAPTER_REVISION_NOT_FOUND', message: '章节历史版本不存在。' })
    return { ...revision, wordCount: revision.plainText.replace(/\s/g, '').length }
  }

  async restoreRevision(chapterId: string, revisionId: string, userId: string, input: RestoreRevisionInput) {
    const { chapter } = await this.access.chapter(chapterId, userId)
    if (chapter.version !== input.expectedVersion) throw new ConflictException({ code: 'CHAPTER_VERSION_CONFLICT', message: '章节已在其他位置更新，请重新载入。', details: { currentVersion: chapter.version } })
    const revision = await this.revision(chapterId, revisionId, userId)
    return this.db.transaction(async tx => {
      await tx.insert(chapterRevisions).values({ chapterId, version: chapter.version, title: chapter.title, contentJson: chapter.contentJson, plainText: chapter.plainText }).onConflictDoNothing()
      const [restored] = await tx.update(chapters).set({ title: revision.title, contentJson: revision.contentJson, plainText: revision.plainText, wordCount: revision.wordCount, version: chapter.version + 1, updatedAt: new Date() }).where(and(eq(chapters.id, chapterId), eq(chapters.version, input.expectedVersion), isNull(chapters.deletedAt))).returning()
      if (!restored) throw new ConflictException({ code: 'CHAPTER_VERSION_CONFLICT', message: '章节已在其他位置更新，请重新载入。' })
      const [{ total }] = await tx.select({ total: sql<number>`coalesce(sum(${chapters.wordCount}), 0)::int` }).from(chapters).where(and(eq(chapters.projectId, chapter.projectId), isNull(chapters.deletedAt)))
      await tx.update(projects).set({ totalWords: total, updatedAt: new Date() }).where(eq(projects.id, chapter.projectId))
      return restored
    })
  }
}
