import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

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

const draftStoreState = vi.hoisted(() => ({
  ruleSetDraftState: null as null | { draft: unknown, resumeStepId: string | null },
  setRuleSetDraft: vi.fn(),
  clearRuleSetDraft: vi.fn(),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => draftStoreState,
}))

import RuleSetBoard from '../RuleSetBoard.vue'

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
})
