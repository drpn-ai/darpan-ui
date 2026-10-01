import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: { saveReconciliation: vi.fn(), saveReconciliationQuestion: vi.fn(), listSavedRuns: vi.fn() },
}))

import { reconciliationFacade } from '../../../lib/api/facade'
import RunFlowchartCreatePage from '../RunFlowchartCreatePage.vue'

const f = vi.mocked(reconciliationFacade)

beforeEach(() => {
  push.mockReset()
  Object.values(f).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  f.listSavedRuns.mockResolvedValue({ savedRuns: [
    { savedRunId: 'POP', runName: 'Sales orders in window', scopeMode: 'EVALUATE', requiresSystemSelection: false, systemOptions: [] },
    { savedRunId: 'CMP', runName: 'Shopify vs NetSuite', scopeMode: 'COMPARE', requiresSystemSelection: false, systemOptions: [] },
  ] } as never)
  f.saveReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R9' } } as never)
  f.saveReconciliationQuestion.mockResolvedValue({ question: { reconciliationRunId: 'Q1', ruleSetId: 'POP' } } as never)
})

async function submit(w: ReturnType<typeof mount>) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('RunFlowchartCreatePage', () => {
  it('creates a run with a start and lands on its chart', async () => {
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()
    await w.get('[data-testid="flowchart-create-name"]').setValue('NetSuite order chain')
    await submit(w)
    await w.get('[data-testid="flowchart-start-choice-records"]').trigger('click')
    await flushPromises()
    const starting = (w.findComponent({ name: 'WorkflowSelect' }).props('options') as { value: string }[]).map((o) => o.value)
    expect(starting).toEqual(['POP'])
    w.findComponent({ name: 'WorkflowSelect' }).vm.$emit('update:modelValue', 'POP')
    await submit(w)
    await w.get('[data-testid="flowchart-create-days"]').setValue('3')
    await submit(w)
    expect(f.saveReconciliation).toHaveBeenCalledWith({ reconciliationName: 'NetSuite order chain', defaultTimeWindow: '3d' })
    expect(f.saveReconciliationQuestion).toHaveBeenCalledWith(expect.objectContaining({ reconciliationId: 'R9', ruleSetId: 'POP', questionRole: 'START' }))
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R9' } })
  })

  it('creates a run with no start', async () => {
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()
    await w.get('[data-testid="flowchart-create-name"]').setValue('Loose checks')
    await submit(w)
    await w.get('[data-testid="flowchart-start-choice-none"]').trigger('click')
    await flushPromises()
    await submit(w)
    expect(f.saveReconciliationQuestion).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalled()
  })
})
