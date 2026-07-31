import { normalizeStringOrEmpty } from './utils/strings'

const PENDING_RECONCILIATION_RUNS_STORAGE_KEY = 'darpan.pendingReconciliationRuns'

const PENDING_RUN_MAX_AGE_MS = 12 * 60 * 60 * 1000

type PendingRunsListener = () => void
const pendingRunsListeners = new Set<PendingRunsListener>()

export function subscribeToPendingReconciliationRunsChange(listener: PendingRunsListener): () => void {
  pendingRunsListeners.add(listener)
  return () => {
    pendingRunsListeners.delete(listener)
  }
}

export interface PendingReconciliationRun {
  pendingRunId: string
  savedRunId: string
  runName: string
  file1SystemLabel: string
  file2SystemLabel: string
  submittedAt: string
}

interface PendingReconciliationRunInput {
  savedRunId: string
  runName: string
  file1SystemLabel: string
  file2SystemLabel: string
}

interface CompletedReconciliationRun {
  createdDate?: string | number
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function notifyPendingRunsChanged(): void {
  pendingRunsListeners.forEach((listener) => {
    try {
      listener()
    } catch (error) {
      console.error('[pendingReconciliationRuns] listener threw:', error)
    }
  })
}

function parseTimestamp(value: string | number | undefined): number {
  if (value == null || value === '') return Number.NaN
  return new Date(value).getTime()
}

function isPendingRun(value: unknown): value is PendingReconciliationRun {
  if (!value || typeof value !== 'object') return false
  const row = value as Record<string, unknown>
  return Boolean(
    normalizeStringOrEmpty(row.pendingRunId) &&
      normalizeStringOrEmpty(row.savedRunId) &&
      normalizeStringOrEmpty(row.runName) &&
      normalizeStringOrEmpty(row.submittedAt),
  )
}

function readPendingRuns(): PendingReconciliationRun[] {
  const targetStorage = storage()
  if (!targetStorage) return []

  try {
    const parsed = JSON.parse(targetStorage.getItem(PENDING_RECONCILIATION_RUNS_STORAGE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isPendingRun) : []
  } catch {
    return []
  }
}

function isFreshPendingRun(run: PendingReconciliationRun, nowMs = Date.now()): boolean {
  const submittedMs = parseTimestamp(run.submittedAt)
  return Number.isFinite(submittedMs) && nowMs - submittedMs <= PENDING_RUN_MAX_AGE_MS
}

function writePendingRuns(runs: PendingReconciliationRun[], shouldNotify = true): void {
  const targetStorage = storage()
  if (!targetStorage) return

  if (runs.length === 0) {
    targetStorage.removeItem(PENDING_RECONCILIATION_RUNS_STORAGE_KEY)
  } else {
    targetStorage.setItem(PENDING_RECONCILIATION_RUNS_STORAGE_KEY, JSON.stringify(runs))
  }

  if (shouldNotify) notifyPendingRunsChanged()
}

function currentPendingRuns(): PendingReconciliationRun[] {
  const runs = readPendingRuns()
  const freshRuns = runs.filter((run) => isFreshPendingRun(run))
  if (freshRuns.length !== runs.length) writePendingRuns(freshRuns, false)
  return freshRuns
}

function buildPendingRunId(savedRunId: string, submittedAt: string): string {
  const randomSuffix = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)
  return `${savedRunId}-${submittedAt}-${randomSuffix}`.replace(/[^A-Za-z0-9._-]/g, '_')
}

export function recordPendingReconciliationRun(input: PendingReconciliationRunInput): PendingReconciliationRun {
  const submittedAt = new Date().toISOString()
  const savedRunId = normalizeStringOrEmpty(input.savedRunId)
  const pendingRun: PendingReconciliationRun = {
    pendingRunId: buildPendingRunId(savedRunId, submittedAt),
    savedRunId,
    runName: normalizeStringOrEmpty(input.runName) || savedRunId || 'Selected Run',
    file1SystemLabel: normalizeStringOrEmpty(input.file1SystemLabel),
    file2SystemLabel: normalizeStringOrEmpty(input.file2SystemLabel),
    submittedAt,
  }

  writePendingRuns([
    ...currentPendingRuns().filter((run) => run.pendingRunId !== pendingRun.pendingRunId),
    pendingRun,
  ])

  return pendingRun
}

export function clearPendingReconciliationRun(pendingRunId: string | undefined): void {
  const normalizedPendingRunId = normalizeStringOrEmpty(pendingRunId)
  if (!normalizedPendingRunId) return

  const nextRuns = currentPendingRuns().filter((run) => run.pendingRunId !== normalizedPendingRunId)
  writePendingRuns(nextRuns)
}

export function listPendingReconciliationRuns(savedRunId?: string): PendingReconciliationRun[] {
  const normalizedSavedRunId = normalizeStringOrEmpty(savedRunId)
  return currentPendingRuns().filter((run) => !normalizedSavedRunId || run.savedRunId === normalizedSavedRunId)
}

// A submitted run creates its backend RUNNING row within seconds; a marker well past this
// grace with no backend running row belongs to a run that died server-side (FAILED rows are
// not listed), and would otherwise ghost an "In Progress" tile until the next successful run.
const ABANDONED_PENDING_RUN_GRACE_MS = 15 * 60 * 1000

export function pruneAbandonedPendingReconciliationRuns(savedRunId: string, nowMs: number = Date.now()): void {
  const normalizedSavedRunId = normalizeStringOrEmpty(savedRunId)
  if (!normalizedSavedRunId) return

  const nextRuns = currentPendingRuns().filter((run) => {
    if (run.savedRunId !== normalizedSavedRunId) return true
    const submittedMs = parseTimestamp(run.submittedAt)
    return Number.isFinite(submittedMs) && nowMs - submittedMs <= ABANDONED_PENDING_RUN_GRACE_MS
  })
  if (nextRuns.length !== currentPendingRuns().length) writePendingRuns(nextRuns)
}

export function resolveCompletedPendingReconciliationRuns(
  savedRunId: string,
  completedRuns: CompletedReconciliationRun[],
): PendingReconciliationRun[] {
  const normalizedSavedRunId = normalizeStringOrEmpty(savedRunId)
  if (!normalizedSavedRunId || completedRuns.length === 0) return listPendingReconciliationRuns(normalizedSavedRunId)

  const completedTimestamps = completedRuns
    .map((run) => parseTimestamp(run.createdDate))
    .filter((timestamp) => Number.isFinite(timestamp))
  if (completedTimestamps.length === 0) return listPendingReconciliationRuns(normalizedSavedRunId)

  const nextRuns = currentPendingRuns().filter((run) => {
    if (run.savedRunId !== normalizedSavedRunId) return true
    const submittedMs = parseTimestamp(run.submittedAt)
    return !completedTimestamps.some((completedMs) => completedMs >= submittedMs)
  })

  writePendingRuns(nextRuns)
  return nextRuns.filter((run) => run.savedRunId === normalizedSavedRunId)
}
