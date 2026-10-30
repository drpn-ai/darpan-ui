import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import { buildReconciliationRunLiveRoute, type ReconciliationRunRouteContext } from '../lib/reconciliationRoutes'
import { pollForRegisteredRunResultId } from '../lib/runRegistration'

/**
 * DAR-BE-163: retry a failed run from the step it failed at. The server reuses the sides the failed run
 * finished reading and runs over that run's own window as a new, linked run; this starts it and opens
 * its live view the way Run does — racing the submission (which answers only when the run ends) against
 * a look for the run it registered.
 */
export function useRunRetry() {
  const router = useRouter()
  const retrying = ref(false)
  const retryError = ref<string | null>(null)

  async function retry(context: ReconciliationRunRouteContext, failedRunResultId: string): Promise<void> {
    if (retrying.value || !context.savedRunId || !failedRunResultId) return
    retrying.value = true
    retryError.value = null
    const lookup = new AbortController()
    try {
      const submission = reconciliationFacade.runSavedRunDiff({
        savedRunId: context.savedRunId,
        retryFromRunResultId: failedRunResultId,
      })
      const liveRunResultId = await Promise.race([
        pollForRegisteredRunResultId(context.savedRunId, lookup.signal),
        submission.then(() => '', () => ''),
      ])
      if (liveRunResultId) {
        // The retry keeps running server-side; its live view takes over from here.
        void submission.catch(() => undefined)
        await router.push(buildReconciliationRunLiveRoute(context, liveRunResultId))
        return
      }

      const response = await submission
      const retriedRunResultId = response.runResult?.generatedOutput?.reconciliationRunResultId?.trim()
      if (!retriedRunResultId) {
        // A refusal (not failed, edited since, nothing landed) resolves as an error envelope.
        retryError.value = response.errors?.[0] ?? 'This run cannot be retried.'
        return
      }
      await router.push(buildReconciliationRunLiveRoute(context, retriedRunResultId))
    } catch (error) {
      retryError.value = error instanceof ApiCallError ? error.message : 'This run cannot be retried.'
    } finally {
      lookup.abort()
      retrying.value = false
    }
  }

  return { retrying, retryError, retry }
}
