import type { FlowchartExecutionRow, RunFlowchartPayload } from '../api/flowchartTypes'
import { addDays, displayDayStart, formatDateInputValue, todayInDisplayTimeZone } from '../utils/date'

// DAR-UI-048. The run bar's window and the chart's per-question run states. A question with no row yet
// is waiting: the backend creates a question's row only when its turn comes (spec A3).
export const POLL_INTERVAL_MS = 3000
// A walk that dies leaves unvisited questions without rows; stop asking after this and say so.
export const POLL_CEILING_MS = 6 * 60 * 60 * 1000

export function defaultWindowDays(defaultTimeWindow?: string | null): number {
  const match = /^\s*(\d+)\s*d\s*$/i.exec(defaultTimeWindow ?? '')
  const days = match?.[1] ? Number.parseInt(match[1], 10) : 1
  return days > 0 ? days : 1
}

export function windowFromDays(days: number, today: Date = todayInDisplayTimeZone()): { startDate: Date; endExclusiveDate: Date } {
  return { startDate: addDays(today, -days), endExclusiveDate: today }
}

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

export function shouldKeepPolling(startedAt: number, now: number, done: boolean): boolean {
  return !done && now - startedAt <= POLL_CEILING_MS
}
