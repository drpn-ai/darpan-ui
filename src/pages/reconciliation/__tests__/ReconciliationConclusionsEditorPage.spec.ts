// DAR-UI-135. The conclusions edit page: ranked rows that open in place, plain lines that edit one at a time, one save.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import type { RunConclusions } from '../../../lib/api/authoringTypes'
import type { ReconciliationRuleSetDraftState } from '../../../lib/reconciliationRuleSetDraft'

const getRunConclusions = vi.hoisted(() => vi.fn())
const saveRunConclusions = vi.hoisted(() => vi.fn())
const createCode = vi.hoisted(() => vi.fn())
const getJsonSchema = vi.hoisted(() => vi.fn())
const flattenJsonSchema = vi.hoisted(() => vi.fn())
const routerPush = vi.hoisted(() => vi.fn())
// The page's leave guards, run by routerPush as the real router would; `landed` holds the navigations they let through.
const leaveGuards = vi.hoisted(() => [] as Array<() => unknown>)
const landed = vi.hoisted(() => [] as unknown[])

vi.mock('vue-router', () => ({
  RouterLink: {
    name: 'RouterLink',
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRouter: () => ({ push: routerPush }),
  onBeforeRouteLeave: (guard: () => unknown) => { leaveGuards.push(guard) },
}))

vi.mock('../../../lib/api/facade', () => ({
  jsonSchemaFacade: { get: getJsonSchema, flatten: flattenJsonSchema },
}))

vi.mock('../../../lib/api/authoringFacade', () => ({
  runConclusionFacade: { get: getRunConclusions, save: saveRunConclusions, createCode },
}))

const draftStoreState = vi.hoisted(() => ({
  workflowOrigin: null as { label: string, path: string } | null,
  ruleSetDraftState: null as null | { draft: unknown, resumeStepId: string | null },
  setWorkflowOrigin: vi.fn(),
  setRuleSetDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import { ApiCallError } from '../../../lib/api/client'
import { useMascotStore } from '../../../stores/mascot'
import ReconciliationConclusionsEditorPage from '../ReconciliationConclusionsEditorPage.vue'

function draftState(): ReconciliationRuleSetDraftState {
  return {
    draft: {
      savedRunId: 'RS_SHIP_BILL',
      runName: 'HotWax shipments vs NetSuite billing',
      file1SystemEnumId: 'NETSUITE_SUITEQL',
      file1SystemLabel: 'NetSuite',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1FileTypeEnumId: 'DftJson',
      file1PrimaryIdExpression: ['order_name'],
      file2SystemEnumId: 'OMS',
      file2SystemLabel: 'HotWax',
      file2SourceTypeEnumId: 'AUT_SRC_API',
      file2FileTypeEnumId: 'DftJson',
      file2PrimaryIdExpression: ['order_name'],
    },
    resumeStepId: 'ruleset-manager',
  }
}

function loadedConclusions(): RunConclusions {
  return {
    savedRunId: 'RS_SHIP_BILL',
    scopeMode: 'COMPARE',
    catalog: [
      { id: 'SHIPPED_NOT_BILLED', label: 'Shipped, not billed' },
      { id: 'BACKORDERED', label: 'Backordered in NetSuite' },
    ],
    buckets: ['MISSING_FROM_FILE_1', 'MISSING_FROM_FILE_2', 'RULE', 'FINDING'],
    operators: [],
    presence: [],
    keyScopes: [],
    quantifiers: [],
    lookups: [],
    unexplainedOutcome: null,
    conclusions: [
      {
        key: '10',
        parent: null,
        conclusion: 'SHIPPED_NOT_BILLED',
        bucket: 'RULE',
        question: 'Is NetSuite waiting to bill it?',
        fix: null,
        outcome: null,
        conditions: [{
          subject: 'FILE_1',
          presence: 'ANY',
          keyScope: 'FULL',
          quantifier: 'ALL',
          field: 'billing_status',
          operator: 'IN',
          values: ['Pending Billing'],
          checkLabel: 'NetSuite billing_status is one of Pending Billing',
        }],
      },
      {
        key: '20',
        parent: null,
        conclusion: 'BACKORDERED',
        bucket: 'MISSING_FROM_FILE_2',
        question: '',
        fix: null,
        outcome: 'HIDE',
        conditions: [{
          subject: 'FILE_2',
          presence: 'ABSENT',
          keyScope: 'FULL',
          quantifier: 'ALL',
          field: null,
          operator: null,
          values: [],
          checkLabel: 'Not in HotWax',
        }],
      },
    ],
  } as RunConclusions
}

const mounted: VueWrapper[] = []

async function mountPage(): Promise<VueWrapper> {
  const wrapper = mount(ReconciliationConclusionsEditorPage, { attachTo: document.body })
  mounted.push(wrapper)
  await flushPromises()
  return wrapper
}

async function pickName(wrapper: VueWrapper, id: string): Promise<void> {
  await wrapper.get('[data-testid="conclusions-editor-open"] [data-testid="conclusions-editor-field-name"]').trigger('click')
  await wrapper.get('[data-testid="conclusions-editor-name-select"]').trigger('click')
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${id}"]`).trigger('click')
}

function rows(wrapper: VueWrapper) {
  return wrapper.findAll('[data-testid="conclusions-editor-row"]')
}

describe('ReconciliationConclusionsEditorPage', () => {
  beforeEach(() => {
    getRunConclusions.mockReset()
    saveRunConclusions.mockReset()
    createCode.mockReset()
    getJsonSchema.mockReset()
    flattenJsonSchema.mockReset()
    routerPush.mockReset()
    leaveGuards.length = 0
    landed.length = 0
    routerPush.mockImplementation(async (to: unknown) => {
      for (const guard of leaveGuards) if ((await guard()) === false) return
      landed.push(to)
    })
    draftStoreState.workflowOrigin = { label: 'Run Details', path: '/reconciliation/ruleset-manager?run=RS_SHIP_BILL' }
    draftStoreState.ruleSetDraftState = draftState()
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: loadedConclusions() })
  })

  afterEach(() => {
    while (mounted.length) mounted.pop()?.unmount()
    vi.restoreAllMocks()
  })

  it('lists conclusions with plain when lines', async () => {
    const wrapper = await mountPage()

    expect(getRunConclusions).toHaveBeenCalledWith('RS_SHIP_BILL', expect.anything())
    expect(wrapper.get('[data-testid="conclusions-editor-title"]').text()).toBe('HotWax shipments vs NetSuite billing')
    expect(wrapper.text()).toContain('First match wins.')

    const [first, second] = rows(wrapper)
    expect(first!.get('[data-testid="conclusions-editor-rank"]').text()).toBe('1')
    expect(first!.get('[data-testid="conclusions-editor-name"]').text()).toBe('Shipped, not billed')
    expect(first!.get('[data-testid="conclusions-editor-when"]').text()).toBe('when NetSuite billing_status is one of Pending Billing')
    expect(first!.get('[data-testid="conclusions-editor-explains"]').text()).toBe('explains the rules hold')
    expect(first!.get('[data-testid="conclusions-editor-outcome"]').text()).toBe('Shown')
    expect(second!.get('[data-testid="conclusions-editor-when"]').text()).toBe('when the HotWax record is missing')
    expect(second!.get('[data-testid="conclusions-editor-explains"]').text()).toBe('explains In HotWax')
    expect(second!.get('[data-testid="conclusions-editor-outcome"]').text()).toBe('Hidden')

    const unexplained = wrapper.get('[data-testid="conclusions-editor-unexplained"]')
    expect(unexplained.text()).toContain('Unexplained')
    expect(unexplained.text()).toContain('when nothing above matches')
    expect(unexplained.text()).toContain('Shown')
  })

  it('opens one conclusion at a time', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('[data-testid="conclusions-editor-open"]')).toHaveLength(0)

    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    expect(wrapper.findAll('[data-testid="conclusions-editor-open"]')).toHaveLength(1)
    const open = wrapper.get('[data-testid="conclusions-editor-open"]')
    // Every part reads plain; the when line is a sentence, not a form.
    expect(open.get('[data-testid="conclusions-editor-field-name"]').text()).toContain('Shipped, not billed')
    expect(open.get('[data-testid="conclusions-editor-field-question"]').text()).toContain('Is NetSuite waiting to bill it?')
    expect(open.get('[data-testid="conclusions-editor-field-outcome"]').text()).toContain('a finding you see')
    expect(open.get('[data-testid="conclusions-editor-field-fix"]').text()).toContain('how you fix it (only you write this)')
    expect(open.findAll('[data-testid="conclusion-line"]')).toHaveLength(1)
    expect(open.find('[data-testid="conclusion-line-edit"]').exists()).toBe(false)

    // One part at a time becomes its control.
    await open.get('[data-testid="conclusions-editor-field-name"]').trigger('click')
    expect(wrapper.find('[data-testid="conclusions-editor-name-select"]').exists()).toBe(true)
    await wrapper.get('[data-testid="conclusions-editor-field-question"]').trigger('click')
    expect(wrapper.find('[data-testid="conclusions-editor-name-select"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="conclusions-editor-question-input"]').exists()).toBe(true)
    await wrapper.get('[data-testid="conclusion-line"]').trigger('click')
    expect(wrapper.find('[data-testid="conclusions-editor-question-input"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="conclusion-line-edit"]').exists()).toBe(true)

    // Opening another closes the first; clicking it again closes it.
    await rows(wrapper)[1]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    expect(wrapper.findAll('[data-testid="conclusions-editor-open"]')).toHaveLength(1)
    expect(rows(wrapper)[1]!.find('[data-testid="conclusions-editor-open"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="conclusion-line-edit"]').exists()).toBe(false)
    await rows(wrapper)[1]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    expect(wrapper.findAll('[data-testid="conclusions-editor-open"]')).toHaveLength(0)
  })

  it('moves the open conclusion and keeps it open', async () => {
    const wrapper = await mountPage()
    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-move-down"]').trigger('click')

    expect(rows(wrapper)[1]!.get('[data-testid="conclusions-editor-name"]').text()).toBe('Shipped, not billed')
    expect(rows(wrapper)[1]!.find('[data-testid="conclusions-editor-open"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').classes()).toContain('app-icon-action--dirty')
  })

  it('unexplained offers Shown and Expected only', async () => {
    const wrapper = await mountPage()
    const unexplained = wrapper.get('[data-testid="conclusions-editor-unexplained"]')
    await unexplained.get('[data-testid="conclusions-editor-toggle"]').trigger('click')

    const open = wrapper.get('[data-testid="conclusions-editor-unexplained"] [data-testid="conclusions-editor-open"]')
    expect(open.findAll('[data-testid^="conclusions-editor-field-"]').map((f) => f.attributes('data-testid')))
      .toEqual(['conclusions-editor-field-outcome'])
    expect(wrapper.find('[data-testid="conclusions-editor-move-up"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="conclusions-editor-delete"]').exists()).toBe(false)

    await open.get('[data-testid="conclusions-editor-field-outcome"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-outcome-select"]').trigger('click')
    const options = wrapper.findAll('[data-testid="app-select-option"]')
    expect(options.map((o) => o.text())).toEqual(['Shown', 'Expected'])

    await options[1]!.trigger('click')
    expect(wrapper.get('[data-testid="conclusions-editor-unexplained"]').text()).toContain('not a finding; counted as expected')

    saveRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [] })
    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()
    expect(saveRunConclusions).toHaveBeenCalledWith('RS_SHIP_BILL', expect.any(Array), expect.anything(), { unexplainedOutcome: 'EXPECTED' })
  })

  it('save is off with nothing changed', async () => {
    const wrapper = await mountPage()
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="conclusions-save-blocked"]').exists()).toBe(false)

    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-move-down"]').trigger('click')
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').attributes('disabled')).toBeUndefined()
  })

  it('save is off while a line is incomplete', async () => {
    const wrapper = await mountPage()
    expect(wrapper.find('[data-testid="conclusions-save-blocked"]').exists()).toBe(false)

    await wrapper.get('[data-testid="conclusions-editor-add"]').trigger('click')

    // The new conclusion opens at the bottom with its first line already editing.
    expect(rows(wrapper)).toHaveLength(3)
    expect(rows(wrapper)[2]!.find('[data-testid="conclusions-editor-open"]').exists()).toBe(true)
    expect(rows(wrapper)[2]!.find('[data-testid="conclusion-line-edit"]').exists()).toBe(true)

    // Named, nothing open: the unfinished line is the only reason save is off.
    await pickName(wrapper, 'SHIPPED_NOT_BILLED')
    await wrapper.get('[data-testid="conclusions-editor-edit-name"] [aria-label="Done with this line"]').trigger('click')
    expect(wrapper.find('[data-testid="conclusion-line-edit"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="conclusions-save-blocked"]').exists()).toBe(true)
  })

  it('saves a new conclusion whose only value is typed, not entered, on one press', async () => {
    saveRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [] })
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="conclusions-editor-add"]').trigger('click')
    await pickName(wrapper, 'BACKORDERED')
    await rows(wrapper)[2]!.get('[data-testid="conclusion-line"]').trigger('click')
    await wrapper.get('[data-testid="conclusion-line-subject"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="__path__"]').trigger('click')
    await wrapper.get('[data-testid="conclusion-line-path-input"]').setValue('billing_status')

    const input = wrapper.get<HTMLInputElement>('[data-testid="conclusion-line-tag-input"]')
    input.element.focus()
    await input.setValue('Pending Fulfillment')
    // A part is open, so save takes the press even though the line has no entered value yet.
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').attributes('disabled')).toBeUndefined()
    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()

    expect(saveRunConclusions).toHaveBeenCalledTimes(1)
    const [, payload] = saveRunConclusions.mock.calls[0] as [string, Array<{ conclusion: string, conditions: Array<{ field: string, values: string[] }> }>]
    expect(payload).toHaveLength(3)
    expect(payload[2]!.conclusion).toBe('BACKORDERED')
    expect(payload[2]!.conditions[0]!.field).toBe('billing_status')
    expect(payload[2]!.conditions[0]!.values).toEqual(['Pending Fulfillment'])
    expect(routerPush).toHaveBeenCalledWith({ path: '/reconciliation/ruleset-manager?run=RS_SHIP_BILL' })
  })

  it('a press that leaves a line unfinished does not save and the mascot says why', async () => {
    const wrapper = await mountPage()
    await wrapper.get('[data-testid="conclusions-editor-add"]').trigger('click')
    await pickName(wrapper, 'BACKORDERED')
    await rows(wrapper)[2]!.get('[data-testid="conclusion-line"]').trigger('click')

    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()

    expect(saveRunConclusions).not.toHaveBeenCalled()
    expect(routerPush).not.toHaveBeenCalled()
    expect(useMascotStore().tipText).toBe('Save waits until every conclusion has a name and a finished line, and any the tree cannot place is deleted.')
  })

  it('back with unsaved changes asks first, once', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const wrapper = await mountPage()
    const run = { path: '/reconciliation/ruleset-manager?run=RS_SHIP_BILL' }

    // Nothing changed: back goes straight to the run page.
    await wrapper.get('[data-testid="conclusions-editor-back"]').trigger('click')
    await flushPromises()
    expect(confirm).not.toHaveBeenCalled()
    expect(landed).toEqual([run])
    landed.length = 0

    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-move-down"]').trigger('click')

    await wrapper.get('[data-testid="conclusions-editor-back"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(landed).toEqual([])

    confirm.mockReturnValue(true)
    await wrapper.get('[data-testid="conclusions-editor-back"]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(landed).toEqual([run])
    expect(saveRunConclusions).not.toHaveBeenCalled()
  })

  it('leaving any other way asks while changes wait; after a save it does not', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    saveRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [] })
    const wrapper = await mountPage()
    expect(leaveGuards).toHaveLength(1)
    const leave = leaveGuards[0]!

    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-move-down"]').trigger('click')
    // The sidebar or the browser back runs the same guard: it asks, and a "no" stays.
    expect(leave()).toBe(false)
    expect(confirm).toHaveBeenCalledTimes(1)

    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()
    expect(saveRunConclusions).toHaveBeenCalledTimes(1)
    expect(landed).toEqual([{ path: '/reconciliation/ruleset-manager?run=RS_SHIP_BILL' }])
    expect(confirm).toHaveBeenCalledTimes(1)
    expect(leave()).toBe(true)
  })

  it('a conclusion left with no line blocks save and reads no when', async () => {
    const wrapper = await mountPage()
    await rows(wrapper)[1]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusion-line"]').trigger('click')
    await wrapper.get('[aria-label="Remove this line"]').trigger('click')

    expect(rows(wrapper)[1]!.find('[data-testid="conclusions-editor-when"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('always')
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="conclusions-save-blocked"]').exists()).toBe(true)
  })

  it('save flushes typed value text', async () => {
    saveRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [] })
    const wrapper = await mountPage()
    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusion-line"]').trigger('click')

    const input = wrapper.get<HTMLInputElement>('[data-testid="conclusion-line-tag-input"]')
    input.element.focus()
    await input.setValue('Partially Billed')
    // Typed, never entered: the save itself must keep it.
    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()

    expect(saveRunConclusions).toHaveBeenCalledTimes(1)
    const [, payload] = saveRunConclusions.mock.calls[0] as [string, Array<{ conditions: Array<{ values: string[] }> }>]
    expect(payload[0]!.conditions[0]!.values).toEqual(['Pending Billing', 'Partially Billed'])
    expect(routerPush).toHaveBeenCalledWith({ path: '/reconciliation/ruleset-manager?run=RS_SHIP_BILL' })
  })

  it('a refused save stays and shows the service words', async () => {
    saveRunConclusions.mockRejectedValue(new ApiCallError('Refused.', 400, { result: { errors: ['A conclusion may hold at most 8 lines.'] } }))
    const wrapper = await mountPage()
    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-move-down"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()

    expect(routerPush).not.toHaveBeenCalled()
    expect(wrapper.get('[data-testid="conclusions-editor-error"]').text()).toContain('A conclusion may hold at most 8 lines.')
    expect(rows(wrapper)[1]!.get('[data-testid="conclusions-editor-name"]').text()).toBe('Shipped, not billed')
  })

  // A tree broken by a data load: the orphan shows (it was dropped, and the next save erased it), says why, and save
  // waits until the person deletes it.
  it('shows a stored conclusion whose parent is gone, says why, and saves only once it is deleted', async () => {
    const stored = loadedConclusions()
    stored.conclusions.push({ ...stored.conclusions[1]!, key: '30', parent: '99', bucket: null, outcome: null })
    getRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [], conclusions: stored })
    saveRunConclusions.mockResolvedValue({ ok: true, messages: [], errors: [] })
    const wrapper = await mountPage()

    expect(rows(wrapper)).toHaveLength(3)
    expect(wrapper.get('[data-testid="conclusions-editor-tree-problem"]').text())
      .toBe('Conclusion 3, Backordered in NetSuite, hangs off a conclusion that is not here. Delete it to save.')
    expect(wrapper.find('[data-testid="conclusions-save-blocked"]').exists()).toBe(true)

    await rows(wrapper)[2]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-delete"]').trigger('click')
    expect(wrapper.find('[data-testid="conclusions-editor-tree-problem"]').exists()).toBe(false)
    await wrapper.get('[data-testid="conclusions-editor-save"]').trigger('click')
    await flushPromises()

    const [, payload] = saveRunConclusions.mock.calls[0] as [string, Array<{ key: string }>]
    expect(payload.map((node) => node.key)).toEqual(['10', '20'])
  })

  it('cancel puts the list back', async () => {
    const wrapper = await mountPage()
    await rows(wrapper)[0]!.get('[data-testid="conclusions-editor-toggle"]').trigger('click')
    await wrapper.get('[data-testid="conclusions-editor-delete"]').trigger('click')
    expect(rows(wrapper)).toHaveLength(1)

    await wrapper.get('[data-testid="conclusions-editor-cancel"]').trigger('click')
    expect(rows(wrapper)).toHaveLength(2)
    expect(wrapper.get('[data-testid="conclusions-editor-save"]').classes()).not.toContain('app-icon-action--dirty')
  })

  it('shows the run setup way in when there is no run', async () => {
    draftStoreState.ruleSetDraftState = null
    const wrapper = await mountPage()

    expect(getRunConclusions).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('No run basics defined yet')
  })
})
