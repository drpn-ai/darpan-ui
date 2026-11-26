import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import type { RunSubmissionOutcome } from '../../../stores/runSubmissions'

// DAR-UI-156 (Aditi: "the transition from submission to the run detail page is 1-3 seconds, when it should be
// immediate"). The page Run, Retry and Run now open on the click: it draws at once, moves to the live run when the run
// exists (its first status already read), follows a run that finished first, and shows a refusal with a way back.

const route = vi.hoisted(() => ({
  params: { savedRunId: 'RS_1', pendingRunId: 'P1' } as Record<string, string>,
  query: { runName: 'Orders', file1SystemLabel: 'HotWax', file2SystemLabel: 'Shopify' } as Record<string, string>,
}))
const replace = vi.hoisted(() => vi.fn(() => Promise.resolve()))
const getActiveRunResult = vi.hoisted(() => vi.fn())
const getReconciliationRunStatus = vi.hoisted(() => vi.fn())

// Reactive, as the router's is: leaving changes it before the page unmounts.
vi.mock('vue-router', async () => {
  const { reactive } = await import('vue')
  return {
    RouterLink: { props: ['to'], template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>' },
    useRoute: () => reactive(route),
    useRouter: () => ({ replace }),
  }
})
vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: { getActiveRunResult, getReconciliationRunStatus },
}))

import ReconciliationRunStartingPage from '../ReconciliationRunStartingPage.vue'
import { useRunSubmissionsStore } from '../../../stores/runSubmissions'
import { useRunResultsStore } from '../../../stores/runResults'
import { useMascotStore } from '../../../stores/mascot'

const context = { savedRunId: 'RS_1', runName: 'Orders', file1SystemLabel: 'HotWax', file2SystemLabel: 'Shopify' }
// DAR-UI-157: the run's short address; what this page knows goes in history state.
const LIVE = { name: 'reconciliation-run-live', params: { savedRunId: 'RS_1', runResultId: '103112' }, state: { runName: 'Orders', file1SystemLabel: 'HotWax', file2SystemLabel: 'Shopify' } }

function deferred<T>() {
  let resolve: (value: T) => void = () => {}
  const promise = new Promise<T>((r) => { resolve = r })
  return { promise, resolve }
}

function startSubmission(submit: () => Promise<RunSubmissionOutcome>, register: () => Promise<string>) {
  useRunSubmissionsStore().start({ pendingRunId: 'P1', context, backRoute: '/diff', backLabel: 'Back to setup', submit, register, reopen: () => {} })
}

/** Leaves as the router does: the route is the next page's by the time this one unmounts. */
function leave(w: { unmount: () => void }) {
  const at = route.params
  reactive(route).params = {}
  w.unmount()
  route.params = at
}

beforeEach(() => {
  replace.mockClear()
  getActiveRunResult.mockReset()
  getReconciliationRunStatus.mockReset()
  getReconciliationRunStatus.mockResolvedValue({ ok: true, statusEnumId: 'AUT_STAT_RUNNING', steps: [] })
})

