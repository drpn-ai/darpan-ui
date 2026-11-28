import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getActiveRunResult = vi.hoisted(() => vi.fn())

vi.mock('../api/facade', () => ({
  reconciliationFacade: { getActiveRunResult },
}))

import { delay, pollForRegisteredRunResultId } from '../runRegistration'

describe('pollForRegisteredRunResultId', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    getActiveRunResult.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the run once it shows, treating a failed look as "not yet"', async () => {
    getActiveRunResult
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error('blip'))
      .mockResolvedValueOnce({ reconciliationRunResultId: 'RRR_1' })

    const found = pollForRegisteredRunResultId('RUN_1', new AbortController().signal)
    await vi.runAllTimersAsync()

    await expect(found).resolves.toBe('RRR_1')
    expect(getActiveRunResult).toHaveBeenCalledTimes(3)
  })

  // The look's signal lives as long as the submission; each wait between looks must not leave its abort
  // listener behind on it (40 looks used to leave up to 40).
  it('leaves no abort listener on the signal after each wait', async () => {
    getActiveRunResult
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ reconciliationRunResultId: 'RRR_1' })
    const controller = new AbortController()
    const added = vi.spyOn(controller.signal, 'addEventListener')
    const removed = vi.spyOn(controller.signal, 'removeEventListener')

    const found = pollForRegisteredRunResultId('RUN_1', controller.signal)
    await vi.runAllTimersAsync()
    await found

    expect(added).toHaveBeenCalledTimes(2)
    expect(removed).toHaveBeenCalledTimes(2)
  })

  it('stops looking when the signal aborts', async () => {
    getActiveRunResult.mockResolvedValue({})
    const controller = new AbortController()

    const found = pollForRegisteredRunResultId('RUN_1', controller.signal)
    await Promise.resolve()
    controller.abort()
    await vi.runAllTimersAsync()

    await expect(found).resolves.toBe('')
    expect(getActiveRunResult).toHaveBeenCalledTimes(1)
  })
})

// S99-111: one delay for the run-registration polls (this file and the automation dashboard had a copy each).
describe('delay', () => {
  afterEach(() => vi.useRealTimers())

  it('waits the time, and ends early when the signal aborts', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    let done = false
    void delay(1000, controller.signal).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(999)
    expect(done).toBe(false)
    controller.abort()
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })

  it('ends at once on a signal that has already aborted, rather than waiting it out', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    controller.abort()
    let done = false
    void delay(1000, controller.signal).then(() => { done = true })
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(true)
  })
})
