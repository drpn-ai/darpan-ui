import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

const push = vi.hoisted(() => vi.fn(() => Promise.resolve()))
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
import { useRunSubmissionsStore } from '../../stores/runSubmissions'

const runSavedRunDiff = vi.mocked(reconciliationFacade.runSavedRunDiff)
const getActiveRunResult = vi.mocked(reconciliationFacade.getActiveRunResult)

const context = {
  savedRunId: 'RS_PROD_ORDERS',
  runName: 'SM Prod Orders',
  file1SystemLabel: 'HotWax orders and payments',
  file2SystemLabel: 'Shopify',
}
const QUERY = { runName: 'SM Prod Orders', file1SystemLabel: 'HotWax orders and payments', file2SystemLabel: 'Shopify' }

/** The one submission Retry started, and the Starting page it opened. */
function started() {
  const [[to]] = push.mock.calls as unknown as [[{ name: string; params: { pendingRunId: string } }]]
  return { to, submission: useRunSubmissionsStore().get(to.params.pendingRunId) }
}

describe('useRunRetry', () => {
  beforeEach(() => {
    push.mockClear()
    runSavedRunDiff.mockReset()
    getActiveRunResult.mockReset()
  })

  // DAR-UI-156: the Starting page opens on the click, before the retry call or the look for its run answers.
  it('opens the Starting page at once and asks for a retry of the failed run', async () => {
    runSavedRunDiff.mockReturnValue(new Promise(() => undefined))
    getActiveRunResult.mockReturnValue(new Promise(() => undefined))

    const { retry, retrying } = useRunRetry()
    await retry(context, '100766')

    expect(runSavedRunDiff).toHaveBeenCalledWith({ savedRunId: 'RS_PROD_ORDERS', retryFromRunResultId: '100766' })
    const { to, submission } = started()
    expect(to).toMatchObject({ name: 'reconciliation-run-starting', params: { savedRunId: 'RS_PROD_ORDERS' }, query: QUERY })
    expect(submission?.state).toEqual({ phase: 'starting' })
    expect(submission?.input.backLabel).toBe('Back to the failed run')
    expect(submission?.input.backRoute).toMatchObject({ name: 'reconciliation-run-live', params: { runResultId: '100766' } })
    expect(retrying.value).toBe(false)
  })

  it('goes live once the new run is found', async () => {
    runSavedRunDiff.mockReturnValue(new Promise(() => undefined))
    getActiveRunResult.mockResolvedValue({ reconciliationRunResultId: '100767' } as never)
    const { retry } = useRunRetry()
    await retry(context, '100766')
    await flushPromises()
    expect(started().submission?.state).toEqual({ phase: 'live', runResultId: '100767' })
  })

  it('holds the refusal in words for the Starting page', async () => {
    runSavedRunDiff.mockResolvedValue({
      ok: false,
      errors: ['RS_PROD_ORDERS was edited after run 100766 started, so its extracts no longer answer the same question; run it again instead.'],
    } as never)
    getActiveRunResult.mockResolvedValue({} as never)
    const { retry } = useRunRetry()
    await retry(context, '100766')
    await flushPromises()
    expect(started().submission?.state).toMatchObject({ phase: 'failed', error: expect.stringContaining('was edited after run 100766 started') })
  })

  it('leads a retry that finished before its run was seen to that run', async () => {
    runSavedRunDiff.mockResolvedValue({ ok: true, runResult: { generatedOutput: { reconciliationRunResultId: '100768' } } } as never)
    getActiveRunResult.mockReturnValue(new Promise(() => undefined))
    const { retry } = useRunRetry()
    await retry(context, '100766')
    await flushPromises()
    expect(started().submission?.state).toMatchObject({ phase: 'done', route: { params: { savedRunId: 'RS_PROD_ORDERS', runResultId: '100768' } } })
  })

  it('holds a thrown call error', async () => {
    runSavedRunDiff.mockRejectedValue(new ApiCallError('Your active tenant only has view access for reconciliation runs.', 403))
    getActiveRunResult.mockReturnValue(new Promise(() => undefined))
    const { retry } = useRunRetry()
    await retry(context, '100766')
    await flushPromises()
    expect(started().submission?.state).toEqual({ phase: 'failed', error: 'Your active tenant only has view access for reconciliation runs.', details: [], retryable: true })
  })
})
