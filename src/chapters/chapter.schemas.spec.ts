import { describe, expect, it } from 'vitest'
import { restoreRevisionSchema, revisionListSchema, updateChapterSchema } from './chapter.schemas'

describe('chapter update schema', () => {
  it('requires a positive expected version', () => {
    expect(updateChapterSchema.safeParse({ version: 3, status: 'done' }).success).toBe(true)
    expect(updateChapterSchema.safeParse({ version: 0, status: 'done' }).success).toBe(false)
  })

  it('rejects unknown chapter statuses', () => {
    expect(updateChapterSchema.safeParse({ version: 1, status: 'published' }).success).toBe(false)
  })
})

describe('chapter revision schemas', () => {
  it('coerces pagination query values and applies defaults', () => {
    expect(revisionListSchema.parse({})).toEqual({ limit: 20 })
    expect(revisionListSchema.parse({ limit: '10', beforeVersion: '5' })).toEqual({ limit: 10, beforeVersion: 5 })
  })

  it('requires the current chapter version when restoring', () => {
    expect(restoreRevisionSchema.safeParse({ expectedVersion: 2 }).success).toBe(true)
    expect(restoreRevisionSchema.safeParse({ expectedVersion: 0 }).success).toBe(false)
  })
})
