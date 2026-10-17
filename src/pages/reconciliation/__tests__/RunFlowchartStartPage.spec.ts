import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { push, replace } = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { reconciliationId: 'R1' } }), useRouter: () => ({ push, replace }) }))
vi.mock('../../../lib/api/facade', () => ({ reconciliationFacade: { getReconciliation: vi.fn(), runReconciliation: vi.fn() } }))

import { reconciliationFacade } from '../../../lib/api/facade'
import RunFlowchartStartPage from '../RunFlowchartStartPage.vue'

const f = vi.mocked(reconciliationFacade)

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 7, 17, 12))
  push.mockReset()
  replace.mockReset()
  f.getReconciliation.mockReset()
  f.runReconciliation.mockReset()
  f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1', defaultTimeWindow: '3d' }, questions: [] } as never)
  f.runReconciliation.mockResolvedValue({ reconciliationExecutionId: 'E9' } as never)
})
afterEach(() => vi.useRealTimers())

function select(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowSelect' }) }

describe('RunFlowchartStartPage', () => {
  it('asks which days, defaulting to the run\'s own look-back', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    expect(w.text()).toContain('Which days should this run look at?')
    expect(select(w).props('modelValue')).toBe('3')
    expect((select(w).props('options') as { label: string }[]).map((o) => o.label)).toEqual(['Previous day', 'Last 3 days', 'Last 7 days', 'Last 30 days'])
  })

  it('runs over the chosen days, the end exclusive, and lands on the run page following it (review I3)', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({
      reconciliationId: 'R1', windowStartLocalDate: '2026-08-14', windowEndLocalDate: '2026-08-17' }))
    expect(replace).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1', reconciliationExecutionId: 'E9' },
      state: { startedRun: 'E9' } })
  })

  it('a lifecycle built from stages ends its window late-after days back', async () => {
    f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1', defaultTimeWindow: '3d', buildMode: 'STAGES', lateAfterDays: 2 }, questions: [] } as never)
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({ windowStartLocalDate: '2026-08-12', windowEndLocalDate: '2026-08-15' }))
  })

  it('a double submit starts one walk (review I4)', async () => {
    let resolve: (v: unknown) => void = () => {}
    f.runReconciliation.mockReturnValue(new Promise((r) => { resolve = r }) as never)
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await w.get('form').trigger('submit')
    await w.get('form').trigger('submit')
    resolve({ reconciliationExecutionId: 'E1' })
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledTimes(1)
  })

  it('a revisit offers the last visit\'s days at once, before the network answers (DAR-UI-051)', async () => {
    mount(RunFlowchartStartPage).unmount()
    await flushPromises()
    f.getReconciliation.mockReturnValue(new Promise(() => {}))
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    expect(select(w).props('modelValue')).toBe('3')
    expect(select(w).props('placeholder')).not.toBe('Loading...')
    expect((select(w).props('options') as unknown[]).length).toBe(4)
  })

  it('Back returns to the run page without running', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    w.findComponent({ name: 'WorkflowStepForm' }).vm.$emit('back')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1' } })
    expect(f.runReconciliation).not.toHaveBeenCalled()
  })
})
