import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, defineComponent, h, ref } from 'vue'
import type { RunConclusionCondition, RunConclusionNode, RunConclusions } from '../../lib/api/authoringTypes'

const getConclusions = vi.hoisted(() => vi.fn())
const saveConclusions = vi.hoisted(() => vi.fn())
const createCode = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/authoringFacade', () => ({
  runConclusionFacade: { get: getConclusions, save: saveConclusions, createCode },
}))

import { ApiCallError } from '../../lib/api/client'
import { useRunConclusions, type RunConclusionsState } from '../useRunConclusions'

const STATUS_LINE: RunConclusionCondition = {
  subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL',
  field: 'statusId', operator: 'IN', values: ['RETURN_COMPLETED', 'RETURN_RECEIVED'],
  checkLabel: 'The return is completed or received in the OMS',
}
const NO_ORDER_LINE: RunConclusionCondition = {
  subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL',
  field: 'orderExternalId', operator: 'BLANK', values: [], checkLabel: 'The return names no order',
}
// A hand-written label on a first-key-field line: saving untouched must not rewrite it.
const SCREENED_LINE: RunConclusionCondition = {
  subject: 'FILE_2', presence: 'EXCLUDED', keyScope: 'FIRST_FIELD', quantifier: 'ALL',
  field: null, operator: null, values: [], checkLabel: 'Screened out of NetSuite',
}

function tree(overrides: Partial<RunConclusions> = {}): RunConclusions {
  return {
    savedRunId: 'RS_RETURNS',
    scopeMode: 'COMPARE',
    conclusions: [
      {
        key: '10', parent: null, conclusion: 'CONC_RETURN_NOT_IN_NETSUITE', label: 'Return not in NetSuite',
        bucket: 'MISSING_FROM_FILE_2', question: 'Is the return done?', fix: 'Fulfil it in NetSuite.', outcome: null,
        conditions: [STATUS_LINE],
      },
      {
        key: '20', parent: '10', conclusion: 'CONC_RETURN_NO_ORDER', label: 'Return names no order',
        bucket: null, question: null, outcome: 'HIDE', conditions: [NO_ORDER_LINE],
      },
      {
        key: '40', parent: null, conclusion: 'CONC_SCREENED', label: 'Screened out', bucket: 'FINDING',
        question: null, outcome: 'EXPECTED', conditions: [SCREENED_LINE],
        suggestedFilterJson: '{"fieldExpression":"returnId","operator":"EXCLUDE_IN","values":["R1"]}',
      },
    ],
    catalog: [
      { id: 'CONC_RETURN_NOT_IN_NETSUITE', label: 'Return not in NetSuite' },
      { id: 'CONC_RETURN_NO_ORDER', label: 'Return names no order' },
      { id: 'CONC_SCREENED', label: 'Screened out' },
    ],
    buckets: ['MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING'],
    operators: ['IN', 'NOT_IN', 'GT', 'LT', 'GT_ZERO', 'WITHIN_HOURS', 'BLANK', 'NOT_BLANK'],
    presence: ['ANY', 'KEPT', 'EXCLUDED', 'ABSENT'],
    keyScopes: ['FULL', 'FIRST_FIELD'],
    quantifiers: ['ALL', 'ANY'],
    lookups: [],
    unexplainedOutcome: null,
    ...overrides,
  }
}

async function setup(stored: RunConclusions = tree()): Promise<RunConclusionsState> {
  getConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: stored })
  let state: RunConclusionsState | null = null
  mount(defineComponent({
    setup() {
      state = useRunConclusions({
        savedRunId: ref('RS_RETURNS'),
        file1Label: computed(() => 'OMS'),
        file2Label: computed(() => 'NetSuite'),
        firstKeyField: ref('order_name'),
        listPaths: ref(new Set<string>()),
      })
      return () => h('div')
    },
  }))
  await flushPromises()
  return state!
}

function sent(): RunConclusionNode[] {
  return saveConclusions.mock.calls.at(-1)?.[1] as RunConclusionNode[]
}

