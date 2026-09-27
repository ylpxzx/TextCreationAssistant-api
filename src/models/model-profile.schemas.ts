import { z } from 'zod'

const providerSchema = z.enum(['openai', 'openai-compatible'])
export const createModelProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
  provider: providerSchema,
  model: z.string().trim().min(1).max(160),
  baseUrl: z.string().trim().url(),
  apiKey: z.string().trim().min(8).max(500),
  isDefault: z.boolean().default(false),
})
export const updateModelProfileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  provider: providerSchema.optional(),
  model: z.string().trim().min(1).max(160).optional(),
  baseUrl: z.string().trim().url().optional(),
  apiKey: z.string().trim().min(8).max(500).optional(),
})
export type CreateModelProfileInput = z.infer<typeof createModelProfileSchema>
export type UpdateModelProfileInput = z.infer<typeof updateModelProfileSchema>
