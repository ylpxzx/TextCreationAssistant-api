import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger, type ExceptionFilter } from '@nestjs/common'
import type { FastifyReply, FastifyRequest } from 'fastify'

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name)

  catch(exception: unknown, host: ArgumentsHost) {
    const context = host.switchToHttp()
    const request = context.getRequest<FastifyRequest>()
    const reply = context.getResponse<FastifyReply>()
    const external = exception as { statusCode?: number; code?: string; message?: string }
    const status = exception instanceof HttpException ? exception.getStatus() : typeof external?.statusCode === 'number' ? external.statusCode : HttpStatus.INTERNAL_SERVER_ERROR
    if (status >= 500) this.logger.error(exception instanceof Error ? exception.message : 'Unknown internal error', exception instanceof Error ? exception.stack : undefined)
    const response = exception instanceof HttpException ? exception.getResponse() : undefined
    const payload = typeof response === 'object' && response ? response as Record<string, unknown> : {}
    const fastifyMessage = external?.code === 'FST_REQ_FILE_TOO_LARGE' ? '书籍文件不能超过 50MB。' : external?.message
    const fallbackMessage = status === 500 ? '服务器暂时无法处理请求。' : fastifyMessage || String(response || '请求失败')
    reply.status(status).send({
      error: {
        code: typeof payload.code === 'string' ? payload.code : external?.code || (status === 500 ? 'INTERNAL_ERROR' : 'REQUEST_FAILED'),
        message: typeof payload.message === 'string' ? payload.message : fallbackMessage,
        retryable: status >= 500,
        requestId: request.id,
        details: payload.details || {},
      },
    })
  }
}
