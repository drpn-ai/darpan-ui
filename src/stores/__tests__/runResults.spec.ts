import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const listGeneratedOutputs = vi.hoisted(() => vi.fn())
const getReconciliationRunStatus = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: { listGeneratedOutputs, getReconciliationRunStatus },
}))

import { ApiCallError } from '../../lib/api/client'
import { useRunResultsStore } from '../runResults'

interface OutputSeed {
  fileName: string
  savedRunId: string
  createdDate?: string | null
}

function output(seed: OutputSeed) {
  return seed as never
}

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
}

describe('runResults store (run-result cache)', () => {
  beforeEach(() => {
    listGeneratedOutputs.mockReset()
    getReconciliationRunStatus.mockReset()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('upserts outputs keyed by fileName and reads them back', () => {
    const store = useRunResultsStore()
    store.upsertOutput(output({ fileName: 'a.json', savedRunId: 'run-1', createdDate: isoDaysAgo(0) }))
    expect(store.getByFileName('a.json')?.savedRunId).toBe('run-1')
    expect(store.recentOutputs).toHaveLength(1)
  })

  it('ignores null outputs and running outputs with an empty fileName', () => {
    const store = useRunResultsStore()
    store.upsertOutput(null)
    store.upsertOutput(output({ fileName: '', savedRunId: 'run-1', createdDate: isoDaysAgo(0) }))
    expect(store.recentOutputs).toHaveLength(0)
  })

  it('replaces an existing entry on re-upsert of the same fileName', () => {
    const store = useRunResultsStore()
    store.upsertOutput(output({ fileName: 'a.json', savedRunId: 'run-1', createdDate: isoDaysAgo(1) }))
    store.upsertOutput(output({ fileName: 'a.json', savedRunId: 'run-1-renamed', createdDate: isoDaysAgo(1) }))
    expect(store.recentOutputs).toHaveLength(1)
    expect(store.getByFileName('a.json')?.savedRunId).toBe('run-1-renamed')
  })

  it('sorts recentOutputs by createdDate descending', () => {
    const store = useRunResultsStore()
    store.upsertOutputs([
      output({ fileName: 'old.json', savedRunId: 'run-1', createdDate: isoDaysAgo(2) }),
      output({ fileName: 'new.json', savedRunId: 'run-1', createdDate: isoDaysAgo(0) }),
      output({ fileName: 'mid.json', savedRunId: 'run-1', createdDate: isoDaysAgo(1) }),
    ])
    expect(store.recentOutputs.map((o) => o.fileName)).toEqual(['new.json', 'mid.json', 'old.json'])
  })

  it('scopes getOutputsForSavedRun to the requested saved run', () => {
    const store = useRunResultsStore()
    store.upsertOutputs([
      output({ fileName: 'a.json', savedRunId: 'run-1', createdDate: isoDaysAgo(0) }),
      output({ fileName: 'b.json', savedRunId: 'run-2', createdDate: isoDaysAgo(0) }),
    ])
    expect(store.getOutputsForSavedRun('run-1').map((o) => o.fileName)).toEqual(['a.json'])
    expect(store.getOutputsForSavedRun('')).toEqual([])
  })

  it('removeOutput invalidates a deleted result', () => {
    const store = useRunResultsStore()
    store.upsertOutput(output({ fileName: 'a.json', savedRunId: 'run-1', createdDate: isoDaysAgo(0) }))
    store.removeOutput('a.json')
    expect(store.getByFileName('a.json')).toBeNull()
    expect(store.recentOutputs).toHaveLength(0)
  })

  it('reset clears the cache (logout / tenant switch)', () => {
    const store = useRunResultsStore()
    store.upsertOutput(output({ fileName: 'a.json', savedRunId: 'run-1', createdDate: isoDaysAgo(0) }))
    store.reset()
    expect(store.recentOutputs).toHaveLength(0)
    expect(store.loadedAt).toBeNull()
  })

  it('hydrate fetches recent outputs and drops anything older than the 2-day window', async () => {
    listGeneratedOutputs.mockResolvedValue({
      generatedOutputs: [
        output({ fileName: 'fresh.json', savedRunId: 'run-1', createdDate: isoDaysAgo(1) }),
        output({ fileName: 'stale.json', savedRunId: 'run-1', createdDate: isoDaysAgo(5) }),
      ],
    })
    const store = useRunResultsStore()
    await store.hydrate()
    expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)
    expect(store.recentOutputs.map((o) => o.fileName)).toEqual(['fresh.json'])
    expect(store.loadedAt).not.toBeNull()
  })

  it('hydrate is de-duplicated so concurrent callers share one fetch', async () => {
    listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [] })
    const store = useRunResultsStore()
    await Promise.all([store.hydrate(), store.hydrate()])
    expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)
  })

  it('hydrate surfaces an ApiCallError message and leaves loadedAt null', async () => {
    listGeneratedOutputs.mockRejectedValue(new ApiCallError('Backend down', 503))
    const store = useRunResultsStore()
    await store.hydrate()
    expect(store.error).toBe('Backend down')
    expect(store.loadedAt).toBeNull()
  })

  it('refresh re-fetches even after hydrate, so new run results surface (audit #11)', async () => {
    listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [] })
    const store = useRunResultsStore()
    await store.hydrate()
    expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)
    await store.refresh()
    expect(listGeneratedOutputs).toHaveBeenCalledTimes(2)
  })

  it('startAutoRefresh polls on the interval and stopAutoRefresh halts it (audit #11)', async () => {
    vi.useFakeTimers()
    try {
      listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [] })
      const store = useRunResultsStore()
      store.startAutoRefresh(5000)
      await vi.advanceTimersByTimeAsync(5000)
      expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)
      store.stopAutoRefresh()
      await vi.advanceTimersByTimeAsync(15000)
      expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('startRunStatusPoll fetches immediately and exposes the live status', async () => {
    getReconciliationRunStatus.mockResolvedValue({
      ok: true,
      statusEnumId: 'AUT_STAT_RUNNING',
      currentStage: 'COMPARE',
      progressPercent: 40,
      steps: [],
    })
    const store = useRunResultsStore()
    try {
      await store.startRunStatusPoll('RR_LIVE', 5000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(1)
      expect(getReconciliationRunStatus).toHaveBeenCalledWith({ reconciliationRunResultId: 'RR_LIVE' })
      expect(store.getRunStatus('RR_LIVE')?.currentStage).toBe('COMPARE')
      expect(store.getRunStatus('RR_LIVE')?.progressPercent).toBe(40)
    } finally {
      store.stopRunStatusPoll('RR_LIVE')
    }
  })

  it('run status poll stops on terminal status and refreshes the cache once', async () => {
    vi.useFakeTimers()
    try {
      getReconciliationRunStatus
        .mockResolvedValueOnce({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', currentStage: 'EXTRACT_FILE1', progressPercent: 10 })
        .mockResolvedValueOnce({ ok: true, statusEnumId: 'AUT_STAT_SUCCESS', currentStage: 'NOTIFY', progressPercent: 100 })
      listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [] })
      const store = useRunResultsStore()
      await store.startRunStatusPoll('RR_FINISHING', 5000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(5000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(2)
      expect(store.getRunStatus('RR_FINISHING')?.statusEnumId).toBe('AUT_STAT_SUCCESS')
      // Live→terminal transition refreshes the cache so the finished run replaces
      // the running tile promptly instead of waiting for the next 30s tick.
      expect(listGeneratedOutputs).toHaveBeenCalledTimes(1)

      await vi.advanceTimersByTimeAsync(20000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('a run already terminal on first fetch never starts polling or refreshing', async () => {
    vi.useFakeTimers()
    try {
      getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_SUCCESS' })
      listGeneratedOutputs.mockResolvedValue({ generatedOutputs: [] })
      const store = useRunResultsStore()
      await store.startRunStatusPoll('RR_DONE', 5000)
      await vi.advanceTimersByTimeAsync(20000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(1)
      expect(listGeneratedOutputs).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('startRunStatusPoll is idempotent per run id', async () => {
    getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING' })
    const store = useRunResultsStore()
    try {
      await store.startRunStatusPoll('RR_IDEMPOTENT', 5000)
      await store.startRunStatusPoll('RR_IDEMPOTENT', 5000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(1)
    } finally {
      store.stopRunStatusPoll('RR_IDEMPOTENT')
    }
  })

  it('reset stops run status polls and clears cached statuses', async () => {
    vi.useFakeTimers()
    try {
      getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING' })
      const store = useRunResultsStore()
      await store.startRunStatusPoll('RR_RESET', 5000)
      expect(store.getRunStatus('RR_RESET')?.statusEnumId).toBe('AUT_STAT_RUNNING')
      store.reset()
      expect(store.getRunStatus('RR_RESET')).toBeNull()
      await vi.advanceTimersByTimeAsync(20000)
      expect(getReconciliationRunStatus).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })
})
