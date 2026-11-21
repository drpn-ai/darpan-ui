import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ConclusionLine from '../ConclusionLine.vue'
import type { RunConclusionCondition } from '../../../lib/api/authoringTypes'
import type { CatalogField } from '../../../lib/conclusionFieldCatalog'
import type { LineContext } from '../../../lib/conclusionLines'

const context: LineContext = {
  file1: 'NetSuite',
  file2: 'HotWax',
  evaluate: false,
  firstKeyField: 'order_name',
  listPaths: new Set(['lines']),
}
const fields: CatalogField[] = [
  { value: 'FILE_1:billing_status', label: 'NetSuite › billing_status', subject: 'FILE_1', field: 'billing_status', list: false },
  { value: 'FILE_2:lines.status', label: 'HotWax › lines.status', subject: 'FILE_2', field: 'lines.status', list: true },
]
const statusLine = (extra: Partial<RunConclusionCondition> = {}): RunConclusionCondition => ({
  subject: 'FILE_1',
  presence: 'ANY',
  keyScope: 'FULL',
  quantifier: 'ALL',
  field: 'billing_status',
  operator: 'IN',
  values: ['Pending Billing'],
  checkLabel: '',
  ...extra,
})

function mountLine(condition: RunConclusionCondition, editing: boolean, extra: Record<string, unknown> = {}) {
  return mount(ConclusionLine, {
    props: { condition, context, fields, connector: 'when', editing, ...extra },
    attachTo: document.body,
  })
}
async function pick(wrapper: VueWrapper, testId: string, value: string) {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get(`[data-option-value="${value}"]`).trigger('click')
}
const last = (wrapper: VueWrapper) => (wrapper.emitted('update') ?? []).at(-1)?.[0] as RunConclusionCondition

