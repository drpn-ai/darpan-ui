import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref } from 'vue'

vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: {
    saveSavedRunName: vi.fn(),
  },
}))

import { useRunResultName } from '../useRunResultName'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'

const saveSavedRunName = vi.mocked(reconciliationFacade.saveSavedRunName)

function buildRunName(overrides: { savedRunId?: string; canEdit?: boolean } = {}) {
  const loadError = ref<string | null>(null)
  const runName = useRunResultName({
    savedRunId: computed(() => overrides.savedRunId ?? 'RS_ORDER_CSV'),
    fallbackRunName: computed(() => 'Selected Run'),
    canEditTenantSettings: computed(() => overrides.canEdit ?? true),
    setLoadError: (message) => {
      loadError.value = message
    },
  })
  return { runName, loadError }
}

describe('useRunResultName', () => {
  beforeEach(() => {
    saveSavedRunName.mockReset()
  })

  it('saves a new run name and tracks it as persisted', async () => {
    saveSavedRunName.mockResolvedValue({
      savedRun: { savedRunId: 'RS_ORDER_CSV', runName: 'Renamed Run' },
    } as never)
    const { runName, loadError } = buildRunName()
    runName.persistedRunName.value = 'Old Run'
    runName.editableRunName.value = 'Old Run'

    await runName.saveRunName('Renamed Run')

    expect(saveSavedRunName).toHaveBeenCalledWith({ savedRunId: 'RS_ORDER_CSV', runName: 'Renamed Run' })
    expect(runName.editableRunName.value).toBe('Renamed Run')
    expect(runName.persistedRunName.value).toBe('Renamed Run')
    expect(runName.savingRunName.value).toBe(false)
    expect(loadError.value).toBeNull()
  })

  it('reverts to the previous name when the user cannot edit tenant settings', async () => {
    const { runName } = buildRunName({ canEdit: false })
    runName.persistedRunName.value = 'Original'
    runName.editableRunName.value = 'Edited'

    await runName.saveRunName('Edited')

    expect(saveSavedRunName).not.toHaveBeenCalled()
    expect(runName.editableRunName.value).toBe('Original')
  })

  it('reverts an empty name and skips unchanged names', async () => {
    const { runName } = buildRunName()
    runName.persistedRunName.value = 'Original'

    await runName.saveRunName('   ')
    expect(runName.editableRunName.value).toBe('Original')

    await runName.saveRunName('Original')
    expect(saveSavedRunName).not.toHaveBeenCalled()
  })

  it('does nothing without a saved run id', async () => {
    const { runName } = buildRunName({ savedRunId: '' })

    await runName.saveRunName('New Name')

    expect(saveSavedRunName).not.toHaveBeenCalled()
  })

  it('restores the previous name and surfaces the error message on failure', async () => {
    saveSavedRunName.mockRejectedValue(new ApiCallError('Rename rejected', 500))
    const { runName, loadError } = buildRunName()
    runName.persistedRunName.value = 'Original'
    runName.editableRunName.value = 'New Name'

    await runName.saveRunName('New Name')

    expect(runName.editableRunName.value).toBe('Original')
    expect(runName.savingRunName.value).toBe(false)
    expect(loadError.value).toBe('Rename rejected')
  })

  it('resetRunNameState restores the fallback name', () => {
    const { runName } = buildRunName()
    runName.editableRunName.value = 'Something else'
    runName.persistedRunName.value = 'Something else'
    runName.savingRunName.value = true

    runName.resetRunNameState()

    expect(runName.editableRunName.value).toBe('Selected Run')
    expect(runName.persistedRunName.value).toBe('Selected Run')
    expect(runName.savingRunName.value).toBe(false)
  })
})
