import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { ApiCallError } from '../../../lib/api/client'
import type { AuditCheckDetail, AuditCheckOptions } from '../../../lib/api/authoringTypes'

// DAR-UI-064 S4 — the add / edit check editor the audit settings page mounts under each statement.

const getOptions = vi.hoisted(() => vi.fn())
const getCheck = vi.hoisted(() => vi.fn())
const saveCheck = vi.hoisted(() => vi.fn())
const deleteCheck = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/authoringFacade', () => ({
  auditCheckFacade: { getOptions, get: getCheck, save: saveCheck, delete: deleteCheck },
}))

import AuditCheckEditor from '../AuditCheckEditor.vue'

const options: AuditCheckOptions = {
  audit: { id: 'month-close', name: 'Month close' },
  statements: [
    { id: 'R4', text: 'Every return is credited in NetSuite.' },
    { id: 'R5', text: 'Every refund matches its credit.' },
    { id: 'R6', text: 'No open RMA is older than a week.' },
  ],
  runs: [
    {
      savedRunId: 'RUN_A',
      runName: 'Returns: OMS vs NetSuite',
      scopeMode: 'COMPARE',
      rules: [
        { ruleId: 'r1', ruleText: 'Amounts agree' },
        { ruleId: 'r2', ruleText: 'Dates agree' },
      ],
      conclusions: [
        { code: 'C1', label: 'Not yet credited' },
        { code: 'C2', label: 'Credited elsewhere' },
      ],
    },
    {
      savedRunId: 'RUN_C',
      runName: 'Refunds: Shopify vs NetSuite',
      scopeMode: 'COMPARE',
      rules: [{ ruleId: 'r2', ruleText: 'Dates agree' }],
      conclusions: [{ code: 'C2', label: 'Credited elsewhere' }],
    },
    {
      savedRunId: 'RUN_E',
      runName: 'Open RMAs',
      scopeMode: 'EVALUATE',
      rules: [],
      conclusions: [{ code: 'STALE', label: 'Stale' }],
    },
  ],
  diffTypes: ['MISSING_IN_FILE_1', 'MISSING_IN_FILE_2', 'FIELD_MISMATCH', 'FINDING', 'DUPLICATE_IN_FILE_1', 'DUPLICATE_IN_FILE_2'],
  fixWhere: ['OMS', 'NETSUITE', 'SHOPIFY'],
  checks: [{ id: 'returns-credited', label: 'Returns credited' }],
}

const stored: AuditCheckDetail = {
  id: 'returns-credited',
  label: 'Returns credited',
  savedRunId: 'RUN_A',
  file1RecordType: 'Return',
  file2RecordType: 'Credit memo',
  graceDays: 3,
  matchedBy: 'HC Return Id',
  fixOwner: 'Finance',
  fixWhereEnumId: 'NETSUITE',
  expectedSource: 'returnTotal',
  actualSource: 'creditTotal',
  amountCurrencyUomId: 'USD',
  headlineTemplate: 'Return {returnId} has no credit',
  fixActionTemplate: 'Credit {returnId}',
  passesWhenTemplate: 'Every return has a credit',
  automationId: null,
  statements: [
    { id: 'R4', diffTypes: ['MISSING_IN_FILE_2'], conclusionCodes: ['C1'], ruleIds: [] },
    { id: 'R5', diffTypes: ['FIELD_MISMATCH'], conclusionCodes: [], ruleIds: ['r1'] },
  ],
}

function ok<T extends object>(body: T) {
  return { ok: true, messages: [], errors: [], ...body }
}

let wrapper: VueWrapper | null = null

async function mountEditor(props: Record<string, unknown> = {}) {
  wrapper = mount(AuditCheckEditor, {
    props: { audit: 'month-close', statement: 'R4', ...props },
    attachTo: document.body,
    global: {
      plugins: [createRouter({ history: createMemoryHistory(), routes: [{ path: '/:any(.*)*', component: { render: () => null } }] })],
    },
  })
  await flushPromises()
  return wrapper
}

function trigger(w: VueWrapper, testId: string) {
  return w.get(`[data-testid="${testId}"]`)
}

