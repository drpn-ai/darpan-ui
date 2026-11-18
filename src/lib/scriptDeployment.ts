// DAR-BE-167. Script deployment helpers: the daily-time <-> Quartz cron mapping the deploy panel edits, and the words
// for a deployment's last outcome.
import type { ScriptDeploymentStatus } from './api/scriptTypes'

const DAILY_CRON = /^0 (\d{1,2}) (\d{1,2}) \* \* \?$/

/** "09:30" -> "0 30 9 * * ?" (every day at that time); null for anything that is not HH:MM. */
export function cronFromTime(time: string): string | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim())
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `0 ${minute} ${hour} * * ?`
}

/** "0 30 9 * * ?" -> "09:30"; null when the cron is not a once-a-day schedule. */
export function timeFromCron(cron: string | null | undefined): string | null {
  const match = DAILY_CRON.exec((cron ?? '').trim())
  if (!match) return null
  const minute = Number(match[1])
  const hour = Number(match[2])
  if (hour > 23 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

const STATUS_WORDS: Record<ScriptDeploymentStatus, string> = {
  PREVIEW: 'Preview',
  SENT: 'Sent',
  NOTHING_TO_SEND: 'Nothing to send',
  SCRIPT_ERROR: 'Script error',
  NO_INPUT: 'No input',
  NOT_DELIVERED: 'Not delivered',
  SCRIPT_MISSING: 'Script missing',
}

export function statusWords(status: string | null | undefined): string {
  return (status && STATUS_WORDS[status as ScriptDeploymentStatus]) || status || ''
}

// DAR-UI-124. Outcomes that mean the scheduled run did not post what it should have.
const FAILED_STATUSES: ReadonlySet<string> = new Set(['SCRIPT_ERROR', 'NO_INPUT', 'NOT_DELIVERED', 'SCRIPT_MISSING'])

export function isFailedStatus(status: string | null | undefined): boolean {
  return Boolean(status && FAILED_STATUSES.has(status))
}

/** "07:30" -> "7:30 AM": how a schedule reads back everywhere else in the product (scripts, audit settings). */
export function twelveHourTime(time: string): string {
  const [hourText, minute] = time.split(':')
  const hour = Number(hourText)
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

/** "0 0 7 * * ?" -> "Daily at 7:00 AM"; a cron that is not once a day reads as itself. */
export function scheduleWords(cron: string | null | undefined): string {
  const time = timeFromCron(cron)
  return time ? `Daily at ${twelveHourTime(time)}` : `Cron ${cron ?? ''}`.trim()
}

/** The state dot on a script's row: on schedule, off, or its last scheduled run failed. */
export type ScheduleState = 'on' | 'off' | 'failed' | 'none'

export function scheduleState(deployment: { isActive: boolean; lastRunStatus: string | null } | null | undefined): ScheduleState {
  if (!deployment) return 'none'
  if (isFailedStatus(deployment.lastRunStatus)) return 'failed'
  return deployment.isActive ? 'on' : 'off'
}

/** The newest result file of a saved run, read the way the scheduled run reads it
 *  (ScriptDeploymentSupport.newestResultFileName): the first finished output in list#GeneratedOutputs order. */
export function newestResultFileName(
  outputs: readonly { fileName?: string; savedRunId?: string; resultAvailable?: boolean }[],
  savedRunId: string,
): string | null {
  const newest = outputs.find((out) => out.fileName && out.resultAvailable !== false
    && (out.savedRunId == null || out.savedRunId === savedRunId))
  return newest?.fileName ?? null
}
