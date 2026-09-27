import { ConflictException, Inject, Injectable, UnauthorizedException } from '@nestjs/common'
import { randomBytes } from 'node:crypto'
import { eq, lt } from 'drizzle-orm'
import { env } from '../config/env'
import { DATABASE } from '../database/database.constants'
import type { Database } from '../database/database.module'
import { sessions, users } from '../database/schema'
import { hashPassword, verifyPassword } from './password'
import { tokenHash } from './session.guard'
import type { CredentialsInput } from './auth.schemas'

@Injectable()
export class AuthService {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  async register(input: CredentialsInput) {
    const existing = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
    if (existing.length) throw new ConflictException({ code: 'EMAIL_EXISTS', message: '该邮箱已经注册。' })
    const [user] = await this.db.insert(users).values({ email: input.email, passwordHash: await hashPassword(input.password) }).returning({ id: users.id, email: users.email })
    return { user, ...(await this.createSession(user.id)) }
  }

  async login(input: CredentialsInput) {
    const [record] = await this.db.select().from(users).where(eq(users.email, input.email)).limit(1)
    if (!record || !await verifyPassword(input.password, record.passwordHash)) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: '邮箱或密码不正确。' })
    return { user: { id: record.id, email: record.email }, ...(await this.createSession(record.id)) }
  }

  async logout(token?: string) {
    if (token) await this.db.delete(sessions).where(eq(sessions.tokenHash, tokenHash(token)))
  }

  async refresh(token: string) {
    const nextToken = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000)
    await this.db.update(sessions).set({ tokenHash: tokenHash(nextToken), expiresAt }).where(eq(sessions.tokenHash, tokenHash(token)))
    return { token: nextToken, expiresAt }
  }

  private async createSession(userId: string) {
    await this.db.delete(sessions).where(lt(sessions.expiresAt, new Date()))
    const token = randomBytes(32).toString('base64url')
    const expiresAt = new Date(Date.now() + env().SESSION_TTL_DAYS * 86_400_000)
    await this.db.insert(sessions).values({ userId, tokenHash: tokenHash(token), expiresAt })
    return { token, expiresAt }
  }
}
