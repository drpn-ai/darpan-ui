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
})
