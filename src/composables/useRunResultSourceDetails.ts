import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GeneratedOutputSourceDetails, GeneratedOutputSourceFile } from '../lib/api/types'
import { fileNameFromPath, normalizeDisplayText, normalizeDisplayToken } from '../lib/reconciliationDisplay'
import { darpanSystemNameFromLabel, darpanSystemNamePair } from '../lib/utils/darpanSystems'
import { addDays, displayCalendarDayOf, formatDateTime, getDefaultDisplayTimeZone, startOfLocalDay, timeZoneCode } from '../lib/utils/date'

export interface RunSourceFileView {
  key: string
  label: string
  fileName: string
  filePath: string
  sourceFormat: string
  downloadFileName: string
  canDownload: boolean
}

export interface UseRunResultSourceDetailsDeps {
  file1Label: ComputedRef<string>
  file2Label: ComputedRef<string>
}

export interface UseRunResultSourceDetails {
  runSourceDetails: Ref<GeneratedOutputSourceDetails | null>
  runSourceFiles: ComputedRef<RunSourceFileView[]>
  isApiRunSource: ComputedRef<boolean>
  runSourceModeLabel: ComputedRef<string>
  runSourceDateRangeLabel: ComputedRef<string>
  runSourceDateRangeDetail: ComputedRef<string>
  runSourceFilesLabel: ComputedRef<string>
  showRunSourceDetails: ComputedRef<boolean>
  resetRunSourceDetails: () => void
}

const DAY_MILLIS = 24 * 60 * 60 * 1000
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatCalendarDay(day: Date): string {
  return `${MONTH_NAMES[day.getMonth()]} ${day.getDate()}, ${day.getFullYear()}`
}

function formatRunSourceDate(value: string | undefined): string {
  const parsedDate = parseRunSourceDate(value)
  if (!parsedDate) return normalizeDisplayText(value)
  return formatCalendarDay(parsedDate)
}

// Full ISO timestamps are instants (the run wizard anchors windows at local midnight
// and serializes with toISOString()), so they must resolve to the viewer's display-timezone
// calendar day — slicing the UTC date portion reads a day early east of UTC.
// Bare YYYY-MM-DD values stay calendar dates.
function parseRunSourceDate(value: string | undefined): Date | null {
  const normalizedValue = normalizeDisplayText(value)
  if (/^\d{4}-\d{2}-\d{2}T/.test(normalizedValue)) {
    const instant = new Date(normalizedValue)
    if (!Number.isNaN(instant.getTime())) return displayCalendarDayOf(instant)
  }
  const dateMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return null
  return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
}

function parseIsoInstant(value: string | undefined): Date | null {
  const normalizedValue = normalizeDisplayText(value)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(normalizedValue)) return null
  const instant = new Date(normalizedValue)
  return Number.isNaN(instant.getTime()) ? null : instant
}

// Not every window is anchored in the zone the viewer reads it in. An automation anchors its
// window in its own windowTimeZone, whose default is UTC, so a UTC calendar day arrives as a pair
// of exact UTC midnights — and resolving those instants in a display timezone behind UTC named the
// previous day (a Sep 1 UTC run read "Aug 31" in America/Los_Angeles). Exact UTC midnights a whole
// number of days apart ARE a UTC calendar window, which is the same test the backend uses to
// recognise one (ReconciliationApiWindowSupport.isUtcMidnight + isWholeDayRange), so name the UTC
// day rather than the viewer's. Every other window — the wizard's own local-midnight instants
// among them — is not on a UTC midnight boundary and keeps resolving through the display timezone.
function utcAnchoredCalendarWindow(start: string | undefined, end: string | undefined): { start: Date, end: Date } | null {
  const startInstant = parseIsoInstant(start)
  const endInstant = parseIsoInstant(end)
  if (!startInstant || !endInstant) return null
  if (startInstant.getTime() % DAY_MILLIS !== 0 || endInstant.getTime() % DAY_MILLIS !== 0) return null
  const spanMillis = endInstant.getTime() - startInstant.getTime()
  if (spanMillis <= 0 || spanMillis % DAY_MILLIS !== 0) return null
  return {
    start: new Date(startInstant.getUTCFullYear(), startInstant.getUTCMonth(), startInstant.getUTCDate()),
    end: new Date(endInstant.getUTCFullYear(), endInstant.getUTCMonth(), endInstant.getUTCDate()),
  }
}

