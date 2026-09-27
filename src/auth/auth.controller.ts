import { Body, Controller, Get, Inject, Post, Req, Res, UseGuards } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { env } from '../config/env'
import { CurrentUser, type AuthenticatedUser } from '../common/current-user.decorator'
import { ZodValidationPipe } from '../common/zod-validation.pipe'
import { AuthService } from './auth.service'
import { credentialsSchema, type CredentialsInput } from './auth.schemas'
import { SessionGuard } from './session.guard'
import { AuthRateLimitGuard } from './auth-rate-limit.guard'

@Controller('v1/auth')
export class AuthController {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  @Post('register')
  @UseGuards(AuthRateLimitGuard)
  async register(@Body(new ZodValidationPipe(credentialsSchema)) body: CredentialsInput, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.register(body)
    this.setCookie(reply, result.token, result.expiresAt)
    return { user: result.user }
  }

  @Post('login')
  @UseGuards(AuthRateLimitGuard)
  async login(@Body(new ZodValidationPipe(credentialsSchema)) body: CredentialsInput, @Res({ passthrough: true }) reply: FastifyReply) {
    const result = await this.auth.login(body)
    this.setCookie(reply, result.token, result.expiresAt)
    return { user: result.user }
  }

  @Post('logout')
  async logout(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    await this.auth.logout(request.cookies[env().SESSION_COOKIE_NAME])
    reply.clearCookie(env().SESSION_COOKIE_NAME, { path: '/' })
    return { ok: true }
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: AuthenticatedUser) { return { user } }

  @Post('session/refresh')
  @UseGuards(SessionGuard)
  async refresh(@Req() request: FastifyRequest, @Res({ passthrough: true }) reply: FastifyReply) {
    const currentToken = request.cookies[env().SESSION_COOKIE_NAME]!
    const result = await this.auth.refresh(currentToken)
    this.setCookie(reply, result.token, result.expiresAt)
    return { ok: true, expiresAt: result.expiresAt }
  }

  private setCookie(reply: FastifyReply, token: string, expires: Date) {
    reply.setCookie(env().SESSION_COOKIE_NAME, token, { httpOnly: true, sameSite: 'lax', secure: env().NODE_ENV === 'production', path: '/', expires })
  }
}
