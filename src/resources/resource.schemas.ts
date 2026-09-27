import { z } from 'zod'

export const createGroupSchema = z.object({ name: z.string().trim().min(1).max(120), useInAi: z.boolean().default(true) })
export const updateGroupSchema = createGroupSchema.partial()
export const createItemSchema = z.object({ name: z.string().trim().min(1).max(160), content: z.string().max(500_000).default(''), useInAi: z.boolean().default(true) })
export const updateItemSchema = createItemSchema.partial()
export const reorderSchema = z.object({ orderIndex: z.number().int().nonnegative() })
export type CreateGroupInput = z.infer<typeof createGroupSchema>
export type UpdateGroupInput = z.infer<typeof updateGroupSchema>
export type CreateItemInput = z.infer<typeof createItemSchema>
export type UpdateItemInput = z.infer<typeof updateItemSchema>
export type ReorderInput = z.infer<typeof reorderSchema>
