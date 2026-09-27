import { z } from 'zod'

const voice = z.object({ id: z.string(), name: z.string().max(120), description: z.string().max(4000), catchphrases: z.array(z.string().max(200)), bannedPatterns: z.array(z.string().max(200)) })
const scene = z.object({ id: z.string(), chapterId: z.string().uuid(), goal: z.string().max(2000), conflict: z.string().max(2000), characters: z.array(z.string()), location: z.string().max(300), requiredEvents: z.array(z.string()), forbiddenReveals: z.array(z.string()), emotionalArc: z.string().max(1000), targetWords: z.number().int().min(0).max(100000), hook: z.string().max(2000), beats: z.array(z.string()) })
const mark = z.object({ id: z.string(), chapterId: z.string().uuid(), excerpt: z.string().max(3000), kind: z.string().max(80), note: z.string().max(2000), resolved: z.boolean(), createdAt: z.string() })
const branch = z.object({ id: z.string(), name: z.string().max(160), description: z.string().max(2000), chapterId: z.string().uuid(), content: z.string().max(500_000), createdAt: z.string() })
const suggestion = z.object({ id: z.string(), chapterId: z.string().uuid(), category: z.string().max(80), subject: z.string().max(200), before: z.string().max(2000), after: z.string().max(4000), status: z.enum(['pending', 'accepted', 'rejected']) })
const issue = z.object({ id: z.string(), chapterId: z.string().uuid().optional(), severity: z.enum(['certain', 'possible', 'notice']), title: z.string().max(300), description: z.string().max(4000), evidence: z.array(z.string().max(2000)), status: z.enum(['open', 'ignored', 'resolved']) })
export const creativeStateSchema = z.object({
  styleProfile: z.object({ summary: z.string().max(10000), preferredPatterns: z.array(z.string().max(300)), bannedPatterns: z.array(z.string().max(300)) }),
  characterVoices: z.array(voice), sceneCards: z.array(scene), editMarks: z.array(mark), branches: z.array(branch), stateSuggestions: z.array(suggestion), consistencyIssues: z.array(issue),
})
export const scanSchema = z.object({ chapterId: z.string().uuid() })
export const searchSchema = z.object({ q: z.string().trim().min(1).max(200) })
export type CreativeStateInput = z.infer<typeof creativeStateSchema>
