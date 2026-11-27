// DAR-BE-328. Words for a peak period on a list: its dates, when it starts or ends, and the Tenant Settings value.
// Dates are "YYYY-MM-DD" in the tenant's zone; "today" is the browser's local date, which is close enough for a list.
import type { PeakPeriodSummary } from './api/peakTypes'
import { formatClockTime, getDefaultDisplayTimeZone, timeZoneCode } from './utils/date'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function parts(date: string): { y: number; m: number; d: number } {
  const [y = 0, m = 1, d = 1] = date.split('-').map(Number)
  return { y, m, d }
}

/** "Nov 28": one date of a period, without its year. */
export function peakDay(date: string): string {
  const { m, d } = parts(date)
  return `${MONTHS[m - 1] ?? ''} ${d}`
}

/**
 * "Nov 24 – Dec 1", or "Nov 27" for a one-day period (DAR-UI-159: it read "Nov 27 – Nov 27"); the year is added to
 * each end only when the period is not in the current year.
 */
export function peakDateRange(fromDate: string, thruDate: string, today: Date = new Date()): string {
  const year = today.getFullYear()
  const end = (date: string) => (parts(date).y === year ? peakDay(date) : `${peakDay(date)}, ${parts(date).y}`)
  if (fromDate === thruDate) return end(fromDate)
  const start = (date: string) => (parts(fromDate).y === year && parts(thruDate).y === year ? peakDay(date) : `${peakDay(date)}, ${parts(date).y}`)
  return `${start(fromDate)} – ${end(thruDate)}`
}

function daysUntil(date: string, today: Date): number {
  const { y, m, d } = parts(date)
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000)
}

/** The "When" column: On now, Off, Ended, Starts today, Starts tomorrow, Starts in N days (N <= 30), else Starts MMM d. */
export function peakWhen(period: PeakPeriodSummary, today: Date = new Date()): string {
  if (period.state === 'on') return 'On now'
  if (period.state === 'off') return 'Off'
  if (period.state === 'ended') return 'Ended'
  const days = daysUntil(period.fromDate, today)
  // The server says upcoming by the tenant's date; the browser's date can already be the start day, or past it.
  if (days <= 0) return 'Starts today'
  if (days === 1) return 'Starts tomorrow'
  if (days <= 30) return `Starts in ${days} days`
  return `Starts ${peakDay(period.fromDate)}`
}

function usableZone(timeZone: string | undefined): string | undefined {
  const zone = timeZone?.trim()
  if (!zone) return undefined
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: zone })
    return zone
  } catch {
    return undefined
  }
}

/**
 * The note play shows inside peak hours: "Peak hours until 23:00." on the tenant's clock, the one its peak hours are set
 * in. Without a usable tenant zone, the viewer's clock with its zone code ("23:00 PST"), so the time cannot be read in
 * the wrong zone. Empty when there is no time.
 */
export function peakHoursUntilNotice(until: unknown, tenantTimeZone?: string): string {
  const zone = usableZone(tenantTimeZone)
  const clock = formatClockTime(until, zone ?? getDefaultDisplayTimeZone())
  if (!clock) return ''
  if (zone) return `Peak hours until ${clock}.`
  const code = timeZoneCode(until instanceof Date ? until : new Date(until as string | number), getDefaultDisplayTimeZone())
  return `Peak hours until ${clock}${code ? ` ${code}` : ''}.`
}

/**
 * The Tenant Settings value: the period on now, else the soonest upcoming one, with when it is ("PEAK Nov 27 · on now",
 * "Cyber Monday · starts in 3 days"), else "None". DAR-UI-159: its dates are on the period's own page; names usually
 * carry them already ("PEAK Nov 27 · Nov 27 – Nov 27").
 */
export function peakSettingsValue(periods: PeakPeriodSummary[], today: Date = new Date()): string {
  const on = periods.find((period) => period.state === 'on')
  const upcoming = periods.filter((period) => period.state === 'upcoming').sort((a, b) => a.fromDate.localeCompare(b.fromDate))[0]
  const pick = on ?? upcoming
  if (!pick) return 'None'
  const when = peakWhen(pick, today)
  return `${pick.periodName} · ${when.charAt(0).toLowerCase()}${when.slice(1)}`
}
