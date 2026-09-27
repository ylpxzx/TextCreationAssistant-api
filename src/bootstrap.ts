import cookie from '@fastify/cookie'
import multipart from '@fastify/multipart'
import { NestFactory } from '@nestjs/core'
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppModule } from './app.module'
import { ApiExceptionFilter } from './common/api-exception.filter'
import { env } from './config/env'
import { randomUUID } from 'node:crypto'
import type { IncomingMessage } from 'node:http'

export async function createApplication(options: { logger?: boolean; swagger?: boolean } = {}) {
  const config = env()
  const adapter = new FastifyAdapter({
    bodyLimit: 52 * 1024 * 1024,
    logger: options.logger === false ? false : { level: 'info', redact: { paths: ['req.headers.authorization', 'req.headers.cookie', 'req.body.apiKey', 'req.body.model.apiKey', 'res.headers.set-cookie'], censor: '[REDACTED]' } },
    genReqId: (request: IncomingMessage) => {
      const incoming = request.headers['x-request-id']
      return typeof incoming === 'string' && /^[A-Za-z0-9._-]{8,128}$/.test(incoming) ? incoming : randomUUID()
    },
  })
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, { logger: options.logger === false ? false : undefined })
  adapter.getInstance().addHook('onRequest', async (request, reply) => { reply.header('x-request-id', request.id) })
  await app.register(cookie)
  await app.register(multipart, { limits: { files: 1, fileSize: 50 * 1024 * 1024 } })
  app.enableCors({ origin: config.WEB_ORIGIN, credentials: true, methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'] })
  app.useGlobalFilters(new ApiExceptionFilter())
  app.enableShutdownHooks()
  if (options.swagger ?? true) {
    const openApi = new DocumentBuilder().setTitle('墨引核心 API').setDescription('作品、章节、创作资料和模型配置的业务 API').setVersion('0.1.0').addCookieAuth(config.SESSION_COOKIE_NAME).build()
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, openApi))
  }
  return app
}
