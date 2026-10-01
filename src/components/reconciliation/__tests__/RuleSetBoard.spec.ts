import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'

const flattenJsonSchema = vi.hoisted(() => vi.fn())
const getJsonSchema = vi.hoisted(() => vi.fn())
const listAutomationSourceOptions = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  jsonSchemaFacade: {
    flatten: flattenJsonSchema,
    get: getJsonSchema,
  },
  reconciliationFacade: {
    listAutomationSourceOptions,
  },
}))

const draftStoreState = vi.hoisted(() => {
  const state = {
    ruleSetDraftState: null as null | { draft: unknown, resumeStepId: string | null },
    setRuleSetDraft: vi.fn(),
    clearRuleSetDraft: vi.fn(),
    // DAR-UI-044: the one-shot exclusion "Stop flagging in rules board" hands over.
    pendingExclusion: null as null | Record<string, unknown>,
    takePendingExclusion: () => {
      const pending = state.pendingExclusion
      state.pendingExclusion = null
      return pending
    },
  }
  return state
})

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import RuleSetBoard from '../RuleSetBoard.vue'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../../lib/uiEvents'

// The board listens on document, so a board left mounted by one test would answer another test's events.
enableAutoUnmount(afterEach)

describe('RuleSetBoard with CSV column lists', () => {
  beforeEach(() => {
    flattenJsonSchema.mockReset()
    getJsonSchema.mockReset()
    listAutomationSourceOptions.mockReset()
    draftStoreState.ruleSetDraftState = null

    listAutomationSourceOptions.mockResolvedValue({ ok: true, nsRestletConfigs: [], systemRemotes: [] })
  })

  it('populates both columns for CSV sides carrying a flat schema', async () => {
    // The board already routes non-API sides through resolveSchemaId -> flatten#JsonSchema
    // (loadSourceFields). This proves a CSV side carrying a schema id needs no board change at
    // all -- the whole point of storing CSV columns as an ordinary flat schema.
    flattenJsonSchema.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      fieldList: [
        { fieldPath: 'orderId', type: 'string', required: false },
        { fieldPath: 'status', type: 'string', required: false },
      ],
    })

    draftStoreState.ruleSetDraftState = {
      resumeStepId: null,
      draft: {
        runName: 'CSV vs CSV',
        file1SystemEnumId: 'SHOPIFY',
        file1SystemLabel: 'SHOPIFY',
        file1FileTypeEnumId: 'DftCsv',
        file1JsonSchemaId: 'SchemaFlatCsvOne',
        file1SchemaFileName: 'orders-a.csv',
        file1PrimaryIdExpression: ['orderId'],
        file2SystemEnumId: 'OMS',
        file2SystemLabel: 'OMS',
        file2FileTypeEnumId: 'DftCsv',
        file2JsonSchemaId: 'SchemaFlatCsvTwo',
        file2SchemaFileName: 'orders-b.csv',
        file2PrimaryIdExpression: ['orderId'],
        rules: [],
      },
    }

    const wrapper = mount(RuleSetBoard)
    await flushPromises()

    expect(wrapper.text()).toContain('orderId')
    expect(wrapper.text()).toContain('status')
    // One flatten per side -- the board must resolve both CSV schemas, not just file1.
    expect(flattenJsonSchema).toHaveBeenCalledTimes(2)

    wrapper.unmount()
  })

  it('titles each column with the system family, not the endpoint it reads through', async () => {
    // Endpoint-level systems (OMS_RETURNS, SHOPIFY_RETURN_REFS) make the side's own systemLabel
    // name the ENDPOINT -- "HotWax Returns (Reconciliation API)". The board asks how to compare two
    // SYSTEMS, so its column titles must read the family name, the same way the rule set manager's
    // System card already does. The endpoint is still named on the schema/source cards.
    flattenJsonSchema.mockResolvedValue({ ok: true, messages: [], errors: [], fieldList: [] })

    draftStoreState.ruleSetDraftState = {
      resumeStepId: null,
      draft: {
        runName: 'Returns presence',
        file1SystemEnumId: 'OMS_RETURNS',
        file1SystemLabel: 'HotWax Returns (Reconciliation API)',
        file1SystemParentLabel: 'HotWax',
        file1FileTypeEnumId: 'DftCsv',
        file1PrimaryIdExpression: ['returnId'],
        file2SystemEnumId: 'SHOPIFY_RETURN_REFS',
        file2SystemLabel: 'Shopify Order Return References',
        file2SystemParentLabel: 'Shopify',
        file2FileTypeEnumId: 'DftCsv',
        file2PrimaryIdExpression: ['refundOrReturnId'],
        rules: [],
      },
    }

    const wrapper = mount(RuleSetBoard)
    await flushPromises()

    expect(wrapper.text()).toContain('HotWax')
    expect(wrapper.text()).toContain('Shopify')
    expect(wrapper.text()).not.toContain('HotWax Returns (Reconciliation API)')
    expect(wrapper.text()).not.toContain('Shopify Order Return References')

    wrapper.unmount()
  })

  it('falls back to the side label for a family system that has no parent', async () => {
    // SHOPIFY and OMS are the families themselves and carry no systemParentLabel; dropping the
    // fallback would regress every ordinary run to a bare enum id.
    flattenJsonSchema.mockResolvedValue({ ok: true, messages: [], errors: [], fieldList: [] })

    draftStoreState.ruleSetDraftState = {
      resumeStepId: null,
      draft: {
        runName: 'Orders',
        file1SystemEnumId: 'SHOPIFY',
        file1SystemLabel: 'Shopify',
        file1FileTypeEnumId: 'DftCsv',
        file1PrimaryIdExpression: ['orderId'],
        file2SystemEnumId: 'OMS',
        file2SystemLabel: 'HotWax',
        file2FileTypeEnumId: 'DftCsv',
        file2PrimaryIdExpression: ['orderId'],
        rules: [],
      },
    }

    const wrapper = mount(RuleSetBoard)
    await flushPromises()

    expect(wrapper.text()).toContain('Shopify')
    expect(wrapper.text()).toContain('HotWax')

    wrapper.unmount()
  })

  // DAR-UI-044: "Stop flagging in rules board" opens the exclusion editor pre-filled. Nothing is
  // saved until the operator applies it — the board is where the filter is seen and confirmed.
  it('opens the exclusion editor pre-filled from a pending exclusion and saves nothing', async () => {
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      nsRestletConfigs: [],
      systemRemotes: [{
        optionKey: 'gorjana_prod',
        systemMessageRemoteId: 'HOTWAX_ORDERS_API',
        sourceConfigId: 'gorjana_prod',
        systemEnumId: 'OMS_ORDER_ITEMS',
        supportsExcludeFilters: true,
        fieldOptions: [{ fieldPath: 'facilityId' }, { fieldPath: 'omsOrderId' }],
      }],
    })
    const draft = {
      runName: 'Order sync',
      file1SystemEnumId: 'OMS_ORDER_ITEMS',
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
      file1SourceConfigId: 'gorjana_prod',
      file1PrimaryIdExpression: ['omsOrderId'],
      file1ExcludeFilters: [],
      file2SystemEnumId: 'NETSUITE_SUITEQL',
      file2SourceTypeEnumId: 'AUT_SRC_API',
      file2PrimaryIdExpression: ['orderId'],
      rules: [],
    }
    draftStoreState.ruleSetDraftState = { resumeStepId: null, draft }
    draftStoreState.pendingExclusion = { fileSide: 'FILE_1', fieldExpression: 'facilityId', operator: 'EXCLUDE_IN', values: ['_NA_'] }

    const wrapper = mount(RuleSetBoard)
    await flushPromises()

    expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(true)
    expect((wrapper.get('[data-testid="ruleset-exclusion-field"]').element as HTMLInputElement).value).toBe('facilityId')
    expect(wrapper.get('[data-testid="ruleset-exclusion-popover"]').text()).toContain('_NA_')
    expect(draft.file1ExcludeFilters).toEqual([])
    expect(draftStoreState.pendingExclusion).toBeNull()
  })
})

