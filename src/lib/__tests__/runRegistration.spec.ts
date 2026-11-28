import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const getActiveRunResult = vi.hoisted(() => vi.fn())

vi.mock('../api/facade', () => ({
  reconciliationFacade: { getActiveRunResult },
}))

import { pollForRegisteredRunResultId } from '../runRegistration'

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