function savedOk() {
  saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: null })
}

describe('useRunConclusions', () => {
  beforeEach(() => {
    getConclusions.mockReset()
    saveConclusions.mockReset()
    createCode.mockReset()
  })

  it('loads a tree with children as flat rows and is not dirty', async () => {
    const state = await setup()

    expect(getConclusions).toHaveBeenCalledWith('RS_RETURNS', expect.any(AbortSignal))
    expect(state.loaded.value).toBe(true)
    // The child ranks above its parent, carries its parent's line first, and explains its root's check.
    expect(state.list.value.map((node) => node.key)).toEqual(['20', '10', '40'])
    expect(state.list.value[0]!.bucket).toBe('MISSING_FROM_FILE_2')
    expect(state.list.value[0]!.lines.map((line) => line.condition)).toEqual([STATUS_LINE, NO_ORDER_LINE])
    expect(state.list.value[0]!.outcome).toBe('HIDE')
    expect(state.list.value[1]!.fix).toBe('Fulfil it in NetSuite.')
    expect(state.conclusionLabel(state.list.value[0]!)).toBe('Return names no order')
    expect(state.describeLines(state.list.value[0]!))
      .toBe('OMS statusId is one of RETURN_COMPLETED, RETURN_RECEIVED and OMS orderExternalId is empty')
    expect(state.list.value.map((node) => node.suggestsFilter)).toEqual([false, false, true])
    expect(state.unexplained.value).toBe('')
    expect(state.dirty.value).toBe(false)
    expect(state.incomplete.value).toBe(false)
  })

  it('save without edits sends untouched conditions unchanged', async () => {
    const state = await setup()
    savedOk()

    await expect(state.save()).resolves.toBe(true)

    expect(saveConclusions).toHaveBeenCalledTimes(1)
    expect(saveConclusions.mock.calls[0]![0]).toBe('RS_RETURNS')
    expect(saveConclusions.mock.calls[0]![3]).toBeUndefined()
    const payload = sent()
    expect(payload.map((node) => [node.key, node.parent])).toEqual([['20', null], ['10', null], ['40', null]])
    expect(payload[0]!.conditions).toEqual([STATUS_LINE, NO_ORDER_LINE])
    expect(payload[2]!.conditions).toEqual([SCREENED_LINE])
    // The filter suggestion is read only: never sent.
    expect(payload[2]).not.toHaveProperty('suggestedFilterJson')
    expect(payload[2]).not.toHaveProperty('suggestsFilter')
    expect(payload[0]).toMatchObject({ bucket: 'MISSING_FROM_FILE_2', outcome: 'HIDE', question: null })
    expect(payload[1]).toMatchObject({ bucket: 'MISSING_FROM_FILE_2', outcome: null, question: 'Is the return done?', fix: 'Fulfil it in NetSuite.' })
    expect(state.dirty.value).toBe(false)
  })

  it('move swaps neighbours and marks dirty', async () => {
    const state = await setup()
    const uid = state.list.value[1]!.uid

    state.move(uid, -1)
    expect(state.list.value.map((node) => node.key)).toEqual(['10', '20', '40'])
    expect(state.dirty.value).toBe(true)

    state.move(uid, 1)
    expect(state.list.value.map((node) => node.key)).toEqual(['20', '10', '40'])
    expect(state.dirty.value).toBe(false)

    // At either end it stays put.
    state.move(state.list.value[2]!.uid, 1)
    expect(state.list.value.map((node) => node.key)).toEqual(['20', '10', '40'])
  })

  it('cancel restores the loaded list', async () => {
    const state = await setup()
    state.updateConclusion(state.list.value[0]!.uid, { question: 'Changed?' })
    state.removeConclusion(state.list.value[2]!.uid)
    state.addConclusion()
    state.unexplained.value = 'EXPECTED'
    expect(state.dirty.value).toBe(true)

    state.cancel()

    expect(state.list.value.map((node) => node.key)).toEqual(['20', '10', '40'])
    expect(state.list.value[0]!.question).toBe('')
    expect(state.unexplained.value).toBe('')
    expect(state.dirty.value).toBe(false)
  })

  it('changing a line regenerates only that line\'s checkLabel', async () => {
    const state = await setup()
    const node = state.list.value[0]!
    const changed = node.lines[1]!
    state.updateLine(node.uid, changed.uid, { ...changed.condition, operator: 'NOT_BLANK' })
    const added = state.addLine(state.list.value[1]!.uid)
    state.updateLine(state.list.value[1]!.uid, added, {
      subject: 'FILE_2', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL',
      field: 'status', operator: 'IN', values: ['Open'], checkLabel: '',
    })
    savedOk()

    await expect(state.save()).resolves.toBe(true)

    const payload = sent()
    expect(payload[0]!.conditions.map((condition) => condition.checkLabel))
      .toEqual(['The return is completed or received in the OMS', 'OMS orderExternalId is not empty'])
    expect(payload[1]!.conditions.map((condition) => condition.checkLabel))
      .toEqual(['The return is completed or received in the OMS', 'NetSuite status is one of Open'])
    expect(payload[2]!.conditions[0]!.checkLabel).toBe('Screened out of NetSuite')
  })

  it('incomplete blocks save', async () => {
    const state = await setup()
    const uid = state.addConclusion()
    const node = state.list.value.find((entry) => entry.uid === uid)!
    expect(node).toMatchObject({ conclusion: '', bucket: '', outcome: '' })
    expect(node.lines).toHaveLength(1)
    state.updateConclusion(uid, { conclusion: 'CONC_SCREENED' })
    state.updateLine(uid, node.lines[0]!.uid, { ...node.lines[0]!.condition, field: 'statusId', operator: 'IN', values: [] })

    expect(state.incomplete.value).toBe(true)
    await expect(state.save()).resolves.toBe(false)
    expect(saveConclusions).not.toHaveBeenCalled()

    state.updateLine(uid, node.lines[0]!.uid, { ...node.lines[0]!.condition, field: 'statusId', operator: 'IN', values: ['X'] })
    expect(state.incomplete.value).toBe(false)
    savedOk()
    await expect(state.save()).resolves.toBe(true)
    // A new row's key is its place; no two rows share one.
    const keys = sent().map((entry) => entry.key)
    expect(keys).toEqual(['20', '10', '40', 'n3'])
  })

  it('unexplained Expected→Shown sends COUNTS; unchanged sends nothing', async () => {
    const state = await setup(tree({ unexplainedOutcome: 'EXPECTED' }))
    expect(state.unexplained.value).toBe('EXPECTED')
    expect(state.dirty.value).toBe(false)

    state.unexplained.value = ''
    expect(state.dirty.value).toBe(true)
    savedOk()
    await expect(state.save()).resolves.toBe(true)
    expect(saveConclusions.mock.calls[0]![3]).toEqual({ unexplainedOutcome: 'COUNTS' })
    expect(state.dirty.value).toBe(false)

    await expect(state.save()).resolves.toBe(true)
    expect(saveConclusions.mock.calls[1]![3]).toBeUndefined()
  })

  it('a refused save keeps the draft and shows the service errors', async () => {
    const state = await setup()
    state.updateConclusion(state.list.value[0]!.uid, { question: 'Still open?' })
    saveConclusions.mockRejectedValue(new ApiCallError('Refused.', 400, { result: { errors: ['A conclusion may hold at most 8 lines.'] } }))

    await expect(state.save()).resolves.toBe(false)

    expect(state.errors.value).toEqual(['A conclusion may hold at most 8 lines.'])
    expect(state.list.value[0]!.question).toBe('Still open?')
    expect(state.dirty.value).toBe(true)
    expect(state.saving.value).toBe(false)
  })

  it('after a save that returns the stored list, the list and its snapshot come from the response', async () => {
    const state = await setup()
    state.move(state.list.value[2]!.uid, -1)
    const stored = tree({
      conclusions: [
        { key: '10', parent: null, conclusion: 'CONC_RETURN_NO_ORDER', bucket: 'MISSING_FROM_FILE_2', question: null, outcome: 'HIDE', conditions: [STATUS_LINE, NO_ORDER_LINE] },
        { key: '20', parent: null, conclusion: 'CONC_SCREENED', bucket: 'FINDING', question: null, outcome: 'EXPECTED', conditions: [SCREENED_LINE] },
        { key: '30', parent: null, conclusion: 'CONC_RETURN_NOT_IN_NETSUITE', bucket: 'MISSING_FROM_FILE_2', question: 'Is the return done?', outcome: null, conditions: [STATUS_LINE] },
      ],
      unexplainedOutcome: 'EXPECTED',
    })
    saveConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], savedConclusions: stored })

    await expect(state.save()).resolves.toBe(true)

    expect(state.list.value.map((node) => [node.key, node.conclusion])).toEqual([
      ['10', 'CONC_RETURN_NO_ORDER'], ['20', 'CONC_SCREENED'], ['30', 'CONC_RETURN_NOT_IN_NETSUITE'],
    ])
    expect(state.unexplained.value).toBe('EXPECTED')
    expect(state.dirty.value).toBe(false)
    state.cancel()
    expect(state.list.value.map((node) => node.key)).toEqual(['10', '20', '30'])
  })

  it('a one-system run offers no missing-from-the-second-side check', async () => {
    const state = await setup(tree({
      scopeMode: 'EVALUATE',
      conclusions: [{ key: '10', parent: null, conclusion: 'CONC_SCREENED', bucket: 'FINDING', question: null, outcome: null, conditions: [STATUS_LINE] }],
    }))

    expect(state.isEvaluate.value).toBe(true)
    expect(state.bucketOptions.value).toEqual([
      { value: '', label: 'any check' },
      { value: 'MISSING_FROM_FILE_1', label: 'In OMS' },
      { value: 'RULE', label: 'the rules hold' },
      { value: 'FINDING', label: 'every finding' },
    ])
  })

  it('createCode adds the new code to the catalog and returns its id; a refusal keeps the service\'s words', async () => {
    const state = await setup()
    createCode.mockResolvedValueOnce({ ok: true, messages: [], errors: [], conclusionCode: { id: 'CONC_OWN_1', label: 'Late refund', own: true } })

    await expect(state.createCode('  Late refund ')).resolves.toBe('CONC_OWN_1')
    expect(createCode).toHaveBeenCalledWith('Late refund')
    expect(state.catalogOptions.value).toContainEqual({ value: 'CONC_OWN_1', label: 'Late refund' })
    expect(state.newCodeErrors.value).toEqual([])

    createCode.mockRejectedValueOnce(new ApiCallError('Refused.', 400, { result: { errors: ['Your catalog already has Late refund.'] } }))
    await expect(state.createCode('Late refund')).resolves.toBeNull()
    expect(state.newCodeErrors.value).toEqual(['Your catalog already has Late refund.'])
    expect(state.creating.value).toBe(false)
  })

  it('a new or changed line is normalised on save; an untouched one is not', async () => {
    const state = await setup()
    const node = state.list.value[0]!
    const [untouched, changed] = node.lines
    state.updateLine(node.uid, changed!.uid, { ...changed!.condition, field: '  statusId ', operator: 'IN', values: ['A, B', 'A', ' C ', ''] })
    const gt = state.addLine(node.uid)
    state.updateLine(node.uid, gt, { subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL', field: 'qty', operator: 'GT', values: ['5', '6'], checkLabel: '' })
    const blank = state.addLine(node.uid)
    state.updateLine(node.uid, blank, { subject: 'FILE_1', presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL', field: 'note ', operator: 'BLANK', values: ['x'], checkLabel: '' })
    savedOk()

    await expect(state.save()).resolves.toBe(true)

    const [first, second, third, fourth] = sent()[0]!.conditions
    expect(first).toEqual(untouched!.loaded)
    expect(second).toMatchObject({ field: 'statusId', values: ['A', 'B', 'C'], checkLabel: 'OMS statusId is one of A, B, C' })
    expect(third).toMatchObject({ field: 'qty', values: ['5'], checkLabel: 'OMS qty is more than 5' })
    expect(fourth).toMatchObject({ field: 'note', values: [], checkLabel: 'OMS note is empty' })
  })

  it('a conclusion with no name blocks save', async () => {
    const state = await setup()
    const uid = state.addConclusion()
    const line = state.list.value.find((entry) => entry.uid === uid)!.lines[0]!
    state.updateLine(uid, line.uid, { ...line.condition, field: 'statusId', values: ['X'] })

    expect(state.incomplete.value).toBe(true)
    await expect(state.save()).resolves.toBe(false)
    expect(saveConclusions).not.toHaveBeenCalled()

    state.updateConclusion(uid, { conclusion: 'CONC_SCREENED' })
    expect(state.incomplete.value).toBe(false)
  })

  it('removing the last line makes the conclusion incomplete', async () => {
    const state = await setup()
    const node = state.list.value[2]!
    state.removeLine(node.uid, node.lines[0]!.uid)

    expect(node.lines).toHaveLength(0)
    expect(state.describeLines(node)).toBe('')
    expect(state.incomplete.value).toBe(true)
    await expect(state.save()).resolves.toBe(false)
    expect(saveConclusions).not.toHaveBeenCalled()
  })

  it('a compare run offers every finding only when a loaded row already uses it', async () => {
    const without = await setup(tree({ conclusions: [tree().conclusions[0]!] }))
    expect(without.bucketOptions.value.map((option) => option.value)).toEqual(['', 'MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE'])

    const kept = await setup()
    expect(kept.bucketOptions.value).toContainEqual({ value: 'FINDING', label: 'every finding (single-sided only)' })
  })

  // A tree broken outside the app (a data load) would be erased or silently broadened by the all-or-nothing save.
  it('a stored conclusion no root reaches shows, says why, and blocks save until it is deleted', async () => {
    const orphan: RunConclusionNode = {
      key: '50', parent: '30', conclusion: 'CONC_SCREENED', label: 'Screened out', bucket: null, question: null, outcome: null,
      conditions: [NO_ORDER_LINE],
    }
    const state = await setup(tree({ conclusions: [...tree().conclusions, orphan] }))

    expect(state.list.value.map((node) => [node.key, node.problem])).toEqual([
      ['20', null], ['10', null], ['40', null], ['50', 'ORPHAN'],
    ])
    expect(state.treeProblems.value).toEqual(['Conclusion 4, Screened out, hangs off a conclusion that is not here. Delete it to save.'])
    expect(state.incomplete.value).toBe(true)
    await expect(state.save()).resolves.toBe(false)
    expect(saveConclusions).not.toHaveBeenCalled()

    state.removeConclusion(state.list.value[3]!.uid)
    expect(state.treeProblems.value).toEqual([])
    expect(state.incomplete.value).toBe(false)
    savedOk()
    await expect(state.save()).resolves.toBe(true)
    expect(sent().map((node) => node.key)).toEqual(['20', '10', '40'])
  })

  it('the run\'s many lookups word their lines as lists', async () => {
    const state = await setup(tree({
      lookups: [{ name: 'returns', subject: 'FILE_2', many: true }, { name: 'orderInNetsuite', subject: 'FILE_2' }],
      conclusions: [{
        key: '10', parent: null, conclusion: 'CONC_SCREENED', bucket: null, question: null, outcome: null,
        conditions: [{ ...STATUS_LINE, subject: 'FILE_2', field: 'returns.statusId', values: ['DONE'] }],
      }],
    }))

    expect(state.lineContext.value.listPaths.has('returns')).toBe(true)
    expect(state.lineContext.value.nonListPaths?.has('orderInNetsuite')).toBe(true)
    expect(state.describeLines(state.list.value[0]!)).toBe("every NetSuite return's statusId is one of DONE")
  })
})
