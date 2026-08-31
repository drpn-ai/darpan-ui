let defaultDisplayTimeZone: string | undefined

export function setDefaultDisplayTimeZone(timeZone: string | undefined): void {
  let normalized = timeZone?.trim() || undefined

  // Validate that the browser can format with this timezone
  if (normalized) {
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: normalized })
    } catch {
      normalized = undefined
    }
  }

  defaultDisplayTimeZone = normalized
}

export function getDefaultDisplayTimeZone(): string | undefined {
  return defaultDisplayTimeZone
}

// Timezone CODES, not offsets. Intl alone cannot do this: `timeZoneName: 'short'` is
// locale-dependent and inconsistent — en-US renders Los Angeles as PDT but Kolkata as "GMT+5:30",
// and en-IN does the reverse. CLDR only carries an abbreviation for the zones a locale considers
// familiar. So the locale here is PINNED rather than following the viewer: an unpinned one means
// two people reading the same run see different labels for the same instant, which is the exact
// ambiguity a zone label exists to remove.
const ZONE_CODE_LOCALE = 'en-US'
// A real abbreviation, as opposed to the "GMT+5:30" / "GMT-7" offsets Intl falls back to.
const ZONE_CODE_PATTERN = /^[A-Z]{2,5}$/
// Only where initialising the long name is provably WRONG, not merely unfamiliar. "Central
// European Standard Time" initialises to CEST, which asserts summer time in January — a wrong code
// is worse than an unfamiliar one. Deliberately tiny: the derivation below handles new zones
// without maintenance, and a large table here would go stale silently.
const ZONE_CODE_OVERRIDES: Record<string, string> = {
  'Central European Standard Time': 'CET',
  'Nepal Time': 'NPT',
  'Iran Standard Time': 'IRST',
}

function zoneNamePart(date: Date, timeZone: string | undefined, style: 'short' | 'long'): string {
  return new Intl.DateTimeFormat(ZONE_CODE_LOCALE, { timeZone, timeZoneName: style })
    .formatToParts(date)
    .find((part) => part.type === 'timeZoneName')?.value ?? ''
}

/**
 * The abbreviation for `timeZone` at `date` — IST, PDT, BST, UTC. DST-aware by construction, since
 * both lookups are resolved against the instant: Los Angeles is PDT in August and PST in January.
 *
 * Falls back through three steps. CLDR's own short name when it is a real code; otherwise the
 * initials of the long name ("India Standard Time" -> IST); otherwise the offset, so a zone with no
 * phrase-like name still renders something rather than nothing.
 */
export function timeZoneCode(date: Date, timeZone?: string): string {
  try {
    const short = zoneNamePart(date, timeZone, 'short')
    if (ZONE_CODE_PATTERN.test(short)) return short

    const long = zoneNamePart(date, timeZone, 'long')
    if (ZONE_CODE_OVERRIDES[long]) return ZONE_CODE_OVERRIDES[long]

    const initials = long
      .split(/[\s-]+/)
      .filter((word) => /^[A-Z]/.test(word))
      .map((word) => word[0])
      .join('')
    return initials.length >= 2 ? initials : short
  } catch {
    // An unusable zone must not take the whole timestamp down with it.
    return ''
  }
}

export interface FormatDateTimeOptions {
  fallback?: string
  locale?: Intl.LocalesArgument
  timeZone?: string
}

export function formatDateTime(value: unknown, options: FormatDateTimeOptions = {}): string {
  const fallback = options.fallback ?? '-'
  let parsedDate: Date

  if (typeof value === 'string') {
    if (!value.trim()) return fallback
    parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) return value
  } else if (typeof value === 'number') {
    if (!Number.isFinite(value)) return fallback
    parsedDate = new Date(value)
    if (Number.isNaN(parsedDate.getTime())) return fallback
  } else if (value instanceof Date) {
    parsedDate = value
    if (Number.isNaN(parsedDate.getTime())) return fallback
  } else {
    return fallback
  }

  // The zone code used to be appended to every timestamp in the product. It is not any
  // more: a code repeated on hundreds of rows is noise, and the one moment anybody needs
  // it is the moment they doubt a particular time. That is a question, so it is answered
  // on demand — rest on a timestamp and the mascot names the zone (see describeTimeZone).
  const zone = options.timeZone?.trim() || defaultDisplayTimeZone
  return new Intl.DateTimeFormat(options.locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: zone,
  }).format(parsedDate)
}

