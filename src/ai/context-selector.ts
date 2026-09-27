export type GenerationContextItem = {
  sourceType: 'project' | 'chapter' | 'resource-item'
  sourceId?: string
  label: string
  content: string
  characterCount: number
}

const MAX_CONTEXT_CHARACTERS = 60_000
const MAX_ITEM_CHARACTERS = 20_000
const sourcePriority: Record<GenerationContextItem['sourceType'], number> = { project: 0, chapter: 1, 'resource-item': 2 }

export function selectGenerationContext(items: GenerationContextItem[]) {
  const seen = new Set<string>()
  let remaining = MAX_CONTEXT_CHARACTERS
  const selected: GenerationContextItem[] = []

  const prioritized = items.map((item, index) => ({ item, index })).sort((left, right) => sourcePriority[left.item.sourceType] - sourcePriority[right.item.sourceType] || left.index - right.index)
  for (const { item } of prioritized) {
    if (remaining === 0) break
    const content = item.content.trim()
    if (!content) continue
    const fingerprint = content.replace(/\s+/g, ' ').toLocaleLowerCase()
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    const limited = content.slice(0, Math.min(MAX_ITEM_CHARACTERS, remaining))
    selected.push({ ...item, content: limited, characterCount: limited.length })
    remaining -= limited.length
  }
  return selected
}
