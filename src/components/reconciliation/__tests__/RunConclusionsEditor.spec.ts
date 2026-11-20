import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, provide, ref } from 'vue'
import type { RunConclusionNode, RunConclusions } from '../../../lib/api/authoringTypes'

const getConclusions = vi.hoisted(() => vi.fn())
const saveConclusions = vi.hoisted(() => vi.fn())
const createCode = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/authoringFacade', () => ({
  runConclusionFacade: { get: getConclusions, save: saveConclusions, createCode },
}))

import { ApiCallError } from '../../../lib/api/client'
import { RUN_CONCLUSIONS_KEY, useRunConclusions } from '../../../composables/useRunConclusions'
import AppSelect from '../../ui/AppSelect.vue'
import RunConclusionRows from '../RunConclusionRows.vue'
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
        outcome: 'EXPECTED',
        suggestedFilterJson: '{"fieldExpression":"returnId","operator":"EXCLUDE_IN","values":["R1"]}',
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
    operators: ['IN', 'NOT_IN', 'GT', 'LT', 'GT_ZERO', 'WITHIN_HOURS', 'BLANK', 'NOT_BLANK'],
    presence: ['ANY', 'KEPT', 'EXCLUDED', 'ABSENT'],
    keyScopes: ['FULL', 'FIRST_FIELD'],
    quantifiers: ['ALL', 'ANY'],
  }
}

/** The page's wiring in miniature: it holds the tree and provides it to the rows and the popup. */
function harness(editable = true) {
  return defineComponent({
    setup() {
      const state = useRunConclusions({ savedRunId: ref('RS_RETURNS'), file1Label: computed(() => 'OMS'), file2Label: computed(() => 'NetSuite') })
      provide(RUN_CONCLUSIONS_KEY, state)
      return () => h('div', [h(RunConclusionRows, { editable }), h(RunConclusionsEditor)])
    },
  })
}

async function mountEditor(scopeMode = 'COMPARE', editable = true, stored: RunConclusions = tree(scopeMode)): Promise<VueWrapper> {
  getConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: stored })
  const wrapper = mount(harness(editable), { attachTo: document.body })
  await flushPromises()
  return wrapper
}

function rowAt(wrapper: VueWrapper, index: number) {
  return wrapper.findAll('[data-testid="run-conclusions-node"]')[index]!
}

async function openRow(wrapper: VueWrapper, index: number) {
  await rowAt(wrapper, index).get('[data-testid="run-conclusions-open"]').trigger('click')
  return popup(wrapper)
}

function popup(wrapper: VueWrapper) {
  return wrapper.get('[data-testid="run-conclusion-popup"]')
}

function selectsIn(wrapper: VueWrapper, testId: string) {
  return wrapper.findAllComponents(AppSelect).filter((select) => select.props('testId') === testId)
}

function savedPayload(): RunConclusionNode[] {
  return saveConclusions.mock.calls.at(-1)?.[1] as RunConclusionNode[]
}

async function save(wrapper: VueWrapper) {
  await popup(wrapper).get('[data-testid="run-conclusions-save"]').trigger('click')
  await flushPromises()
}

