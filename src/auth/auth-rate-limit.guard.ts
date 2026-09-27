import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

type Bucket = { count: number; resetAt: number }

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, Bucket>()
  private readonly windowMs = 60_000
  private readonly limit = 10

  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const reply = context.switchToHttp().getResponse<FastifyReply>()
    const now = Date.now()
    const key = request.ip
    const current = this.buckets.get(key)
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + this.windowMs } : current
    bucket.count += 1
    this.buckets.set(key, bucket)
    reply.header('X-RateLimit-Limit', this.limit).header('X-RateLimit-Remaining', Math.max(0, this.limit - bucket.count))
    if (bucket.count <= this.limit) return true
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    reply.header('Retry-After', retryAfter)
    throw new HttpException({ code: 'AUTH_RATE_LIMITED', message: '登录尝试过于频繁，请稍后再试。', retryable: true }, HttpStatus.TOO_MANY_REQUESTS)
  }
}