// A single-day API run window is sent as an exclusive end boundary (end = start + 1 day),
// e.g. start=2026-07-01, end=2026-07-02, which covers only July 1. Detect that convention
// here so the range collapses to one date instead of reading as a two-day span.
function isExclusiveEndBoundary(start: string | undefined, end: string | undefined): boolean {
  const startDate = parseRunSourceDate(start)
  const endDate = parseRunSourceDate(end)
  if (!startDate || !endDate) return false
  return addDays(startOfLocalDay(startDate), 1).getTime() === startOfLocalDay(endDate).getTime()
}

/** The calendar day an instant falls on IN a named zone, which is the only zone that can
    answer "which day did this run cover" without asking who is looking. */
function zonedCalendarDay(value: string | undefined, zone: string): Date | null {
  const normalized = normalizeDisplayText(value)
  if (!/^\d{4}-\d{2}-\d{2}T/.test(normalized)) return null
  const instant = new Date(normalized)
  return Number.isNaN(instant.getTime()) ? null : displayCalendarDayOf(instant, zone)
}

function formatRunSourceDateRange(start: string | undefined, end: string | undefined, zone?: string): string {
  // A recorded zone beats every heuristic below it: those exist precisely because the zone
  // was missing, and guessing is what let two viewers read different days for one run.
  if (zone) {
    const zonedStart = zonedCalendarDay(start, zone)
    const zonedEnd = zonedCalendarDay(end, zone)
    if (zonedStart && zonedEnd) {
      if (addDays(zonedStart, 1).getTime() === zonedEnd.getTime()) return formatCalendarDay(zonedStart)
      return `${formatCalendarDay(zonedStart)} to ${formatCalendarDay(zonedEnd)}`
    }
    if (zonedStart) return formatCalendarDay(zonedStart)
  }

  const utcWindow = utcAnchoredCalendarWindow(start, end)
  if (utcWindow) {
    const formattedUtcStart = formatCalendarDay(utcWindow.start)
    if (addDays(utcWindow.start, 1).getTime() === utcWindow.end.getTime()) return formattedUtcStart
    return `${formattedUtcStart} to ${formatCalendarDay(utcWindow.end)}`
  }

  const formattedStart = formatRunSourceDate(start)
  const formattedEnd = formatRunSourceDate(end)
  if (formattedStart && formattedEnd && formattedStart !== formattedEnd) {
    if (isExclusiveEndBoundary(start, end)) return formattedStart
    return `${formattedStart} to ${formattedEnd}`
  }
  return formattedStart || formattedEnd
}

// SHOPIFY, OMS, AUT_SRC_API -- an id the backend stored, not something to show a person.
const ENUM_TOKEN_LABEL = /^[A-Z][A-Z0-9_]*$/

/**
 * The exact window, for the mascot to read back when somebody rests on the date range.
 *
 * The label above it is a CALENDAR DAY, which two instants alone cannot name — so where the
 * run recorded the zone it was anchored in, both the label and this answer resolve in THAT
 * zone and read the same for everybody. Where it did not (runs older than the column), the
 * day still falls back to the viewer's zone and this says the instants plainly rather than
 * claiming a zone nobody stored. Never empty: the body carries a {detail} token, and an
 * unfilled slot would print the store's timestamp fallback, which is wrong for a window.
 */
/** ISO with an explicit zone: the only shape whose instant is unambiguous. */
const ZONED_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})$/
/**
 * A wall clock with no zone on it. This is what the run row actually sends: windowStartDate
 * is a date-time column and the backend serialises it with Timestamp.toString(), so it
 * arrives as "2026-09-01 00:00:00.0" — space separated, no T, no offset. Requiring an ISO T
 * made every real API run report that it had no time of day at all.
 */