// DAR-UI-047: Escape on an open popover must close the popover, not abort the create-run workflow (which
// discarded the whole draft). App.vue dispatches this cancelable request before aborting; the board claims it.
describe('RuleSetBoard and the workflow Escape', () => {
  const apiDraft = () => ({
    runName: 'Order sync',
    file1SystemEnumId: 'OMS_ORDER_ITEMS',
    file1SourceTypeEnumId: 'AUT_SRC_API',
    file1SystemMessageRemoteId: 'HOTWAX_ORDERS_API',
    file1SourceConfigId: 'gorjana_prod',
    file1PrimaryIdExpression: ['omsOrderId'],
    file1ExcludeFilters: [],
    file2SystemEnumId: 'NETSUITE_SUITEQL',
    file2SourceTypeEnumId: 'AUT_SRC_API',
    file2PrimaryIdExpression: ['orderId'],
    rules: [{ id: 'r1', ruleId: 'r1', sequenceNum: 1, file1FieldPath: 'omsOrderId', file2FieldPath: 'orderId', operator: '=', preActions: [] }],
  })

  beforeEach(() => {
    listAutomationSourceOptions.mockReset()
    listAutomationSourceOptions.mockResolvedValue({
      ok: true,
      nsRestletConfigs: [],
      systemRemotes: [{
        optionKey: 'gorjana_prod',
        systemMessageRemoteId: 'HOTWAX_ORDERS_API',
        sourceConfigId: 'gorjana_prod',
        systemEnumId: 'OMS_ORDER_ITEMS',
        supportsExcludeFilters: true,
        fieldOptions: [{ fieldPath: 'facilityId' }, { fieldPath: 'omsOrderId' }],
      }],
    })
    draftStoreState.pendingExclusion = null
  })

  function requestCancel(): Event {
    const request = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })
    document.dispatchEvent(request)
    return request
  }

  it('closes an open filter popover and claims the Escape', async () => {
    draftStoreState.ruleSetDraftState = { resumeStepId: null, draft: apiDraft() }
    draftStoreState.pendingExclusion = { fileSide: 'FILE_1', fieldExpression: 'facilityId', operator: 'EXCLUDE_IN', values: ['_NA_'] }
    const wrapper = mount(RuleSetBoard, { attachTo: document.body })
    await flushPromises()
    expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(true)

    const later = vi.fn()
    document.addEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, later)
    const request = requestCancel()
    await flushPromises()

    expect(request.defaultPrevented).toBe(true)
    expect(later).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="ruleset-exclusion-popover"]').exists()).toBe(false)
    document.removeEventListener(WORKFLOW_CANCEL_REQUEST_EVENT, later)
  })

  it('closes an open rule editor and claims the Escape', async () => {
    draftStoreState.ruleSetDraftState = { resumeStepId: null, draft: apiDraft() }
    const wrapper = mount(RuleSetBoard, { attachTo: document.body })
    await flushPromises()
    await wrapper.get('[data-testid="ruleset-rule-operator-r1"]').trigger('click')
    expect(wrapper.find('.ruleset-rule-popover').exists()).toBe(true)

    const request = requestCancel()
    await flushPromises()

    expect(request.defaultPrevented).toBe(true)
    expect(wrapper.find('.ruleset-rule-popover').exists()).toBe(false)
  })

  it('leaves the Escape to the workflow when no popover is open', async () => {
    draftStoreState.ruleSetDraftState = { resumeStepId: null, draft: apiDraft() }
    mount(RuleSetBoard, { attachTo: document.body })
    await flushPromises()

    expect(requestCancel().defaultPrevented).toBe(false)
  })
})
