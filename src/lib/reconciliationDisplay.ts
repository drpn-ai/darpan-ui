import { darpanSystemNameFromLabel, darpanSystemNamePair } from './utils/darpanSystems'

export function normalizeDisplayText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function normalizeDisplayToken(value: unknown): string {
  return normalizeDisplayText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function fileNameFromPath(value: unknown): string {
  const normalizedValue = normalizeDisplayText(value)
  if (!normalizedValue) return ''
  return normalizedValue.split(/[\\/]/).filter(Boolean).pop() ?? normalizedValue
}

// Stage codes come from the backend RunObservability lifecycle
// (darpan.reconciliation.ReconciliationRunStep.stageCode). Extract stages take the
// run's own system labels so operators read "Extracting SHOPIFY", not a code.

// Canonical stage order, mirroring RunObservability.STAGE_SEQUENCE. Step rows are created
// lazily as stages start, so a live view synthesizes the not-yet-started remainder from this
// list; conditional stages (VERIFY, file-mode extracts) simply drop out as real rows arrive.
export const RUN_STAGE_SEQUENCE: readonly string[] = [
  'RESOLVE',
  'EXTRACT_FILE1',
  'EXTRACT_FILE2',
  'COMPARE',
  'VERIFY',
  'WRITE_OUTPUT',
  'NOTIFY',
]

const RUN_STAGE_LABELS: Record<string, string> = {
  RESOLVE: 'Preparing run',
  COMPARE: 'Comparing records',
  WRITE_OUTPUT: 'Writing results',
  VERIFY: 'Verifying differences',
  NOTIFY: 'Sending notifications',
}

// Three separate verification passes (exchange pairs, missing-record lookups, returns presence)
// share the VERIFY stage code, so a run that ran two of them showed two identical rows. Each pass
// records the side labels it actually rechecked in its own metricsJson; resolve those to system
// names here so the rows say which system each one covered.
function verifiedSystemNames(metricsJson: unknown): string[] {
  const raw = normalizeDisplayText(metricsJson)
  if (!raw) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // A step row must never lose its label to malformed metrics.
    return []
  }

  const systems = (parsed as { verifiedSystems?: unknown })?.verifiedSystems
  if (!Array.isArray(systems)) return []

  const names: string[] = []
  for (const system of systems) {
    const name = darpanSystemNameFromLabel(normalizeDisplayText(system))
    if (name && !names.includes(name)) names.push(name)
  }
  return names
}

function joinSystemNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? ''
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function reconciliationStageLabel(
  stageCode: unknown,
  file1Label?: string,
  file2Label?: string,
  metricsJson?: unknown,
): string {
  const code = normalizeDisplayText(stageCode)
  if (!code) return ''
  if (code === 'EXTRACT_FILE1' || code === 'EXTRACT_FILE2') {
    // The side labels a run stamps are the ENDPOINTS its extracts used ("Shopify Order Return
    // References"), but a step pulls from a SYSTEM -- so name the system, matching the compared-file
    // chips above and leaving the row width for the duration and record count. Resolved as a PAIR:
    // two endpoints of the same system would both collapse to "Extracting HotWax" and leave the two
    // extract rows indistinguishable, which darpanSystemNamePair avoids by keeping both endpoints.
    const systemNames = darpanSystemNamePair(file1Label, file2Label)
    if (code === 'EXTRACT_FILE1') return `Extracting ${normalizeDisplayText(systemNames.file1) || 'source 1'}`
    return `Extracting ${normalizeDisplayText(systemNames.file2) || 'source 2'}`
  }
  if (code === 'VERIFY') {
    const systemNames = joinSystemNames(verifiedSystemNames(metricsJson))
    if (systemNames) return `Verifying ${systemNames}'s diffs`
  }
  return RUN_STAGE_LABELS[code] ?? code
}

function parseRunTimestamp(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? null : parsed
  }
  return null
}

export function formatRunStepDuration(startedDate: unknown, completedDate: unknown): string {
  const startMs = parseRunTimestamp(startedDate)
  const endMs = parseRunTimestamp(completedDate)
  if (startMs == null || endMs == null || endMs < startMs) return ''
  const totalSeconds = Math.round((endMs - startMs) / 1000)
  if (totalSeconds < 1) return '<1s'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`
  if (minutes > 0) return `${minutes}m ${String(seconds).padStart(2, '0')}s`
  return `${seconds}s`
}

export function humanizeToken(value: unknown): string {
  const normalizedValue = normalizeDisplayText(value)
  if (!normalizedValue) return ''

  return normalizedValue
    .replace(/^AUT_(IN|WIN)_/, '')
    .replace(/^API_/, 'API ')
    .replace(/^SFTP_/, 'SFTP ')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b(api|sftp|utc)\b/g, (match) => match.toUpperCase())
    .replace(/\b\w/g, (match) => match.toUpperCase())
}
