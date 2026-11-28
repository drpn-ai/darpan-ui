import { computed, ref, type ComputedRef, type Ref } from 'vue'
import type { WorkflowShortcutChoiceOption } from '../components/workflow/WorkflowShortcutChoiceCards.vue'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade, settingsFacade } from '../lib/api/facade'
import type { GetReconciliationRunStatusResponse, TenantChatSpace } from '../lib/api/types'
import { isActiveRunStatus } from '../stores/runResults'

export interface UseRunNotifyMeDeps {
  runId: ComputedRef<string>
  runStatus: ComputedRef<GetReconciliationRunStatusResponse | null>
  /** Re-reads the run's status, so the button shows the new subscription at once instead of on the next poll. */
  refreshRunStatus: (runId: string) => Promise<void>
}

export interface UseRunNotifyMe {
  showNotifyMe: ComputedRef<boolean>
  notifySubscribed: ComputedRef<boolean>
  notifyButtonLabel: ComputedRef<string>
  notifyBusy: Ref<boolean>
  notifyError: Ref<string | null>
  notifyPickerOpen: Ref<boolean>
  notifyPickerLoading: Ref<boolean>
  notifyPickerSpaces: Ref<TenantChatSpace[]>
  notifyPickerOptions: ComputedRef<WorkflowShortcutChoiceOption[]>
  toggleNotifyMe: () => Promise<void>
  closeNotifyPicker: () => void
  pickDefaultAndSubscribe: (chatSpaceId: string) => Promise<void>
}

// callService (client.ts) throws ApiCallError for ANY envelope with ok:false, before this code sees the response,
// so the backend's needsDefaultChatSpace signal (sent alongside ok:false) can only be read off the thrown error's
// details.result.
function readNeedsDefaultChatSpace(error: unknown): boolean {
  if (!(error instanceof ApiCallError)) return false
  const details = (error.details ?? {}) as { result?: { needsDefaultChatSpace?: unknown } }
  return details.result?.needsDefaultChatSpace === true
}

/**
 * Notify me (Task 12): subscribe or unsubscribe the current user to chat notifications for a run. Offered only while
 * the run is still active (PENDING/RUNNING): a terminal run has already notified or never will. A user with no default
 * chat space is asked to pick one, which is saved and the subscription retried.
 */
export function useRunNotifyMe(deps: UseRunNotifyMeDeps): UseRunNotifyMe {
  const notifyBusy = ref(false)
  const notifyError = ref<string | null>(null)
  const notifySubscribed = computed(() => deps.runStatus.value?.mySubscription === true)
  const showNotifyMe = computed(() => Boolean(deps.runId.value) && isActiveRunStatus(deps.runStatus.value?.statusEnumId))
  const notifyButtonLabel = computed(() =>
    notifySubscribed.value ? `Notifying — ${deps.runStatus.value?.mySubscriptionSpaceName ?? 'chat space'}` : 'Notify me')

  const notifyPickerOpen = ref(false)
  const notifyPickerLoading = ref(false)
  const notifyPickerBusy = ref(false)
  const notifyPickerSpaces = ref<TenantChatSpace[]>([])
  const notifyPickerOptions = computed<WorkflowShortcutChoiceOption[]>(() =>
    notifyPickerSpaces.value.map((space, index) => ({
      value: space.chatSpaceId,
      label: space.spaceName,
      shortcutKey: String.fromCharCode(65 + index),
    })),
  )

  // The subscribe/unsubscribe call, shared by the button and the picker's retry. Callers own the busy guard.
  async function performNotifyToggle(runId: string): Promise<void> {
    if (notifySubscribed.value) {
      await reconciliationFacade.unsubscribeRunNotification({ reconciliationRunResultId: runId })
    } else {
      try {
        await reconciliationFacade.subscribeRunNotification({ reconciliationRunResultId: runId })
      } catch (error) {
        if (readNeedsDefaultChatSpace(error)) {
          await openNotifyPicker()
          return
        }
        throw error
      }
    }
    await deps.refreshRunStatus(runId)
  }

  async function toggleNotifyMe(): Promise<void> {
    const runId = deps.runId.value
    if (!runId || notifyBusy.value) return

    notifyBusy.value = true
    notifyError.value = null
    try {
      await performNotifyToggle(runId)
    } catch (error) {
      notifyError.value = error instanceof ApiCallError ? error.message : 'The notification subscription missed the memo. Not updated.'
    } finally {
      notifyBusy.value = false
    }
  }

  async function openNotifyPicker(): Promise<void> {
    notifyPickerOpen.value = true
    notifyPickerSpaces.value = []
    notifyPickerLoading.value = true
    try {
      const response = await settingsFacade.listTenantChatSpaces()
      notifyPickerSpaces.value = (response.chatSpaces ?? []).filter((space) => space.isActive !== 'N')
    } catch (error) {
      notifyPickerOpen.value = false
      notifyError.value = error instanceof ApiCallError ? error.message : 'The chat spaces drifted into outer space.'
    } finally {
      notifyPickerLoading.value = false
    }
  }

  function closeNotifyPicker(): void {
    notifyPickerOpen.value = false
    notifyPickerSpaces.value = []
  }

  async function pickDefaultAndSubscribe(chatSpaceId: string): Promise<void> {
    const runId = deps.runId.value
    if (!runId || notifyPickerBusy.value) return

    notifyPickerBusy.value = true
    notifyError.value = null
    try {
      await settingsFacade.saveUserNotificationDefault({ chatSpaceId })
      closeNotifyPicker()
      await performNotifyToggle(runId)
    } catch (error) {
      notifyError.value = error instanceof ApiCallError ? error.message : 'The notification default did not get the memo. Not saved.'
    } finally {
      notifyPickerBusy.value = false
    }
  }

  return {
    showNotifyMe,
    notifySubscribed,
    notifyButtonLabel,
    notifyBusy,
    notifyError,
    notifyPickerOpen,
    notifyPickerLoading,
    notifyPickerSpaces,
    notifyPickerOptions,
    toggleNotifyMe,
    closeNotifyPicker,
    pickDefaultAndSubscribe,
  }
}
