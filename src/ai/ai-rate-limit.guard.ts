import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import type { AuthenticatedUser } from '../common/current-user.decorator'

type Bucket = { count: number; resetAt: number }

@Injectable()
export class AiRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>()
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest & { user: AuthenticatedUser }>()
    const reply = context.switchToHttp().getResponse<FastifyReply>()
    const now = Date.now(); const key = request.user.id; const current = this.buckets.get(key)
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + 60_000 } : current
    bucket.count += 1; this.buckets.set(key, bucket)
    reply.header('X-RateLimit-Limit', 20).header('X-RateLimit-Remaining', Math.max(0, 20 - bucket.count))
    if (bucket.count <= 20) return true
    reply.header('Retry-After', Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)))
    throw new HttpException({ code: 'AI_RATE_LIMITED', message: 'AI 请求过于频繁，请稍后再试。', retryable: true }, HttpStatus.TOO_MANY_REQUESTS)
  }
}
