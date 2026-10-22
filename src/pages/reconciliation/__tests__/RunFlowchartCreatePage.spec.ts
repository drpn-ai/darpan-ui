import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const push = vi.fn()
vi.mock('vue-router', () => ({ useRouter: () => ({ push }), useRoute: () => ({ query: {} }) }))
vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: { getLifecycleOptions: vi.fn(), saveLifecycle: vi.fn(), getLifecycleRuleOptions: vi.fn() },
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
  f.getLifecycleRuleOptions.mockReset()
  settings.listNsAuthConfigs.mockReset()
  settings.listNsAuthConfigs.mockResolvedValue({ authConfigs: [{ nsAuthConfigId: 'gorjana_prod', description: 'gorjana_prod', authType: 'OAUTH2_M2M_JWT' }] } as never)
  f.getLifecycleOptions.mockImplementation((async (p: { recordType?: string }) => (p.recordType
    ? { recordTypes: [], stages: STAGES }
    : { recordTypes: [{ recordType: 'SalesOrd', label: 'Sales orders', count: 24310 }, { recordType: 'RtnAuth', label: 'Return authorizations', count: 1904 }], stages: [] })) as never)
  f.saveLifecycle.mockResolvedValue({ reconciliationId: 'R9', reconciliationName: 'Sales Orders' } as never)
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
    expect(labels(w)).toEqual(['Sales orders', 'Return authorizations'])
    select(w).vm.$emit('update:modelValue', 'SalesOrd')
    await submit(w)

    expect(w.text()).toContain('What happens to a sales order?')
    expect(f.getLifecycleOptions).toHaveBeenLastCalledWith({ nsAuthConfigId: 'gorjana_prod', recordType: 'SalesOrd' })
    expect(labels(w)).toEqual(['Invoice', 'Fulfillment', 'Return authorization'])
    // What at least half of these records go on to is chosen already.
    expect(select(w).props('modelValue')).toEqual(['CustInvc', 'ItemShip'])
    await submit(w)

    // Leave-out rules are not asked here; they are set from the lifecycle's settings.
    expect(w.text()).not.toContain('Leave out')
    expect(f.getLifecycleRuleOptions).not.toHaveBeenCalled()
    expect(w.text()).toContain('When is a sales order late?')
    // Measured to the last stage, defaulting to the first day past 90%.
    expect(labels(w)).toEqual(['Same day', '1 day', '2 days'])
    expect(select(w).props('modelValue')).toBe('2')
    await submit(w)

    expect(f.saveLifecycle).toHaveBeenCalledWith({
      nsAuthConfigId: 'gorjana_prod', recordType: 'SalesOrd', stageRecordTypes: ['CustInvc', 'ItemShip'], lateAfterDays: 2,
    })
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R9' } })
  })

  // DAR-UI-052. A return's credit memo is found by the HC Return Id both carry, not by a link: the option says so
  // and the save carries it as the stage's reach.
  it('saves how a stage reached by a shared field is found', async () => {
    const reach = { startField: 'custbody_hc_return_id', stageField: 'custbody_hc_return_id', fieldLabel: 'HC Return Id' }
    f.getLifecycleOptions.mockImplementation((async (p: { recordType?: string }) => (p.recordType
      ? { recordTypes: [], stages: [
        { recordType: 'ItemRcpt', label: 'Item receipt', past: 'Received', reached: 4721, rate: 75, typicalDays: 6,
          coverage: [{ days: 14, percent: 97 }, { days: 30, percent: 100 }] },
        { recordType: 'CustCred', label: 'Credit memo', past: 'Credited', reached: 5981, rate: 95, typicalDays: 7, reach,
          coverage: [{ days: 14, percent: 96 }, { days: 30, percent: 100 }] }] }
      : { recordTypes: [{ recordType: 'RtnAuth', label: 'Return authorizations', count: 6281 }, { recordType: 'SalesOrd', label: 'Sales orders', count: 24310 }], stages: [] })) as never)
    const w = mount(RunFlowchartCreatePage)
    await flushPromises()
    select(w).vm.$emit('update:modelValue', 'RtnAuth')
    await submit(w)
    expect(w.text()).toContain('What happens to a return authorization?')
    expect(labels(w)).toEqual(['Item receipt', 'Credit memo'])
    await submit(w)
    select(w).vm.$emit('update:modelValue', '30')
    await submit(w)

    expect(f.saveLifecycle).toHaveBeenCalledWith({
      nsAuthConfigId: 'gorjana_prod', recordType: 'RtnAuth', stageRecordTypes: ['ItemRcpt', 'CustCred'], lateAfterDays: 30,
      stageReach: [{ recordType: 'CustCred', startField: 'custbody_hc_return_id', stageField: 'custbody_hc_return_id' }],
    })
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
