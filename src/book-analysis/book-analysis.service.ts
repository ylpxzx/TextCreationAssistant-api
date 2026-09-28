import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { MultipartFile } from '@fastify/multipart'
import { extname } from 'node:path'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'
import { AiServiceClient } from '../ai/ai-service.client'
import { env } from '../config/env'
import { ModelProfilesService } from '../models/model-profiles.service'
import { extractEpubText } from './epub-parser'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { bookAnalyses } from '../database/schema'
import { and, desc, eq } from 'drizzle-orm'
import type { CreateShortStoryInput } from './book-analysis.schemas'

const supportedExtensions = new Set(['.pdf', '.epub', '.txt', '.md', '.markdown', '.docx'])

@Injectable()
export class BookAnalysisService {
  constructor(
    @Inject(DATABASE) private readonly db: Database,
    @Inject(ModelProfilesService) private readonly profiles: ModelProfilesService,
    @Inject(AiServiceClient) private readonly ai: AiServiceClient,
  ) {}

  async analyze(userId: string, file: MultipartFile | undefined, requestId: string) {
    if (!file) throw new BadRequestException({ code: 'BOOK_FILE_REQUIRED', message: '请选择需要拆解的书籍文件。' })
    const extension = extname(file.filename).toLowerCase()
    if (!supportedExtensions.has(extension)) throw new BadRequestException({ code: 'BOOK_FILE_UNSUPPORTED', message: '目前支持 PDF、EPUB、TXT、Markdown 和 DOCX 文件。' })
    const buffer = await file.toBuffer()
    let text: string
    try { text = normalizeText(await extractText(extension, buffer)) }
    catch { throw new BadRequestException({ code: 'BOOK_FILE_PARSE_FAILED', message: '书籍文件无法解析，文件可能已损坏、加密或格式不标准。' }) }
    if (text.length < 200) throw new BadRequestException({ code: 'BOOK_TEXT_TOO_SHORT', message: '文件中可解析的文字过少，无法进行拆书。扫描版 PDF 请先完成 OCR。' })
    const profile = await this.profiles.resolveDefaultApiKey(userId)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(env().AI_REQUEST_TIMEOUT_MS, 300_000))
    try {
      const response = await this.ai.analyzeBook({ filename: file.filename, text: text.slice(0, 500_000), model: { provider: profile.provider, model: profile.model, baseUrl: profile.baseUrl, apiKey: profile.apiKey } }, controller.signal, requestId)
      const body = await response.json() as { result?: unknown; error?: { message?: string } }
      if (!response.ok || !body.result) throw new BadGatewayException({ code: 'BOOK_ANALYSIS_FAILED', message: body.error?.message || '拆书分析失败，请稍后重试。' })
      const result = body.result as { sourceAnalysis?: Record<string, unknown>; originalPlan?: Record<string, unknown> & { title?: string } }
      if (!result.sourceAnalysis || !result.originalPlan) throw new BadGatewayException({ code: 'BOOK_ANALYSIS_INCOMPLETE', message: '模型返回的拆书结果不完整。' })
      const [record] = await this.db.insert(bookAnalyses).values({ userId, filename: file.filename, title: result.originalPlan.title || '未命名原创方案', characterCount: text.length, model: profile.model, sourceAnalysis: result.sourceAnalysis, originalPlan: result.originalPlan }).returning()
      return this.publicRecord(record)
    } finally { clearTimeout(timer) }
  }

  async regenerateOriginal(analysisId: string, userId: string, requestId: string) {
    const record = await this.record(analysisId, userId)
    const serialized = JSON.stringify(record.sourceAnalysis)
    if (serialized.length > 500_000) throw new BadRequestException({ code: 'SOURCE_ANALYSIS_TOO_LARGE', message: '原书拆解结果过大，无法重新生成。' })
    const profile = await this.profiles.resolveDefaultApiKey(userId)
    const response = await this.requestAnalysis(profile, { filename: '已完成的原书拆解.json', text: serialized }, requestId)
    const result = response.result as { originalPlan?: Record<string, unknown> & { title?: string } }
    if (!result?.originalPlan) throw new BadGatewayException({ code: 'BOOK_ORIGINAL_PLAN_MISSING', message: '模型没有返回可用的原创转化方案。' })
    const [updated] = await this.db.update(bookAnalyses).set({ originalPlan: result.originalPlan, title: result.originalPlan.title || record.title, model: profile.model, updatedAt: new Date() }).where(eq(bookAnalyses.id, record.id)).returning()
    return this.publicRecord(updated)
  }

  async createShortStory(analysisId: string, userId: string, input: CreateShortStoryInput, requestId: string) {
    const record = await this.record(analysisId, userId)
    const source = record.sourceAnalysis as { summary?: string; chapters?: Array<{ chapter?: string; summary?: string; turningPoint?: string; characterChanges?: string[] }> }
    const chapters = source.chapters || []
    const selectedChapters = [...new Set(input.chapterIndexes)].map(index => chapters[index]).filter(Boolean)
    if (selectedChapters.length !== new Set(input.chapterIndexes).size) throw new BadRequestException({ code: 'BOOK_CHAPTER_NOT_FOUND', message: '所选章节不存在，请刷新拆书结果后重试。' })
    const profile = await this.profiles.resolveDefaultApiKey(userId)
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(env().AI_REQUEST_TIMEOUT_MS, 300_000))
    try {
      const response = await this.ai.createShortStory({ sourceTitle: record.title, sourceSummary: source.summary || '未提供全书概述', selectedChapters: selectedChapters.map(item => ({ chapter: item.chapter || '未命名章节', summary: item.summary || '无概述', turningPoint: item.turningPoint || '', characterChanges: item.characterChanges || [] })), targetWords: input.targetWords, model: { provider: profile.provider, model: profile.model, baseUrl: profile.baseUrl, apiKey: profile.apiKey } }, controller.signal, requestId)
      const body = await response.json() as { result?: { title?: string; content?: string; wordCount?: number }; error?: { message?: string } }
      if (!response.ok || !body.result?.content) throw new BadGatewayException({ code: 'SHORT_STORY_GENERATION_FAILED', message: body.error?.message || '短篇生成失败，请稍后重试。' })
      if ((body.result.wordCount || body.result.content.replace(/\s/g, '').length) > 20_000) throw new BadGatewayException({ code: 'SHORT_STORY_TOO_LONG', message: '生成的短篇超过 2 万字，请调低目标字数后重试。' })
      return body.result
    } finally { clearTimeout(timer) }
  }

  async list(userId: string) {
    const rows = await this.db.select({ id: bookAnalyses.id, filename: bookAnalyses.filename, title: bookAnalyses.title, characterCount: bookAnalyses.characterCount, model: bookAnalyses.model, createdAt: bookAnalyses.createdAt, updatedAt: bookAnalyses.updatedAt }).from(bookAnalyses).where(eq(bookAnalyses.userId, userId)).orderBy(desc(bookAnalyses.updatedAt))
    return rows
  }

  async detail(id: string, userId: string) { return this.publicRecord(await this.record(id, userId)) }

  async remove(id: string, userId: string) {
    const record = await this.record(id, userId)
    await this.db.delete(bookAnalyses).where(eq(bookAnalyses.id, record.id))
    return { ok: true }
  }

  private async requestAnalysis(profile: Awaited<ReturnType<ModelProfilesService['resolveDefaultApiKey']>>, source: { filename: string; text: string }, requestId: string) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), Math.min(env().AI_REQUEST_TIMEOUT_MS, 300_000))
    try {
      const response = await this.ai.analyzeBook({ ...source, model: { provider: profile.provider, model: profile.model, baseUrl: profile.baseUrl, apiKey: profile.apiKey } }, controller.signal, requestId)
      const body = await response.json() as { result?: Record<string, unknown>; error?: { message?: string } }
      if (!response.ok || !body.result) throw new BadGatewayException({ code: 'BOOK_ANALYSIS_FAILED', message: body.error?.message || '拆书分析失败，请稍后重试。' })
      return body as { result: Record<string, unknown> }
    } finally { clearTimeout(timer) }
  }

  private async record(id: string, userId: string) {
    const [record] = await this.db.select().from(bookAnalyses).where(and(eq(bookAnalyses.id, id), eq(bookAnalyses.userId, userId))).limit(1)
    if (!record) throw new NotFoundException({ code: 'BOOK_ANALYSIS_NOT_FOUND', message: '拆书记录不存在。' })
    return record
  }

  private publicRecord(record: typeof bookAnalyses.$inferSelect) {
    return { id: record.id, filename: record.filename, title: record.title, characterCount: record.characterCount, model: record.model, createdAt: record.createdAt, updatedAt: record.updatedAt, result: { sourceAnalysis: record.sourceAnalysis, originalPlan: record.originalPlan } }
  }
}

async function extractText(extension: string, buffer: Buffer) {
  if (extension === '.pdf') {
    const parser = new PDFParse({ data: buffer })
    try { return (await parser.getText()).text } finally { await parser.destroy() }
  }
  if (extension === '.docx') return (await mammoth.extractRawText({ buffer })).value
  if (extension === '.epub') return extractEpubText(buffer)
  return buffer.toString('utf8')
}

function normalizeText(value: string) { return value.replace(/\u0000/g, '').replace(/\r\n/g, '\n').replace(/\n{4,}/g, '\n\n\n').trim() }
