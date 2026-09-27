import { z } from 'zod'

const status = z.enum(['draft', 'writing', 'done'])
export const createChapterSchema = z.object({ title: z.string().trim().min(1).max(200).optional() })
export const updateChapterSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  contentJson: z.record(z.string(), z.unknown()).optional(),
  plainText: z.string().max(2_000_000).optional(),
  status: status.optional(),
  version: z.number().int().positive(),
})
export const reorderChapterSchema = z.object({ orderIndex: z.number().int().nonnegative() })
export const revisionListSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  beforeVersion: z.coerce.number().int().positive().optional(),
})
export const restoreRevisionSchema = z.object({ expectedVersion: z.number().int().positive() })
export type CreateChapterInput = z.infer<typeof createChapterSchema>
export type UpdateChapterInput = z.infer<typeof updateChapterSchema>
export type ReorderChapterInput = z.infer<typeof reorderChapterSchema>
export type RevisionListInput = z.infer<typeof revisionListSchema>
export type RestoreRevisionInput = z.infer<typeof restoreRevisionSchema>
