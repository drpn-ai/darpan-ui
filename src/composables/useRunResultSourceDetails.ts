import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { GeneratedOutputSourceDetails, GeneratedOutputSourceFile } from '../lib/api/types'
import { fileNameFromPath, normalizeDisplayText, normalizeDisplayToken } from '../lib/reconciliationDisplay'
import { addDays, startOfLocalDay } from '../lib/utils/date'

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

function formatRunSourceDate(value: string | undefined): string {
  const normalizedValue = normalizeDisplayText(value)
  const dateMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return normalizedValue

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthIndex = Number(dateMatch[2]) - 1
  const monthName = monthNames[monthIndex] ?? dateMatch[2]
  return `${monthName} ${Number(dateMatch[3])}, ${dateMatch[1]}`
}

function parseRunSourceDate(value: string | undefined): Date | null {
  const normalizedValue = normalizeDisplayText(value)
  const dateMatch = normalizedValue.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!dateMatch) return null
  return new Date(Number(dateMatch[1]), Number(dateMatch[2]) - 1, Number(dateMatch[3]))
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
  const formattedStart = formatRunSourceDate(start)
  const formattedEnd = formatRunSourceDate(end)
  if (formattedStart && formattedEnd && formattedStart !== formattedEnd) {
    if (isExclusiveEndBoundary(start, end)) return formattedStart
    return `${formattedStart} to ${formattedEnd}`
  }
  return formattedStart || formattedEnd
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

    const label = normalizeDisplayText(sourceFile.label) || (index === 0 ? deps.file1Label.value : deps.file2Label.value)
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

  const runSourceFiles = computed<RunSourceFileView[]>(() =>
    (runSourceDetails.value?.files ?? [])
      .map((sourceFile, index) => normalizeRunSourceFile(sourceFile, index))
      .filter((sourceFile): sourceFile is RunSourceFileView => sourceFile !== null),
  )
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
