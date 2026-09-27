import { BadRequestException, ConflictException, Inject, Injectable } from '@nestjs/common'
import { env } from '../config/env'
import { GenerationsService } from '../generations/generations.service'
import { ModelProfilesService } from '../models/model-profiles.service'
import { ProjectAccessService } from '../projects/project-access.service'
import { ResourcesService } from '../resources/resources.service'
import type { StreamGenerationInput } from './ai.schemas'
import { ActiveGenerationsService } from './active-generations.service'
import { AiServiceClient } from './ai-service.client'
import { selectGenerationContext } from './context-selector'
import { CreativeIntelligenceService } from '../creative-intelligence/creative-intelligence.service'

@Injectable()
export class AiOrchestratorService {
  constructor(
    @Inject(ProjectAccessService) private readonly access: ProjectAccessService,
    @Inject(ResourcesService) private readonly resources: ResourcesService,
    @Inject(CreativeIntelligenceService) private readonly creative: CreativeIntelligenceService,
    @Inject(ModelProfilesService) private readonly profiles: ModelProfilesService,
    @Inject(GenerationsService) private readonly generations: GenerationsService,
    @Inject(AiServiceClient) private readonly client: AiServiceClient,
    @Inject(ActiveGenerationsService) private readonly active: ActiveGenerationsService,
  ) {}

  async prepare(userId: string, input: StreamGenerationInput, idempotencyKey: string) {
    const project = await this.access.project(input.projectId, userId)
    const { chapter } = await this.access.chapter(input.chapterId, userId)
    if (chapter.projectId !== project.id) throw new BadRequestException({ code: 'CHAPTER_PROJECT_MISMATCH', message: '章节不属于指定作品。' })
    if (chapter.version !== input.chapterVersion) throw new ConflictException({ code: 'CHAPTER_VERSION_CONFLICT', message: '章节内容已经更新，请重新载入后再生成。', details: { currentVersion: chapter.version } })
    const previousChapter = await this.access.previousChapter(project.id, chapter.orderIndex)
    const profile = await this.profiles.resolveApiKey(input.modelProfileId, userId)
    const resourceContext = await this.resources.aiContext(project.id, userId)
    const creativeContext = await this.creative.aiContext(project.id, userId, chapter.id)
    const context = selectGenerationContext([
      ...(project.idea.trim() ? [{ sourceType: 'project' as const, sourceId: project.id, label: '作品构想', content: project.idea, characterCount: project.idea.length }] : []),
      ...(previousChapter?.plainText.trim() ? [{ sourceType: 'chapter' as const, sourceId: previousChapter.id, label: `上一章：${previousChapter.title}`, content: previousChapter.plainText.slice(-12_000), characterCount: Math.min(previousChapter.plainText.length, 12_000) }] : []),
      ...resourceContext,
      ...creativeContext,
    ])
    const started = await this.generations.start({ userId, projectId: project.id, chapterId: chapter.id, modelProfileId: profile.id, operation: input.operation, promptVersion: `${input.operation}-v1`, provider: profile.provider, model: profile.model, idempotencyKey, inputCharacters: input.instruction.length + input.selectedText.length + input.cursorContext.length + context.reduce((sum, item) => sum + item.characterCount, 0), context: context.map(({ content: _content, ...item }) => item) })
    if (started.reused) throw new ConflictException({ code: 'GENERATION_ALREADY_EXISTS', message: '相同请求已经提交，请勿重复生成。', details: { generationId: started.record.id, status: started.record.status } })
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), env().AI_REQUEST_TIMEOUT_MS)
    this.active.add(started.record.id, controller)
    return {
      record: started.record,
      controller,
      timeout,
      upstreamBody: {
        generationId: started.record.id,
        operation: input.operation,
        instruction: input.instruction,
        selectedText: input.selectedText,
        cursorContext: input.cursorContext,
        context: context.map(({ characterCount: _characterCount, ...item }) => item),
        model: { provider: profile.provider, model: profile.model, baseUrl: profile.baseUrl, apiKey: profile.apiKey },
        maxOutputTokens: input.maxOutputTokens,
        temperature: input.temperature,
      },
    }
  }

  finish(id: string, timeout: NodeJS.Timeout) { clearTimeout(timeout); this.active.remove(id) }
  cancelActive(id: string) { return this.active.cancel(id) }
  testModel(profileId: string, userId: string, signal: AbortSignal, requestId: string) { return this.profiles.resolveApiKey(profileId, userId).then(profile => this.client.testModel({ provider: profile.provider, model: profile.model, baseUrl: profile.baseUrl, apiKey: profile.apiKey }, signal, requestId)) }
  streamUpstream(body: Record<string, unknown>, signal: AbortSignal, requestId: string) { return this.client.stream(body, signal, requestId) }
  complete(id: string, userId: string, input: { outputCharacters: number; finishReason: string; inputTokens: number; outputTokens: number }) { return this.generations.complete(id, userId, input) }
  fail(id: string, userId: string, code: string) { return this.generations.fail(id, userId, code) }
  cancel(id: string, userId: string) { this.cancelActive(id); return this.generations.cancel(id, userId) }
}