const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?$/

/** Rendered from its own parts, never through a Date: converting a stamp that carries no
    zone into the viewer's would invent an offset the record does not have. */
function formatWallClock(match: RegExpMatchArray): string {
  const [, year, month, day, hour, minute, second] = match.map(Number) as number[]
  const clockHour = (hour as number) % 12 || 12
  const suffix = (hour as number) < 12 ? 'AM' : 'PM'
  const seconds = second ? `:${String(second).padStart(2, '0')}` : ''
  return `${MONTH_NAMES[(month as number) - 1]} ${day}, ${year}, ${clockHour}:${String(minute).padStart(2, '0')}${seconds} ${suffix}`
}

function renderWindowBoundary(value: string, zone?: string): { text: string, zoned: boolean, at: Date | null } | null {
  if (ZONED_INSTANT.test(value)) {
    const instant = new Date(value)
    // Shown in the window's own zone when the run recorded one, so the answer is the same for
    // everybody who reads it. Falls back to the viewer's zone only when nothing was recorded.
    if (!Number.isNaN(instant.getTime())) return { text: formatDateTime(instant, zone ? { timeZone: zone } : {}), zoned: true, at: instant }
  }
  const wall = value.match(WALL_CLOCK)
  return wall ? { text: formatWallClock(wall), zoned: false, at: null } : null
}

/**
 * The exact window, for the mascot to read back when somebody rests on the date range.
 *
 * The label above it is a CALENDAR DAY resolved in the viewer's own zone, so two people
 * in different zones read different days for one run (DAR-UI-025/026). The instants are
 * the only thing that settles that. Never empty: the body carries a {detail} token, and
 * an unfilled slot would print the store's timestamp fallback, which is the wrong
 * sentence for a window.
 */
function describeRunSourceWindow(startValue: string, endValue: string, dayLabel: string, zone?: string): string {
  if (!startValue && !endValue) return 'no window was recorded for this run'

  // A wall clock carries no zone of its own, so a recorded zone is deliberately NOT applied to
  // one: the two would disagree, since the stamp was rendered in the server's zone rather than
  // the window's. Only instants can be moved.
  const start = renderWindowBoundary(startValue, zone)
  const end = renderWindowBoundary(endValue, zone)
  // A zone code is appended only when every boundary shown carries one. On a mixed or
  // zone-less pair it would be a claim about a stamp that never had a zone.
  // Taken at the window's own instant, not at "now": a zone code has to survive a DST
  // boundary between the run and whoever is reading it back.
  const zoneCode = (start?.zoned ?? true) && (end?.zoned ?? true)
    ? timeZoneCode(start?.at ?? end?.at ?? new Date(), zone || getDefaultDisplayTimeZone())
    : ''
  const suffix = zoneCode ? ` ${zoneCode}` : ''

  if (start && end) return `${start.text} to ${end.text}${suffix}`
  if (start) return `from ${start.text}${suffix}, with no end recorded`
  if (end) return `until ${end.text}${suffix}, with no start recorded`
  // A bare YYYY-MM-DD carries no instant at all, and rendering one as midnight would
  // manufacture precision the contract does not have.
  return `${dayLabel}, with no time of day recorded`
}

