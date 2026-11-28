import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, ref } from 'vue'
import { ApiCallError } from '../../lib/api/client'

const cancelReconciliationRun = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api/facade', () => ({ reconciliationFacade: { cancelReconciliationRun } }))

import type { GetReconciliationRunStatusResponse } from '../../lib/api/types'
import { useRunCancel } from '../useRunCancel'

function setup() {
  const liveRunResultId = ref('RR_1')
  const status = ref<GetReconciliationRunStatusResponse | null>({ ok: true, statusEnumId: 'AUT_STAT_RUNNING' } as GetReconciliationRunStatusResponse)
  const cancel = useRunCancel({
    liveRunResultId: computed(() => liveRunResultId.value),
    runStatus: computed(() => status.value),
    liveRunActive: computed(() => true),
    canRun: computed(() => true),
  })
  return { cancel, liveRunResultId, status }
}

describe('useRunCancel', () => {
  // Braced: a function returned from beforeEach is run as teardown, and mockReset returns the mock itself.
  beforeEach(() => { cancelReconciliationRun.mockReset() })

  it('sends one cancel however often it is confirmed while the first is under way', async () => {
    cancelReconciliationRun.mockReturnValue(new Promise(() => {}))
    const { cancel } = setup()
    void cancel.cancelRun()
    void cancel.cancelRun()
    expect(cancelReconciliationRun).toHaveBeenCalledTimes(1)
    expect(cancel.cancelRequested.value).toBe(true)
  })

  it('reads a cancel another viewer asked for from the run status', () => {
    const { cancel, status } = setup()
    status.value = { ...status.value!, cancelRequestedDate: 1784955159000 }
    expect(cancel.cancelRequested.value).toBe(true)
  })

  it('a refusal that lands after the page moved to another run says nothing on the new one', async () => {
    let refuse: (error: unknown) => void = () => {}
    cancelReconciliationRun.mockReturnValue(new Promise((_, reject) => { refuse = reject }))
    const { cancel, liveRunResultId } = setup()
    const sent = cancel.cancelRun()

    liveRunResultId.value = 'RR_2'
    await nextTick()
    refuse(new ApiCallError('Run already finished.'))
    await sent

    expect(cancel.cancelError.value).toBeNull()
    expect(cancel.cancelRequested.value).toBe(false)
  })

  it('a refusal on this run puts Cancel back with the reason', async () => {
    cancelReconciliationRun.mockRejectedValue(new ApiCallError('Run already finished.'))
    const { cancel } = setup()
    await cancel.cancelRun()
    expect(cancel.cancelError.value).toBe('Run already finished.')
    expect(cancel.cancelRequested.value).toBe(false)
  })
})
