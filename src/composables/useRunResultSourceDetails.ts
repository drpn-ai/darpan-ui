import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GeneratedOutputSourceDetails, GeneratedOutputSourceFile } from '../lib/api/types'
import { fileNameFromPath, normalizeDisplayText, normalizeDisplayToken } from '../lib/reconciliationDisplay'
import { darpanSystemNameFromLabel, darpanSystemNamePair } from '../lib/utils/darpanSystems'
import { addDays, displayCalendarDayOf, startOfLocalDay } from '../lib/utils/date'

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

function formatRunSourceDateRange(start: string | undefined, end: string | undefined): string {
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
  const runSourceDateRangeLabel = computed(() => formatRunSourceDateRange(runSourceDetails.value?.dateRange?.start, runSourceDetails.value?.dateRange?.end))
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
    runSourceFilesLabel,
    showRunSourceDetails,
    resetRunSourceDetails,
  }
}
