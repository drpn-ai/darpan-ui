import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: { getLifecycleOptions: vi.fn(), saveLifecycle: vi.fn() },
  settingsFacade: { listNsAuthConfigs: vi.fn() },
}))

import { reconciliationFacade, settingsFacade } from '../../../lib/api/facade'
import RunFlowchartCreatePage from '../RunFlowchartCreatePage.vue'

const f = vi.mocked(reconciliationFacade)
const settings = vi.mocked(settingsFacade)

const STAGES = [
  { recordType: 'CustInvc', label: 'Invoice', past: 'Billed', reached: 960, rate: 96, typicalDays: 0,
    coverage: [{ days: 0, percent: 73 }, { days: 1, percent: 94 }] },
  { recordType: 'ItemShip', label: 'Fulfillment', past: 'Shipped', reached: 970, rate: 97, typicalDays: 1,
    coverage: [{ days: 0, percent: 10 }, { days: 1, percent: 80 }, { days: 2, percent: 91 }] },
  { recordType: 'RtnAuth', label: 'Return authorization', past: 'Returned', reached: 30, rate: 3, typicalDays: 18,
    coverage: [{ days: 14, percent: 41 }] },
]

beforeEach(() => {
  push.mockReset()
  f.getLifecycleOptions.mockReset()
  f.saveLifecycle.mockReset()
  settings.listNsAuthConfigs.mockReset()
  settings.listNsAuthConfigs.mockResolvedValue({ authConfigs: [{ nsAuthConfigId: 'gorjana_prod', description: 'gorjana_prod', authType: 'OAUTH2_M2M_JWT' }] } as never)
  f.getLifecycleOptions.mockImplementation((async (p: { recordType?: string }) => (p.recordType
    ? { recordTypes: [], stages: STAGES }
    : { recordTypes: [{ recordType: 'SalesOrd', label: 'Sales orders', count: 24310 }, { recordType: 'RtnAuth', label: 'Return authorizations', count: 1904 }], stages: [] })) as never)
  f.saveLifecycle.mockResolvedValue({ reconciliationId: 'R9', reconciliationName: 'Sales orders: billed → shipped' } as never)
})

async function submit(w: ReturnType<typeof mount>) {
  await w.get('form').trigger('submit')
  await flushPromises()
}

function select(w: ReturnType<typeof mount>) { return w.findComponent({ name: 'WorkflowSelect' }) }
function labels(w: ReturnType<typeof mount>) { return (select(w).props('options') as { label: string }[]).map((o) => o.label) }

describe('RunFlowchartCreatePage (lifecycle builder)', () => {
  it('builds a lifecycle from dropdowns alone, each option carrying its evidence', async () => {
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()

    // One account: its card is skipped.
    expect(w.text()).toContain('Which records?')
    expect(labels(w)).toEqual(['Sales orders · 24,310 in the last 30 days', 'Return authorizations · 1,904 in the last 30 days'])
    select(w).vm.$emit('update:modelValue', 'SalesOrd')
    await submit(w)

    expect(w.text()).toContain('What happens to a sales order?')
    expect(f.getLifecycleOptions).toHaveBeenLastCalledWith({ nsAuthConfigId: 'gorjana_prod', recordType: 'SalesOrd' })
    expect(labels(w)).toEqual(['Invoice · 96% · usually the same day', 'Fulfillment · 97% · usually 1 day later',
      'Return authorization · 3% · usually 18 days later'])
    // What at least half of these records go on to is chosen already.
    expect(select(w).props('modelValue')).toEqual(['CustInvc', 'ItemShip'])
    await submit(w)

    expect(w.text()).toContain('When is a sales order late?')
    // Measured to the last stage, defaulting to the first day past 90%.
    expect(labels(w)).toEqual(['Same day · 10% done by then', '1 day · 80% done by then', '2 days · 91% done by then'])
    expect(select(w).props('modelValue')).toBe('2')
    await submit(w)

    expect(f.saveLifecycle).toHaveBeenCalledWith({
      nsAuthConfigId: 'gorjana_prod', recordType: 'SalesOrd', stageRecordTypes: ['CustInvc', 'ItemShip'], lateAfterDays: 2,
    })
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R9' } })
  })

  it('has no text inputs anywhere in the flow', async () => {
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()
    for (let i = 0; i < 3; i++) {
      expect(w.findAll('input, textarea')).toHaveLength(0)
      if (i === 0) select(w).vm.$emit('update:modelValue', 'SalesOrd')
      await submit(w)
    }
  })

  it('asks for the account when there is more than one', async () => {
    settings.listNsAuthConfigs.mockResolvedValue({ authConfigs: [
      { nsAuthConfigId: 'A', description: 'gorjana_prod', authType: 'OAUTH2_M2M_JWT' },
      { nsAuthConfigId: 'B', description: 'gorjana_sb', authType: 'OAUTH2_M2M_JWT' },
    ] } as never)
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()
    expect(w.text()).toContain('Which account?')
    expect(labels(w)).toEqual(['gorjana_prod', 'gorjana_sb'])
    expect(f.getLifecycleOptions).not.toHaveBeenCalled()
  })

  it('shows the backend refusal in place', async () => {
    f.getLifecycleOptions.mockRejectedValue(new Error("Could not read NetSuite account 'gorjana_prod': NetSuite token endpoint returned 500."))
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()
    expect(w.text()).toContain('NetSuite token endpoint returned 500')
  })
})
