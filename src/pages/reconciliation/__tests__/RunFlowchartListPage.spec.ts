import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

vi.mock('vue-router', () => ({ RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } }))
vi.mock('../../../lib/api/facade', () => ({ reconciliationFacade: { listReconciliations: vi.fn() } }))

import { reconciliationFacade } from '../../../lib/api/facade'
import RunFlowchartListPage from '../RunFlowchartListPage.vue'

describe('RunFlowchartListPage', () => {
  it('lists runs with their question count and links each to its chart', async () => {
    vi.mocked(reconciliationFacade.listReconciliations).mockResolvedValue({ reconciliations: [
      { reconciliationId: 'R1', reconciliationName: 'Order chain', questionCount: 5, defaultTimeWindow: '3d' },
    ] } as never)
    const w = mount(RunFlowchartListPage, { global: { stubs: { RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' } } } })
    await flushPromises()
    expect(w.text()).toContain('Order chain')
    expect(w.text()).toContain('5 questions')
    expect(w.get('[data-testid="flowchart-run-R1"]').attributes('data-to')).toContain('reconciliation-run-flowchart')
  })

  it('shows an empty state with a way to create one', async () => {
    vi.mocked(reconciliationFacade.listReconciliations).mockResolvedValue({ reconciliations: [] } as never)
    const w = mount(RunFlowchartListPage, { global: { stubs: { RouterLink: true } } })
    await flushPromises()
    expect(w.text()).toContain('No runs')
  })
})
