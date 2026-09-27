import { z } from 'zod'

export const streamGenerationSchema = z.object({
  operation: z.enum(['completion', 'rewrite', 'chapter', 'question']),
  projectId: z.string().uuid(),
  chapterId: z.string().uuid(),
  chapterVersion: z.number().int().positive(),
  modelProfileId: z.string().uuid(),
  instruction: z.string().trim().min(1).max(4000),
  selectedText: z.string().max(100_000).default(''),
  cursorContext: z.string().max(20_000).default(''),
  maxOutputTokens: z.number().int().min(16).max(32_000).default(2048),
  temperature: z.number().min(0).max(2).default(0.8),
}).superRefine((value, context) => {
  if (value.operation === 'rewrite' && !value.selectedText.trim()) context.addIssue({ code: 'custom', message: '选区改写必须提供 selectedText', path: ['selectedText'] })
})

export type StreamGenerationInput = z.infer<typeof streamGenerationSchema>
