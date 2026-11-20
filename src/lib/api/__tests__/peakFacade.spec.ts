import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>()
  return { ...actual, callService: vi.fn() }
})

import { callService } from '../client'
import { peakFacade } from '../facade'

const call = vi.mocked(callService)

// DAR-BE-328: the peak periods client.
describe('peak facade methods', () => {
  beforeEach(() => call.mockReset().mockResolvedValue({}))

  it('names the six services exactly and passes each payload as it is', async () => {
    const signal = new AbortController().signal
    await peakFacade.listPeakPeriods(signal)
    await peakFacade.getPeakPeriod({ peakPeriodId: 'PK1' }, signal)
    await peakFacade.savePeakPeriod({ periodName: 'BFCM', fromDate: '2026-11-20', thruDate: '2026-12-02', peakHoursStart: '09:00', peakHoursEnd: '17:00', isActive: true })
    await peakFacade.deletePeakPeriod({ peakPeriodId: 'PK1' })
    await peakFacade.savePeakRunTime({ peakPeriodId: 'PK1', automationId: 'A1', onDate: '2026-11-27', runTime: '22:00' })
    await peakFacade.deletePeakRunTime({ runTimeId: 'RT1' })
    expect(call.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['facade.PeakPeriodFacadeServices.list#PeakPeriods', {}],
      ['facade.PeakPeriodFacadeServices.get#PeakPeriod', { peakPeriodId: 'PK1' }],
      ['facade.PeakPeriodFacadeServices.save#PeakPeriod', { periodName: 'BFCM', fromDate: '2026-11-20', thruDate: '2026-12-02', peakHoursStart: '09:00', peakHoursEnd: '17:00', isActive: true }],
      ['facade.PeakPeriodFacadeServices.delete#PeakPeriod', { peakPeriodId: 'PK1' }],
      ['facade.PeakPeriodFacadeServices.save#PeakPeriodRunTime', { peakPeriodId: 'PK1', automationId: 'A1', onDate: '2026-11-27', runTime: '22:00' }],
      ['facade.PeakPeriodFacadeServices.delete#PeakPeriodRunTime', { runTimeId: 'RT1' }],
    ])
    expect(call.mock.calls[0]?.[2]).toBe(signal)
    expect(call.mock.calls[1]?.[2]).toBe(signal)
  })
})
