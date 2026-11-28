import { computed, ref, watch, type ComputedRef, type Ref } from 'vue'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'
import type { GetReconciliationRunStatusResponse } from '../lib/api/types'

export interface UseRunCancelDeps {
  /** The live run, empty once the page shows a result file. */
  liveRunResultId: ComputedRef<string>
  runStatus: ComputedRef<GetReconciliationRunStatusResponse | null>
  liveRunActive: ComputedRef<boolean>
  canRun: ComputedRef<boolean>
}

export interface UseRunCancel {
  showCancelRun: ComputedRef<boolean>
  cancelRequested: ComputedRef<boolean>
  cancelConfirming: Ref<boolean>
  cancelError: Ref<string | null>
  cancelRun: () => Promise<void>
}

/**
 * Cancel a live run. Cancelling is cooperative on the backend: the request is recorded and the run ends itself at its
 * next checkpoint, so the button reports "Stopping" until the poll shows a terminal status rather than pretending the
 * run stopped. DAR-UI-156: "Stopping" shows the moment the person confirms; the status poll confirms it through
 * cancelRequestedDate, and only a refusal puts the Cancel button back, with the reason above it.
 */
export function useRunCancel(deps: UseRunCancelDeps): UseRunCancel {
  const cancelSent = ref(false)
  const cancelConfirming = ref(false)
  const cancelError = ref<string | null>(null)
  const cancelRequested = computed(() => cancelSent.value || Boolean(deps.runStatus.value?.cancelRequestedDate))
  const showCancelRun = computed(() => Boolean(deps.liveRunResultId.value) && deps.canRun.value && deps.liveRunActive.value)

  watch(deps.liveRunResultId, () => {
    cancelSent.value = false
    cancelConfirming.value = false
    cancelError.value = null
  })

  async function cancelRun(): Promise<void> {
    const runId = deps.liveRunResultId.value
    if (!runId || cancelRequested.value) return

    cancelConfirming.value = false
    cancelSent.value = true
    cancelError.value = null
    try {
      await reconciliationFacade.cancelReconciliationRun({ reconciliationRunResultId: runId })
    } catch (error) {
      if (deps.liveRunResultId.value !== runId) return
      cancelSent.value = false
      cancelError.value = error instanceof ApiCallError ? error.message : 'This run refuses to stop. It is very committed.'
    }
  }

  return { showCancelRun, cancelRequested, cancelConfirming, cancelError, cancelRun }
}