export function useRunResultSourceDetails(deps: UseRunResultSourceDetailsDeps): UseRunResultSourceDetails {
  const runSourceDetails = ref<GeneratedOutputSourceDetails | null>(null)

  function normalizeRunSourceFile(sourceFile: GeneratedOutputSourceFile, index: number): RunSourceFileView | null {
    const filePath = normalizeDisplayText(sourceFile.filePath)
    const fileName =
      normalizeDisplayText(sourceFile.fileName) ||
      normalizeDisplayText(sourceFile.downloadFileName) ||
      fileNameFromPath(filePath)
    if (!fileName && !filePath) return null

    // The backend sends the raw system enum id here (SHOPIFY), while the rest of this screen shows
    // the resolved display label (Shopify) -- so the file badge read "SHOPIFY orders-b.csv" right
    // above a tile reading "Missing from Shopify". Prefer the resolved label, and keep the
    // backend's only when it is a real name rather than an enum token.
    const resolvedSideLabel = index === 0 ? deps.file1Label.value : deps.file2Label.value
    const backendLabel = normalizeDisplayText(sourceFile.label)
    const label = (ENUM_TOKEN_LABEL.test(backendLabel) ? resolvedSideLabel : backendLabel) || resolvedSideLabel
    const sourceFormat = normalizeDisplayText(sourceFile.sourceFormat) || fileNameFromPath(fileName).split('.').pop()?.toLowerCase() || 'json'
    return {
      key: `${sourceFile.side || index}-${filePath || fileName}`,
      label,
      fileName: fileName || filePath,
      filePath,
      sourceFormat,
      downloadFileName: normalizeDisplayText(sourceFile.downloadFileName) || fileName || filePath,
      canDownload: sourceFile.canDownload !== false && Boolean(filePath),
    }
  }

  // The label the backend stamps into a run is the ENDPOINT the extract used ("HotWax Returns
  // (Reconciliation API)"), but a file belongs to a system -- so name the system, matching the
  // difference tiles beside it and leaving room for the file name. Resolved as a PAIR, never one
  // side at a time: two endpoints of the same system would both collapse to "HotWax" and leave the
  // two files indistinguishable, and darpanSystemNamePair keeps the endpoint labels for exactly
  // that case.
  const runSourceFiles = computed<RunSourceFileView[]>(() => {
    const files = (runSourceDetails.value?.files ?? [])
      .map((sourceFile, index) => normalizeRunSourceFile(sourceFile, index))
      .filter((sourceFile): sourceFile is RunSourceFileView => sourceFile !== null)

    if (files.length === 2) {
      const systemNames = darpanSystemNamePair(files[0]!.label, files[1]!.label)
      return [
        { ...files[0]!, label: systemNames.file1 },
        { ...files[1]!, label: systemNames.file2 },
      ]
    }

    return files.map((file) => ({ ...file, label: darpanSystemNameFromLabel(file.label) || file.label }))
  })
  const isApiRunSource = computed(() => {
    const mode = normalizeDisplayToken(runSourceDetails.value?.mode)
    return mode.includes('api') || Boolean(runSourceDetails.value?.dateRange?.start || runSourceDetails.value?.dateRange?.end)
  })
  const runSourceModeLabel = computed(() => isApiRunSource.value ? 'API date range' : 'Source files')
  const runSourceWindowTimeZone = computed(() => normalizeDisplayText(runSourceDetails.value?.dateRange?.timeZone) || undefined)
  const runSourceDateRangeLabel = computed(() => formatRunSourceDateRange(
    runSourceDetails.value?.dateRange?.start,
    runSourceDetails.value?.dateRange?.end,
    runSourceWindowTimeZone.value,
  ))
  const runSourceDateRangeDetail = computed(() => describeRunSourceWindow(
    normalizeDisplayText(runSourceDetails.value?.dateRange?.start),
    normalizeDisplayText(runSourceDetails.value?.dateRange?.end),
    runSourceDateRangeLabel.value,
    runSourceWindowTimeZone.value,
  ))
  const runSourceFilesLabel = computed(() => isApiRunSource.value ? 'Files compared' : 'Source files')
  const showRunSourceDetails = computed(() =>
    runSourceFiles.value.length > 0 || Boolean(runSourceDateRangeLabel.value),
  )

  function resetRunSourceDetails(): void {
    runSourceDetails.value = null
  }

  return {
    runSourceDetails,
    runSourceFiles,
    isApiRunSource,
    runSourceModeLabel,
    runSourceDateRangeLabel,
    runSourceDateRangeDetail,
    runSourceFilesLabel,
    showRunSourceDetails,
    resetRunSourceDetails,
  }
}
