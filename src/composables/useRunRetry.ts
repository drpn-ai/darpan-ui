import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import {
  buildReconciliationRunLiveRoute,
  buildReconciliationRunStartingRoute,
  type ReconciliationRunRouteContext,
} from '../lib/reconciliationRoutes'
import { pollForRegisteredRunResultId } from '../lib/runRegistration'
import { newPendingRunId, useRunSubmissionsStore } from '../stores/runSubmissions'

/**
 * DAR-BE-163: retry a failed run from the step it failed at. The server reuses the sides the failed run
 * finished reading and runs over that run's own window as a new, linked run.
 * DAR-UI-156: the Starting page opens on the click, as Run's does; the store sends the retry and looks for the
 * run it registered, and a refusal (not failed, edited since) shows there with a way back to the failed run.
 */
export function useRunRetry() {
  const router = useRouter()
  const submissions = useRunSubmissionsStore()
  const retrying = ref(false)

  async function retry(context: ReconciliationRunRouteContext, failedRunResultId: string): Promise<void> {
    if (retrying.value || !context.savedRunId || !failedRunResultId) return
    // A retry of this run still starting (Back, then Retry again): open it, start no second one.
    const alreadyStarting = submissions.startingFor(context.savedRunId)
    if (alreadyStarting) {
      await router.push(buildReconciliationRunStartingRoute(context, alreadyStarting))
      return
    }
    retrying.value = true
    const pendingRunId = newPendingRunId(context.savedRunId)
    const startingRoute = buildReconciliationRunStartingRoute(context, pendingRunId)
    submissions.start({
      pendingRunId,
      context,
      backRoute: buildReconciliationRunLiveRoute(context, failedRunResultId),
      backLabel: 'Back to the failed run',
      register: (signal) => pollForRegisteredRunResultId(context.savedRunId, signal),
      submit: async () => {
        try {
          const response = await reconciliationFacade.runSavedRunDiff({
            savedRunId: context.savedRunId,
            retryFromRunResultId: failedRunResultId,
          })
          const retriedRunResultId = response.runResult?.generatedOutput?.reconciliationRunResultId?.trim()
          // A refusal (not failed, edited since, nothing landed) resolves as an error envelope.
          if (!retriedRunResultId) return { error: response.errors?.[0] ?? 'This run cannot be retried.' }
          return { route: buildReconciliationRunLiveRoute(context, retriedRunResultId) }
        } catch (error) {
          return { error: error instanceof ApiCallError ? error.message : 'This run cannot be retried.' }
        }
      },
      reopen: () => void router.push(startingRoute),
    })
    try {
      await router.push(startingRoute)
    } finally {
      retrying.value = false
    }
  }

  return { retrying, retry }
}
