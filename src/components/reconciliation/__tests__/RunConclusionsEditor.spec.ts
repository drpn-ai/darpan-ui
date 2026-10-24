import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { RunConclusionNode, RunConclusions } from '../../../lib/api/authoringTypes'

const getConclusions = vi.hoisted(() => vi.fn())
const saveConclusions = vi.hoisted(() => vi.fn())
const createCode = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/authoringFacade', () => ({
  runConclusionFacade: { get: getConclusions, save: saveConclusions, createCode },
}))

import { ApiCallError } from '../../../lib/api/client'
import AppSelect from '../../ui/AppSelect.vue'
import RunConclusionsEditor from '../RunConclusionsEditor.vue'

function tree(scopeMode = 'COMPARE'): RunConclusions {
  return {
    savedRunId: 'RS_RETURNS',
    scopeMode,
    conclusions: [
      {
        key: '10',
        parent: null,
        conclusion: 'CONC_RETURN_NOT_IN_NETSUITE',
        label: 'Return not in NetSuite',
        bucket: 'MISSING_FROM_FILE_2',
        question: 'Is the return done?',
        fix: 'Fulfil {orderInNetsuite.tranId} in NetSuite.',
        conditions: [
          {
            subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL',
            field: 'statusId', operator: 'IN', values: ['RETURN_COMPLETED', 'RETURN_RECEIVED'],
            checkLabel: 'The return is completed or received in the OMS',
          },
        ],
      },
      {
        key: '20',
        parent: '10',
        conclusion: 'CONC_RETURN_NO_ORDER_NOT_SYNCED',
        label: 'Return names no order',
        bucket: null,
        question: null,
        conditions: [
          {
            subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL',
            field: 'orderExternalId', operator: 'BLANK', values: [], checkLabel: 'The return names no order',
          },
        ],
      },
      {
        key: '30',
        parent: '20',
        conclusion: 'CONC_MEMO_LEFT_OPEN',
        label: 'Memo left open',
        bucket: null,
        question: null,
        conditions: [
          {
            subject: 'FILE_2', presence: 'EXCLUDED', keyScope: 'FIRST_FIELD', quantifier: 'ALL',
            field: null, operator: null, values: [], checkLabel: 'Screened out of NetSuite',
          },
        ],
      },
      {
        key: '40',
        parent: null,
        conclusion: 'CONC_NO_CUSTOMER_NAME',
        label: 'No customer name',
        bucket: 'FINDING',
        question: null,
        conditions: [
          {
            subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL',
            field: 'returnId', operator: 'NOT_BLANK', values: [], checkLabel: "A return's RMA",
          },
        ],
      },
    ],
    catalog: [
      { id: 'CONC_RETURN_NOT_IN_NETSUITE', label: 'Return not in NetSuite' },
      { id: 'CONC_RETURN_NO_ORDER_NOT_SYNCED', label: 'Return names no order' },
      { id: 'CONC_MEMO_LEFT_OPEN', label: 'Memo left open' },
      { id: 'CONC_NO_CUSTOMER_NAME', label: 'No customer name' },
    ],
    buckets: ['MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING'],
    operators: ['IN', 'NOT_IN', 'GT', 'GT_ZERO', 'WITHIN_HOURS', 'BLANK', 'NOT_BLANK'],
    presence: ['ANY', 'KEPT', 'EXCLUDED', 'ABSENT'],
    keyScopes: ['FULL', 'FIRST_FIELD'],
    quantifiers: ['ALL', 'ANY'],
  }
}

