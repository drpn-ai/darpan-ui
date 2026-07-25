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
const RUN_STAGE_LABELS: Record<string, string> = {
  RESOLVE: 'Preparing run',
  COMPARE: 'Comparing records',
  WRITE_OUTPUT: 'Writing results',
  NOTIFY: 'Sending notifications',
}

export function reconciliationStageLabel(stageCode: unknown, file1Label?: string, file2Label?: string): string {
  const code = normalizeDisplayText(stageCode)
  if (!code) return ''
  if (code === 'EXTRACT_FILE1') return `Extracting ${normalizeDisplayText(file1Label) || 'source 1'}`
  if (code === 'EXTRACT_FILE2') return `Extracting ${normalizeDisplayText(file2Label) || 'source 2'}`
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
