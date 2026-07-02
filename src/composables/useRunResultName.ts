import { ref, type ComputedRef, type Ref } from 'vue'
import { ApiCallError } from '../lib/api/client'
import { reconciliationFacade } from '../lib/api/facade'

export interface UseRunResultNameDeps {
  savedRunId: ComputedRef<string>
  fallbackRunName: ComputedRef<string>
  canEditTenantSettings: ComputedRef<boolean>
  setLoadError: (message: string | null) => void
}

export interface UseRunResultName {
  editableRunName: Ref<string>
  persistedRunName: Ref<string>
  savingRunName: Ref<boolean>
  saveRunName: (nextRunName: string) => Promise<void>
  resetRunNameState: () => void
}

export function useRunResultName(deps: UseRunResultNameDeps): UseRunResultName {
  const editableRunName = ref('')
  const persistedRunName = ref('')
  const savingRunName = ref(false)

  async function saveRunName(nextRunName: string): Promise<void> {
    const normalizedRunName = nextRunName.trim()
    const previousRunName = persistedRunName.value || deps.fallbackRunName.value
    if (!deps.canEditTenantSettings.value) {
      editableRunName.value = previousRunName
      return
    }
    if (!deps.savedRunId.value) return
    if (!normalizedRunName) {
      editableRunName.value = previousRunName
      return
    }
    if (normalizedRunName === previousRunName || savingRunName.value) return

    savingRunName.value = true
    deps.setLoadError(null)

    try {
      const response = await reconciliationFacade.saveSavedRunName({
        savedRunId: deps.savedRunId.value,
        runName: normalizedRunName,
      })
      const savedRunName = response.savedRun?.runName || normalizedRunName
      editableRunName.value = savedRunName
      persistedRunName.value = savedRunName
    } catch (error) {
      editableRunName.value = previousRunName
      deps.setLoadError(error instanceof ApiCallError ? error.message : 'Unable to save run name.')
    } finally {
      savingRunName.value = false
    }
  }

  function resetRunNameState(): void {
    editableRunName.value = deps.fallbackRunName.value
    persistedRunName.value = deps.fallbackRunName.value
    savingRunName.value = false
  }

  return {
    editableRunName,
    persistedRunName,
    savingRunName,
    saveRunName,
    resetRunNameState,
  }
}
