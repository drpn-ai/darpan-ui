import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>()
  return { ...actual, callService: vi.fn() }
})

import { callService } from '../client'
import { peakFacade, pulseFacade } from '../facade'

const call = vi.mocked(callService)

// DAR-BE-328: the sync pulse client.
describe('pulse facade methods', () => {
  beforeEach(() => call.mockReset().mockResolvedValue({}))

  it('names the five services exactly and passes each payload as it is', async () => {
    const signal = new AbortController().signal
    await pulseFacade.listSyncPairs(signal)
    await pulseFacade.getSyncPair({ syncPairId: 'SP1' }, signal)
    await pulseFacade.saveSyncPair({ automationId: 'A1', upstreamSide: 'FILE_1', allowanceMinutes: 120, pulseEveryMinutes: 60 })
    await pulseFacade.deleteSyncPair({ syncPairId: 'SP1' })
    await pulseFacade.getRunPulseFlags({ reconciliationRunResultId: 'RR1' })
    expect(call.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['facade.SyncPulseFacadeServices.list#SyncPairs', {}],
      ['facade.SyncPulseFacadeServices.get#SyncPair', { syncPairId: 'SP1' }],
      ['facade.SyncPulseFacadeServices.save#SyncPair', { automationId: 'A1', upstreamSide: 'FILE_1', allowanceMinutes: 120, pulseEveryMinutes: 60 }],
      ['facade.SyncPulseFacadeServices.delete#SyncPair', { syncPairId: 'SP1' }],
      ['facade.SyncPulseFacadeServices.get#RunPulseFlags', { reconciliationRunResultId: 'RR1' }],
    ])
    expect(call.mock.calls[0]?.[2]).toBe(signal)
    expect(call.mock.calls[1]?.[2]).toBe(signal)
  })

  it('names the two peak sync services', async () => {
    await peakFacade.savePeakSync({ peakPeriodId: 'PK1', syncPairId: 'SP1', allowanceMinutes: 30 })
    await peakFacade.deletePeakSync({ peakPeriodId: 'PK1', syncPairId: 'SP1' })
    expect(call.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['facade.PeakPeriodFacadeServices.save#PeakPeriodSync', { peakPeriodId: 'PK1', syncPairId: 'SP1', allowanceMinutes: 30 }],
      ['facade.PeakPeriodFacadeServices.delete#PeakPeriodSync', { peakPeriodId: 'PK1', syncPairId: 'SP1' }],
    ])
  })
})