async function mountEditor(scopeMode = 'COMPARE'): Promise<VueWrapper> {
  getConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: tree(scopeMode) })
  const wrapper = mount(RunConclusionsEditor, {
    props: { savedRunId: 'RS_RETURNS', file1Label: 'OMS', file2Label: 'NetSuite' },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

function nodeAt(wrapper: VueWrapper, index: number) {
  return wrapper.findAll('[data-testid="run-conclusions-node"]')[index]
}

function selectsIn(wrapper: VueWrapper, testId: string) {
  return wrapper.findAllComponents(AppSelect).filter((select) => select.props('testId') === testId)
}

function savedPayload(): RunConclusionNode[] {
  return saveConclusions.mock.calls.at(-1)?.[1] as RunConclusionNode[]
}

describe('RunConclusionsEditor', () => {
  beforeEach(() => {
    getConclusions.mockReset()
    saveConclusions.mockReset()
    createCode.mockReset()
  })

  it('renders the loaded tree in order, each node indented under its parent', async () => {
    const wrapper = await mountEditor()

    expect(getConclusions).toHaveBeenCalledWith('RS_RETURNS', expect.any(AbortSignal))
    const nodes = wrapper.findAll('[data-testid="run-conclusions-node"]')
    expect(nodes.map((node) => node.attributes('data-key'))).toEqual(['10', '20', '30', '40'])
    expect(nodes.map((node) => node.attributes('data-depth'))).toEqual(['1', '2', '3', '1'])
    expect(nodes.map((node) => node.classes('run-conclusions-node--child'))).toEqual([false, true, true, false])
    expect(nodes[2]?.attributes('style')).toContain('--run-conclusions-depth: 2')
    // Only roots say which rows they apply to.
    expect(selectsIn(wrapper, 'run-conclusions-bucket').map((select) => select.props('modelValue'))).toEqual([
      'MISSING_FROM_FILE_2',
      'FINDING',
    ])
    expect(wrapper.text()).toContain('Return not in NetSuite')
    wrapper.unmount()
  })

  it('a one-system run never offers the second side', async () => {
    const compare = await mountEditor('COMPARE')
    expect(selectsIn(compare, 'run-conclusions-subject')).toHaveLength(4)
    compare.unmount()

    const evaluate = await mountEditor('EVALUATE')
    expect(selectsIn(evaluate, 'run-conclusions-subject')).toHaveLength(0)
    // The stored MISSING_FROM_FILE_2 root keeps its value; a new root is not offered it.
    await evaluate.get('[data-testid="run-conclusions-remove"]').trigger('click')
    const bucketValues = (selectsIn(evaluate, 'run-conclusions-bucket')[0]!.props('options') as { value: string }[]).map((o) => o.value)
    expect(bucketValues).toEqual(['', 'MISSING_FROM_FILE_1', 'RULE', 'FINDING'])
    await evaluate.get('[data-testid="run-conclusions-revert"]').trigger('click')

    await nodeAt(evaluate, 0)!.get('[data-testid="run-conclusions-question"]').setValue('Done?')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await evaluate.get('[data-testid="run-conclusions-save"]').trigger('click')
    await flushPromises()
    expect(savedPayload().flatMap((node) => node.conditions.map((condition) => condition.subject))).toEqual([
      'FILE_1', 'FILE_1', 'FILE_1', 'FILE_1',
    ])
    evaluate.unmount()
  })

  it('cannot add a child under a third-level conclusion', async () => {
    const wrapper = await mountEditor()
    const addChild = wrapper.findAll('[data-testid="run-conclusions-add-child"]')
    expect(addChild.map((button) => button.attributes('disabled') !== undefined)).toEqual([false, false, true, false])

    // A child added under the second level lands at the third, where it cannot take children either.
    await addChild[1]!.trigger('click')
    const nodes = wrapper.findAll('[data-testid="run-conclusions-node"]')
    expect(nodes.map((node) => node.attributes('data-depth'))).toEqual(['1', '2', '3', '3', '1'])
    expect(nodes[3]!.get('[data-testid="run-conclusions-add-child"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('saves the whole tree: keys and parents kept, values as lists, none for a no-value operator', async () => {
    const wrapper = await mountEditor()
    expect(wrapper.get('[data-testid="run-conclusions-save"]').attributes('disabled')).toBeDefined()

    // Edit a value list (commas split it) and add a child under the last root.
    await nodeAt(wrapper, 0)!.get('[data-testid="run-conclusions-values"]').setValue('RETURN_COMPLETED, RETURN_RECEIVED,RETURN_ACCEPTED')
    await nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-add-child"]').trigger('click')
    const added = nodeAt(wrapper, 4)!
    selectsIn(wrapper, 'run-conclusions-conclusion').at(-1)!.vm.$emit('update:modelValue', 'CONC_MEMO_LEFT_OPEN')
    await added.get('[data-testid="run-conclusions-field"]').setValue('status')
    selectsIn(wrapper, 'run-conclusions-operator').at(-1)!.vm.$emit('update:modelValue', 'NOT_IN')
    await flushPromises()
    await nodeAt(wrapper, 4)!.get('[data-testid="run-conclusions-values"]').setValue('Credit Memo : Open')
    await nodeAt(wrapper, 4)!.get('[data-testid="run-conclusions-check-label"]').setValue('The memo is not open')

    const stored = tree()
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: stored })
    await wrapper.get('[data-testid="run-conclusions-save"]').trigger('click')
    await flushPromises()

    expect(saveConclusions).toHaveBeenCalledWith('RS_RETURNS', expect.any(Array), expect.any(AbortSignal))
    const payload = savedPayload()
    expect(payload.map((node) => [node.key, node.parent])).toEqual([
      ['10', null], ['20', '10'], ['30', '20'], ['40', null], [payload[4]!.key, '40'],
    ])
    expect(payload[4]!.key).toMatch(/^new-/)
    expect(payload[0]).toEqual({
      key: '10',
      parent: null,
      conclusion: 'CONC_RETURN_NOT_IN_NETSUITE',
      bucket: 'MISSING_FROM_FILE_2',
      question: 'Is the return done?',
      fix: 'Fulfil {orderInNetsuite.tranId} in NetSuite.',
      conditions: [{
        subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL', field: 'statusId', operator: 'IN',
        values: ['RETURN_COMPLETED', 'RETURN_RECEIVED', 'RETURN_ACCEPTED'],
        checkLabel: 'The return is completed or received in the OMS',
      }],
    })
    // A child carries no bucket; a presence-only check sends no field or operator.
    expect(payload[1]!.bucket).toBeNull()
    expect(payload[2]!.conditions[0]).toMatchObject({ subject: 'FILE_2', presence: 'EXCLUDED', keyScope: 'FIRST_FIELD', field: null, operator: null, values: [] })
    expect(payload[3]!.conditions[0]).toMatchObject({ operator: 'NOT_BLANK', values: [] })
    expect(payload[4]).toMatchObject({
      conclusion: 'CONC_MEMO_LEFT_OPEN',
      bucket: null,
      question: null,
      conditions: [{ subject: 'FILE_1', field: 'status', operator: 'NOT_IN', values: ['Credit Memo : Open'], checkLabel: 'The memo is not open' }],
    })
    expect(wrapper.emitted('saved')?.[0]).toEqual([stored])
    wrapper.unmount()
  })

  it('"is more than" takes one number and saves it as the one value', async () => {
    const wrapper = await mountEditor()
    selectsIn(wrapper, 'run-conclusions-operator').at(3)!.vm.$emit('update:modelValue', 'GT')
    await flushPromises()
    const amount = nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-amount"]')
    expect(amount.attributes('inputmode')).toBe('decimal')
    expect(nodeAt(wrapper, 3)!.find('[data-testid="run-conclusions-values"]').exists()).toBe(false)
    await amount.setValue(' 5 ')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: tree() })
    await wrapper.get('[data-testid="run-conclusions-save"]').trigger('click')
    await flushPromises()
    expect(savedPayload()[3]!.conditions[0]).toMatchObject({ field: 'returnId', operator: 'GT', values: ['5'] })
    wrapper.unmount()
  })

  // DAR-BE-124. Save replaces the whole tree: a cause's fix the editor does not show still goes back as loaded.
  it('saves each cause\'s fix as loaded, so a save never erases it', async () => {
    const wrapper = await mountEditor()
    await nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-check-label"]').setValue('A return has its RMA')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: tree() })
    await wrapper.get('[data-testid="run-conclusions-save"]').trigger('click')
    await flushPromises()
    expect(savedPayload().map((node) => node.fix ?? null)).toEqual(['Fulfil {orderInNetsuite.tranId} in NetSuite.', null, null, null])
    wrapper.unmount()
  })

  it('"is within the last hours" takes one number of hours and saves it as the one value', async () => {
    const wrapper = await mountEditor()
    selectsIn(wrapper, 'run-conclusions-operator').at(3)!.vm.$emit('update:modelValue', 'WITHIN_HOURS')
    await flushPromises()
    const hours = nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-amount"]')
    expect(hours.attributes('placeholder')).toBe('hours')
    await hours.setValue('24')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: tree() })
    await wrapper.get('[data-testid="run-conclusions-save"]').trigger('click')
    await flushPromises()
    expect(savedPayload()[3]!.conditions[0]).toMatchObject({ field: 'returnId', operator: 'WITHIN_HOURS', values: ['24'] })
    wrapper.unmount()
  })

  it('shows a stored "is more than" with its number', async () => {
    const stored = tree()
    stored.conclusions[3]!.conditions[0] = { ...stored.conclusions[3]!.conditions[0]!, field: 'unapplied', operator: 'GT', values: ['5'] }
    getConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: stored })
    const wrapper = mount(RunConclusionsEditor, { props: { savedRunId: 'RS_RETURNS', file1Label: 'OMS', file2Label: 'NetSuite' }, attachTo: document.body })
    await flushPromises()
    expect((nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-amount"]').element as HTMLInputElement).value).toBe('5')
    wrapper.unmount()
  })

  it('shows every refusal exactly as the service words it, and keeps the edits', async () => {
    const wrapper = await mountEditor()
    await nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-check-label"]').setValue('')
    saveConclusions.mockRejectedValue(new ApiCallError("'No customer name': every condition says what it checks.", 200, {
      result: { errors: ["'No customer name': every condition says what it checks.", "'Memo left open' is more than 3 levels deep."] },
    }))
    await wrapper.get('[data-testid="run-conclusions-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-testid="run-conclusions-error"]').map((error) => error.text())).toEqual([
      "'No customer name': every condition says what it checks.",
      "'Memo left open' is more than 3 levels deep.",
    ])
    expect((nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-check-label"]').element as HTMLInputElement).value).toBe('')
    expect(wrapper.emitted('saved')).toBeUndefined()
    wrapper.unmount()
  })

  it('revert puts back the tree as last loaded', async () => {
    const wrapper = await mountEditor()
    await nodeAt(wrapper, 0)!.get('[data-testid="run-conclusions-question"]').setValue('Changed?')
    await nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-remove"]').trigger('click')
    await nodeAt(wrapper, 0)!.get('[data-testid="run-conclusions-remove"]').trigger('click')
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(0)
    expect(wrapper.get('[data-testid="run-conclusions-revert"]').attributes('disabled')).toBeUndefined()

    await wrapper.get('[data-testid="run-conclusions-revert"]').trigger('click')

    const nodes = wrapper.findAll('[data-testid="run-conclusions-node"]')
    expect(nodes.map((node) => node.attributes('data-key'))).toEqual(['10', '20', '30', '40'])
    expect(nodes.map((node) => node.attributes('data-depth'))).toEqual(['1', '2', '3', '1'])
    expect((nodes[0]!.get('[data-testid="run-conclusions-question"]').element as HTMLInputElement).value).toBe('Is the return done?')
    expect(wrapper.get('[data-testid="run-conclusions-save"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('moves a root down with its children', async () => {
    const wrapper = await mountEditor()
    await nodeAt(wrapper, 0)!.get('[data-testid="run-conclusions-move-down"]').trigger('click')
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]').map((node) => node.attributes('data-key'))).toEqual([
      '40', '10', '20', '30',
    ])
    wrapper.unmount()
  })

  it('makes a new conclusion code from the picker and picks it on that node only', async () => {
    const wrapper = await mountEditor()
    const before = selectsIn(wrapper, 'run-conclusions-conclusion').map((select) => select.props('modelValue'))
    expect(wrapper.find('[data-testid="run-conclusions-new-code-row"]').exists()).toBe(false)

    await nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-new-code"]').trigger('click')
    const row = nodeAt(wrapper, 3)!.get('[data-testid="run-conclusions-new-code-row"]')
    expect(row.get('[data-testid="run-conclusions-new-code-add"]').attributes('disabled')).toBeDefined()
    await row.get('[data-testid="run-conclusions-new-code-label"]').setValue('  Gift card return  ')
    createCode.mockResolvedValue({
      ok: true, messages: [], errors: [], conclusionCode: { id: 'TNT_GIFT_CARD_RETURN', label: 'Gift card return', own: true },
    })
    await row.get('[data-testid="run-conclusions-new-code-add"]').trigger('click')
    await flushPromises()

    expect(createCode).toHaveBeenCalledWith('Gift card return')
    expect(wrapper.find('[data-testid="run-conclusions-new-code-row"]').exists()).toBe(false)
    const pickers = selectsIn(wrapper, 'run-conclusions-conclusion')
    expect(pickers.map((select) => select.props('modelValue'))).toEqual([...before.slice(0, 3), 'TNT_GIFT_CARD_RETURN'])
    for (const picker of pickers) {
      expect(picker.props('options')).toContainEqual({ value: 'TNT_GIFT_CARD_RETURN', label: 'Gift card return' })
    }
    expect(pickers[0]!.props('options')).toHaveLength(5)
    // Picking it is an unsaved edit like any other: nothing is saved or reloaded.
    expect(saveConclusions).not.toHaveBeenCalled()
    expect(getConclusions).toHaveBeenCalledTimes(1)
    expect(wrapper.get('[data-testid="run-conclusions-save"]').attributes('disabled')).toBeUndefined()
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]').map((node) => node.attributes('data-key'))).toEqual([
      '10', '20', '30', '40',
    ])
    wrapper.unmount()
  })

  it('shows a new-code refusal as the service words it and keeps the node as it was', async () => {
    const wrapper = await mountEditor()
    await nodeAt(wrapper, 0)!.get('[data-testid="run-conclusions-new-code"]').trigger('click')
    const row = nodeAt(wrapper, 0)!.get('[data-testid="run-conclusions-new-code-row"]')
    await row.get('[data-testid="run-conclusions-new-code-label"]').setValue('Memo left open')
    createCode.mockResolvedValue({ ok: false, messages: [], errors: ["'Memo left open' is already a conclusion."], conclusionCode: null })
    await row.get('[data-testid="run-conclusions-new-code-label"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(createCode).toHaveBeenCalledWith('Memo left open')
    expect(wrapper.findAll('[data-testid="run-conclusions-new-code-error"]').map((error) => error.text())).toEqual([
      "'Memo left open' is already a conclusion.",
    ])
    expect(wrapper.find('[data-testid="run-conclusions-error"]').exists()).toBe(false)
    expect((wrapper.get('[data-testid="run-conclusions-new-code-label"]').element as HTMLInputElement).value).toBe('Memo left open')
    expect(selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.props('modelValue')).toBe('CONC_RETURN_NOT_IN_NETSUITE')
    expect(selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.props('options')).toHaveLength(4)
    expect(wrapper.get('[data-testid="run-conclusions-save"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })
})
