import { describe, expect, it } from 'vitest'
import {
  buildRunPayload, defaultWindowDays, isExecutionDone, POLL_CEILING_MS, questionStates, shouldKeepPolling, windowFromDays,
} from '../flowchartRunState'

describe('the window', () => {
  it('reads "<n>d" and falls back to one day', () => {
    expect(defaultWindowDays('3d')).toBe(3)
    expect(defaultWindowDays(' 14d ')).toBe(14)
    expect(defaultWindowDays('week')).toBe(1)
    expect(defaultWindowDays(null)).toBe(1)
  })

  it('is the last n days ending today, end exclusive', () => {
    const today = new Date(2026, 7, 17)
    const w = windowFromDays(3, today)
    expect(w.endExclusiveDate.getDate()).toBe(17)
    expect(w.startDate.getDate()).toBe(14)
  })

  it('builds the run payload with instants and local dates', () => {
    const p = buildRunPayload('R1', { startDate: new Date(2026, 7, 14), endExclusiveDate: new Date(2026, 7, 17) })
    expect(p.reconciliationId).toBe('R1')
    expect(p.windowStartLocalDate).toBe('2026-08-14')
    expect(p.windowEndLocalDate).toBe('2026-08-17')
    expect(typeof p.windowStartDate).toBe('string')
  })
})

describe('question states', () => {
  const walk = ['S', 'A', 'B']
  it('a question with no row yet is waiting', () => {
    expect(questionStates(walk, [{ reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_RUNNING' }]))
      .toMatchObject({ S: { state: 'running' }, A: { state: 'waiting' }, B: { state: 'waiting' } })
  })
  it('maps every terminal status', () => {
    const s = questionStates(['a', 'b', 'c', 'd', 'e'], [
      { reconciliationRunResultId: '1', reconciliationRunId: 'a', statusEnumId: 'AUT_STAT_SUCCESS' },
      { reconciliationRunResultId: '2', reconciliationRunId: 'b', statusEnumId: 'AUT_STAT_NO_DATA' },
      { reconciliationRunResultId: '3', reconciliationRunId: 'c', statusEnumId: 'AUT_STAT_FAILED' },
      { reconciliationRunResultId: '4', reconciliationRunId: 'd', statusEnumId: 'AUT_STAT_NOT_RUN' },
      { reconciliationRunResultId: '5', reconciliationRunId: 'e', statusEnumId: 'AUT_STAT_CANCELLED' },
    ])
    expect([s.a?.state, s.b?.state, s.c?.state, s.d?.state, s.e?.state]).toEqual(['done', 'nothing', 'failed', 'not-run', 'cancelled'])
  })
  it('is done only when every walkable question has a terminal row', () => {
    const rows = [{ reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS' }]
    expect(isExecutionDone(walk, rows)).toBe(false)
    expect(isExecutionDone(['S'], rows)).toBe(true)
  })
})

describe('polling', () => {
  it('polling gives up after the ceiling', () => {
    expect(shouldKeepPolling(0, 1000, false)).toBe(true)
    expect(shouldKeepPolling(0, POLL_CEILING_MS + 1, false)).toBe(false)
    expect(shouldKeepPolling(0, 1000, true)).toBe(false)
  })
})