/**
 * The sentence the mascot says when someone rests on a timestamp: which zone the time is
 * being shown in, and how far that is from UTC. Two people in different zones read
 * different text for the same instant, which is exactly why it has to be askable.
 */
export function describeTimeZone(value?: unknown, timeZone?: string): string {
  // No tenant preference set means the browser decides, which is a real answer worth
  // naming rather than a blank — that fallback is precisely when people are confused.
  const zone = timeZone?.trim()
    || defaultDisplayTimeZone
    || Intl.DateTimeFormat().resolvedOptions().timeZone
    || 'UTC'
  const at = value instanceof Date
    ? value
    : new Date(typeof value === 'string' || typeof value === 'number' ? value : Date.now())
  const instant = Number.isNaN(at.getTime()) ? new Date() : at
  const code = timeZoneCode(instant, zone)
  const offset = utcOffsetLabel(instant, zone)
  if (!code) return zone
  return offset ? `${code} (${zone}, ${offset})` : `${code} (${zone})`
}

/** "UTC+05:30" for the given instant, so the answer survives a DST boundary. */
function utcOffsetLabel(date: Date, timeZone: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'longOffset' })
      .formatToParts(date)
      .find((entry) => entry.type === 'timeZoneName')
    return part?.value ?? ''
  } catch {
    return ''
  }
}

export function formatSavedResultDateTime(value: unknown): string {
  return formatDateTime(value, { fallback: 'Saved result' })
}

export interface CalendarCell {
  key: string
  date: Date
  day: number
  isCurrentMonth: boolean
}

export interface CalendarMonth {
  key: string
  label: string
  cells: CalendarCell[]
}

export function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Calendar days travel as local-midnight carrier Dates (same convention as
// startOfLocalDay/parseDateInput); these helpers translate between instants
// and calendar days in the app's display timezone.
export function displayCalendarDayOf(instant: Date, timeZone: string | undefined = defaultDisplayTimeZone): Date {
  if (!timeZone) return startOfLocalDay(instant)
  const formatted = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
  const parts = formatted.split('-')
  return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
}

export function displayDayStart(day: Date, timeZone: string | undefined = defaultDisplayTimeZone): Date {
  if (!timeZone) return startOfLocalDay(day)
  const utcGuess = Date.UTC(day.getFullYear(), day.getMonth(), day.getDate())
  const offsetAtGuess = wallClockOffsetMs(new Date(utcGuess), timeZone)
  const candidate = new Date(utcGuess - offsetAtGuess)
  const offsetAtCandidate = wallClockOffsetMs(candidate, timeZone)
  return offsetAtCandidate === offsetAtGuess ? candidate : new Date(utcGuess - offsetAtCandidate)
}

export function todayInDisplayTimeZone(timeZone: string | undefined = defaultDisplayTimeZone): Date {
  return displayCalendarDayOf(new Date(), timeZone)
}

function wallClockOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant)
  const partValue = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0)
  const wallClockAsUtc = Date.UTC(
    partValue('year'),
    partValue('month') - 1,
    partValue('day'),
    partValue('hour') % 24,
    partValue('minute'),
    partValue('second'),
  )
  return wallClockAsUtc - Math.floor(instant.getTime() / 1000) * 1000
}

export function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

export function addDays(date: Date, dayCount: number): Date {
  const nextDate = new Date(date)
  nextDate.setDate(nextDate.getDate() + dayCount)
  return nextDate
}

export function addMonths(date: Date, monthCount: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + monthCount, 1)
}

export function formatDateInputValue(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInput(value: string): Date | null {
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(year, monthIndex, day)
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) return null
  return date
}

export function formatMonthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date)
}

export function buildCalendarMonth(monthDate: Date): CalendarMonth {
  const monthStart = startOfMonth(monthDate)
  const firstCellDate = addDays(monthStart, -monthStart.getDay())
  const cells: CalendarCell[] = Array.from({ length: 42 }, (_, index) => {
    const date = addDays(firstCellDate, index)
    return {
      key: formatDateInputValue(date),
      date,
      day: date.getDate(),
      isCurrentMonth: date.getMonth() === monthStart.getMonth() && date.getFullYear() === monthStart.getFullYear(),
    }
  })

  return {
    key: formatDateInputValue(monthStart),
    label: formatMonthLabel(monthStart),
    cells,
  }
}
