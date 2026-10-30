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