/** Opens a select by its trigger and clicks one option inside that same select. */
async function pick(w: VueWrapper, testId: string, value: string) {
  const button = trigger(w, testId)
  if (button.attributes('aria-expanded') !== 'true') await button.trigger('click')
  const root = button.element.parentElement as HTMLElement
  const option = root.querySelector(`[data-option-value="${value}"]`) as HTMLElement | null
  if (!option) throw new Error(`No option ${value} in ${testId}`)
  option.click()
  await flushPromises()
}

async function optionValues(w: VueWrapper, testId: string): Promise<string[]> {
  const button = trigger(w, testId)
  if (button.attributes('aria-expanded') !== 'true') await button.trigger('click')
  const root = button.element.parentElement as HTMLElement
  const values = Array.from(root.querySelectorAll('[data-option-value]')).map((el) => el.getAttribute('data-option-value') ?? '')
  await button.trigger('click')
  return values
}

beforeEach(() => {
  getOptions.mockReset().mockResolvedValue(ok({ options }))
  getCheck.mockReset().mockResolvedValue(ok({ check: stored }))
  saveCheck.mockReset()
  deleteCheck.mockReset()
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AuditCheckEditor', () => {
  it('links to the run builder for a new run, two-sided or one-system', async () => {
    const w = await mountEditor()
    expect(trigger(w, 'audit-check-new-run').attributes('href')).toBe('/reconciliation/create')
    expect(trigger(w, 'audit-check-new-evaluate-run').attributes('href')).toBe('/reconciliation/create?scope=EVALUATE')
  })

  it('loads the audit options and links the opening statement', async () => {
    const w = await mountEditor()

    expect(getOptions).toHaveBeenCalledWith('month-close', expect.any(AbortSignal))
    expect(getCheck).not.toHaveBeenCalled()
    expect(w.findAll('[data-testid="audit-check-link"]')).toHaveLength(1)
    expect(trigger(w, 'audit-check-statement-0').text()).toContain('R4')
    expect(w.find('[data-testid="audit-check-remove"]').exists()).toBe(false)
    expect(w.find('[data-testid="audit-check-money"]').exists()).toBe(false)
  })

  it('derives the id from the label until the id is edited', async () => {
    const w = await mountEditor()
    const id = trigger(w, 'audit-check-id')

    await trigger(w, 'audit-check-label').setValue('Returns not in NetSuite!')
    expect((id.element as HTMLInputElement).value).toBe('returns-not-in-netsuite')

    await id.setValue('returns-missing')
    await trigger(w, 'audit-check-label').setValue('Returns missing from NetSuite')
    expect((id.element as HTMLInputElement).value).toBe('returns-missing')
  })

  it('hides file 2 and offers only findings and file-1 duplicates for an EVALUATE run', async () => {
    const w = await mountEditor()

    await pick(w, 'audit-check-run', 'RUN_A')
    expect(w.find('[data-testid="audit-check-file2"]').exists()).toBe(true)
    expect(await optionValues(w, 'audit-check-diff-types-0')).toEqual(options.diffTypes)

    await pick(w, 'audit-check-run', 'RUN_E')
    expect(w.find('[data-testid="audit-check-file2"]').exists()).toBe(false)
    expect(await optionValues(w, 'audit-check-diff-types-0')).toEqual(['FINDING', 'DUPLICATE_IN_FILE_1'])
  })

  it('drops rule, conclusion and row-type picks the new run cannot produce', async () => {
    saveCheck.mockResolvedValue(ok({ savedCheck: stored }))
    const w = await mountEditor()
    await trigger(w, 'audit-check-label').setValue('Returns credited twice')

    await pick(w, 'audit-check-run', 'RUN_A')
    await pick(w, 'audit-check-diff-types-0', 'FIELD_MISMATCH')
    await pick(w, 'audit-check-diff-types-0', 'FINDING')
    await pick(w, 'audit-check-diff-types-0', 'DUPLICATE_IN_FILE_2')
    await pick(w, 'audit-check-rules-0', 'r1')
    await pick(w, 'audit-check-rules-0', 'r2')
    await pick(w, 'audit-check-conclusions-0', 'C1')
    await pick(w, 'audit-check-conclusions-0', 'C2')

    await pick(w, 'audit-check-run', 'RUN_C')
    await trigger(w, 'audit-check-save').trigger('click')
    await flushPromises()
    expect(saveCheck.mock.calls[0]?.[2]).toEqual([
      { id: 'R4', diffTypes: ['FIELD_MISMATCH', 'FINDING', 'DUPLICATE_IN_FILE_2'], conclusionCodes: ['C2'], ruleIds: ['r2'] },
    ])

    await pick(w, 'audit-check-run', 'RUN_E')
    expect(w.find('[data-testid="audit-check-rules-0"]').exists()).toBe(false)
    await trigger(w, 'audit-check-save').trigger('click')
    await flushPromises()
    expect(saveCheck.mock.calls[1]?.[2]).toEqual([{ id: 'R4', diffTypes: ['FINDING'], conclusionCodes: [], ruleIds: [] }])
  })

  it('saves the check and its statement links in the service shape', async () => {
    saveCheck.mockResolvedValue(ok({ savedCheck: stored }))
    const w = await mountEditor()

    await pick(w, 'audit-check-run', 'RUN_A')
    await trigger(w, 'audit-check-label').setValue('Returns credited in NetSuite')
    await pick(w, 'audit-check-diff-types-0', 'MISSING_IN_FILE_2')
    await pick(w, 'audit-check-conclusions-0', 'C1')
    await trigger(w, 'audit-check-add-link').trigger('click')
    await pick(w, 'audit-check-statement-1', 'R6')
    await pick(w, 'audit-check-diff-types-1', 'FIELD_MISMATCH')
    await pick(w, 'audit-check-rules-1', 'r2')

    await w.get('input[name="file1RecordType"]').setValue('Return')
    await w.get('input[name="file2RecordType"]').setValue('Credit memo')
    await w.get('input[name="matchedBy"]').setValue('HC Return Id')
    await w.get('input[name="graceDays"]').setValue('3')
    await w.get('input[name="fixOwner"]').setValue('Finance')
    await pick(w, 'audit-check-fix-where', 'NETSUITE')
    await trigger(w, 'audit-check-money-toggle').trigger('click')
    await w.get('input[name="amountCurrencyUomId"]').setValue('usd')
    await w.get('input[name="expectedSource"]').setValue('returnTotal')
    await w.get('input[name="actualSource"]').setValue('creditTotal')
    await w.get('textarea[name="headlineTemplate"]').setValue('Return {returnId} has no credit')
    await w.get('textarea[name="fixActionTemplate"]').setValue('Credit {returnId}')

    await trigger(w, 'audit-check-save').trigger('click')
    await flushPromises()

    expect(saveCheck).toHaveBeenCalledTimes(1)
    expect(saveCheck).toHaveBeenCalledWith(
      'month-close',
      {
        id: 'returns-credited-in-netsuite',
        label: 'Returns credited in NetSuite',
        savedRunId: 'RUN_A',
        file1RecordType: 'Return',
        file2RecordType: 'Credit memo',
        graceDays: 3,
        matchedBy: 'HC Return Id',
        fixOwner: 'Finance',
        fixWhereEnumId: 'NETSUITE',
        expectedSource: 'returnTotal',
        actualSource: 'creditTotal',
        amountCurrencyUomId: 'USD',
        headlineTemplate: 'Return {returnId} has no credit',
        fixActionTemplate: 'Credit {returnId}',
        passesWhenTemplate: null,
        create: true,
      },
      [
        { id: 'R4', diffTypes: ['MISSING_IN_FILE_2'], conclusionCodes: ['C1'], ruleIds: [] },
        { id: 'R6', diffTypes: ['FIELD_MISMATCH'], conclusionCodes: [], ruleIds: ['r2'] },
      ],
    )
    expect(w.emitted('saved')).toEqual([[stored]])
  })

  it('shows every service error sentence verbatim', async () => {
    saveCheck.mockRejectedValue(
      new ApiCallError('Name the check: what it compares, in a few words.', 200, {
        result: {
          errors: ['Name the check: what it compares, in a few words.', "Rule 'r9' is not in run 'RUN_A'."],
        },
      }),
    )
    const w = await mountEditor()

    await trigger(w, 'audit-check-save').trigger('click')
    await flushPromises()

    const shown = w.get('[data-testid="audit-check-errors"]').findAll('.inline-validation').map((node) => node.text())
    expect(shown).toEqual(['Name the check: what it compares, in a few words.', "Rule 'r9' is not in run 'RUN_A'."])
    expect(w.emitted('saved')).toBeUndefined()
  })

  it('edits a stored check with its id locked', async () => {
    saveCheck.mockResolvedValue(ok({ savedCheck: stored }))
    const w = await mountEditor({ check: 'returns-credited' })

    expect(getCheck).toHaveBeenCalledWith('month-close', 'returns-credited', expect.any(AbortSignal))
    const id = trigger(w, 'audit-check-id')
    expect((id.element as HTMLInputElement).value).toBe('returns-credited')
    expect(id.attributes('disabled')).toBeDefined()
    expect(trigger(w, 'audit-check-run').text()).toContain('Returns: OMS vs NetSuite')
    expect(w.findAll('[data-testid="audit-check-link"]')).toHaveLength(2)
    expect(w.find('[data-testid="audit-check-money"]').exists()).toBe(true)

    await trigger(w, 'audit-check-label').setValue('Returns credited on time')
    expect((id.element as HTMLInputElement).value).toBe('returns-credited')

    await trigger(w, 'audit-check-save').trigger('click')
    await flushPromises()
    expect(saveCheck.mock.calls[0]?.[1]).toMatchObject({ id: 'returns-credited', label: 'Returns credited on time', graceDays: 3 })
    expect(saveCheck.mock.calls[0]?.[2]).toEqual(stored.statements)
  })

  it('refuses a new check whose id the audit already has', async () => {
    const w = await mountEditor()
    await trigger(w, 'audit-check-label').setValue('Returns credited')

    await trigger(w, 'audit-check-save').trigger('click')
    await flushPromises()

    expect(saveCheck).not.toHaveBeenCalled()
    expect(w.get('[data-testid="audit-check-errors"]').text()).toContain("Check 'returns-credited' is already on this audit.")
  })

  it('confirms inline before removing, and says when the check was removed', async () => {
    deleteCheck.mockResolvedValue(ok({ result: { id: 'returns-credited', removed: true, unlinked: true } }))
    const w = await mountEditor({ check: 'returns-credited' })

    await trigger(w, 'audit-check-remove').trigger('click')
    expect(deleteCheck).not.toHaveBeenCalled()
    expect(w.get('[data-testid="audit-check-remove-confirm"]').text()).toContain('Month close')

    await trigger(w, 'audit-check-remove-yes').trigger('click')
    await flushPromises()

    expect(deleteCheck).toHaveBeenCalledWith('month-close', 'returns-credited')
    expect(w.get('[data-testid="audit-check-notice"]').text()).toBe('Check removed.')
    expect(w.emitted('removed')).toEqual([[{ id: 'returns-credited', removed: true, unlinked: true }]])
  })

  it('says when the check was only unlinked, and Keep backs out', async () => {
    deleteCheck.mockResolvedValue(ok({ result: { id: 'returns-credited', removed: false, unlinked: true } }))
    const w = await mountEditor({ check: 'returns-credited' })

    await trigger(w, 'audit-check-remove').trigger('click')
    await trigger(w, 'audit-check-remove-no').trigger('click')
    expect(w.find('[data-testid="audit-check-remove-confirm"]').exists()).toBe(false)

    await trigger(w, 'audit-check-remove').trigger('click')
    await trigger(w, 'audit-check-remove-yes').trigger('click')
    await flushPromises()

    expect(w.get('[data-testid="audit-check-notice"]').text()).toContain('Unlinked from this audit')
    expect(w.emitted('removed')?.[0]?.[0]).toMatchObject({ removed: false, unlinked: true })
  })

  it('emits cancel', async () => {
    const w = await mountEditor()
    await trigger(w, 'audit-check-cancel').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
  })
})
