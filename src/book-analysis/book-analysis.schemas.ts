import { z } from 'zod'

export const createShortStorySchema = z.object({
  chapterIndexes: z.array(z.number().int().min(0)).min(1).max(20),
  targetWords: z.number().int().min(1000).max(20_000),
})

export type CreateShortStoryInput = z.infer<typeof createShortStorySchema>
