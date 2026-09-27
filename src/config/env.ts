import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  SESSION_COOKIE_NAME: z.string().min(1).default('moyin_session'),
  SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
  SEED_USER_EMAIL: z.string().email().default('writer@example.com'),
  SEED_USER_PASSWORD: z.string().min(8).default('ChangeMe123!'),
  CREDENTIAL_ENCRYPTION_KEY: z.string().optional(),
  AI_SERVICE_URL: z.string().url().default('http://localhost:3100'),
  AI_SERVICE_TOKEN: z.string().min(32).optional(),
  AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1000).max(600000).default(125000),
})

export type AppEnv = z.infer<typeof envSchema>

let cached: AppEnv | undefined

export function env(): AppEnv {
  if (cached) return cached
  const parsed = envSchema.safeParse(process.env)
  if (!parsed.success) throw new Error(`环境变量配置错误：${z.prettifyError(parsed.error)}`)
  cached = parsed.data
  return cached
}
