import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { routeParams, push, replace } = vi.hoisted(() => ({
  routeParams: { reconciliationId: 'R1' } as Record<string, string | undefined>,
  push: vi.fn(),
  replace: vi.fn(),
}))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: routeParams }), useRouter: () => ({ push, replace }), RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } }))
vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: { listNsAuthConfigs: vi.fn(async () => ({ authConfigs: [{ nsAuthConfigId: 'net_prod', description: 'Gorjana NetSuite' }, { nsAuthConfigId: 'gorjana_prod', description: 'Gorjana NetSuite (sandbox copy)' }] })) },
  reconciliationFacade: {
    getReconciliation: vi.fn(), listSavedRuns: vi.fn(), saveReconciliationQuestion: vi.fn(), saveReconciliation: vi.fn(),
    deleteReconciliationQuestion: vi.fn(), runReconciliation: vi.fn(), getReconciliationExecution: vi.fn(),
    listReconciliationExecutions: vi.fn(), getLifecycleRuleOptions: vi.fn(), saveLifecycleRule: vi.fn(), deleteLifecycleRule: vi.fn(),
  },
}))

import { reconciliationFacade, settingsFacade } from '../../../lib/api/facade'
import RunFlowchartPage from '../RunFlowchartPage.vue'
import { clearStoredReads, invalidateReadCache, setReadCacheScope } from '../../../lib/api/readCache'
import { installLocalStorageStub } from '../../../test/localStorage'