describe('ConclusionLine', () => {
  it('reads as plain text until clicked', async () => {
    const wrapper = mountLine(statusLine(), false)
    const line = wrapper.get('button.conclusion-line')
    expect(line.text()).toContain('when')
    expect(line.text()).toContain('NetSuite billing_status is one of Pending Billing')
    expect(line.attributes('aria-label')).toBe('Change this line: NetSuite billing_status is one of Pending Billing')
    expect(wrapper.find('.app-select').exists()).toBe(false)
    await line.trigger('click')
    expect(wrapper.emitted('edit')).toHaveLength(1)
  })

  it('does not offer the click while disabled', async () => {
    const wrapper = mountLine(statusLine(), false, { disabled: true })
    await wrapper.get('button.conclusion-line').trigger('click')
    expect(wrapper.emitted('edit')).toBeUndefined()
  })

  it('shows the connector and an aligned edit row with done and remove while editing', async () => {
    const wrapper = mountLine(statusLine(), true, { connector: 'and' })
    expect(wrapper.find('button.conclusion-line').exists()).toBe(false)
    expect(wrapper.text()).toContain('and')
    await wrapper.get('[aria-label="Done with this line"]').trigger('click')
    await wrapper.get('[aria-label="Remove this line"]').trigger('click')
    expect(wrapper.emitted('done')).toHaveLength(1)
    expect(wrapper.emitted('remove')).toHaveLength(1)
  })

  it('blur keeps typed value text', async () => {
    const wrapper = mountLine(statusLine({ values: ['A'] }), true)
    const input = wrapper.get('[data-testid="conclusion-line-tag-input"]')
    await input.setValue('B')
    await input.trigger('blur')
    expect(last(wrapper).values).toEqual(['A', 'B'])
  })

  it('Enter and comma add tags, without duplicates', async () => {
    const wrapper = mountLine(statusLine({ values: ['A'] }), true)
    const input = wrapper.get('[data-testid="conclusion-line-tag-input"]')
    await input.setValue('B, A, C')
    await input.trigger('keydown', { key: 'Enter' })
    expect(last(wrapper).values).toEqual(['A', 'B', 'C'])
    await input.setValue('D')
    await input.trigger('keydown', { key: ',' })
    expect(last(wrapper).values).toEqual(['A', 'D'])
  })

  it('removes a tag', async () => {
    const wrapper = mountLine(statusLine({ values: ['A', 'B'] }), true)
    await wrapper.get('[aria-label="Remove A"]').trigger('click')
    expect(last(wrapper).values).toEqual(['B'])
  })

  it('marks an empty required value', () => {
    const wrapper = mountLine(statusLine({ values: [] }), true)
    expect(wrapper.find('.conclusion-line__against--missing').exists()).toBe(true)
    const filled = mountLine(statusLine(), true)
    expect(filled.find('.conclusion-line__against--missing').exists()).toBe(false)
  })

  it('choosing a record offers record tests', async () => {
    const wrapper = mountLine(statusLine(), true)
    await pick(wrapper, 'conclusion-line-subject', 'record:FILE_2:FULL')
    expect(last(wrapper)).toMatchObject({ subject: 'FILE_2', field: null, operator: null, keyScope: 'FULL', presence: 'KEPT' })

    const record = mountLine({ subject: 'FILE_2', presence: 'KEPT', keyScope: 'FULL', field: null, operator: null, values: [], checkLabel: '' }, true)
    await record.get('[data-testid="conclusion-line-test"]').trigger('click')
    const offered = record.findAll('[data-option-value]').map((o) => o.attributes('data-option-value'))
    expect(offered).toEqual(['KEPT', 'ABSENT', 'EXCLUDED'])
    await record.get('[data-option-value="ABSENT"]').trigger('click')
    expect(last(record)).toMatchObject({ presence: 'ABSENT', operator: null, field: null })
  })

  it('offers the first-key-field record only when the context has one', async () => {
    const wrapper = mountLine(statusLine(), true)
    await wrapper.get('[data-testid="conclusion-line-subject"]').trigger('click')
    const values = wrapper.findAll('[data-option-value]').map((o) => o.attributes('data-option-value'))
    expect(values).toContain('record:FILE_1:FIRST_FIELD')
    await wrapper.get('[data-option-value="record:FILE_1:FIRST_FIELD"]').trigger('click')
    expect(last(wrapper)).toMatchObject({ keyScope: 'FIRST_FIELD', operator: null })

    const bare = mount(ConclusionLine, { props: { condition: statusLine(), context: { ...context, firstKeyField: null }, fields, connector: 'when', editing: true }, attachTo: document.body })
    await bare.get('[data-testid="conclusion-line-subject"]').trigger('click')
    expect(bare.find('[data-option-value="record:FILE_1:FIRST_FIELD"]').exists()).toBe(false)
  })

  it('adds a loaded field that is not in the catalogue as its own option', async () => {
    const wrapper = mountLine(statusLine({ field: 'legacy_flag' }), true)
    await wrapper.get('[data-testid="conclusion-line-subject"]').trigger('click')
    expect(wrapper.get('[data-option-value="FILE_1:legacy_flag"]').text()).toBe('NetSuite › legacy_flag')
  })

  it('choosing a field sets presence ANY and keeps a loaded presence', async () => {
    const record = mountLine({ subject: 'FILE_1', presence: 'KEPT', keyScope: 'FULL', field: null, operator: null, values: [], checkLabel: '' }, true)
    await pick(record, 'conclusion-line-subject', 'FILE_1:billing_status')
    expect(last(record)).toMatchObject({ field: 'billing_status', presence: 'ANY', keyScope: 'FULL' })

    const loaded = mountLine(statusLine({ presence: 'EXCLUDED' }), true)
    expect(loaded.find('[data-testid="conclusion-line-presence"]').exists()).toBe(true)
    await pick(loaded, 'conclusion-line-subject', 'FILE_2:lines.status')
    expect(last(loaded)).toMatchObject({ subject: 'FILE_2', field: 'lines.status', presence: 'EXCLUDED' })

    expect(mountLine(statusLine(), true).find('[data-testid="conclusion-line-presence"]').exists()).toBe(false)
  })

  it('list field shows any/every/no', async () => {
    const wrapper = mountLine(statusLine({ subject: 'FILE_2', field: 'lines.status', quantifier: 'ANY' }), true)
    expect(wrapper.find('[data-testid="conclusion-line-quantifier"]').exists()).toBe(true)
    await pick(wrapper, 'conclusion-line-quantifier', 'NONE')
    expect(last(wrapper)).toMatchObject({ quantifier: 'ALL', operator: 'NOT_IN' })
    await pick(wrapper, 'conclusion-line-quantifier', 'ALL')
    expect(last(wrapper)).toMatchObject({ quantifier: 'ALL', operator: 'IN' })

    expect(mountLine(statusLine(), true).find('[data-testid="conclusion-line-quantifier"]').exists()).toBe(false)
    const none = mountLine(statusLine({ subject: 'FILE_2', field: 'lines.status', quantifier: 'ALL', operator: 'NOT_IN' }), true)
    expect(none.get('[data-testid="conclusion-line-quantifier"]').text()).toContain('no')
  })

  it('type a path keeps the typed field', async () => {
    const wrapper = mountLine(statusLine(), true)
    await pick(wrapper, 'conclusion-line-subject', '__path__')
    const input = wrapper.get('[data-testid="conclusion-line-path-input"]')
    await input.setValue('shipping.carrier')
    expect(last(wrapper)).toMatchObject({ subject: 'FILE_1', field: 'shipping.carrier' })
    await pick(wrapper, 'conclusion-line-side', 'FILE_2')
    expect(last(wrapper)).toMatchObject({ subject: 'FILE_2' })
  })

  it('field-to-field tests are disabled', async () => {
    const wrapper = mountLine(statusLine(), true)
    await wrapper.get('[data-testid="conclusion-line-test"]').trigger('click')
    const option = wrapper.get('[data-option-value="FIELD_EQ"]')
    expect(option.attributes('aria-disabled')).toBe('true')
    expect(option.text()).toContain('arrives with the new rules')
    await option.trigger('click')
    expect(wrapper.emitted('update')).toBeUndefined()
  })

  it('changing the test clears values of another kind and keeps like ones', async () => {
    const wrapper = mountLine(statusLine(), true)
    await pick(wrapper, 'conclusion-line-test', 'GT')
    expect(last(wrapper)).toMatchObject({ operator: 'GT', values: [] })
    const num = mountLine(statusLine({ operator: 'GT', values: ['3'] }), true)
    await pick(num, 'conclusion-line-test', 'LT')
    expect(last(num)).toMatchObject({ operator: 'LT', values: ['3'] })
    await num.get('[data-testid="conclusion-line-number-input"]').setValue('9')
    expect(last(num).values).toEqual(['9'])
  })

  it('takes hours for a within-hours test and nothing for a blank test', () => {
    expect(mountLine(statusLine({ operator: 'WITHIN_HOURS', values: ['24'] }), true).find('[data-testid="conclusion-line-number-input"]').exists()).toBe(true)
    const blank = mountLine(statusLine({ operator: 'BLANK', values: [] }), true)
    expect(blank.find('[data-testid="conclusion-line-number-input"]').exists()).toBe(false)
    expect(blank.find('[data-testid="conclusion-line-tag-input"]').exists()).toBe(false)
  })
})
