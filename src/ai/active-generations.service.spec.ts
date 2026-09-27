import { describe, expect, it } from 'vitest'
import { ActiveGenerationsService } from './active-generations.service'

describe('ActiveGenerationsService', () => {
  it('aborts a registered upstream request', () => {
    const service = new ActiveGenerationsService(); const controller = new AbortController()
    service.add('generation-1', controller)
    expect(service.cancel('generation-1')).toBe(true)
    expect(controller.signal.aborted).toBe(true)
  })

  it('stops exposing a generation after cleanup', () => {
    const service = new ActiveGenerationsService(); const controller = new AbortController()
    service.add('generation-1', controller); service.remove('generation-1')
    expect(service.cancel('generation-1')).toBe(false)
    expect(controller.signal.aborted).toBe(false)
  })
})
