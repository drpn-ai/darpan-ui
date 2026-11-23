import { beforeEach, describe, expect, it } from 'vitest'
import { mount, type VueWrapper } from '@vue/test-utils'
import QueryDataPopup from '../QueryDataPopup.vue'
import type { QueryCatalog, ReadInput } from '../../../lib/queryRead'

const catalog: QueryCatalog = {
  audits: [
    { auditId: '100510', auditCode: 'MC', auditName: 'Month-close audit', fields: ['statement', 'state', 'recordKey', 'headline', 'firstFoundDate'] },
    { auditId: '100600', auditCode: 'MR', auditName: 'Monthly returns', fields: ['statement', 'state', 'recordKey', 'headline', 'firstFoundDate'] },
  ],
  savedRuns: [{ savedRunId: 'RS_1', runName: 'Shopify vs HotWax', fields: ['bucket', 'key'], note: 'plus each record' }],
  datasets: [
    { datasetId: 'DS_ORDERS', system: 'HotWax', idField: 'orderId', windowField: 'orderDate', recordCount: 10,
      fields: ['orderId', 'status'], wholeRecords: false },
    { datasetId: 'DS_WHOLE', system: 'Shopify', idField: 'id', windowField: null, recordCount: null, fields: null, wholeRecords: true },
  ],
}

const findings: ReadInput = {
  name: 'findings', source: 'auditFindings', auditId: '100510', fields: ['recordKey', 'headline'],
  where: { field: 'statement', op: 'equals', value: 'R5' }, window: { field: 'firstFoundDate', lastDays: 30 }, note: 'kept',
}

function mountPopup(props: Record<string, unknown> = {}) {
  return mount(QueryDataPopup, { props: { input: findings, catalog, ...props }, attachTo: document.body })
}

