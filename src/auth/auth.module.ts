import { Module } from '@nestjs/common'
import { AuthController } from './auth.controller'
import { AuthService } from './auth.service'
import { SessionGuard } from './session.guard'
import { AuthRateLimitGuard } from './auth-rate-limit.guard'

@Module({ controllers: [AuthController], providers: [AuthService, SessionGuard, AuthRateLimitGuard], exports: [SessionGuard] })
export class AuthModule {}
