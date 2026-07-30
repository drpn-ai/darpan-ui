import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import type { GeneratedOutput, GetReconciliationRunStatusResponse } from '../lib/api/types'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

// Mirrors RunObservability status constants: a run is live while PENDING/RUNNING;
// every other status is terminal and ends the per-run poll.
const ACTIVE_RUN_STATUS_IDS = new Set(['AUT_STAT_PENDING', 'AUT_STAT_RUNNING'])

// Active runs refresh every 5s: get#ReconciliationRunStatus is a cheap single-row read
// plus step rows, and the poll only exists while a run is PENDING/RUNNING.
const RUN_STATUS_POLL_INTERVAL_MS = 5000

export function isActiveRunStatus(statusEnumId: string | null | undefined): boolean {
  return ACTIVE_RUN_STATUS_IDS.has(statusEnumId ?? '')
}

// Headroom over the expected ~5-6 outputs / 2 days for the active tenant.
// If a tenant ever bursts past this, hydrate() simply returns the most
// recent N — older entries get fetched on-demand via the page's existing
// pagination path.
const RECENT_FETCH_PAGE_SIZE = 25

interface LoadState {
  loading: boolean
  error: string | null
  loadedAt: number | null
}

function emptyLoadState(): LoadState {
  return { loading: false, error: null, loadedAt: null }
}

function isAbortError(err: unknown): boolean {
  return (err as { name?: string } | null)?.name === 'AbortError'
}

function describeError(err: unknown, fallback: string): string {
  if (err instanceof ApiCallError) return err.message
  if (err instanceof Error) return err.message
  return fallback
}

// The wire delivers timestamps as epoch milliseconds (numbers); specs and some callers use
// ISO strings. Both must parse or the recent-window filter silently discards every server row.
function parseCreatedDate(value: string | number | undefined | null): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (!value) return 0
  const parsed = Date.parse(value)
  return Number.isNaN(parsed) ? 0 : parsed
}

function isWithinRecentWindow(output: GeneratedOutput, nowMs: number): boolean {
  const createdMs = parseCreatedDate(output.createdDate)
  if (createdMs === 0) return false
  return nowMs - createdMs <= TWO_DAYS_MS
}

function outputKey(output: GeneratedOutput): string {
  return output.fileName
}

function sortByCreatedDateDesc(a: GeneratedOutput, b: GeneratedOutput): number {
  return parseCreatedDate(b.createdDate) - parseCreatedDate(a.createdDate)
}