describe('ReconciliationRunStartingPage', () => {
  it('draws the run and its steps at once, then opens the live run with its first status already read', async () => {
    const found = deferred<string>()
    startSubmission(() => new Promise(() => {}), () => found.promise)
    const w = mount(ReconciliationRunStartingPage)
    expect(w.get('[data-testid="run-starting-title"]').text()).toContain('Orders')
    expect(w.get('[data-testid="run-starting-state"]').text()).toBe('Starting…')
    const rows = w.get('[data-testid="run-starting-steps"]').findAll('li')
    expect(rows[0]!.text()).toContain('Starting')
    expect(rows[1]!.text()).toContain('Pending')
    expect(w.get('[data-testid="run-starting-hint"]').text()).toContain('come back later from')
    expect(replace).not.toHaveBeenCalled()

    found.resolve('103112')
    await flushPromises()
    expect(getReconciliationRunStatus).toHaveBeenCalledWith({ reconciliationRunResultId: '103112' })
    expect(useRunResultsStore().getRunStatus('103112')).toMatchObject({ statusEnumId: 'AUT_STAT_RUNNING' })
    expect(replace).toHaveBeenCalledWith(LIVE)
    // Done with once the page has gone.
    w.unmount()
    expect(useRunSubmissionsStore().get('P1')).toBeNull()
  })

  it('follows a run that finished before it was found to its result', async () => {
    startSubmission(async () => ({ route: '/result/R1' }), () => new Promise(() => {}))
    mount(ReconciliationRunStartingPage)
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/result/R1')
  })

  it('shows a refusal here with its details, a Retry that sends it again and the way back', async () => {
    let sent = 0
    startSubmission(async () => {
      sent += 1
      return sent === 1 ? { error: 'Schema validation failed', details: ['OMS: missing order_id'] } : new Promise(() => {})
    }, async () => '')
    const w = mount(ReconciliationRunStartingPage)
    await flushPromises()
    expect(w.get('[data-testid="run-starting-state"]').text()).toBe('Did not start.')
    expect(w.get('[data-testid="run-starting-error"]').text()).toBe('Schema validation failed')
    expect(w.get('[data-testid="run-starting-details"]').text()).toBe('OMS: missing order_id')
    expect(w.get('[data-testid="run-starting-steps"]').findAll('li')[0]!.text()).toContain('Failed')
    const back = w.get('[data-testid="run-starting-back"]')
    expect(back.text()).toBe('Back to setup')
    expect(back.attributes('data-to')).toBe('/diff')
    expect(replace).not.toHaveBeenCalled()

    await w.get('[data-testid="run-starting-retry"]').trigger('click')
    expect(sent).toBe(2)
    expect(w.get('[data-testid="run-starting-state"]').text()).toBe('Starting…')
    expect(w.find('[data-testid="run-starting-error"]').exists()).toBe(false)
  })

  // The router moves to the next page before this one unmounts: a refusal that lands after that is nowhere on screen,
  // so the mascot raises it; a run that went on after it needs nothing.
  it('hands a refusal that lands after leaving to the mascot, and drops a run that went on', async () => {
    const answer = deferred<RunSubmissionOutcome>()
    startSubmission(() => answer.promise, () => new Promise(() => {}))
    const w = mount(ReconciliationRunStartingPage)
    await flushPromises()
    leave(w)
    answer.resolve({ error: 'Schema validation failed' })
    await flushPromises()
    expect(useMascotStore().warnings[0]).toMatchObject({ id: 'run-start-P1', body: 'Schema validation failed' })

    const found = deferred<string>()
    startSubmission(() => new Promise(() => {}), () => found.promise)
    leave(mount(ReconciliationRunStartingPage))
    found.resolve('103112')
    await flushPromises()
    expect(useRunSubmissionsStore().get('P1')).toBeNull()
    expect(useMascotStore().warnings).toHaveLength(1)
  })

  // A request that dropped after the run may have started: Retry could run it twice, so the page offers run history.
  it('offers no Retry when the run may have started', async () => {
    startSubmission(async () => ({ lost: 'Darpan stepped out for chai.' }), async () => '')
    const w = mount(ReconciliationRunStartingPage)
    await flushPromises()
    expect(w.get('[data-testid="run-starting-error"]').text()).toBe('Darpan stepped out for chai.')
    expect(w.find('[data-testid="run-starting-retry"]').exists()).toBe(false)
    expect(w.find('[data-testid="run-starting-history"]').exists()).toBe(true)
  })

  // A reload, or a link: this tab holds no submission, so one look decides.
  it('on a reload opens the run if it is running, else says it is not', async () => {
    getActiveRunResult.mockResolvedValueOnce({ ok: true, reconciliationRunResultId: '103112' })
    mount(ReconciliationRunStartingPage)
    await flushPromises()
    expect(getActiveRunResult).toHaveBeenCalledWith({ savedRunId: 'RS_1' })
    expect(replace).toHaveBeenCalledWith(LIVE)

    replace.mockClear()
    getActiveRunResult.mockResolvedValueOnce({ ok: true })
    const w = mount(ReconciliationRunStartingPage)
    await flushPromises()
    expect(replace).not.toHaveBeenCalled()
    expect(w.get('[data-testid="run-starting-missing"]').text()).toContain('not running now')
    expect(w.get('[data-testid="run-starting-history"]').attributes('data-to')).toContain('reconciliation-run-history')
  })
})
