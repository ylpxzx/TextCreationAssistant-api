import { z } from 'zod'

export const createProjectSchema = z.object({
  title: z.string().trim().min(1).max(200),
  idea: z.string().max(5000).default(''),
  genres: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
  lengthType: z.string().trim().min(1).max(40).default('中长篇'),
  styles: z.array(z.string().trim().min(1).max(40)).max(12).default([]),
})

export const updateProjectSchema = createProjectSchema.partial().extend({ archived: z.boolean().optional() })
export type CreateProjectInput = z.infer<typeof createProjectSchema>
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>