describe('RunConclusionsEditor', () => {
  beforeEach(() => {
    getConclusions.mockReset()
    saveConclusions.mockReset()
    createCode.mockReset()
  })

  it('lists the loaded tree as rows in order, each child indented under its parent with an arrow', async () => {
    const wrapper = await mountEditor()

    expect(getConclusions).toHaveBeenCalledWith('RS_RETURNS', expect.any(AbortSignal))
    const rows = wrapper.findAll('[data-testid="run-conclusions-node"]')
    expect(rows.map((row) => row.attributes('data-key'))).toEqual(['10', '20', '30', '40'])
    expect(rows.map((row) => row.attributes('data-depth'))).toEqual(['1', '2', '3', '1'])
    expect(rows[2]?.attributes('style')).toContain('--run-conclusion-depth: 2')
    expect(rows.map((row) => row.find('.run-conclusion__arrow').exists())).toEqual([false, true, true, false])
    // The order they are tried in: roots 1, 2; children numbered under their parent.
    expect(wrapper.findAll('[data-testid="run-conclusions-number"]').map((number) => number.text())).toEqual(['1', '1.1', '1.1.1', '2'])
    // Code (by its catalog label) over what it applies to | question | when, in words | outcome.
    expect(rows[0]!.get('.run-conclusion__name').text()).toBe('Return not in NetSuite')
    expect(rows[0]!.get('.run-conclusion__question').text()).toBe('Is the return done?')
    expect(rows[0]!.get('[data-testid="run-conclusions-when"]').text()).toBe('OMS statusId is one of RETURN_COMPLETED, RETURN_RECEIVED')
    expect(rows[1]!.get('.run-conclusion__question').text()).toBe('—')
    expect(rows[2]!.get('[data-testid="run-conclusions-when"]').text()).toBe('NetSuite excluded on its first key field')
    expect(rows[3]!.get('[data-testid="run-conclusions-when"]').text()).toBe('OMS returnId has a value')
    // Only a root says what it applies to.
    expect(rows.map((row) => row.find('[data-testid="run-conclusions-applies"]').exists() ? row.get('[data-testid="run-conclusions-applies"]').text() : null))
      .toEqual(['Missing from NetSuite', null, null, 'Every finding'])
    expect(wrapper.findAll('[data-testid="run-conclusions-outcome"]').map((pill) => pill.text())).toEqual(['Shown', 'Shown', 'Shown', 'Expected'])
    expect(rows[3]!.get('[data-testid="run-conclusions-outcome"]').classes()).toContain('run-conclusion__outcome--quiet')
    expect(rows[0]!.get('[data-testid="run-conclusions-outcome"]').classes()).not.toContain('run-conclusion__outcome--quiet')
    expect(rows.map((row) => row.find('[data-testid="run-conclusions-suggests"]').exists())).toEqual([false, false, false, true])
    expect(rows[3]!.get('[data-testid="run-conclusions-suggests"]').text()).toBe('suggests a filter')
    // No open selects on the page: the editing controls live in the popup only.
    expect(wrapper.findAllComponents(AppSelect)).toHaveLength(0)
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)
    expect(rows[0]!.get('[data-testid="run-conclusions-open"]').attributes('aria-label')).toBe('Open conclusion Return not in NetSuite')
    wrapper.unmount()
  })

  it('shows the rows read-only to someone who cannot edit: no buttons, no create tile', async () => {
    const wrapper = await mountEditor('COMPARE', false)

    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="run-conclusions-open"]').element.tagName).toBe('DIV')
    expect(wrapper.find('[data-testid="run-conclusions-node"] button').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-conclusions-new"]').exists()).toBe(false)
    await wrapper.get('[data-testid="run-conclusions-open"]').trigger('click')
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('opens a row in the popup with exactly that node\'s fields', async () => {
    const wrapper = await mountEditor()
    const dialog = await openRow(wrapper, 0)

    expect(dialog.attributes('role')).toBe('dialog')
    expect(dialog.get('#run-conclusion-popup-title').text()).toBe('Return not in NetSuite')
    expect(selectsIn(wrapper, 'run-conclusions-conclusion').map((select) => select.props('modelValue'))).toEqual(['CONC_RETURN_NOT_IN_NETSUITE'])
    expect(selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.props('searchable')).toBe(true)
    // Only a root says which rows it applies to.
    expect(selectsIn(wrapper, 'run-conclusions-bucket').map((select) => select.props('modelValue'))).toEqual(['MISSING_FROM_FILE_2'])
    expect((dialog.get('[data-testid="run-conclusions-question"]').element as HTMLInputElement).value).toBe('Is the return done?')
    expect(dialog.findAll('[data-testid="run-conclusions-condition"]')).toHaveLength(1)
    expect((dialog.get('[data-testid="run-conclusions-values"]').element as HTMLInputElement).value).toBe('RETURN_COMPLETED, RETURN_RECEIVED')
    expect(dialog.find('[data-testid="run-conclusions-save"]').exists()).toBe(true)
    expect(dialog.find('[data-testid="run-conclusions-cancel"]').exists()).toBe(true)
    expect(dialog.get('[data-testid="run-conclusions-delete"]').attributes('aria-label')).toBe('Delete conclusion')
    expect(dialog.find('select').exists()).toBe(false)
    expect(dialog.find('input[type="checkbox"]').exists()).toBe(false)

    await dialog.get('[data-testid="run-conclusions-cancel"]').trigger('click')
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)

    await openRow(wrapper, 1)
    expect(selectsIn(wrapper, 'run-conclusions-bucket')).toHaveLength(0)
    wrapper.unmount()
  })

  it('a one-system run never offers the second side', async () => {
    const compare = await mountEditor('COMPARE')
    await openRow(compare, 0)
    expect(selectsIn(compare, 'run-conclusions-subject')).toHaveLength(1)
    compare.unmount()

    const evaluate = await mountEditor('EVALUATE')
    expect(evaluate.findAll('[data-testid="run-conclusions-when"]')[0]!.text()).toBe('statusId is one of RETURN_COMPLETED, RETURN_RECEIVED')
    await openRow(evaluate, 0)
    expect(selectsIn(evaluate, 'run-conclusions-subject')).toHaveLength(0)
    // The stored MISSING_FROM_FILE_2 root keeps its value and is still offered it.
    const bucketValues = (selectsIn(evaluate, 'run-conclusions-bucket')[0]!.props('options') as { value: string }[]).map((o) => o.value)
    expect(bucketValues).toEqual(['', 'MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING'])

    await popup(evaluate).get('[data-testid="run-conclusions-question"]').setValue('Done?')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(evaluate)
    expect(savedPayload().flatMap((node) => node.conditions.map((condition) => condition.subject))).toEqual([
      'FILE_1', 'FILE_1', 'FILE_1', 'FILE_1',
    ])
    evaluate.unmount()
  })

  it('saves the whole tree from a popup: keys and parents kept, values as lists, none for a no-value operator', async () => {
    const wrapper = await mountEditor()
    const dialog = await openRow(wrapper, 0)
    await dialog.get('[data-testid="run-conclusions-values"]').setValue('RETURN_COMPLETED, RETURN_RECEIVED,RETURN_ACCEPTED')

    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: tree() })
    await save(wrapper)

    expect(saveConclusions).toHaveBeenCalledWith('RS_RETURNS', expect.any(Array), expect.any(AbortSignal))
    const payload = savedPayload()
    expect(payload.map((node) => [node.key, node.parent])).toEqual([['10', null], ['20', '10'], ['30', '20'], ['40', null]])
    expect(payload[0]).toEqual({
      key: '10',
      parent: null,
      conclusion: 'CONC_RETURN_NOT_IN_NETSUITE',
      bucket: 'MISSING_FROM_FILE_2',
      question: 'Is the return done?',
      fix: 'Fulfil {orderInNetsuite.tranId} in NetSuite.',
      outcome: null,
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
    // The outcome goes back as shown; the suggested filter is not sent, so the service keeps it with its rule (DAR-BE-198).
    expect(payload[3]!.outcome).toBe('EXPECTED')
    expect(payload.some((node) => 'suggestedFilterJson' in node || 'engine' in node)).toBe(false)
    // DAR-BE-124: every cause's fix goes back as loaded, so a save never erases it.
    expect(payload.map((node) => node.fix ?? null)).toEqual(['Fulfil {orderInNetsuite.tranId} in NetSuite.', null, null, null])
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('closes without a call when nothing in the popup changed', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    await save(wrapper)

    expect(saveConclusions).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('adds and removes conditions in the popup', async () => {
    const wrapper = await mountEditor()
    const dialog = await openRow(wrapper, 3)
    expect(dialog.get('[data-testid="run-conclusions-remove-condition"]').attributes('disabled')).toBeDefined()

    await dialog.get('[data-testid="run-conclusions-add-condition"]').trigger('click')
    const conditions = popup(wrapper).findAll('[data-testid="run-conclusions-condition"]')
    expect(conditions).toHaveLength(2)
    await conditions[1]!.get('[data-testid="run-conclusions-field"]').setValue('status')
    await conditions[1]!.get('[data-testid="run-conclusions-values"]').setValue('Open')
    await conditions[1]!.get('[data-testid="run-conclusions-check-label"]').setValue('The return is open')
    await conditions[0]!.get('[data-testid="run-conclusions-remove-condition"]').trigger('click')
    expect(popup(wrapper).findAll('[data-testid="run-conclusions-condition"]')).toHaveLength(1)

    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(wrapper)
    expect(savedPayload()[3]!.conditions).toEqual([
      { subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL', field: 'status', operator: 'IN', values: ['Open'], checkLabel: 'The return is open' },
    ])
    // Saved without a tree back: the rows read the edit as it was sent.
    expect(wrapper.findAll('[data-testid="run-conclusions-when"]')[3]!.text()).toBe('OMS status is one of Open')
    wrapper.unmount()
  })

  it('"is more than" takes one number and saves it as the one value', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    selectsIn(wrapper, 'run-conclusions-operator')[0]!.vm.$emit('update:modelValue', 'GT')
    await flushPromises()
    const amount = popup(wrapper).get('[data-testid="run-conclusions-amount"]')
    expect(amount.attributes('inputmode')).toBe('decimal')
    expect(popup(wrapper).find('[data-testid="run-conclusions-values"]').exists()).toBe(false)
    await amount.setValue(' 5 ')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: tree() })
    await save(wrapper)
    expect(savedPayload()[3]!.conditions[0]).toMatchObject({ field: 'returnId', operator: 'GT', values: ['5'] })
    wrapper.unmount()
  })

  it('"is within the last hours" takes one number of hours and reads as hours on its row', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    selectsIn(wrapper, 'run-conclusions-operator')[0]!.vm.$emit('update:modelValue', 'WITHIN_HOURS')
    await flushPromises()
    const hours = popup(wrapper).get('[data-testid="run-conclusions-amount"]')
    expect(hours.attributes('placeholder')).toBe('hours')
    await hours.setValue('24')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(wrapper)
    expect(savedPayload()[3]!.conditions[0]).toMatchObject({ field: 'returnId', operator: 'WITHIN_HOURS', values: ['24'] })
    expect(wrapper.findAll('[data-testid="run-conclusions-when"]')[3]!.text()).toBe('OMS returnId is within the last 24 hours')
    wrapper.unmount()
  })

  it('"is less than" takes one number, saves it as the one value and reads back on its row (DAR-BE-327)', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    selectsIn(wrapper, 'run-conclusions-operator')[0]!.vm.$emit('update:modelValue', 'LT')
    await flushPromises()
    const amount = popup(wrapper).get('[data-testid="run-conclusions-amount"]')
    expect(amount.attributes('aria-label')).toBe('Less than')
    expect(popup(wrapper).find('[data-testid="run-conclusions-values"]').exists()).toBe(false)
    await amount.setValue('1728370800000')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(wrapper)
    expect(savedPayload()[3]!.conditions[0]).toMatchObject({ field: 'returnId', operator: 'LT', values: ['1728370800000'] })
    expect(wrapper.findAll('[data-testid="run-conclusions-when"]')[3]!.text()).toBe('OMS returnId is less than 1728370800000')
    wrapper.unmount()
  })

  it('shows a stored "is more than" with its number', async () => {
    const stored = tree()
    stored.conclusions[3]!.conditions[0] = { ...stored.conclusions[3]!.conditions[0]!, field: 'unapplied', operator: 'GT', values: ['5'] }
    const wrapper = await mountEditor('COMPARE', true, stored)
    expect(wrapper.findAll('[data-testid="run-conclusions-when"]')[3]!.text()).toBe('OMS unapplied is more than 5')
    await openRow(wrapper, 3)
    expect((popup(wrapper).get('[data-testid="run-conclusions-amount"]').element as HTMLInputElement).value).toBe('5')
    wrapper.unmount()
  })

  it('shows every refusal in the popup exactly as the service words it, and keeps the edits', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    await popup(wrapper).get('[data-testid="run-conclusions-check-label"]').setValue('')
    saveConclusions.mockRejectedValue(new ApiCallError("'No customer name': every condition says what it checks.", 200, {
      result: { errors: ["'No customer name': every condition says what it checks.", "'Memo left open' is more than 3 levels deep."] },
    }))
    await save(wrapper)

    expect(popup(wrapper).findAll('[data-testid="run-conclusions-error"]').map((error) => error.text())).toEqual([
      "'No customer name': every condition says what it checks.",
      "'Memo left open' is more than 3 levels deep.",
    ])
    expect((popup(wrapper).get('[data-testid="run-conclusions-check-label"]').element as HTMLInputElement).value).toBe('')
    wrapper.unmount()
  })

  it('cancel puts back the tree as it was when the popup opened', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 0)
    await popup(wrapper).get('[data-testid="run-conclusions-question"]').setValue('Changed?')
    selectsIn(wrapper, 'run-conclusions-order')[0]!.vm.$emit('update:modelValue', '1')
    await flushPromises()
    await popup(wrapper).get('[data-testid="run-conclusions-cancel"]').trigger('click')

    const rows = wrapper.findAll('[data-testid="run-conclusions-node"]')
    expect(rows.map((row) => row.attributes('data-key'))).toEqual(['10', '20', '30', '40'])
    expect(rows[0]!.get('.run-conclusion__question').text()).toBe('Is the return done?')
    expect(saveConclusions).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('picks a root\'s order among its siblings; its children move with it and the save sends the new order', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 0)
    const order = selectsIn(wrapper, 'run-conclusions-order')[0]!
    expect(order.props('modelValue')).toBe('0')
    expect(order.props('options')).toEqual([{ value: '0', label: '1' }, { value: '1', label: '2' }])
    order.vm.$emit('update:modelValue', '1')
    await flushPromises()
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]').map((row) => row.attributes('data-key'))).toEqual(['40', '10', '20', '30'])
    expect(wrapper.findAll('[data-testid="run-conclusions-number"]').map((number) => number.text())).toEqual(['1', '2', '2.1', '2.1.1'])
    expect(selectsIn(wrapper, 'run-conclusions-order')[0]!.props('modelValue')).toBe('1')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(wrapper)
    expect(savedPayload().map((node) => node.key)).toEqual(['40', '10', '20', '30'])
    wrapper.unmount()
  })

  it('numbers a child\'s order under its parent, and an only child has nothing to pick', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 1)
    const order = selectsIn(wrapper, 'run-conclusions-order')[0]!
    expect(order.props('options')).toEqual([{ value: '0', label: '1.1' }])
    expect(order.props('disabled')).toBe(true)
    wrapper.unmount()
  })

  it('sets a root\'s Applies to and any node\'s Outcome, and the rows read them back in words', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 0)
    const bucket = selectsIn(wrapper, 'run-conclusions-bucket')[0]!
    expect((bucket.props('options') as { value: string, label: string }[]).map((option) => option.label)).toEqual([
      'Any finding', 'Missing from OMS', 'Missing from NetSuite', 'A rule differs', 'Every finding',
    ])
    const outcome = selectsIn(wrapper, 'run-conclusions-outcome')[0]!
    expect(outcome.props('modelValue')).toBe('')
    expect(outcome.props('options')).toEqual([
      { value: '', label: 'Shown' }, { value: 'HIDE', label: 'Hidden' }, { value: 'EXPECTED', label: 'Expected' },
    ])
    bucket.vm.$emit('update:modelValue', 'RULE')
    outcome.vm.$emit('update:modelValue', 'HIDE')
    await flushPromises()
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(wrapper)

    expect(savedPayload()[0]).toMatchObject({ bucket: 'RULE', outcome: 'HIDE' })
    const first = rowAt(wrapper, 0)
    expect(first.get('[data-testid="run-conclusions-applies"]').text()).toBe('A rule differs')
    expect(first.get('[data-testid="run-conclusions-outcome"]').text()).toBe('Hidden')

    // A child has an outcome but no Applies to.
    await openRow(wrapper, 2)
    expect(selectsIn(wrapper, 'run-conclusions-bucket')).toHaveLength(0)
    expect(selectsIn(wrapper, 'run-conclusions-outcome')).toHaveLength(1)
    wrapper.unmount()
  })

  it('reads a blank Applies to as any finding', async () => {
    const stored = tree()
    stored.conclusions[0]!.bucket = null
    const wrapper = await mountEditor('COMPARE', true, stored)
    expect(rowAt(wrapper, 0).get('[data-testid="run-conclusions-applies"]').text()).toBe('Any finding')
    wrapper.unmount()
  })

  it('deletes a conclusion and every one under it through one save', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 1)
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await popup(wrapper).get('[data-testid="run-conclusions-delete"]').trigger('click')
    await flushPromises()

    expect(saveConclusions).toHaveBeenCalledTimes(1)
    expect(savedPayload().map((node) => node.key)).toEqual(['10', '40'])
    expect(wrapper.find('[data-testid="run-conclusion-popup"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]').map((row) => row.attributes('data-key'))).toEqual(['10', '40'])
    wrapper.unmount()
  })

  it('keeps the conclusion when a delete is refused, and says why in the popup', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    saveConclusions.mockRejectedValue(new ApiCallError('Not now.', 200, { result: { errors: ['Not now.'] } }))
    await popup(wrapper).get('[data-testid="run-conclusions-delete"]').trigger('click')
    await flushPromises()

    expect(popup(wrapper).get('[data-testid="run-conclusions-error"]').text()).toBe('Not now.')
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('adds a child from the popup and saves it under its parent', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    await popup(wrapper).get('[data-testid="run-conclusions-add-child"]').trigger('click')

    // The popup now holds the new child, a row already in place under its parent.
    expect(popup(wrapper).get('#run-conclusion-popup-title').text()).toBe('New conclusion')
    expect(selectsIn(wrapper, 'run-conclusions-bucket')).toHaveLength(0)
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]').map((row) => row.attributes('data-depth'))).toEqual(['1', '2', '3', '1', '2'])
    selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.vm.$emit('update:modelValue', 'CONC_MEMO_LEFT_OPEN')
    await popup(wrapper).get('[data-testid="run-conclusions-field"]').setValue('status')
    selectsIn(wrapper, 'run-conclusions-operator')[0]!.vm.$emit('update:modelValue', 'NOT_IN')
    await flushPromises()
    await popup(wrapper).get('[data-testid="run-conclusions-values"]').setValue('Credit Memo : Open')
    await popup(wrapper).get('[data-testid="run-conclusions-check-label"]').setValue('The memo is not open')

    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: tree() })
    await save(wrapper)
    const payload = savedPayload()
    expect(payload.map((node) => [node.key, node.parent])).toEqual([
      ['10', null], ['20', '10'], ['30', '20'], ['40', null], [payload[4]!.key, '40'],
    ])
    expect(payload[4]!.key).toMatch(/^new-/)
    expect(payload[4]).toMatchObject({
      conclusion: 'CONC_MEMO_LEFT_OPEN',
      bucket: null,
      question: null,
      conditions: [{ subject: 'FILE_1', field: 'status', operator: 'NOT_IN', values: ['Credit Memo : Open'], checkLabel: 'The memo is not open' }],
    })
    wrapper.unmount()
  })

  it('cannot add a child under a third-level conclusion', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 2)
    expect(popup(wrapper).get('[data-testid="run-conclusions-add-child"]').attributes('disabled')).toBeDefined()
    await popup(wrapper).get('[data-testid="run-conclusions-cancel"]').trigger('click')

    // A child added under the second level lands at the third, where it cannot take children either.
    await openRow(wrapper, 1)
    await popup(wrapper).get('[data-testid="run-conclusions-add-child"]').trigger('click')
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]').map((row) => row.attributes('data-depth'))).toEqual(['1', '2', '3', '3', '1'])
    expect(popup(wrapper).get('[data-testid="run-conclusions-add-child"]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
  })

  it('New conclusion opens the same popup empty, and Cancel leaves no row behind', async () => {
    const wrapper = await mountEditor()
    await wrapper.get('[data-testid="run-conclusions-new"]').trigger('click')

    expect(popup(wrapper).get('#run-conclusion-popup-title').text()).toBe('New conclusion')
    expect(selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.props('modelValue')).toBe('')
    expect(selectsIn(wrapper, 'run-conclusions-bucket')[0]!.props('modelValue')).toBe('')
    expect((popup(wrapper).get('[data-testid="run-conclusions-question"]').element as HTMLInputElement).value).toBe('')
    expect(popup(wrapper).findAll('[data-testid="run-conclusions-condition"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(5)

    await popup(wrapper).get('[data-testid="run-conclusions-cancel"]').trigger('click')
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(4)

    // Saved, it goes last among the roots.
    await wrapper.get('[data-testid="run-conclusions-new"]').trigger('click')
    selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.vm.$emit('update:modelValue', 'CONC_NO_CUSTOMER_NAME')
    selectsIn(wrapper, 'run-conclusions-bucket')[0]!.vm.$emit('update:modelValue', 'RULE')
    await popup(wrapper).get('[data-testid="run-conclusions-field"]').setValue('customerName')
    selectsIn(wrapper, 'run-conclusions-operator')[0]!.vm.$emit('update:modelValue', 'BLANK')
    await popup(wrapper).get('[data-testid="run-conclusions-check-label"]').setValue('No customer name')
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
    await save(wrapper)
    const payload = savedPayload()
    expect(payload).toHaveLength(5)
    expect(payload[4]).toMatchObject({ parent: null, conclusion: 'CONC_NO_CUSTOMER_NAME', bucket: 'RULE' })
    expect(payload[4]!.key).toMatch(/^new-/)
    wrapper.unmount()
  })

  it('a new conclusion deleted before it was ever saved goes without a call', async () => {
    const wrapper = await mountEditor()
    await wrapper.get('[data-testid="run-conclusions-new"]').trigger('click')
    await popup(wrapper).get('[data-testid="run-conclusions-delete"]').trigger('click')
    await flushPromises()

    expect(saveConclusions).not.toHaveBeenCalled()
    expect(wrapper.findAll('[data-testid="run-conclusions-node"]')).toHaveLength(4)
    wrapper.unmount()
  })

  it('shows "None yet." and still offers New conclusion when the run has none', async () => {
    const empty = { ...tree(), conclusions: [] }
    const wrapper = await mountEditor('COMPARE', true, empty)
    expect(wrapper.get('[data-testid="run-conclusions-empty"]').text()).toBe('None yet.')
    expect(wrapper.find('[data-testid="run-conclusions-new"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('makes a new conclusion code from the popup and picks it on that node only', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 3)
    expect(popup(wrapper).find('[data-testid="run-conclusions-new-code-row"]').exists()).toBe(false)

    await popup(wrapper).get('[data-testid="run-conclusions-new-code"]').trigger('click')
    const row = popup(wrapper).get('[data-testid="run-conclusions-new-code-row"]')
    expect(row.get('[data-testid="run-conclusions-new-code-add"]').attributes('disabled')).toBeDefined()
    await row.get('[data-testid="run-conclusions-new-code-label"]').setValue('  Gift card return  ')
    createCode.mockResolvedValue({
      ok: true, messages: [], errors: [], conclusionCode: { id: 'TNT_GIFT_CARD_RETURN', label: 'Gift card return', own: true },
    })
    await row.get('[data-testid="run-conclusions-new-code-add"]').trigger('click')
    await flushPromises()

    expect(createCode).toHaveBeenCalledWith('Gift card return')
    expect(popup(wrapper).find('[data-testid="run-conclusions-new-code-row"]').exists()).toBe(false)
    const picker = selectsIn(wrapper, 'run-conclusions-conclusion')[0]!
    expect(picker.props('modelValue')).toBe('TNT_GIFT_CARD_RETURN')
    expect(picker.props('options')).toContainEqual({ value: 'TNT_GIFT_CARD_RETURN', label: 'Gift card return' })
    expect(picker.props('options')).toHaveLength(5)
    // Picking it is an unsaved edit like any other: nothing is saved or reloaded.
    expect(saveConclusions).not.toHaveBeenCalled()
    expect(getConclusions).toHaveBeenCalledTimes(1)
    // The other rows keep theirs.
    expect(wrapper.findAll('.run-conclusion__name').slice(0, 3).map((name) => name.text())).toEqual([
      'Return not in NetSuite', 'Return names no order', 'Memo left open',
    ])
    wrapper.unmount()
  })

  it('shows a new-code refusal as the service words it and keeps the node as it was', async () => {
    const wrapper = await mountEditor()
    await openRow(wrapper, 0)
    await popup(wrapper).get('[data-testid="run-conclusions-new-code"]').trigger('click')
    const row = popup(wrapper).get('[data-testid="run-conclusions-new-code-row"]')
    await row.get('[data-testid="run-conclusions-new-code-label"]').setValue('Memo left open')
    createCode.mockRejectedValue(new ApiCallError("'Memo left open' is already a conclusion.", 200, {
      result: { errors: ["'Memo left open' is already a conclusion."] },
    }))
    await row.get('[data-testid="run-conclusions-new-code-label"]').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(createCode).toHaveBeenCalledWith('Memo left open')
    expect(saveConclusions).not.toHaveBeenCalled()
    expect(popup(wrapper).findAll('[data-testid="run-conclusions-new-code-error"]').map((error) => error.text())).toEqual([
      "'Memo left open' is already a conclusion.",
    ])
    expect(popup(wrapper).find('[data-testid="run-conclusions-error"]').exists()).toBe(false)
    expect((popup(wrapper).get('[data-testid="run-conclusions-new-code-label"]').element as HTMLInputElement).value).toBe('Memo left open')
    expect(selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.props('modelValue')).toBe('CONC_RETURN_NOT_IN_NETSUITE')
    expect(selectsIn(wrapper, 'run-conclusions-conclusion')[0]!.props('options')).toHaveLength(4)
    wrapper.unmount()
  })
})
