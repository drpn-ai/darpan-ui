import type { FlowchartExecutionRow, RunFlowchartPayload } from '../api/flowchartTypes'
import { displayDayStart, formatDateInputValue } from '../utils/date'

// DAR-UI-048. The run's window payload and the chart's per-question run states. A question with no row yet
// is waiting: the backend creates a question's row only when its turn comes (spec A3).
export const POLL_INTERVAL_MS = 3000
// A walk that dies leaves unvisited questions without rows; stop asking after this and say so.
export const POLL_CEILING_MS = 6 * 60 * 60 * 1000

export function buildRunPayload(reconciliationId: string, window: { startDate: Date; endExclusiveDate: Date }): RunFlowchartPayload {
  return {
    reconciliationId,
    windowStartDate: displayDayStart(window.startDate).toISOString(),
    windowEndDate: displayDayStart(window.endExclusiveDate).toISOString(),
    windowStartLocalDate: formatDateInputValue(window.startDate),
    windowEndLocalDate: formatDateInputValue(window.endExclusiveDate),
  }
}

export type QuestionRunState = 'waiting' | 'running' | 'done' | 'nothing' | 'failed' | 'not-run' | 'cancelled'

const STATE_BY_STATUS: Record<string, QuestionRunState> = {
  AUT_STAT_PENDING: 'running',
  AUT_STAT_RUNNING: 'running',
  AUT_STAT_SUCCESS: 'done',
  AUT_STAT_NO_DATA: 'nothing',
  AUT_STAT_FAILED: 'failed',
  AUT_STAT_NOT_RUN: 'not-run',
  AUT_STAT_CANCELLED: 'cancelled',
}
const TERMINAL: QuestionRunState[] = ['done', 'nothing', 'failed', 'not-run', 'cancelled']

export function questionStates(walkable: string[], rows: FlowchartExecutionRow[]): Record<string, { state: QuestionRunState; row?: FlowchartExecutionRow }> {
  const byQuestion = new Map<string, FlowchartExecutionRow>()
  for (const row of rows) if (row.reconciliationRunId) byQuestion.set(row.reconciliationRunId, row)
  const out: Record<string, { state: QuestionRunState; row?: FlowchartExecutionRow }> = {}
  for (const id of walkable) {
    const row = byQuestion.get(id)
    out[id] = row ? { state: STATE_BY_STATUS[row.statusEnumId ?? ''] ?? 'running', row } : { state: 'waiting' }
  }
  return out
}

export function isExecutionDone(walkable: string[], rows: FlowchartExecutionRow[]): boolean {
  const states = questionStates(walkable, rows)
  return walkable.every((id) => TERMINAL.includes(states[id]?.state ?? 'waiting'))
}

/**
 * DAR-UI-057. Whether an execution can never change again, so its answer may be cached for good. "No row
 * active" is not enough: the walker writes a question's row only when its turn comes, so between two
 * questions every row is done while the walk goes on. Final means every walkable question has a terminal
 * row, or the walk started longer ago than any walk runs (questions added to the chart since it ran have
 * no row and never will).
 */
export function isExecutionFinal(
  walkable: string[], rows: FlowchartExecutionRow[], startedDate: string | number | null | undefined, now: number,
): boolean {
  // An unknown status reads as running, as questionStates reads it: never final on a status it cannot name.
  if (!rows.length || rows.some((r) => !TERMINAL.includes(STATE_BY_STATUS[r.statusEnumId ?? ''] ?? 'running'))) return false
  // An empty chart (not loaded, or failed to load) would make isExecutionDone vacuously true.
  if (walkable.length && isExecutionDone(walkable, rows)) return true
  const started = startedDate == null || startedDate === '' ? Number.NaN : new Date(startedDate).getTime()
  return Number.isFinite(started) && now - started > POLL_CEILING_MS
}

export function shouldKeepPolling(startedAt: number, now: number, done: boolean): boolean {
  return !done && now - startedAt <= POLL_CEILING_MS
}
