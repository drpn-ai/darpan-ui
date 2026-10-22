import { describe, expect, it } from 'vitest'
import {
  buildRunPayload, isExecutionDone, isExecutionFinal, POLL_CEILING_MS, questionStates, shouldKeepPolling,
} from '../flowchartRunState'

describe('the window', () => {
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

// DAR-UI-057. A finished execution is cached for good, so "finished" must never be a pause between questions:
// the walker writes a question's row only when its turn comes.
describe('a final execution', () => {
  const ok = (id: string) => ({ reconciliationRunResultId: id, reconciliationRunId: id, statusEnumId: 'AUT_STAT_SUCCESS' })
  const now = Date.parse('2026-10-19T12:00:00Z')
  const recent = '2026-10-19T11:59:00Z'

  it('is final when every walkable question has a terminal row', () => {
    expect(isExecutionFinal(['S', 'a'], [ok('S'), ok('a')], recent, now)).toBe(true)
  })
  it('is not final between questions: every row done, but a walkable question has no row yet', () => {
    expect(isExecutionFinal(['S', 'a'], [ok('S')], recent, now)).toBe(false)
  })
  it('is never final while a row is active', () => {
    const running = { reconciliationRunResultId: 'a', reconciliationRunId: 'a', statusEnumId: 'AUT_STAT_RUNNING' }
    expect(isExecutionFinal(['S', 'a'], [ok('S'), running], '2026-01-01T00:00:00Z', now)).toBe(false)
  })
  it('is final once it started longer ago than any walk runs, even if the chart gained questions since', () => {
    expect(isExecutionFinal(['S', 'added-later'], [ok('S')], new Date(now - POLL_CEILING_MS - 1).toISOString(), now)).toBe(true)
    expect(isExecutionFinal(['S', 'added-later'], [ok('S')], new Date(now - POLL_CEILING_MS + 60_000).toISOString(), now)).toBe(false)
  })
  it('is not final on a chart it could not read: no walkable questions proves nothing', () => {
    expect(isExecutionFinal([], [ok('S')], recent, now)).toBe(false)
  })
  it('is not final with no rows, or with no start time to age it by', () => {
    expect(isExecutionFinal(['S'], [], '2026-01-01T00:00:00Z', now)).toBe(false)
    expect(isExecutionFinal(['S', 'a'], [ok('S')], null, now)).toBe(false)
  })
})
