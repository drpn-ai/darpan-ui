// DAR-BE-167, DAR-BE-334. Query schedule helpers: the daily-time <-> Quartz cron mapping the schedule popup edits, the
// words for a run's status (moqui-jexl's statuses), and the email recipient list.
import type { QueryRunStatus } from './api/scriptTypes'

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

const STATUS_WORDS: Record<QueryRunStatus, string> = {
  OK: 'Sent',
  NOTHING_TO_SEND: 'Nothing to send',
  PREVIEW: 'Preview',
  HELD: 'Held',
  DISABLED: 'Queries are switched off',
  OWNER_LOST: 'Owner can no longer send it',
  READ_ERROR: 'Read failed',
  READ_NOT_ALLOWED: 'Read not allowed',
  READ_TOO_LARGE: 'Read too large',
  SCRIPT_ERROR: 'Script error',
  RESULT_INVALID: 'Result not usable',
  DELIVERY_PARTIAL: 'Partly delivered',
  DELIVERY_FAILED: 'Not delivered',
  STUCK: 'Stuck',
  SCRIPT_MISSING: 'Query missing',
  NO_INPUT: 'No input',
  WAITING: 'Waiting',
  EXPIRED: 'Skipped (waited too long)',
}

export function statusWords(status: string | null | undefined): string {
  return (status && STATUS_WORDS[status as QueryRunStatus]) || status || ''
}

// Outcomes that mean the scheduled run did not send what it should have.
const FAILED_STATUSES: ReadonlySet<string> = new Set([
  'OWNER_LOST', 'READ_ERROR', 'READ_NOT_ALLOWED', 'READ_TOO_LARGE', 'SCRIPT_ERROR', 'RESULT_INVALID', 'DELIVERY_PARTIAL',
  'DELIVERY_FAILED', 'STUCK', 'SCRIPT_MISSING', 'NO_INPUT', 'EXPIRED',
])

export function isFailedStatus(status: string | null | undefined): boolean {
  return Boolean(status && FAILED_STATUSES.has(status))
}

/** "a@x.com; b@y.com,  c@z.com" -> ["a@x.com", "b@y.com", "c@z.com"] (commas, semicolons, spaces or new lines). */
export function parseRecipients(text: string | null | undefined): string[] {
  return (text ?? '').split(/[\s,;]+/).map((part) => part.trim()).filter(Boolean)
}

/** The list the backend stores: comma-separated, no duplicates (case-insensitive). */
export function formatRecipients(addresses: readonly string[]): string {
  const seen = new Set<string>()
  return addresses.filter((address) => {
    const key = address.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).join(', ')
}

/** An address that is not name@domain.tld; null when every one looks like an address. */
export function badRecipient(addresses: readonly string[]): string | null {
  return addresses.find((address) => !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) ?? null
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

/** "2 addresses · #ops-daily": where a schedule sends; "nowhere" when it names neither. */
export function sendsToWords(recipientCount: number | null | undefined, chatSpaceName: string | null | undefined): string {
  const count = recipientCount ?? 0
  const parts = [
    ...(count > 0 ? [`${count} address${count === 1 ? '' : 'es'}`] : []),
    ...(chatSpaceName ? [chatSpaceName] : []),
  ]
  return parts.join(' · ') || 'nowhere'
}

/** The state dot on a query's row: on schedule, off, or its last scheduled run failed. */
export type ScheduleState = 'on' | 'off' | 'failed' | 'none'

export function isOn(value: boolean | string | null | undefined): boolean {
  return value === true || value === 'Y'
}

export function scheduleState(schedule: { isActive: boolean | string; lastRunStatus: string | null } | null | undefined): ScheduleState {
  if (!schedule) return 'none'
  if (isFailedStatus(schedule.lastRunStatus)) return 'failed'
  return isOn(schedule.isActive) ? 'on' : 'off'
}
