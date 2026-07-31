import { ref, type Ref } from 'vue'
import { ApiCallError, isAbortError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import type { GeneratedOutput, RunSavedRunDiffResponse, SavedRunSummary } from '../lib/api/types'
import type { RunSavedRunDiffPayload } from '../lib/api/facadeTypes'
import { useRunResultsStore } from '../stores/runResults'

function cacheRunResult(output: GeneratedOutput | null | undefined): void {
  if (!output) return
  try {
    useRunResultsStore().upsertOutput(output)
  } catch {
    // Pinia not active (e.g. some test setups); skip cache update.
  }
}

function readLatestCachedOutputForSavedRun(savedRunId: string): GeneratedOutput | null {
  try {
    const cached = useRunResultsStore().getOutputsForSavedRun(savedRunId)
    return cached[0] ?? null
  } catch {
    return null
  }
}

interface FailedRunFeedback {
  validationErrors: string[]
  processingWarnings: string[]
}

function linkExternalSignal(internal: AbortController, external: AbortSignal | undefined): () => void {
  if (!external) return () => {}
  if (external.aborted) {
    internal.abort()
    return () => {}
  }
  const onAbort = (): void => internal.abort()
  external.addEventListener('abort', onAbort, { once: true })
  return () => external.removeEventListener('abort', onAbort)
}

export interface UseReconciliationDiff {
  savedRuns: Ref<SavedRunSummary[]>
  loadingSavedRuns: Ref<boolean>
  loadError: Ref<string | null>
  latestSavedOutput: Ref<GeneratedOutput | null>
  latestSavedOutputLoading: Ref<boolean>
  latestSavedOutputError: Ref<string | null>
  runError: Ref<string | null>
  running: Ref<boolean>
  validationErrors: Ref<string[]>
  processingWarnings: Ref<string[]>
  loadSavedRuns: (signal?: AbortSignal) => Promise<void>
  loadLatestSavedOutput: (savedRunId: string, signal?: AbortSignal) => Promise<void>
  clearLatestSavedOutputState: () => void
  clearRunState: () => void
  submitDiff: (payload: RunSavedRunDiffPayload, signal?: AbortSignal) => Promise<RunSavedRunDiffResponse | null>
  readFailedRunFeedback: (error: ApiCallError) => FailedRunFeedback
}

export function useReconciliationDiff(): UseReconciliationDiff {
  const savedRuns = ref<SavedRunSummary[]>([])
  const loadingSavedRuns = ref(false)
  const loadError = ref<string | null>(null)
  const latestSavedOutput = ref<GeneratedOutput | null>(null)
  const latestSavedOutputLoading = ref(false)
  const latestSavedOutputError = ref<string | null>(null)
  const runError = ref<string | null>(null)
  const running = ref(false)
  const validationErrors = ref<string[]>([])
  const processingWarnings = ref<string[]>([])

  let latestOutputController: AbortController | null = null

  function clearRunState(): void {
    runError.value = null
    validationErrors.value = []
    processingWarnings.value = []
  }

  function clearLatestSavedOutputState(): void {
    latestSavedOutput.value = null
    latestSavedOutputLoading.value = false
    latestSavedOutputError.value = null
  }

  async function loadSavedRuns(signal?: AbortSignal): Promise<void> {
    loadingSavedRuns.value = true
    loadError.value = null

    try {
      const response = await reconciliationFacade.listSavedRuns({
        pageIndex: 0,
        pageSize: 50,
        query: '',
      }, signal)
      savedRuns.value = response.savedRuns ?? []
    } catch (error) {
      if (isAbortError(error)) return
      loadError.value = error instanceof ApiCallError ? error.message : 'Unable to load saved runs.'
    } finally {
      if (!signal?.aborted) {
        loadingSavedRuns.value = false
      }
    }
  }

  async function loadLatestSavedOutput(savedRunId: string, signal?: AbortSignal): Promise<void> {
    const normalizedSavedRunId = savedRunId.trim()
    if (!normalizedSavedRunId) {
      clearLatestSavedOutputState()
      return
    }

    latestOutputController?.abort()
    const controller = new AbortController()
    latestOutputController = controller
    const unlink = linkExternalSignal(controller, signal)

    latestSavedOutputError.value = null
    latestSavedOutput.value = null

    // Recent results (<= 2 days) live in the run-results cache. If we have
    // any cached output for this saved run, it IS the latest — no DB call
    // needed. Fall through to the server only on a cache miss (older or
    // never-run saved runs).
    const cachedLatest = readLatestCachedOutputForSavedRun(normalizedSavedRunId)
    if (cachedLatest) {
      latestSavedOutput.value = cachedLatest
      latestSavedOutputLoading.value = false
      unlink()
      if (latestOutputController === controller) latestOutputController = null
      return
    }

    latestSavedOutputLoading.value = true

    try {
      const response = await reconciliationFacade.listGeneratedOutputs({
        savedRunId: normalizedSavedRunId,
        pageIndex: 0,
        pageSize: 1,
        query: '',
      }, controller.signal)
      if (controller.signal.aborted) return
      const nextLatest = response.generatedOutputs?.[0] ?? null
      latestSavedOutput.value = nextLatest
      cacheRunResult(nextLatest)
    } catch (error) {
      if (controller.signal.aborted || isAbortError(error)) return
      latestSavedOutput.value = null
      latestSavedOutputError.value = error instanceof ApiCallError ? error.message : 'Unable to load saved results.'
    } finally {
      unlink()
      if (!controller.signal.aborted) {
        latestSavedOutputLoading.value = false
      }
      if (latestOutputController === controller) {
        latestOutputController = null
      }
    }
  }

  function readFailedRunFeedback(error: ApiCallError): FailedRunFeedback {
    const details = (error.details ?? {}) as {
      result?: {
        validationErrors?: unknown
        processingWarnings?: unknown
      }
    }

    return {
      validationErrors: Array.isArray(details.result?.validationErrors)
        ? details.result.validationErrors.map((item) => String(item))
        : [],
      processingWarnings: Array.isArray(details.result?.processingWarnings)
        ? details.result.processingWarnings.map((item) => String(item))
        : [],
    }
  }

  async function submitDiff(payload: RunSavedRunDiffPayload, signal?: AbortSignal): Promise<RunSavedRunDiffResponse | null> {
    clearRunState()
    running.value = true

    try {
      const response = await reconciliationFacade.runSavedRunDiff(payload, signal)
      validationErrors.value = response.runResult?.validationErrors ?? []
      processingWarnings.value = response.runResult?.processingWarnings ?? []
      cacheRunResult(response.runResult?.generatedOutput)
      return response
    } catch (error) {
      if (isAbortError(error)) {
        throw error
      }
      if (error instanceof ApiCallError) {
        const failedFeedback = readFailedRunFeedback(error)
        validationErrors.value = failedFeedback.validationErrors
        processingWarnings.value = failedFeedback.processingWarnings
        runError.value = error.message
      } else {
        runError.value = 'Unable to run the diff.'
      }
      throw error
    } finally {
      if (!signal?.aborted) {
        running.value = false
      }
    }
  }

  return {
    savedRuns,
    loadingSavedRuns,
    loadError,
    latestSavedOutput,
    latestSavedOutputLoading,
    latestSavedOutputError,
    runError,
    running,
    validationErrors,
    processingWarnings,
    loadSavedRuns,
    loadLatestSavedOutput,
    clearLatestSavedOutputState,
    clearRunState,
    submitDiff,
    readFailedRunFeedback,
  }
}
