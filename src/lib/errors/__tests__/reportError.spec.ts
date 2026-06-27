import { describe, it, expect, vi, afterEach } from 'vitest'
import { reportError } from '../reportError'

describe('reportError', () => {
  afterEach(() => vi.restoreAllMocks())
  it('forwards the error and context to the sink (console.error) exactly once', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const err = new Error('boom')
    reportError(err, { source: 'test', method: 'get#Thing' })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ error: err, source: 'test', method: 'get#Thing' })
  })
})
