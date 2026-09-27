export type GenerationOperation = 'completion' | 'rewrite' | 'chapter' | 'question'
export type GenerationStatus = 'pending' | 'streaming' | 'completed' | 'cancelled' | 'failed'
export type ContextReference = { sourceType: 'project' | 'chapter' | 'resource-item'; sourceId?: string; label: string; characterCount: number }
