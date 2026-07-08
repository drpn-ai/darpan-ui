import { describe, expect, it } from 'vitest'
import { buildRuleSetDraft } from '../savedRunEditorRoute'
import type { SavedRunSummary, SavedRunSystemOption } from '../api/types'

function createSystemOption(overrides: Partial<SavedRunSystemOption> = {}): SavedRunSystemOption {
  return {
    enumId: 'OMS',
    fileSide: 'FILE_1',
    ...overrides,
  }
}

function createSavedRun(overrides: Partial<SavedRunSummary> = {}): SavedRunSummary {
  return {
    savedRunId: 'RS_TEST',
    runName: 'Test Run',
    requiresSystemSelection: false,
    systemOptions: [
      createSystemOption({ enumId: 'OMS', fileSide: 'FILE_1' }),
      createSystemOption({ enumId: 'SHOPIFY', fileSide: 'FILE_2' }),
    ],
    ...overrides,
  }
}

describe('buildRuleSetDraft', () => {
  it('hydrates composite primary-key arrays from idFieldExpressions', () => {
    const row = createSavedRun({
      systemOptions: [
        createSystemOption({
          enumId: 'OMS',
          fileSide: 'FILE_1',
          idFieldExpression: undefined,
          idFieldExpressions: ['return_id', 'product_id'],
        }),
        createSystemOption({
          enumId: 'SHOPIFY',
          fileSide: 'FILE_2',
          idFieldExpression: undefined,
          idFieldExpressions: ['shopify_return_id', 'shopify_product_id'],
        }),
      ],
    })

    const draft = buildRuleSetDraft(row)

    expect(draft).not.toBeNull()
    expect(draft?.file1PrimaryIdExpression).toEqual(['return_id', 'product_id'])
    expect(draft?.file2PrimaryIdExpression).toEqual(['shopify_return_id', 'shopify_product_id'])
  })

  it('falls back to a single-element array for legacy single-field idFieldExpression', () => {
    const row = createSavedRun({
      systemOptions: [
        createSystemOption({ enumId: 'OMS', fileSide: 'FILE_1', idFieldExpression: 'order_id' }),
        createSystemOption({ enumId: 'SHOPIFY', fileSide: 'FILE_2', idFieldExpression: 'shopify_order_id' }),
      ],
    })

    const draft = buildRuleSetDraft(row)

    expect(draft).not.toBeNull()
    expect(draft?.file1PrimaryIdExpression).toEqual(['order_id'])
    expect(draft?.file2PrimaryIdExpression).toEqual(['shopify_order_id'])
  })

  it('returns null when a side has neither idFieldExpression nor idFieldExpressions', () => {
    const row = createSavedRun({
      systemOptions: [
        createSystemOption({ enumId: 'OMS', fileSide: 'FILE_1', idFieldExpression: undefined, idFieldExpressions: undefined }),
        createSystemOption({ enumId: 'SHOPIFY', fileSide: 'FILE_2', idFieldExpression: 'shopify_order_id' }),
      ],
    })

    const draft = buildRuleSetDraft(row)

    expect(draft).toBeNull()
  })
})
