import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import { and, eq } from 'drizzle-orm'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { generationContextItems, generationRecords, usageLedger } from '../database/schema'
import type { ContextReference, GenerationOperation } from './generation.types'

type StartGenerationInput = {
  userId: string
  projectId?: string
  chapterId?: string
  modelProfileId: string
  operation: GenerationOperation
  promptVersion: string
  provider: string
  model: string
  idempotencyKey?: string
  inputCharacters: number
  context: ContextReference[]
}

@Injectable()
export class GenerationsService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async start(input: StartGenerationInput) {
    if (input.idempotencyKey) {
      const [existing] = await this.db.select().from(generationRecords).where(and(eq(generationRecords.userId, input.userId), eq(generationRecords.idempotencyKey, input.idempotencyKey))).limit(1)
      if (existing) return { record: existing, reused: true }
    }
    const { context, ...recordInput } = input
    return this.db.transaction(async tx => {
      const [record] = await tx.insert(generationRecords).values({ ...recordInput, status: 'streaming', startedAt: new Date() }).returning()
      if (context.length) await tx.insert(generationContextItems).values(context.map(item => ({ generationId: record.id, sourceType: item.sourceType, sourceId: item.sourceId, label: item.label, characterCount: item.characterCount })))
      return { record, reused: false }
    }).catch(error => {
      if (input.idempotencyKey && this.isUniqueViolation(error)) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: '相同幂等键的生成请求正在处理中。' })
      throw error
    })
  }

  async complete(generationId: string, userId: string, input: { outputCharacters: number; finishReason: string; inputTokens: number; outputTokens: number; providerRequestId?: string }) {
    const record = await this.owned(generationId, userId)
    const completedAt = new Date()
    return this.db.transaction(async tx => {
      const [updated] = await tx.update(generationRecords).set({ status: 'completed', outputCharacters: input.outputCharacters, finishReason: input.finishReason, completedAt, durationMs: record.startedAt ? completedAt.getTime() - record.startedAt.getTime() : null, updatedAt: completedAt }).where(eq(generationRecords.id, generationId)).returning()
      await tx.insert(usageLedger).values({ generationId, userId, provider: record.provider, model: record.model, inputTokens: input.inputTokens, outputTokens: input.outputTokens, totalTokens: input.inputTokens + input.outputTokens, providerRequestId: input.providerRequestId }).onConflictDoNothing()
      return updated
    })
  }

  async fail(generationId: string, userId: string, errorCode: string) {
    const record = await this.owned(generationId, userId)
    const completedAt = new Date()
    const [updated] = await this.db.update(generationRecords).set({ status: 'failed', errorCode, completedAt, durationMs: record.startedAt ? completedAt.getTime() - record.startedAt.getTime() : null, updatedAt: completedAt }).where(eq(generationRecords.id, generationId)).returning()
    return updated
  }

  async cancel(generationId: string, userId: string) {
    const record = await this.owned(generationId, userId)
    const completedAt = new Date()
    const [updated] = await this.db.update(generationRecords).set({ status: 'cancelled', finishReason: 'cancelled', completedAt, durationMs: record.startedAt ? completedAt.getTime() - record.startedAt.getTime() : null, updatedAt: completedAt }).where(eq(generationRecords.id, generationId)).returning()
    return updated
  }

  private async owned(generationId: string, userId: string) {
    const [record] = await this.db.select().from(generationRecords).where(and(eq(generationRecords.id, generationId), eq(generationRecords.userId, userId))).limit(1)
    if (!record) throw new NotFoundException({ code: 'GENERATION_NOT_FOUND', message: '生成记录不存在。' })
    return record
  }

  private isUniqueViolation(error: unknown) { return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505' }
}
