import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { reportError, getBufferedErrorReports, resetErrorReporting } from '../report'

describe('reportError', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    resetErrorReporting()
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('sends the error and context to the console sink and buffers a report', () => {
    const err = new Error('boom')
    reportError(err, { source: 'test', method: 'get#Thing' })

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    expect(consoleSpy.mock.calls[0]?.[1]).toMatchObject({ error: err, source: 'test', method: 'get#Thing' })

    const reports = getBufferedErrorReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]).toMatchObject({
      message: 'boom',
      kind: 'Error',
      route: '/',
      context: { source: 'test', method: 'get#Thing' },
      count: 1,
    })
  })

  it('truncates stacks to 2000 characters', () => {
    const err = new Error('long stack')
    err.stack = 'x'.repeat(5000)
    reportError(err)

    expect(getBufferedErrorReports()[0]?.stack).toHaveLength(2000)
  })

  it('dedupes repeats of the same error inside the window instead of re-logging', () => {
    reportError(new Error('same'))
    reportError(new Error('same'))
    reportError(new Error('same'))

    expect(consoleSpy).toHaveBeenCalledTimes(1)
    const reports = getBufferedErrorReports()
    expect(reports).toHaveLength(1)
    expect(reports[0]?.count).toBe(3)
  })

  it('reports again once the dedupe window has passed', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-02T00:00:00Z'))
    reportError(new Error('same'))
    vi.setSystemTime(new Date('2026-07-02T00:00:31Z'))
    reportError(new Error('same'))

    expect(consoleSpy).toHaveBeenCalledTimes(2)
    expect(getBufferedErrorReports()).toHaveLength(2)
  })

  it('keeps distinct errors as distinct reports', () => {
    reportError(new Error('one'))
    reportError(new Error('two'))

    expect(consoleSpy).toHaveBeenCalledTimes(2)
    expect(getBufferedErrorReports().map((r) => r.message)).toEqual(['one', 'two'])
  })

  it('normalizes non-Error values', () => {
    reportError('plain string failure')
    reportError({ code: 42 })

    const [first, second] = getBufferedErrorReports()
    expect(first).toMatchObject({ message: 'plain string failure', kind: 'string' })
    expect(second).toMatchObject({ message: '{"code":42}', kind: 'object' })
  })

  it('caps the ring buffer and drops the oldest report', () => {
    for (let i = 0; i < 30; i++) reportError(new Error(`err ${i}`))

    const reports = getBufferedErrorReports()
    expect(reports).toHaveLength(25)
    expect(reports[0]?.message).toBe('err 5')
    expect(reports[24]?.message).toBe('err 29')
  })

  it('never throws, even when the console sink or serialization fails', () => {
    consoleSpy.mockImplementation(() => {
      throw new Error('console is broken')
    })
    const circular: Record<string, unknown> = {}
    circular.self = circular

    expect(() => reportError(new Error('boom'))).not.toThrow()
    expect(() => reportError(circular)).not.toThrow()
  })
})
