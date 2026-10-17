import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('vue-router', () => ({ useRoute: () => ({ params: { reconciliationId: 'R1' } }), useRouter: () => ({ push }) }))
vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: { listNsAuthConfigs: vi.fn(async () => ({ authConfigs: [{ nsAuthConfigId: 'net_prod', description: 'Gorjana NetSuite' }, { nsAuthConfigId: 'gorjana_prod', description: 'Gorjana NetSuite (sandbox copy)' }] })) },
  reconciliationFacade: {
    getReconciliation: vi.fn(), getLifecycleRuleOptions: vi.fn(), saveLifecycleRule: vi.fn(), deleteLifecycleRule: vi.fn(), saveReconciliation: vi.fn(),
    saveLifecycleStageException: vi.fn(), deleteLifecycleStageException: vi.fn(), saveLifecycleStages: vi.fn(), saveLifecycleDetails: vi.fn(), saveLifecycleFinding: vi.fn(), deleteLifecycleFinding: vi.fn(),
  },
}))

import { reconciliationFacade, settingsFacade } from '../../../lib/api/facade'
import RunFlowchartSettingsPage from '../RunFlowchartSettingsPage.vue'

const f = vi.mocked(reconciliationFacade)
const draft = { fieldId: 'custbody_hc_sales_channel', fieldLabel: 'HC Sales Channel', value: 'Shopify Draft Order', valueLabel: 'Shopify Draft Order' }
const pickup = { stageRecordType: 'ItemShip', stageLabel: 'Fulfillment', fieldId: 'shipmethod', fieldLabel: 'Shipping Method', value: 'Store Pickup' }

beforeEach(() => {
  push.mockReset()
  Object.values(f).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1', buildMode: 'STAGES', lateAfterDays: 1 }, questions: [],
    rules: [draft], stages: [{ recordType: 'CustInvc', label: 'Invoice' }, { recordType: 'ItemShip', label: 'Fulfillment' }], exceptions: [pickup],
    lifecycle: { nsAuthConfigId: 'gorjana_prod', recordType: 'SalesOrd', recordLabel: 'Sales orders' },
    details: [{ fieldId: 'custbody_hc_order_id', key: 'hcOrderId' }] } as never)
  f.getLifecycleRuleOptions.mockImplementation((async (p: { fieldId?: string; scope?: string }) => (p.scope === 'FINDING'
    ? (p.fieldId === 'itemsbackordered' ? { fields: [], values: [{ value: '0', label: 'more than 0' }, { value: '5', label: 'more than 5' }] }
      : { fields: [{ fieldId: 'status', label: 'Status' }, { fieldId: 'itemsbackordered', label: 'Items Backordered', kind: 'number' }] })
    : p.fieldId === 'custbody_hc_order_id'
    ? { fields: [], values: [{ value: 'NO_VALUE', label: 'No value' }, { value: 'M1', label: 'M1' }] }
    : p.fieldId === 'shipmethod' ? { fields: [], values: [{ value: 'digital', label: 'digital' }, { value: 'Store Pickup', label: 'Store Pickup' }] }
      : p.fieldId === 'item' ? { fields: [], values: [{ value: 'GFT-CP', label: 'GFT-CP · Shopify Gift Card - Purchase' }] }
      : p.scope === 'STAGE' ? { fields: [{ fieldId: 'shipmethod', label: 'Shipping Method' }, { fieldId: 'item', label: 'Item' }] }
        : { fields: [{ fieldId: 'custbody_hc_order_id', label: 'HC Order Id' }, { fieldId: 'custbody_hc_sales_channel', label: 'HC Sales Channel' }] })) as never)
  f.saveLifecycleRule.mockResolvedValue({ rules: [] } as never)
  f.deleteLifecycleRule.mockResolvedValue({ rules: [] } as never)
  f.saveLifecycleStageException.mockResolvedValue({ exceptions: [] } as never)
  f.deleteLifecycleStageException.mockResolvedValue({ exceptions: [] } as never)
  f.saveReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1' } } as never)
})

function select(w: ReturnType<typeof mount>, testId: string) {
  return w.findAllComponents({ name: 'AppSelect' }).find((c) => c.props('testId') === testId)!
}

