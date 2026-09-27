import 'reflect-metadata'
import { Logger } from '@nestjs/common'
import { createApplication } from './bootstrap'
import { env } from './config/env'

async function bootstrap() {
  const config = env()
  const app = await createApplication()
  await app.listen({ port: config.PORT, host: '0.0.0.0' })
  Logger.log(`API listening on http://localhost:${config.PORT}`, 'Bootstrap')
}

bootstrap().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
