import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'
import { env } from '../config/env'

const safeMethods = new Set(['GET', 'HEAD', 'OPTIONS'])

@Injectable()
export class OriginGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    if (safeMethods.has(request.method)) return true
    const origin = request.headers.origin
    if (!origin) return true
    if (origin === new URL(env().WEB_ORIGIN).origin) return true
    throw new ForbiddenException({ code: 'ORIGIN_NOT_ALLOWED', message: '请求来源不受信任。' })
  }
}
