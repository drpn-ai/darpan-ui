import { describe, it, expect, vi } from 'vitest'
import { isIdempotentReadMethod, retryRead } from '../retry'

describe('retry policy', () => {
  it('classifies only get/list/search verbs as idempotent reads', () => {
    expect(isIdempotentReadMethod('facade.X.get#Thing')).toBe(true)
    expect(isIdempotentReadMethod('facade.X.list#Things')).toBe(true)
    expect(isIdempotentReadMethod('facade.X.search#Things')).toBe(true)
    expect(isIdempotentReadMethod('facade.X.create#Run')).toBe(false)
    expect(isIdempotentReadMethod('facade.X.run#SavedRunDiff')).toBe(false)
  })
  it('retries a failing read then succeeds, with capped attempts', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('503'))
      .mockResolvedValueOnce('ok')
    const out = await retryRead(fn, { attempts: 3, baseDelayMs: 0 })
    expect(out).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })
  it('re-throws after exhausting attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('down'))
    await expect(retryRead(fn, { attempts: 2, baseDelayMs: 0 })).rejects.toThrow('down')
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
