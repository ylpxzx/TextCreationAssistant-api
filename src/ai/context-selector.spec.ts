import { describe, expect, it } from 'vitest'
import { selectGenerationContext, type GenerationContextItem } from './context-selector'

const item = (sourceType: GenerationContextItem['sourceType'], label: string, content: string): GenerationContextItem => ({ sourceType, label, content, characterCount: content.length })

describe('selectGenerationContext', () => {
  it('prioritizes project context and removes duplicate content', () => {
    const selected = selectGenerationContext([
      item('resource-item', '重复资料', '  世界被潮汐覆盖。  '),
      item('project', '作品构想', '世界被潮汐覆盖。'),
      item('chapter', '上一章：潮痕', '林舟在潮声中推开了门。'),
      item('resource-item', '人物', '林舟害怕深水。'),
    ])
    expect(selected.map(value => value.label)).toEqual(['作品构想', '上一章：潮痕', '人物'])
  })

  it('limits individual items and the complete context', () => {
    const selected = selectGenerationContext([
      item('project', '构想', '甲'.repeat(30_000)),
      item('resource-item', '资料一', '乙'.repeat(30_000)),
      item('resource-item', '资料二', '丙'.repeat(30_000)),
      item('resource-item', '资料三', '丁'.repeat(30_000)),
    ])
    expect(selected.map(value => value.content.length)).toEqual([20_000, 20_000, 20_000])
    expect(selected.reduce((sum, value) => sum + value.characterCount, 0)).toBe(60_000)
  })
})
