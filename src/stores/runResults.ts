import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { describeError, isAbortError } from '../lib/api/errors'
import { reconciliationFacade } from '../lib/api/facade'
import type { GeneratedOutput } from '../lib/api/types'

const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000

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

function parseCreatedDate(value: string | undefined | null): number {
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
    _abortController?.abort()
    _abortController = null
    _hydrationPromise = null
    _byFileName.value = new Map()
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
    upsertOutput,
    upsertOutputs,
    removeOutput,
    reset,
  }
})