describe('RunFlowchartSettingsPage', () => {
  it('draws the lifecycle as one line, each rule under what it belongs to', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    const spine = w.get('[data-testid="lifecycle-spine"]').text()
    // Order is position: the start, what is left out of it, then each stage with what it is not expected of.
    expect(spine.indexOf('Sales orders')).toBeLessThan(spine.indexOf('except HC Sales Channel is Shopify Draft Order'))
    // A stage's rules sit under it, as the filters sit under the starting records.
    expect(spine.indexOf('Invoice')).toBeLessThan(spine.indexOf('Fulfillment'))
    expect(spine.indexOf('Fulfillment')).toBeLessThan(spine.indexOf('not expected for Shipping Method is Store Pickup'))
    expect(w.find('[data-testid="lifecycle-settings-readback"]').exists()).toBe(false)
    // The account by its description, never its id.
    expect(spine).toContain('Gorjana NetSuite (sandbox copy)')
    expect(spine).not.toContain('gorjana_prod')
    // At rest no add row is open; only the quiet "+" actions exist.
    expect(w.find('[data-testid="lifecycle-settings-adding-filter"]').exists()).toBe(false)
  })

  it('asks for the account list beside the lifecycle, not after it (DAR-UI-051)', async () => {
    vi.mocked(settingsFacade.listNsAuthConfigs).mockClear()
    f.getReconciliation.mockReturnValue(new Promise(() => {}))
    mount(RunFlowchartSettingsPage)
    await flushPromises()
    expect(settingsFacade.listNsAuthConfigs).toHaveBeenCalled()
  })

  it('adds a filter and an exception where they act, and saves only what changed', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-remove-0"]').trigger('click')
    await w.get('[data-testid="lifecycle-settings-add-filter"]').trigger('click')
    select(w, 'lifecycle-settings-field').vm.$emit('update:modelValue', 'custbody_hc_order_id')
    await flushPromises()
    select(w, 'lifecycle-settings-value').vm.$emit('update:modelValue', 'NO_VALUE')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-rule"]').trigger('click')
    expect(w.get('[data-testid="lifecycle-settings-rule-0"]').text()).toContain('except HC Order Id is No value')

    await w.get('[data-testid="lifecycle-settings-add-exception-ItemShip"]').trigger('click')
    select(w, 'lifecycle-settings-exception-field').vm.$emit('update:modelValue', 'shipmethod')
    await flushPromises()
    select(w, 'lifecycle-settings-exception-value').vm.$emit('update:modelValue', 'digital')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-exception"]').trigger('click')
    select(w, 'lifecycle-settings-late').vm.$emit('update:modelValue', '2')
    await flushPromises()
    expect(w.get('[data-testid="lifecycle-settings-exception-ItemShip-1"]').text()).toContain('not expected for Shipping Method is digital')

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.deleteLifecycleRule).toHaveBeenCalledWith({ reconciliationId: 'R1', fieldId: 'custbody_hc_sales_channel', value: 'Shopify Draft Order' })
    expect(f.saveLifecycleRule).toHaveBeenCalledWith({ reconciliationId: 'R1', fieldId: 'custbody_hc_order_id', fieldLabel: 'HC Order Id', value: 'NO_VALUE' })
    expect(f.saveLifecycleStageException).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordType: 'ItemShip',
      fieldId: 'shipmethod', fieldLabel: 'Shipping Method', value: 'digital' })
    expect(f.deleteLifecycleStageException).not.toHaveBeenCalled()
    expect(f.saveReconciliation).toHaveBeenCalledWith({ reconciliationId: 'R1', lateAfterDays: 2 })
    expect(f.saveLifecycleStages).not.toHaveBeenCalled()
    expect(push).toHaveBeenCalledWith({ name: 'reconciliation-run-flowchart', params: { reconciliationId: 'R1' } })
  })

  it('moves a stage, its rules with it, and saves the new order before anything else', async () => {
    f.saveLifecycleStages.mockResolvedValue({ reconciliationName: 'Sales Orders' } as never)
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    expect(w.get('[data-testid="lifecycle-settings-up-CustInvc"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="lifecycle-settings-up-ItemShip"]').trigger('click')
    const spine = w.get('[data-testid="lifecycle-spine"]').text()
    expect(spine.indexOf('Fulfillment')).toBeLessThan(spine.indexOf('not expected for Shipping Method is Store Pickup'))
    expect(spine.indexOf('not expected for Shipping Method is Store Pickup')).toBeLessThan(spine.indexOf('Invoice'))
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.saveLifecycleStages).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordTypes: ['ItemShip', 'CustInvc'] })
    expect(f.saveLifecycleStageException).not.toHaveBeenCalled()
  })

  // A stage holds exceptions on several fields: Store Pickup orders and gift-card orders are both not owed a fulfillment.
  it('adds an item exception beside another field\'s, and removes one by its field', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-exception-ItemShip"]').trigger('click')
    select(w, 'lifecycle-settings-exception-field').vm.$emit('update:modelValue', 'item')
    await flushPromises()
    select(w, 'lifecycle-settings-exception-value').vm.$emit('update:modelValue', 'GFT-CP')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-exception"]').trigger('click')
    expect(w.get('[data-testid="lifecycle-settings-exception-ItemShip-0"]').text()).toContain('not expected for Shipping Method is Store Pickup')
    expect(w.get('[data-testid="lifecycle-settings-exception-ItemShip-1"]').text()).toContain('not expected for Item is GFT-CP')
    await w.get('[data-testid="lifecycle-settings-exception-ItemShip-0"] button[aria-label^="Remove"]').trigger('click')

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.deleteLifecycleStageException).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordType: 'ItemShip', fieldId: 'shipmethod', value: 'Store Pickup' })
    expect(f.saveLifecycleStageException).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordType: 'ItemShip', fieldId: 'item', fieldLabel: 'Item', value: 'GFT-CP' })
  })

  // A saved line opens in place as its editing row, filled in, and a change replaces it.
  it('changes a filter and an exception in place', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-edit-rule-0"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="lifecycle-settings-rule-0"]').exists()).toBe(false)
    expect(select(w, 'lifecycle-settings-field').props('modelValue')).toBe('custbody_hc_sales_channel')
    expect(select(w, 'lifecycle-settings-value').props('modelValue')).toBe('Shopify Draft Order')
    // The value being changed stays offered even when the account's recent values no longer hold it.
    expect(select(w, 'lifecycle-settings-value').props('options')).toContainEqual({ value: 'Shopify Draft Order', label: 'Shopify Draft Order' })
    expect(w.get('[data-testid="lifecycle-settings-add-rule"]').text()).toBe('Change')
    select(w, 'lifecycle-settings-field').vm.$emit('update:modelValue', 'custbody_hc_order_id')
    await flushPromises()
    select(w, 'lifecycle-settings-value').vm.$emit('update:modelValue', 'NO_VALUE')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-rule"]').trigger('click')
    expect(w.get('[data-testid="lifecycle-settings-rule-0"]').text()).toContain('except HC Order Id is No value')

    await w.get('[data-testid="lifecycle-settings-edit-exception-ItemShip-0"]').trigger('click')
    await flushPromises()
    expect(select(w, 'lifecycle-settings-exception-value').props('modelValue')).toBe('Store Pickup')
    select(w, 'lifecycle-settings-exception-value').vm.$emit('update:modelValue', 'digital')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-exception"]').trigger('click')
    expect(w.findAll('[data-testid^="lifecycle-settings-exception-ItemShip-"]')).toHaveLength(1)
    expect(w.get('[data-testid="lifecycle-settings-exception-ItemShip-0"]').text()).toContain('not expected for Shipping Method is digital')

    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.deleteLifecycleRule).toHaveBeenCalledWith({ reconciliationId: 'R1', fieldId: 'custbody_hc_sales_channel', value: 'Shopify Draft Order' })
    expect(f.saveLifecycleRule).toHaveBeenCalledWith({ reconciliationId: 'R1', fieldId: 'custbody_hc_order_id', fieldLabel: 'HC Order Id', value: 'NO_VALUE' })
    expect(f.deleteLifecycleStageException).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordType: 'ItemShip', fieldId: 'shipmethod', value: 'Store Pickup' })
    expect(f.saveLifecycleStageException).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordType: 'ItemShip', fieldId: 'shipmethod', fieldLabel: 'Shipping Method', value: 'digital' })
  })

  // Each record shows its standard columns and the custom fields chosen here, named as the account names them.
  it('chooses what each record shows', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    expect(w.get('[data-testid="lifecycle-settings-detail-0"]').text()).toContain('shows HC Order Id')
    await w.get('[data-testid="lifecycle-settings-show-field"]').trigger('click')
    // A field already shown is not offered again.
    expect(select(w, 'lifecycle-settings-detail-field').props('options')).toEqual([{ value: 'custbody_hc_sales_channel', label: 'HC Sales Channel' }])
    select(w, 'lifecycle-settings-detail-field').vm.$emit('update:modelValue', 'custbody_hc_sales_channel')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-detail"]').trigger('click')
    expect(w.get('[data-testid="lifecycle-settings-detail-1"]').text()).toContain('shows HC Sales Channel')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.saveLifecycleDetails).toHaveBeenCalledWith({ reconciliationId: 'R1', details: [
      { fieldId: 'custbody_hc_order_id', label: 'HC Order Id' }, { fieldId: 'custbody_hc_sales_channel', label: 'HC Sales Channel' }] })
  })

  // A lifecycle says which places are findings; each place under its stage has a switch, kept by the place's name.
  it('says which places are findings', async () => {
    f.getReconciliation.mockResolvedValue({ reconciliation: { reconciliationId: 'R1', buildMode: 'STAGES', lateAfterDays: 1,
      notFindingPlaces: JSON.stringify(['Shipped, never billed']) },
    questions: [
      { reconciliationRunId: 'S', ruleSetId: 'r0', questionRole: 'START', runName: 'Sales orders', runSequence: 1 },
      { reconciliationRunId: 'F', ruleSetId: 'r1', parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Fulfillment', runSequence: 2 },
      { reconciliationRunId: 'I', ruleSetId: 'r2', parentReconciliationRunId: 'F', parentBranch: 'YES', runName: 'Invoice', noOutcomeLabel: 'Shipped, never billed', runSequence: 3 },
      { reconciliationRunId: 'D', ruleSetId: 'r3', parentReconciliationRunId: 'F', parentBranch: 'YES', runName: 'Invoice', noOutcomeLabel: 'Shipped and billed', runSequence: 4 },
      { reconciliationRunId: 'N', ruleSetId: 'r4', parentReconciliationRunId: 'F', parentBranch: 'NO', runName: 'Invoice', noOutcomeLabel: 'Never shipped, never billed', runSequence: 5 },
    ],
    rules: [], stages: [{ recordType: 'ItemShip', label: 'Fulfillment' }, { recordType: 'CustInvc', label: 'Invoice' }], exceptions: [],
    lifecycle: { nsAuthConfigId: 'gorjana_prod', recordType: 'SalesOrd', recordLabel: 'Sales orders' } } as never)
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    expect(w.get('[data-testid="lifecycle-settings-finding-Never shipped, never billed"]').text()).toBe('finding')
    expect(w.get('[data-testid="lifecycle-settings-finding-Shipped, never billed"]').text()).toBe('not a finding')
    await w.get('[data-testid="lifecycle-settings-finding-Never shipped, never billed"]').trigger('click')
    await w.get('[data-testid="lifecycle-settings-finding-Shipped, never billed"]').trigger('click')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.saveReconciliation).toHaveBeenCalledWith({ reconciliationId: 'R1', notFindingPlaces: ['Never shipped, never billed'] })
  })

  // A finding written for a stage: the records that reached it and whose field matches; a number asks "more than".
  it('writes a finding for a stage', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-finding-ItemShip"]').trigger('click')
    select(w, 'lifecycle-settings-finding-field').vm.$emit('update:modelValue', 'itemsbackordered')
    await flushPromises()
    select(w, 'lifecycle-settings-finding-value').vm.$emit('update:modelValue', '0')
    await flushPromises()
    await w.get('[data-testid="lifecycle-settings-add-written"]').trigger('click')
    expect(w.get('[data-testid="lifecycle-settings-written-ItemShip-0"]').text()).toContain('finding when Items Backordered more than 0')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.saveLifecycleFinding).toHaveBeenCalledWith({ reconciliationId: 'R1', stageRecordType: 'ItemShip', fieldId: 'itemsbackordered',
      fieldLabel: 'Items Backordered', op: 'GT', value: '0', valueLabel: '0' })
  })

  it('an unchanged lifecycle saves nothing', async () => {
    const w = mount(RunFlowchartSettingsPage)
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(f.deleteLifecycleRule).not.toHaveBeenCalled()
    expect(f.saveLifecycleRule).not.toHaveBeenCalled()
    expect(f.saveLifecycleStageException).not.toHaveBeenCalled()
    expect(f.saveReconciliation).not.toHaveBeenCalled()
    expect(f.saveLifecycleDetails).not.toHaveBeenCalled()
  })
})