const f = vi.mocked(reconciliationFacade)
const run = { reconciliationId: 'R1', reconciliationName: 'Order chain', defaultTimeWindow: '3d' }
const questions = [
  { reconciliationRunId: 'S', ruleSetId: 'POP', questionRole: 'START' },
  { reconciliationRunId: 'A', ruleSetId: 'SHIP', parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Has a fulfillment?' },
]

beforeEach(() => {
  invalidateReadCache()
  vi.useFakeTimers()
  Object.values(f).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  push.mockReset()
  replace.mockReset()
  delete routeParams.reconciliationExecutionId
  f.listReconciliationExecutions.mockResolvedValue({ executions: [] } as never)
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

  // DAR-UI-049
  it('says it is a Lifecycle run; its own page keeps play, not back, as a Sync run\'s does', async () => {
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.get('[data-testid="run-type-lifecycle"]').text()).toBe('Lifecycle · 1 question')
    expect(w.find('[data-testid="flowchart-back"]').exists()).toBe(false)
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

  // DAR-UI-050
  describe('a lifecycle built from stages', () => {
    const stagesRun = { ...run, reconciliationName: 'Sales Orders', buildMode: 'STAGES', lateAfterDays: 2 }
    const stageQuestions = [
      { reconciliationRunId: 'S', ruleSetId: 'R0', questionRole: 'START', runName: 'Sales orders' },
      { reconciliationRunId: 'A', ruleSetId: 'R1', parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Fulfillment' },
      { reconciliationRunId: 'B', ruleSetId: 'R2', parentReconciliationRunId: 'A', parentBranch: 'YES', runName: 'Invoice',
        noOutcomeLabel: 'Shipped, never billed', yesOutcomeLabel: 'Shipped and billed' },
      { reconciliationRunId: 'W', ruleSetId: 'R3', parentReconciliationRunId: 'A', parentBranch: 'NO', runName: 'Invoice',
        yesOutcomeLabel: 'Billed, never shipped', noOutcomeLabel: 'Never shipped, never billed' },
    ]
    beforeEach(() => { f.getReconciliation.mockResolvedValue({ reconciliation: stagesRun, questions: stageQuestions } as never) })

    // DAR-UI-050: rules are set up in the lifecycle's settings, beside play, as a Sync run's are; not on this page.
    it('keeps rules off the page and links to its settings', async () => {
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(w.find('[data-testid="lifecycle-rules"]').exists()).toBe(false)
      expect(JSON.parse(w.get('[data-testid="flowchart-settings"]').attributes('data-to') ?? '{}')).toEqual(
        { name: 'reconciliation-run-flowchart-settings', params: { reconciliationId: 'R1' } })
    })

    it("a run's result shows where records stopped instead of the question chart", async () => {
      routeParams.reconciliationExecutionId = 'E7'
      f.getReconciliationExecution.mockResolvedValue({ results: [] } as never)
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(w.find('[data-testid="lifecycle-board"]').exists()).toBe(true)
      expect(w.find('[data-testid="flowchart-box-A"]').exists()).toBe(false)
      expect(w.text()).toContain('Billed, never shipped')
      expect(w.get('[data-testid="run-type-lifecycle"]').text()).toBe('Lifecycle · 2 stages')
    })

    // How it works sits on the lifecycle's own page, read only; changing it is the gear's job.
    it("the lifecycle's own page shows how it works, read only", async () => {
      f.getReconciliation.mockResolvedValue({ reconciliation: stagesRun, questions: stageQuestions,
        lifecycle: { nsAuthConfigId: 'net_prod', recordType: 'SalesOrd', recordLabel: 'Sales orders' },
        rules: [{ fieldId: 'status', fieldLabel: 'Status', value: 'Sales Order : Closed', valueLabel: 'Closed' }],
        stages: [{ recordType: 'ItemShip', label: 'Fulfillment' }, { recordType: 'CustInvc', label: 'Invoice' }],
        exceptions: [{ stageRecordType: 'ItemShip', stageLabel: 'Fulfillment', fieldId: 'shipmethod', fieldLabel: 'Shipping Method', value: 'Store Pickup' }],
      } as never)
      const w = mount(RunFlowchartPage)
      await flushPromises()
      const outline = w.get('[data-testid="lifecycle-outline"]').text()
      // The account by its description, never its id.
      expect(outline).not.toContain('net_prod')
      for (const part of ['Sales orders', 'Gorjana NetSuite', 'except Status is Closed', 'judged after 2 days', 'Fulfillment',
        'not expected for Shipping Method is Store Pickup', 'Invoice']) expect(outline).toContain(part)
      expect(outline.indexOf('Fulfillment')).toBeLessThan(outline.indexOf('Invoice'))
      // Each place is drawn under the stage it is concluded at, a Finding or quietly not.
      const findings = w.findAll('[data-testid="lifecycle-outline-finding"]')
      expect(findings.map((p) => p.find('span').text())).toEqual([
        'stops at Billed, never shipped', 'stops at Never shipped, never billed', 'stops at Shipped, never billed'])
      expect(findings.every((p) => p.find('.status-badge').text() === 'Finding')).toBe(true)
      expect(w.get('[data-testid="lifecycle-outline-complete"]').text()).toBe('Shipped and billed')
      expect(w.find('[data-testid="lifecycle-outline"] button, [data-testid="lifecycle-outline"] select').exists()).toBe(false)
      expect(w.find('[data-testid="flowchart-settings"]').exists()).toBe(true)
    })

    // Findings are the records at the places that are findings; the others still show, marked, and say they are not.
    it('counts only the places that are findings', async () => {
      f.getReconciliation.mockResolvedValue({ reconciliation: { ...stagesRun, notFindingPlaces: JSON.stringify(['Billed, never shipped']) },
        questions: stageQuestions, lifecycle: { nsAuthConfigId: 'net_prod', recordType: 'SalesOrd', recordLabel: 'Sales orders' },
        rules: [], stages: [], exceptions: [] } as never)
      routeParams.reconciliationExecutionId = 'E7'
      f.getReconciliationExecution.mockResolvedValue({ results: [
        { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 100 },
        { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 90, noCount: 10 },
        { reconciliationRunResultId: '3', reconciliationRunId: 'B', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 85, noCount: 5 },
        { reconciliationRunResultId: '4', reconciliationRunId: 'W', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 4, noCount: 6 },
      ] } as never)
      const w = mount(RunFlowchartPage)
      await flushPromises()
      // Shipped, never billed 5 + Never shipped, never billed 6; Billed, never shipped (4) is not a finding.
      expect(w.get('[data-testid="flowchart-summary-findings"]').text()).toBe('11')
      expect(w.findAll('[data-testid="lifecycle-place-not-finding"]')).toHaveLength(1)
    })

    // A run's result shows results alone: back, and nothing that changes or starts the run.
    it("a run's result has only back", async () => {
      routeParams.reconciliationExecutionId = 'E7'
      f.getReconciliationExecution.mockResolvedValue({ results: [] } as never)
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(w.findAll('.action-row > *').map((a) => a.attributes('data-testid'))).toEqual(['flowchart-back'])
      expect(w.find('[data-testid="lifecycle-outline"]').exists()).toBe(false)
    })

    it("the lifecycle's own page is its history, with no result board", async () => {
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(w.find('[data-testid="lifecycle-board"]').exists()).toBe(false)
      expect(w.find('[data-testid="flowchart-history-empty"]').exists()).toBe(true)
      expect(w.find('[data-testid="flowchart-box-A"]').exists()).toBe(false)
    })
  })

  it('the start cannot be deleted (review I5)', async () => {
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-box-S"]').trigger('click')
    expect(w.find('[data-testid="flowchart-editor-delete"]').exists()).toBe(false)
  })

  it('every question with a row links to its run, finished ones too (review I6)', async () => {
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 2 },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_FAILED', errorMessage: 'boom' },
    ] } as never)
    routeParams.reconciliationExecutionId = 'E1'
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.find('[data-testid="flowchart-live-link-S"]').exists()).toBe(true)
    expect(w.find('[data-testid="flowchart-live-link-A"]').exists()).toBe(true)
  })

  it('opens a past run from the route and shows its summary', async () => {
    routeParams.reconciliationExecutionId = 'E7'
    f.listReconciliationExecutions.mockResolvedValue({ executions: [{ reconciliationExecutionId: 'E7', statusEnumId: 'AUT_STAT_SUCCESS', startedDate: '2026-08-17T10:00:00Z' }] } as never)
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 10, noCount: 0, resultDataManagerPath: 'runs/s.json' },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 7, noCount: 3, resultDataManagerPath: 'runs/a.json' },
    ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(f.getReconciliationExecution).toHaveBeenCalledWith({ reconciliationExecutionId: 'E7' })
    expect(w.get('[data-testid="flowchart-summary-status"]').text()).toContain('Done')
    expect(w.get('[data-testid="flowchart-summary-findings"]').text()).toContain('3')
    // As the run result page: when it started under the title, and This Run above the results.
    expect(w.get('[data-testid="flowchart-shown-started"]').text()).not.toBe('')
    const html = w.html()
    expect(html.indexOf('flowchart-summary-status')).toBeLessThan(html.indexOf('flowchart-box-A'))
    // A run's result shows that run alone; its history is on the run's own page, where back leads.
    expect(w.find('[data-testid="flowchart-history"]').exists()).toBe(false)
    expect(JSON.parse(w.get('[data-testid="flowchart-back"]').attributes('data-to') ?? '{}')).toEqual(
      { name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1' } })
  })

  it("the run's own page is its results as tiles, as a Sync run's: most recent, then the ones before", async () => {
    const at = (id: string, day: number, statusEnumId = 'AUT_STAT_SUCCESS') =>
      ({ reconciliationExecutionId: id, statusEnumId, startedDate: `2026-08-${day}T10:00:00Z`, windowStartDate: '2026-08-10T00:00:00Z', windowEndDate: '2026-08-13T00:00:00Z' })
    f.listReconciliationExecutions.mockResolvedValue({ executions: [
      at('E9', 19, 'AUT_STAT_RUNNING'), at('E8', 18), at('E7', 17, 'AUT_STAT_FAILED'),
      ...[16, 15, 14, 13, 12, 11, 10].map((d) => at(`E${d}`, d)),
    ] } as never)
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 10, noCount: 0 },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 7, noCount: 3 },
    ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.get('[data-testid="flowchart-history-running"]').text()).toContain('Running')
    // The newest settled run is the featured tile, its whole box one link to its result, with its figures.
    const featured = w.get('[data-testid="flowchart-history-featured"]')
    expect(JSON.parse(featured.attributes('data-to') ?? '{}')).toEqual(
      { name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1', reconciliationExecutionId: 'E8' } })
    expect(featured.text()).toContain('Findings')
    expect(featured.text()).toContain('3')
    expect(featured.text()).toContain('Days')
    // The ones before are tiles too, six at a time; a failed one says so.
    const previous = () => w.get('[data-testid="flowchart-history"]').findAll('[data-testid^="flowchart-history-tile-"]')
    expect(previous().map((t) => t.attributes('data-testid'))).toEqual(
      ['E7', 'E16', 'E15', 'E14', 'E13', 'E12'].map((id) => `flowchart-history-tile-${id}`))
    expect(previous()[0]!.text()).toContain('Failed')
    await w.get('[data-testid="flowchart-history-more"]').trigger('click')
    expect(previous()).toHaveLength(8)
    expect(w.find('[data-testid="flowchart-history-more"]').exists()).toBe(false)
  })

  // A run's own page deletes it as an automation's does: archived, off Home, its results kept.
  it('deletes the run after asking, and goes Home', async () => {
    f.saveReconciliation.mockResolvedValue({ reconciliation: run } as never)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    try {
      const w = mount(RunFlowchartPage)
      await flushPromises()
      await w.get('[data-testid="flowchart-delete"]').trigger('click')
      expect(f.saveReconciliation).not.toHaveBeenCalled()
      await w.get('[data-testid="flowchart-delete"]').trigger('click')
      await flushPromises()
      expect(confirm).toHaveBeenLastCalledWith('Delete run "Order chain"?')
      expect(f.saveReconciliation).toHaveBeenCalledWith({ reconciliationId: 'R1', isArchived: 'Y', isActive: 'N' })
      expect(push).toHaveBeenCalledWith({ name: 'hub' })
    } finally {
      confirm.mockRestore()
    }
  })

  it("a run's result offers no delete", async () => {
    routeParams.reconciliationExecutionId = 'E7'
    f.getReconciliationExecution.mockResolvedValue({ results: [] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.find('[data-testid="flowchart-delete"]').exists()).toBe(false)
  })

  // DAR-UI-050: the window is chosen when the run starts, in a workflow, as a Sync run's is.
  it('keeps no window on the page; play opens the run workflow', async () => {
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.find('[data-testid="flowchart-window-preset"]').exists()).toBe(false)
    expect(JSON.parse(w.get('[data-testid="flowchart-run-button"]').attributes('data-to') ?? '{}')).toEqual(
      { name: 'reconciliation-run-flowchart-start', params: { reconciliationId: 'R1' } })
    expect(w.get('[data-testid="flowchart-history-empty"]').text()).toBe('Not run yet.')
  })

  it('a finished finding opens its result page', async () => {
    routeParams.reconciliationExecutionId = 'E7'
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 10, noCount: 0 },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 7, noCount: 3, resultDataManagerPath: 'runs/a.json' },
    ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await w.get('[data-testid="flowchart-finding-A"]').trigger('click')
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ name: 'reconciliation-run-result', params: expect.objectContaining({ outputFileName: 'runs/a.json' }) }))
    // The result page leads back to this run, not to the check behind the place.
    expect(push).toHaveBeenCalledWith(expect.objectContaining({ query: expect.objectContaining({ fromLifecycle: 'R1', fromLifecycleRun: 'E7' }) }))
    const tile = JSON.parse(w.get('[data-testid="flowchart-live-link-A"]').attributes('data-to') ?? '{}')
    expect(tile.name).toBe('reconciliation-run-result')
  })

  it('an execution still running is followed until every question has finished', async () => {
    routeParams.reconciliationExecutionId = 'E8'
    f.getReconciliationExecution
      .mockResolvedValueOnce({ results: [{ reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_RUNNING' }] } as never)
      .mockResolvedValue({ results: [
        { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 1 },
        { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 1, noCount: 0 },
      ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.get('[data-testid="flowchart-summary-status"]').text()).toContain('Running')
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.get('[data-testid="flowchart-state-A"]').text()).toContain('Done')
    expect(w.get('[data-testid="flowchart-summary-status"]').text()).toContain('Done')
    const calls = f.getReconciliationExecution.mock.calls.length
    await vi.advanceTimersByTimeAsync(9000)
    expect(f.getReconciliationExecution.mock.calls.length).toBe(calls)
    w.unmount()
  })

  // DAR-UI-050: a run the run workflow just started is followed until every question is done, even between
  // questions, when every row so far has finished and the next question's row does not exist yet.
  it('a run just started by the run workflow is followed past the gap between questions', async () => {
    routeParams.reconciliationExecutionId = 'E5'
    window.history.replaceState({ startedRun: 'E5' }, '')
    f.getReconciliationExecution
      .mockResolvedValueOnce({ results: [{ reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 4 }] } as never)
      .mockResolvedValueOnce({ results: [{ reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 4 }] } as never)
      .mockResolvedValue({ results: [
        { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 4 },
        { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 3, noCount: 1 },
      ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(3000)
    await vi.advanceTimersByTimeAsync(3000)
    expect(w.get('[data-testid="flowchart-state-A"]').text()).toContain('Done')
    expect(f.listReconciliationExecutions.mock.calls.length).toBeGreaterThan(1)
    window.history.replaceState(null, '')
    w.unmount()
  })

  it('a failed run says why in This Run', async () => {
    routeParams.reconciliationExecutionId = 'E4'
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_FAILED', errorMessage: 'internalId cannot be resolved' },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_NOT_RUN', errorMessage: 'parent failed' },
    ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.findAll('[data-testid="flowchart-failure"]').map((n) => n.text())).toEqual(['internalId cannot be resolved'])
    w.unmount()
  })

  it('a finished past run is not followed when the chart has grown since', async () => {
    routeParams.reconciliationExecutionId = 'E6'
    // A was added to the chart after E6 ran, so E6 has no row for it and never will.
    f.getReconciliationExecution.mockResolvedValue({ results: [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 4 },
    ] } as never)
    const w = mount(RunFlowchartPage)
    await flushPromises()
    expect(w.get('[data-testid="flowchart-summary-status"]').text()).toContain('Done')
    await vi.advanceTimersByTimeAsync(9000)
    expect(f.getReconciliationExecution).toHaveBeenCalledTimes(1)
    w.unmount()
  })

  describe('loads without waiting on itself (DAR-UI-051)', () => {
    it('asks for the chart, the account list, the history and the run on show at once', async () => {
      routeParams.reconciliationExecutionId = 'E7'
      f.getReconciliation.mockReturnValue(new Promise(() => {}))
      vi.mocked(settingsFacade.listNsAuthConfigs).mockClear()
      f.getReconciliationExecution.mockResolvedValue({ results: [] } as never)
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(settingsFacade.listNsAuthConfigs).toHaveBeenCalled()
      expect(f.listReconciliationExecutions).toHaveBeenCalled()
      expect(f.getReconciliationExecution).toHaveBeenCalledWith({ reconciliationExecutionId: 'E7' })
      w.unmount()
    })

    it('a live run is not followed until the chart says which questions it has', async () => {
      routeParams.reconciliationExecutionId = 'E7'
      let chartArrives!: (value: unknown) => void
      f.getReconciliation.mockReturnValue(new Promise((resolve) => { chartArrives = resolve }) as never)
      f.getReconciliationExecution.mockResolvedValue({ results: [{ reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_RUNNING' }] } as never)
      const w = mount(RunFlowchartPage)
      await flushPromises()
      await vi.advanceTimersByTimeAsync(10_000)
      expect(f.getReconciliationExecution).toHaveBeenCalledTimes(1)
      chartArrives({ reconciliation: run, questions })
      await flushPromises()
      await vi.advanceTimersByTimeAsync(3_000)
      expect(f.getReconciliationExecution.mock.calls.length).toBeGreaterThan(1)
      w.unmount()
    })

    it('a revisit draws the last chart before the network answers', async () => {
      mount(RunFlowchartPage).unmount()
      await flushPromises()
      f.getReconciliation.mockReturnValue(new Promise(() => {}))
      f.listSavedRuns.mockReturnValue(new Promise(() => {}))
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(w.text()).toContain('Order chain')
      expect(w.find('[data-testid="flowchart-box-A"]').exists()).toBe(true)
      expect(w.find('[data-testid="page-loading"]').exists()).toBe(false)
      w.unmount()
    })
  })
  // DAR-UI-057. A finished execution never changes: its next visit asks nothing of the network, even after
  // a write elsewhere (which drops every other cached read) or in a new tab.
  describe('a finished run is kept (DAR-UI-057)', () => {
    const finished = [
      { reconciliationRunResultId: '1', reconciliationRunId: 'S', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 10, noCount: 0 },
      { reconciliationRunResultId: '2', reconciliationRunId: 'A', statusEnumId: 'AUT_STAT_SUCCESS', yesCount: 7, noCount: 3 },
    ]
    beforeEach(() => {
      installLocalStorageStub()
      setReadCacheScope('alice|GORJANA')
    })
    afterEach(() => {
      clearStoredReads()
      setReadCacheScope(null)
    })

    it('a finished run is drawn on its next visit without asking for it again', async () => {
      routeParams.reconciliationExecutionId = 'E7'
      f.getReconciliationExecution.mockResolvedValue({ results: finished } as never)
      mount(RunFlowchartPage).unmount()
      await flushPromises()
      invalidateReadCache() // a write anywhere: every changeable read is gone
      f.getReconciliationExecution.mockReset()
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(f.getReconciliationExecution).not.toHaveBeenCalled()
      expect(w.get('[data-testid="flowchart-summary-status"]').text()).toContain('Done')
      expect(w.get('[data-testid="flowchart-summary-findings"]').text()).toContain('3')
      w.unmount()
    })

    it('a run paused between questions is not kept: the next visit asks again', async () => {
      routeParams.reconciliationExecutionId = 'E8'
      f.listReconciliationExecutions.mockResolvedValue({ executions: [{ reconciliationExecutionId: 'E8', startedDate: new Date().toISOString() }] } as never)
      f.getReconciliationExecution.mockResolvedValue({ results: [finished[0]] } as never)
      mount(RunFlowchartPage).unmount()
      await flushPromises()
      invalidateReadCache()
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(f.getReconciliationExecution).toHaveBeenCalledTimes(2)
      w.unmount()
    })

    it('keeps nothing while signed out', async () => {
      setReadCacheScope(null)
      routeParams.reconciliationExecutionId = 'E7'
      f.getReconciliationExecution.mockResolvedValue({ results: finished } as never)
      mount(RunFlowchartPage).unmount()
      await flushPromises()
      invalidateReadCache()
      const w = mount(RunFlowchartPage)
      await flushPromises()
      expect(f.getReconciliationExecution).toHaveBeenCalledTimes(2)
      w.unmount()
    })
  })
})
