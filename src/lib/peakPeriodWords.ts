// DAR-BE-328. Words for a peak period on a list: its dates, when it starts or ends, and the Tenant Settings value.
// Dates are "YYYY-MM-DD" in the tenant's zone; "today" is the browser's local date, which is close enough for a list.
import type { PeakPeriodSummary } from './api/peakTypes'

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

/** "Nov 24 – Dec 1"; the year is added to each end only when the period is not in the current year. */
export function peakDateRange(fromDate: string, thruDate: string, today: Date = new Date()): string {
  const year = today.getFullYear()
  const end = (date: string) => (parts(date).y === year ? peakDay(date) : `${peakDay(date)}, ${parts(date).y}`)
  const start = (date: string) => (parts(fromDate).y === year && parts(thruDate).y === year ? peakDay(date) : `${peakDay(date)}, ${parts(date).y}`)
  return `${start(fromDate)} – ${end(thruDate)}`
}

function daysUntil(date: string, today: Date): number {
  const { y, m, d } = parts(date)
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((Date.UTC(y, m - 1, d) - start) / 86_400_000)
}

/** The "When" column: On now, Off, Ended, Starts tomorrow, Starts in N days (N <= 30), else Starts MMM d. */
export function peakWhen(period: PeakPeriodSummary, today: Date = new Date()): string {
  if (period.state === 'on') return 'On now'
  if (period.state === 'off') return 'Off'
  if (period.state === 'ended') return 'Ended'
  const days = daysUntil(period.fromDate, today)
  if (days === 1) return 'Starts tomorrow'
  if (days >= 0 && days <= 30) return `Starts in ${days} days`
  return `Starts ${peakDay(period.fromDate)}`
}

/** The Tenant Settings value: the period on now, else the soonest upcoming one, else "None". */
export function peakSettingsValue(periods: PeakPeriodSummary[], today: Date = new Date()): string {
  const on = periods.find((period) => period.state === 'on')
  const upcoming = periods.filter((period) => period.state === 'upcoming').sort((a, b) => a.fromDate.localeCompare(b.fromDate))[0]
  const pick = on ?? upcoming
  return pick ? `${pick.periodName} · ${peakDateRange(pick.fromDate, pick.thruDate, today)}` : 'None'
}
