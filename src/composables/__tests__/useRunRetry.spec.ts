import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.hoisted(() => vi.fn())
vi.mock('vue-router', () => ({ useRouter: () => ({ push }) }))
vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: {
    runSavedRunDiff: vi.fn(),
    getActiveRunResult: vi.fn(),
  },
}))

import { useRunRetry } from '../useRunRetry'
import { ApiCallError } from '../../lib/api/client'
import { reconciliationFacade } from '../../lib/api/facade'

const runSavedRunDiff = vi.mocked(reconciliationFacade.runSavedRunDiff)
const getActiveRunResult = vi.mocked(reconciliationFacade.getActiveRunResult)

const context = {
  savedRunId: 'RS_PROD_ORDERS',
  runName: 'SM Prod Orders',
  file1SystemLabel: 'HotWax orders and payments',
  file2SystemLabel: 'Shopify',
}

describe('useRunRetry', () => {
  beforeEach(() => {
    push.mockReset()
    runSavedRunDiff.mockReset()
    getActiveRunResult.mockReset()
  })

  it('asks for a retry of the failed run and opens the new run live while it is still going', async () => {
    runSavedRunDiff.mockReturnValue(new Promise(() => undefined))
    getActiveRunResult.mockResolvedValue({ reconciliationRunResultId: '100767' } as never)

    const { retry, retrying, retryError } = useRunRetry()
    await retry(context, '100766')

    expect(runSavedRunDiff).toHaveBeenCalledWith({ savedRunId: 'RS_PROD_ORDERS', retryFromRunResultId: '100766' })
    expect(push).toHaveBeenCalledWith({
      name: 'reconciliation-run-live',
      params: { savedRunId: 'RS_PROD_ORDERS', runResultId: '100767' },
      query: { runName: 'SM Prod Orders', file1SystemLabel: 'HotWax orders and payments', file2SystemLabel: 'Shopify' },
    })
    expect(retrying.value).toBe(false)
    expect(retryError.value).toBeNull()
  })

  it('shows the refusal in words and stays on the failed run', async () => {
    runSavedRunDiff.mockResolvedValue({
      ok: false,
      errors: ['RS_PROD_ORDERS was edited after run 100766 started, so its extracts no longer answer the same question; run it again instead.'],
    } as never)
    getActiveRunResult.mockResolvedValue({} as never)

    const { retry, retryError } = useRunRetry()
    await retry(context, '100766')

    expect(push).not.toHaveBeenCalled()
    expect(retryError.value).toContain('was edited after run 100766 started')
  })

  it('opens a retry that finished before its run was seen', async () => {
    runSavedRunDiff.mockResolvedValue({ ok: true, runResult: { generatedOutput: { reconciliationRunResultId: '100768' } } } as never)
    getActiveRunResult.mockReturnValue(new Promise(() => undefined))

    const { retry } = useRunRetry()
    await retry(context, '100766')

    expect(push).toHaveBeenCalledWith(expect.objectContaining({ params: { savedRunId: 'RS_PROD_ORDERS', runResultId: '100768' } }))
  })

  it('reports a thrown call error', async () => {
    runSavedRunDiff.mockRejectedValue(new ApiCallError('Your active tenant only has view access for reconciliation runs.', 403))
    getActiveRunResult.mockReturnValue(new Promise(() => undefined))

    const { retry, retryError } = useRunRetry()
    await retry(context, '100766')

    expect(push).not.toHaveBeenCalled()
    expect(retryError.value).toBe('Your active tenant only has view access for reconciliation runs.')
  })
})