export const useRunResultsStore = defineStore('runResults', () => {
  const _byFileName = ref<Map<string, GeneratedOutput>>(new Map())
  const _loadState = ref<LoadState>(emptyLoadState())

  let _hydrationPromise: Promise<void> | null = null
  let _abortController: AbortController | null = null
  // Audit 2026-06-11 #11: background refresh so newly-raised sync-failure run results surface without
  // a manual reload. Idempotent; owned by the viewing page via start/stopAutoRefresh lifecycle.
  let _refreshTimer: ReturnType<typeof setInterval> | null = null
  let _visibilityHandler: (() => void) | null = null

  const loading = computed(() => _loadState.value.loading)
  const error = computed(() => _loadState.value.error)
  const loadedAt = computed(() => _loadState.value.loadedAt)

  const recentOutputs = computed<GeneratedOutput[]>(() => {
    const list = Array.from(_byFileName.value.values())
    list.sort(sortByCreatedDateDesc)
    return list
  })

  function getOutputsForSavedRun(savedRunId: string): GeneratedOutput[] {
    if (!savedRunId) return []
    return recentOutputs.value.filter((output) => output.savedRunId === savedRunId)
  }

  function getByFileName(fileName: string): GeneratedOutput | null {
    return _byFileName.value.get(fileName) ?? null
  }

  function _replaceCache(outputs: GeneratedOutput[]): void {
    const next = new Map<string, GeneratedOutput>()
    for (const output of outputs) {
      const key = outputKey(output)
      if (key) next.set(key, output)
    }
    _byFileName.value = next
  }

  async function _loadRecent(signal: AbortSignal): Promise<void> {
    _loadState.value = { loading: true, error: null, loadedAt: _loadState.value.loadedAt }
    try {
      const response = await reconciliationFacade.listGeneratedOutputs(
        { pageIndex: 0, pageSize: RECENT_FETCH_PAGE_SIZE, query: '' },
        signal,
      )
      const nowMs = Date.now()
      const withinWindow = (response.generatedOutputs ?? []).filter((output) => isWithinRecentWindow(output, nowMs))
      _replaceCache(withinWindow)
      _loadState.value = { loading: false, error: null, loadedAt: nowMs }
    } catch (err) {
      if (isAbortError(err)) return
      _loadState.value = {
        loading: false,
        error: describeError(err, 'Unable to load recent run results.'),
        loadedAt: null,
      }
    }
  }

  function hydrate(): Promise<void> {
    if (_hydrationPromise) return _hydrationPromise
    _abortController = new AbortController()
    _hydrationPromise = _loadRecent(_abortController.signal)
    return _hydrationPromise
  }

  function ensureLoaded(): Promise<void> {
    return hydrate()
  }

  // Force a fresh load, bypassing the one-shot hydrate() memoization.
  function refresh(): Promise<void> {
    _abortController?.abort()
    _abortController = new AbortController()
    _hydrationPromise = _loadRecent(_abortController.signal)
    return _hydrationPromise
  }

  // Poll for new run results while the page is visible. Pauses when the tab is hidden and refreshes
  // immediately when it becomes visible again, so a sync failure raised in the background is seen
  // promptly without hammering the API. Idempotent.
  function startAutoRefresh(intervalMs = 30000): void {
    if (typeof window === 'undefined') return
    stopAutoRefresh()
    _refreshTimer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void refresh()
    }, Math.max(5000, intervalMs))
    if (typeof document !== 'undefined') {
      _visibilityHandler = () => {
        if (!document.hidden) void refresh()
      }
      document.addEventListener('visibilitychange', _visibilityHandler)
    }
  }

  function stopAutoRefresh(): void {
    if (_refreshTimer) {
      clearInterval(_refreshTimer)
      _refreshTimer = null
    }
    if (_visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', _visibilityHandler)
      _visibilityHandler = null
    }
  }

  const _runStatusById = ref<Map<string, GetReconciliationRunStatusResponse>>(new Map())
  const _runStatusTimers = new Map<string, ReturnType<typeof setInterval>>()

  function getRunStatus(reconciliationRunResultId: string): GetReconciliationRunStatusResponse | null {
    return _runStatusById.value.get(reconciliationRunResultId) ?? null
  }

  async function _fetchRunStatus(runId: string): Promise<void> {
    try {
      const response = await reconciliationFacade.getReconciliationRunStatus({ reconciliationRunResultId: runId })
      const previous = _runStatusById.value.get(runId)
      const next = new Map(_runStatusById.value)
      next.set(runId, response)
      _runStatusById.value = next
      if (!isActiveRunStatus(response.statusEnumId)) {
        stopRunStatusPoll(runId)
        // Live→terminal transition: refresh the cache so the finished result replaces
        // the running tile promptly instead of waiting for the next auto-refresh tick.
        if (previous && isActiveRunStatus(previous.statusEnumId)) void refresh()
      }
    } catch (err) {
      if (isAbortError(err)) return
      // Poll errors are non-fatal: keep the last known status and try again next tick.
    }
  }

  // Per-run live status poll for the observability timeline: runs only while the run
  // is active (PENDING/RUNNING) and stops itself on any terminal status. Idempotent
  // per run id; pauses while the tab is hidden, like startAutoRefresh.
  function startRunStatusPoll(reconciliationRunResultId: string, intervalMs = RUN_STATUS_POLL_INTERVAL_MS): Promise<void> {
    const runId = (reconciliationRunResultId ?? '').trim()
    if (!runId || typeof window === 'undefined') return Promise.resolve()
    if (_runStatusTimers.has(runId)) return Promise.resolve()
    const timer = setInterval(() => {
      if (typeof document !== 'undefined' && document.hidden) return
      void _fetchRunStatus(runId)
    }, Math.max(2000, intervalMs))
    _runStatusTimers.set(runId, timer)
    return _fetchRunStatus(runId)
  }

  // On-demand refresh of a single run's status, outside the poll interval. Used by
  // notify-me subscribe/unsubscribe actions so the button's label reflects the new
  // subscription state immediately instead of waiting for the next poll tick.
  async function refreshRunStatus(reconciliationRunResultId: string): Promise<void> {
    const runId = (reconciliationRunResultId ?? '').trim()
    if (!runId) return
    await _fetchRunStatus(runId)
  }

  function stopRunStatusPoll(reconciliationRunResultId: string): void {
    const timer = _runStatusTimers.get(reconciliationRunResultId)
    if (timer) {
      clearInterval(timer)
      _runStatusTimers.delete(reconciliationRunResultId)
    }
  }

  function stopAllRunStatusPolls(): void {
    for (const timer of _runStatusTimers.values()) clearInterval(timer)
    _runStatusTimers.clear()
  }

  function upsertOutput(output: GeneratedOutput | null | undefined): void {
    if (!output) return
    const key = outputKey(output)
    if (!key) return
    const next = new Map(_byFileName.value)
    next.set(key, output)
    _byFileName.value = next
  }

  function upsertOutputs(outputs: GeneratedOutput[]): void {
    if (outputs.length === 0) return
    const next = new Map(_byFileName.value)
    for (const output of outputs) {
      const key = outputKey(output)
      if (key) next.set(key, output)
    }
    _byFileName.value = next
  }

  function removeOutput(fileName: string): void {
    if (!fileName || !_byFileName.value.has(fileName)) return
    const next = new Map(_byFileName.value)
    next.delete(fileName)
    _byFileName.value = next
  }

  function reset(): void {
    stopAutoRefresh()
    stopAllRunStatusPolls()
    _abortController?.abort()
    _abortController = null
    _hydrationPromise = null
    _byFileName.value = new Map()
    _runStatusById.value = new Map()
    _loadState.value = emptyLoadState()
  }

  return {
    loading,
    error,
    loadedAt,
    recentOutputs,
    getOutputsForSavedRun,
    getByFileName,
    hydrate,
    ensureLoaded,
    refresh,
    startAutoRefresh,
    stopAutoRefresh,
    getRunStatus,
    startRunStatusPoll,
    refreshRunStatus,
    stopRunStatusPoll,
    stopAllRunStatusPolls,
    upsertOutput,
    upsertOutputs,
    removeOutput,
    reset,
  }
})