async function choose(wrapper: VueWrapper, select: string, value: string, at = 0): Promise<void> {
  await wrapper.findAll(`[data-testid="${select}"]`)[at]!.trigger('click')
  await wrapper.find(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

function saved(wrapper: VueWrapper): ReadInput {
  const events = wrapper.emitted('save') ?? []
  expect(events).toHaveLength(1)
  return events[0]![0] as ReadInput
}

function keep(wrapper: VueWrapper, field: string) {
  return wrapper.findAll('[data-testid="query-data-keep"]').find((chip) => chip.text() === field)!
}

describe('QueryDataPopup', () => {
  beforeEach(() => {
    document.body.replaceChildren()
  })

  it('opens on the input as it is, and saves it untouched', async () => {
    const wrapper = mountPopup()
    expect(wrapper.find('#query-data-title').text()).toBe('Data')
    expect(wrapper.find('.wizard-question').text()).toBe('What should this query read?')
    expect(wrapper.find('[data-testid="query-data-kind-auditFindings"]').classes()).toContain('workflow-shortcut-choice-card--active')
    expect(wrapper.find('[data-testid="query-data-source"]').text()).toContain('Month-close audit')
    expect((wrapper.find('[data-testid="query-data-window"]').element as HTMLInputElement).value).toBe('30')
    expect(keep(wrapper, 'recordKey').attributes('aria-pressed')).toBe('true')
    expect(keep(wrapper, 'statement').attributes('aria-pressed')).toBe('false')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    // Same keys in the same order: an unchanged save leaves the page's JSON (and its edited mark) alone.
    expect(JSON.stringify(saved(wrapper))).toBe(JSON.stringify(findings))
  })

  it('chooses another kind and source, keeps fields, and drops what belonged to the old source', async () => {
    const wrapper = mountPopup()
    await wrapper.find('[data-testid="query-data-kind-dataset"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-condition"]').exists()).toBe(false)
    await choose(wrapper, 'query-data-source', 'DS_ORDERS')
    expect(wrapper.find('[data-testid="query-data-window"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('orderDate · last days')
    await keep(wrapper, 'status').trigger('click')
    await wrapper.find('[data-testid="query-data-window"]').setValue('7')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(saved(wrapper)).toEqual({
      name: 'findings', source: 'dataset', datasetId: 'DS_ORDERS', fields: ['orderId'],
      window: { field: 'orderDate', lastDays: 7 }, note: 'kept',
    })
  })

  it("a run's result takes no window", async () => {
    const wrapper = mountPopup()
    await wrapper.find('[data-testid="query-data-kind-runResult"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-window"]').exists()).toBe(false)
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    const out = saved(wrapper)
    expect(out).toMatchObject({ source: 'runResult', savedRunId: 'RS_1', fields: ['bucket', 'key'] })
    expect(out).not.toHaveProperty('window')
    expect(out).not.toHaveProperty('auditId')
  })

  it('adds and removes conditions', async () => {
    const wrapper = mountPopup()
    await wrapper.find('[data-testid="query-data-condition-add"]').trigger('click')
    expect(wrapper.findAll('[data-testid="query-data-condition"]')).toHaveLength(2)
    await choose(wrapper, 'query-data-condition-field', 'state', 1)
    await wrapper.findAll('[data-testid="query-data-condition-value"]')[1]!.setValue('open')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(saved(wrapper).where).toEqual({ and: [
      { field: 'statement', op: 'equals', value: 'R5' },
      { field: 'state', op: 'equals', value: 'open' },
    ] })

    const again = mountPopup()
    await again.find('[data-testid="query-data-condition-remove"]').trigger('click')
    await again.find('[data-testid="query-data-window"]').setValue('')
    await again.find('[data-testid="query-data-save"]').trigger('click')
    const out = saved(again)
    expect(out).not.toHaveProperty('where')
    expect(out).not.toHaveProperty('window')
  })

  it('refuses a condition with no value', async () => {
    const wrapper = mountPopup()
    await wrapper.find('[data-testid="query-data-condition-value"]').setValue('')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-error"]').text()).toBe('Give statement a value.')
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('toggles kept fields, and needs at least one', async () => {
    const wrapper = mountPopup()
    await keep(wrapper, 'statement').trigger('click')
    await keep(wrapper, 'recordKey').trigger('click')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(saved(wrapper).fields).toEqual(['headline', 'statement'])

    const none = mountPopup({ input: { ...findings, fields: ['recordKey'] } })
    await keep(none, 'recordKey').trigger('click')
    await none.find('[data-testid="query-data-save"]').trigger('click')
    expect(none.find('[data-testid="query-data-error"]').text()).toBe('Keep at least one field.')
  })

  it('takes typed fields for a dataset kept whole, and a typed field not yet Entered still counts', async () => {
    const wrapper = mountPopup({ input: null })
    await wrapper.find('[data-testid="query-data-kind-dataset"]').trigger('click')
    await choose(wrapper, 'query-data-source', 'DS_WHOLE')
    expect(wrapper.find('[data-testid="query-data-keep"]').exists()).toBe(false)
    await wrapper.find('[data-testid="workflow-chip-text-input"]').setValue('total_price')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(saved(wrapper)).toEqual({ name: 'records', source: 'dataset', datasetId: 'DS_WHOLE', fields: ['id', 'total_price'] })
  })

  it('renames with the name rule and refuses a name another input has', async () => {
    const wrapper = mountPopup({ takenNames: ['orders'] })
    const name = wrapper.find('[data-testid="query-data-name"]')
    await name.setValue('Open findings')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-error"]').text()).toMatch(/^The name starts with a lower-case letter/)
    await name.setValue('orders')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-error"]').text()).toBe('Another input is already called input.orders.')
    await name.setValue('openFindings')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(saved(wrapper).name).toBe('openFindings')
  })

  it('a new input needs a source and gets a free name', async () => {
    const wrapper = mountPopup({ input: null, takenNames: ['findings'] })
    expect((wrapper.find('[data-testid="query-data-name"]').element as HTMLInputElement).value).toBe('findings2')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(wrapper.find('[data-testid="query-data-error"]').text()).toBe('Pick an audit.')
    await choose(wrapper, 'query-data-source', '100600')
    await wrapper.find('[data-testid="query-data-save"]').trigger('click')
    expect(saved(wrapper)).toEqual({ name: 'findings2', source: 'auditFindings', auditId: '100600',
      fields: ['recordKey', 'headline', 'firstFoundDate'] })
  })

  it('without the catalog it says so and still shows the source by id', () => {
    const wrapper = mountPopup({ catalog: null, catalogError: 'Could not read the catalog.' })
    expect(wrapper.find('[data-testid="query-data-catalog-error"]').text()).toContain('Could not read the catalog.')
    expect(wrapper.find('[data-testid="query-data-source"]').text()).toContain('100510')
  })

  it('cancels', async () => {
    const wrapper = mountPopup()
    await wrapper.find('[data-testid="query-data-cancel"]').trigger('click')
    expect(wrapper.emitted('cancel')).toHaveLength(1)
  })
})
