import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { FastifyRequest } from 'fastify'

export type AuthenticatedUser = { id: string; email: string }

export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext): AuthenticatedUser => {
  return (context.switchToHttp().getRequest<FastifyRequest>() as FastifyRequest & { user: AuthenticatedUser }).user
})
