import { Inject, Injectable } from '@nestjs/common'
import { and, eq, isNull } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { chapters, projectCreativeStates, resourceGroups, resourceItems, type CreativeStateData } from '../database/schema'
import { ProjectAccessService } from '../projects/project-access.service'
import type { CreativeStateInput } from './creative-intelligence.schemas'

const emptyState = (): CreativeStateData => ({ styleProfile: { summary: '', preferredPatterns: [], bannedPatterns: [] }, characterVoices: [], sceneCards: [], editMarks: [], branches: [], stateSuggestions: [], consistencyIssues: [] })

@Injectable()
export class CreativeIntelligenceService {
  constructor(@Inject(DATABASE) private readonly db: Database, @Inject(ProjectAccessService) private readonly access: ProjectAccessService) {}
  async get(projectId: string, userId: string) {
    await this.access.project(projectId, userId)
    const [row] = await this.db.select().from(projectCreativeStates).where(eq(projectCreativeStates.projectId, projectId)).limit(1)
    return row?.data ?? emptyState()
  }
  async save(projectId: string, userId: string, data: CreativeStateInput) {
    await this.access.project(projectId, userId)
    const [row] = await this.db.insert(projectCreativeStates).values({ projectId, data }).onConflictDoUpdate({ target: projectCreativeStates.projectId, set: { data, updatedAt: new Date() } }).returning()
    return row.data
  }
  async scan(projectId: string, userId: string, chapterId: string) {
    await this.access.project(projectId, userId)
    const [chapter] = await this.db.select().from(chapters).where(and(eq(chapters.id, chapterId), eq(chapters.projectId, projectId), isNull(chapters.deletedAt))).limit(1)
    const text = chapter?.plainText ?? ''
    const patterns = ['不由得', '仿佛', '似乎', '微微一愣', '嘴角微微上扬', '空气中弥漫着', '不是[^。！？]{0,30}而是']
    const findings = patterns.flatMap(pattern => {
      const regex = new RegExp(pattern, 'g'); const matches = [...text.matchAll(regex)]
      return matches.map(match => ({ kind: 'template', label: `模板化表达：${match[0]}`, excerpt: text.slice(Math.max(0, match.index! - 28), Math.min(text.length, match.index! + match[0].length + 28)), offset: match.index }))
    })
    const sentences = text.split(/[。！？]/).filter(Boolean)
    if (sentences.length >= 6) { const lengths = sentences.map(item => item.length); const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length; const variance = lengths.reduce((sum, length) => sum + (length - avg) ** 2, 0) / lengths.length; if (variance < 35) findings.push({ kind: 'rhythm', label: '句长过于均匀，节奏可能显得机械', excerpt: sentences.slice(0, 4).join('。'), offset: 0 }) }
    return { score: Math.max(0, 100 - findings.length * 8), findings }
  }
  async search(projectId: string, userId: string, query: string) {
    await this.access.project(projectId, userId); const needle = query.toLocaleLowerCase()
    const chapterRows = await this.db.select().from(chapters).where(and(eq(chapters.projectId, projectId), isNull(chapters.deletedAt)))
    const groups = await this.db.select().from(resourceGroups).where(and(eq(resourceGroups.projectId, projectId), isNull(resourceGroups.deletedAt)))
    const items = groups.length ? await this.db.select().from(resourceItems).where(isNull(resourceItems.deletedAt)) : []
    return [
      ...chapterRows.filter(row => `${row.title}\n${row.plainText}`.toLocaleLowerCase().includes(needle)).map(row => ({ type: 'chapter', id: row.id, title: row.title, excerpt: this.excerpt(row.plainText, needle) })),
      ...items.filter(item => groups.some(group => group.id === item.groupId) && `${item.name}\n${item.content}`.toLocaleLowerCase().includes(needle)).map(item => ({ type: 'resource', id: item.id, title: item.name, excerpt: this.excerpt(item.content, needle) })),
    ].slice(0, 100)
  }
  async aiContext(projectId: string, userId: string, chapterId: string) {
    const data = await this.get(projectId, userId)
    const scene = data.sceneCards.find(item => item.chapterId === chapterId)
    const parts = [
      data.styleProfile.summary && `作者文风：${data.styleProfile.summary}`,
      data.styleProfile.preferredPatterns.length && `偏好：${data.styleProfile.preferredPatterns.join('；')}`,
      data.styleProfile.bannedPatterns.length && `禁止使用：${data.styleProfile.bannedPatterns.join('；')}`,
      data.characterVoices.length && `角色声纹：\n${data.characterVoices.map(item => `${item.name}：${item.description}${item.catchphrases.length ? `；习惯：${item.catchphrases.join('、')}` : ''}${item.bannedPatterns.length ? `；禁用：${item.bannedPatterns.join('、')}` : ''}`).join('\n')}`,
      scene && `当前场景：目标=${scene.goal}；冲突=${scene.conflict}；地点=${scene.location}；人物=${scene.characters.join('、')}；必须发生=${scene.requiredEvents.join('、')}；不可提前透露=${scene.forbiddenReveals.join('、')}；情绪弧=${scene.emotionalArc}；结尾钩子=${scene.hook}`,
    ].filter(Boolean).join('\n\n')
    return parts ? [{ sourceType: 'project' as const, sourceId: projectId, label: '作者文风、角色声纹与当前场景约束', content: parts, characterCount: parts.length }] : []
  }
  private excerpt(text: string, needle: string) { const at = text.toLocaleLowerCase().indexOf(needle); return text.slice(Math.max(0, at - 50), Math.min(text.length, at + needle.length + 90)) }
}
