import { Body, Controller, Delete, Headers, Inject, Param, ParseUUIDPipe, Post, Req, Res, ServiceUnavailableException, UseGuards } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { SessionGuard } from '../auth/session.guard'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { env } from '../config/env'
import { AiOrchestratorService } from './ai-orchestrator.service'
import { AiRateLimitGuard } from './ai-rate-limit.guard'
import { streamGenerationSchema, type StreamGenerationInput } from './ai.schemas'

type CapturedEvents = { usage?: { inputTokens: number; outputTokens: number }; done?: { finishReason: string; outputCharacters: number }; error?: { code: string } }

@Controller('v1')
export class AiController {
  constructor(@Inject(AiOrchestratorService) private readonly ai: AiOrchestratorService) {}

  @Post('model-profiles/:profileId/test')
  @UseGuards(SessionGuard, AiRateLimitGuard)
  async testModel(@Param('profileId', ParseUUIDPipe) profileId: string, @CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const response = await this.ai.testModel(profileId, user.id, controller.signal, request.id)
      const payload = await safeJson(response)
      if (!response.ok) throw new ServiceUnavailableException(payload)
      return payload
    } finally { clearTimeout(timer) }
  }

  @Post('ai/generations:stream')
  @UseGuards(SessionGuard, AiRateLimitGuard)
  async stream(@Body(new ZodValidationPipe(streamGenerationSchema)) body: StreamGenerationInput, @Headers('idempotency-key') key: string | undefined, @CurrentUser() user: AuthenticatedUser, @Req() request: FastifyRequest, @Res() reply: FastifyReply) {
    if (!key || key.length < 8 || key.length > 128) return reply.code(400).send({ error: { code: 'IDEMPOTENCY_KEY_REQUIRED', message: '必须提供 8 到 128 位的 Idempotency-Key。', retryable: false, requestId: reply.request.id, details: {} } })
    const prepared = await this.ai.prepare(user.id, body, key)
    try {
      const upstream = await this.ai.streamUpstream(prepared.upstreamBody, prepared.controller.signal, request.id)
      if (!upstream.ok || !upstream.body) {
        const error = await safeJson(upstream); const code = publicErrorCode(error)
        await this.ai.fail(prepared.record.id, user.id, code)
        return reply.code(upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502).send(error)
      }
      reply.hijack()
      reply.raw.writeHead(200, { 'Access-Control-Allow-Origin': env().WEB_ORIGIN, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin', 'X-Request-Id': request.id, 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
      reply.raw.on('close', () => { if (!reply.raw.writableEnded) prepared.controller.abort() })
      const captured: CapturedEvents = {}; let buffer = ''; const decoder = new TextDecoder()
      for await (const chunk of upstream.body) {
        const bytes = Buffer.from(chunk); reply.raw.write(bytes); buffer += decoder.decode(bytes, { stream: true }); buffer = captureSse(buffer, captured)
      }
      buffer += decoder.decode(); captureSse(`${buffer}\n\n`, captured)
      if (captured.error) await this.ai.fail(prepared.record.id, user.id, captured.error.code)
      else if (prepared.controller.signal.aborted) await this.ai.cancel(prepared.record.id, user.id)
      else if (captured.done) await this.ai.complete(prepared.record.id, user.id, { outputCharacters: captured.done.outputCharacters || 0, finishReason: captured.done.finishReason, inputTokens: captured.usage?.inputTokens || 0, outputTokens: captured.usage?.outputTokens || 0 })
      else await this.ai.fail(prepared.record.id, user.id, 'MODEL_STREAM_INCOMPLETE')
      reply.raw.end()
    } catch (error) {
      if (prepared.controller.signal.aborted) await this.ai.cancel(prepared.record.id, user.id)
      else await this.ai.fail(prepared.record.id, user.id, 'AI_SERVICE_UNAVAILABLE')
      if (!reply.raw.headersSent) throw error
      reply.raw.end()
    } finally { this.ai.finish(prepared.record.id, prepared.timeout) }
  }

  @Delete('ai/generations/:generationId')
  @UseGuards(SessionGuard)
  async cancel(@Param('generationId', ParseUUIDPipe) id: string, @CurrentUser() user: AuthenticatedUser) { await this.ai.cancel(id, user.id); return { ok: true } }
}

async function safeJson(response: Response): Promise<Record<string, unknown>> { try { return await response.json() as Record<string, unknown> } catch { return { error: { code: 'AI_SERVICE_INVALID_RESPONSE', message: 'AI Service 返回了无效响应。', retryable: true, details: {} } } } }
function publicErrorCode(value: Record<string, unknown>) { const error = value.error as Record<string, unknown> | undefined; return typeof error?.code === 'string' ? error.code : 'AI_SERVICE_UNAVAILABLE' }
function captureSse(buffer: string, captured: CapturedEvents) {
  let boundary = buffer.indexOf('\n\n')
  while (boundary >= 0) {
    const block = buffer.slice(0, boundary); buffer = buffer.slice(boundary + 2)
    const data = block.split('\n').find(line => line.startsWith('data: '))?.slice(6)
    if (data) { try { const event = JSON.parse(data) as Record<string, unknown>; if (event.event === 'generation.usage') captured.usage = { inputTokens: Number(event.inputTokens || 0), outputTokens: Number(event.outputTokens || 0) }; if (event.event === 'generation.done') captured.done = { finishReason: String(event.finishReason || 'stop'), outputCharacters: Number(event.outputCharacters || 0) }; if (event.event === 'generation.error') captured.error = { code: String(event.code || 'MODEL_UNAVAILABLE') } } catch { /* ignore malformed non-contract block */ } }
    boundary = buffer.indexOf('\n\n')
  }
  return buffer
}
