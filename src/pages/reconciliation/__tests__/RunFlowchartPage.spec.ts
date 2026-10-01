import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', () => ({ useRoute: () => ({ params: { reconciliationId: 'R1' } }), useRouter: () => ({ push: vi.fn() }), RouterLink: { template: '<a><slot /></a>' } }))
vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    getReconciliation: vi.fn(), listSavedRuns: vi.fn(), saveReconciliationQuestion: vi.fn(),
    deleteReconciliationQuestion: vi.fn(), runReconciliation: vi.fn(), getReconciliationExecution: vi.fn(),
  },
}))

import { reconciliationFacade } from '../../../lib/api/facade'
import RunFlowchartPage from '../RunFlowchartPage.vue'

const f = vi.mocked(reconciliationFacade)
const run = { reconciliationId: 'R1', reconciliationName: 'Order chain', defaultTimeWindow: '3d' }
const questions = [
  { reconciliationRunId: 'S', ruleSetId: 'POP', questionRole: 'START' },
  { reconciliationRunId: 'A', ruleSetId: 'SHIP', parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Has a fulfillment?' },
]

beforeEach(() => {
  vi.useFakeTimers()
  Object.values(f).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  window.matchMedia = vi.fn().mockReturnValue({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })
  f.getReconciliation.mockResolvedValue({ reconciliation: run, questions } as never)
  f.listSavedRuns.mockResolvedValue({ savedRuns: [{ savedRunId: 'SHIP', runName: 'Has a fulfillment', requiresSystemSelection: false, systemOptions: [] }] } as never)
})
afterEach(() => vi.useRealTimers())

describe('RunFlowchartPage', () => {
  it('loads the run and draws its chart', async () => {
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.text()).toContain('Order chain')
    expect(w.find('[data-testid="flowchart-box-A"]').exists()).toBe(true)
  })

  it('a run with no start offers "Add question" and saves a question with no parent', async () => {
    f.getReconciliation.mockResolvedValue({ reconciliation: run, questions: [] } as never)
    f.saveReconciliationQuestion.mockResolvedValue({ question: { reconciliationRunId: 'Q1', ruleSetId: 'SHIP' } } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-add-top"]').trigger('click')
    w.findComponent({ name: 'FlowchartQuestionEditor' }).vm.$emit('save', { ruleSetId: 'SHIP', runName: 'Shipped?', noOutcomeLabel: '' })
    await flushPromises()
    const payload = f.saveReconciliationQuestion.mock.calls[0]![0]
    expect(payload).toMatchObject({ reconciliationId: 'R1', ruleSetId: 'SHIP' })
    expect(payload).not.toHaveProperty('parentReconciliationRunId')
  })

  it('a run with a start hides "Add question"', async () => {
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.find('[data-testid="flowchart-add-top"]').exists()).toBe(false)
  })

  it('+ next question opens an editor for a yes child and saves it with its parent', async () => {
    f.saveReconciliationQuestion.mockResolvedValue({ question: { reconciliationRunId: 'B', ruleSetId: 'SHIP' } } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-add-next-A"]').trigger('click')
    expect(w.text()).toContain('After yes on: Has a fulfillment?')
    w.findComponent({ name: 'FlowchartQuestionEditor' }).vm.$emit('save', { ruleSetId: 'SHIP', runName: 'Has an invoice?', noOutcomeLabel: 'Never billed' })
    await flushPromises()
    expect(f.saveReconciliationQuestion).toHaveBeenCalledWith(expect.objectContaining({
      reconciliationId: 'R1', ruleSetId: 'SHIP', parentReconciliationRunId: 'A', parentBranch: 'YES',
      runName: 'Has an invoice?', noOutcomeLabel: 'Never billed',
    }))
    expect(f.getReconciliation).toHaveBeenCalledTimes(2)
  })

  it('a refused save shows the reason and keeps the editor open', async () => {
    f.saveReconciliationQuestion.mockRejectedValue(new Error('Question B builds its key differently.'))
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-add-why-A"]').trigger('click')
    w.findComponent({ name: 'FlowchartQuestionEditor' }).vm.$emit('save', { ruleSetId: 'SHIP', runName: '', noOutcomeLabel: '' })
    await flushPromises()
    expect(w.text()).toContain('builds its key differently')
    expect(w.find('[data-testid="flowchart-editor"]').exists()).toBe(true)
  })

  it('a refused delete leaves the chart as it was', async () => {
    f.deleteReconciliationQuestion.mockRejectedValue(new Error('Remove the questions under it first.'))
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-box-A"]').trigger('click')
    w.findComponent({ name: 'FlowchartQuestionEditor' }).vm.$emit('delete')
    await flushPromises()
    expect(w.text()).toContain('Remove the questions under it first.')
    expect(w.find('[data-testid="flowchart-box-A"]').exists()).toBe(true)
  })

  it('runs over the default window and polls until every question has finished', async () => {
    f.runReconciliation.mockResolvedValue({ reconciliationExecutionId: 'E1' } as never)
    f.getReconciliationExecution
      .mockResolvedValueOnce({ results: [{ reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_RUNNING' }] } as never)
      .mockResolvedValue({ results: [
        { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 10 },
        { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 9, noCount: 1 },
      ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-run-button"]').trigger('click')
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({ reconciliationId: 'R1', windowStartLocalDate: expect.any(String) }))
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.get('[data-testid="flowchart-state-A"]').text()).toContain('Done')
    expect(w.get('[data-testid="flowchart-live-link-A"]').text()).toContain('yes 9 · no 1')
    const calls = f.getReconciliationExecution.mock.calls.length
    await vi.advanceTimersByTimeAsync(9000)
    expect(f.getReconciliationExecution.mock.calls.length).toBe(calls)
  })

  it('the window note names the last day covered; the run ends the day after it (review I3)', async () => {
    vi.setSystemTime(new Date(2026, 7, 17, 12))
    f.runReconciliation.mockResolvedValue({ reconciliationExecutionId: 'E1' } as never)
    f.getReconciliationExecution.mockResolvedValue({ results: [] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.get('[data-testid="flowchart-window-dates"]').text()).toBe('Aug 14, 2026 – Aug 16, 2026')
    await w.get('[data-testid="flowchart-run-button"]').trigger('click')
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({ windowStartLocalDate: '2026-08-14', windowEndLocalDate: '2026-08-17' }))
    w.unmount()
  })

  it('a double click starts one walk (review I4)', async () => {
    let resolve: (v: unknown) => void = () => {}
    f.runReconciliation.mockReturnValue(new Promise((r) => { resolve = r }) as never)
    f.getReconciliationExecution.mockResolvedValue({ results: [] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-run-button"]').trigger('click')
    await w.get('[data-testid="flowchart-run-button"]').trigger('click')
    resolve({ reconciliationExecutionId: 'E1' })
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  it('leaving the page while Run is in flight never starts polling (review I4)', async () => {
    let resolve: (v: unknown) => void = () => {}
    f.runReconciliation.mockReturnValue(new Promise((r) => { resolve = r }) as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-run-button"]').trigger('click')
    w.unmount()
    resolve({ reconciliationExecutionId: 'E1' })
    await flushPromises()
    await vi.advanceTimersByTimeAsync(10000)
    expect(f.getReconciliationExecution).not.toHaveBeenCalled()
  })

  it('the start cannot be deleted (review I5)', async () => {
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-box-S"]').trigger('click')
    expect(w.find('[data-testid="flowchart-editor-delete"]').exists()).toBe(false)
  })

  it('every question with a row links to its run, finished ones too (review I6)', async () => {
    f.runReconciliation.mockResolvedValue({ reconciliationExecutionId: 'E1' } as never)
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 2 },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_FAILED', errorMessage: 'boom' },
    ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-run-button"]').trigger('click')
    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.find('[data-testid="flowchart-live-link-S"]').exists()).toBe(true)
    expect(w.find('[data-testid="flowchart-live-link-A"]').exists()).toBe(true)
  })
})
