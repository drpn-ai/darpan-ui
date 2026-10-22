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
  f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1' }, questions: [] } as never)
  f.runReconciliation.mockResolvedValue({ reconciliationExecutionId: 'E9' } as never)
})
afterEach(() => vi.useRealTimers())

function form(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowStepForm' }) }

async function pick(w: ReturnType<typeof mount>, preset: string) {
  await w.get(`[data-testid="flowchart-start-window-${preset}"]`).trigger('click')
}

async function submit(w: ReturnType<typeof mount>) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

describe('RunFlowchartStartPage', () => {
  it('asks which days with the Sync run\'s cards, each naming its dates (DAR-UI-060)', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    expect(w.text()).toContain('Which days should this run look at?')
    const labels = w.findAll('.workflow-shortcut-choice-card__label').map((l) => l.text())
    expect(labels[0]).toBe('Previous Day, Aug 16, 2026')
    expect(labels[1]).toBe('Previous Week, Aug 9, 2026 to Aug 16, 2026')
    expect(labels[2]).toMatch(/^Previous Month, Jul/)
    expect(labels[3]).toBe('Custom Dates, select start and end dates')
    expect(form(w).props('submitDisabled')).toBe(true)
  })

  it('runs over the chosen card, the end exclusive, and lands on the run page following it (review I3)', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    await submit(w)
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({
      reconciliationId: 'R1', windowStartLocalDate: '2026-08-16', windowEndLocalDate: '2026-08-17' }))
    expect(replace).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1', reconciliationExecutionId: 'E9' },
      state: { startedRun: 'E9' } })
  })

  it('a letter key picks its card', async () => {
    const w = mount(RunFlowchartStartPage, { attachTo: document.body })
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    await submit(w)
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({ windowStartLocalDate: '2026-08-09', windowEndLocalDate: '2026-08-17' }))
    w.unmount()
  })

  it('a lifecycle built from stages counts its cards back from late-after days', async () => {
    f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1', buildMode: 'STAGES', lateAfterDays: 2 }, questions: [] } as never)
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    await submit(w)
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({ windowStartLocalDate: '2026-08-14', windowEndLocalDate: '2026-08-15' }))
  })

  it('Custom Dates opens the calendar and runs over the picked days, the last one included', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'custom')
    expect(w.text()).toContain('Select custom dates')
    expect(form(w).props('submitDisabled')).toBe(true)
    await w.get('[data-testid="flowchart-start-custom-day-2026-08-03"]').trigger('click')
    await w.get('[data-testid="flowchart-start-custom-day-2026-08-05"]').trigger('click')
    await submit(w)
    expect(f.runReconciliation).toHaveBeenCalledWith(expect.objectContaining({ windowStartLocalDate: '2026-08-03', windowEndLocalDate: '2026-08-06' }))
  })

  it('the calendar of a lifecycle built from stages stops the day before its window ends', async () => {
    f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1', buildMode: 'STAGES', lateAfterDays: 2 }, questions: [] } as never)
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'custom')
    expect(w.get('[data-testid="flowchart-start-custom-day-2026-08-14"]').attributes('disabled')).toBeUndefined()
    expect(w.get('[data-testid="flowchart-start-custom-day-2026-08-15"]').attributes('disabled')).toBeDefined()
  })

  it('Back from the calendar returns to the cards; Back from the cards returns to the run page without running', async () => {
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'custom')
    form(w).vm.$emit('back')
    await flushPromises()
    expect(w.text()).toContain('Which days should this run look at?')
    expect(push).not.toHaveBeenCalled()
    form(w).vm.$emit('back')
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1' } })
    expect(f.runReconciliation).not.toHaveBeenCalled()
  })

  it('a double submit starts one walk (review I4)', async () => {
    let resolve: (v: unknown) => void = () => {}
    f.runReconciliation.mockReturnValue(new Promise((r) => { resolve = r }) as never)
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    await w.get('form').trigger('submit')
    await w.get('form').trigger('submit')
    resolve({ reconciliationExecutionId: 'E1' })
    await flushPromises()
    expect(f.runReconciliation).toHaveBeenCalledTimes(1)
  })

  it('a revisit can run at once, before the network answers (DAR-UI-051)', async () => {
    mount(RunFlowchartStartPage).unmount()
    await flushPromises()
    f.getReconciliation.mockReturnValue(new Promise(() => {}))
    const w = mount(RunFlowchartStartPage)
    await flushPromises()
    await pick(w, 'previous-day')
    expect(form(w).props('submitDisabled')).toBe(false)
  })
})
