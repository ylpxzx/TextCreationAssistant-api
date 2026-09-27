import { Injectable, ServiceUnavailableException } from '@nestjs/common'
import { env } from '../config/env'

@Injectable()
export class AiServiceClient {
  private config() {
    const config = env()
    if (!config.AI_SERVICE_TOKEN) throw new ServiceUnavailableException({ code: 'AI_SERVICE_NOT_CONFIGURED', message: 'AI Service 内部认证尚未配置。' })
    return config
  }

  async testModel(body: Record<string, unknown>, signal: AbortSignal, requestId: string) {
    const config = this.config()
    return fetch(`${config.AI_SERVICE_URL}/internal/v1/models:test`, { method: 'POST', headers: { authorization: `Bearer ${config.AI_SERVICE_TOKEN}`, 'content-type': 'application/json', 'x-request-id': requestId }, body: JSON.stringify(body), signal })
  }

  async stream(body: Record<string, unknown>, signal: AbortSignal, requestId: string) {
    const config = this.config()
    return fetch(`${config.AI_SERVICE_URL}/internal/v1/generations:stream`, { method: 'POST', headers: { authorization: `Bearer ${config.AI_SERVICE_TOKEN}`, 'content-type': 'application/json', 'x-request-id': requestId }, body: JSON.stringify(body), signal })
  }

  async analyzeBook(body: Record<string, unknown>, signal: AbortSignal, requestId: string) {
    const config = this.config()
    return fetch(`${config.AI_SERVICE_URL}/internal/v1/books:analyze`, { method: 'POST', headers: { authorization: `Bearer ${config.AI_SERVICE_TOKEN}`, 'content-type': 'application/json', 'x-request-id': requestId }, body: JSON.stringify(body), signal })
  }
}
