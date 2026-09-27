import { CanActivate, ExecutionContext, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { createHash } from 'node:crypto'
import { and, eq, gt } from 'drizzle-orm'
import type { FastifyRequest } from 'fastify'
import { env } from '../config/env'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { sessions, users } from '../database/schema'
import type { AuthenticatedUser } from '../common/current-user.decorator'

export const tokenHash = (token: string) => createHash('sha256').update(token).digest('hex')

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<FastifyRequest>()
    const token = request.cookies[env().SESSION_COOKIE_NAME]
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: '请先登录。' })
    const [session] = await this.db.select({ userId: users.id, email: users.email })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .where(and(eq(sessions.tokenHash, tokenHash(token)), gt(sessions.expiresAt, new Date())))
      .limit(1)
    if (!session) throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: '登录状态已失效，请重新登录。' })
    ;(request as FastifyRequest & { user: AuthenticatedUser }).user = { id: session.userId, email: session.email }
    return true
  }
}
