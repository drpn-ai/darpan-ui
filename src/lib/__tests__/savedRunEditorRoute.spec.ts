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

  // Endpoint-level systems (SHOPIFY_RETURN_REFS, OMS_RETURNS) carry a `label` that names the
  // ENDPOINT, so the manager page's System card reads the family name off systemParentLabel instead
  // (see ReconciliationRuleSetManagerPage.systemTitle). Dropping it here silently reverted that card
  // to the endpoint name, which is the bug the field exists to fix.
  it('threads systemParentLabel through for endpoint-level systems', () => {
    const row = createSavedRun({
      systemOptions: [
        createSystemOption({
          enumId: 'SHOPIFY_RETURN_REFS',
          fileSide: 'FILE_1',
          label: 'Shopify Order Return References',
          systemParentEnumId: 'SHOPIFY',
          systemParentLabel: 'Shopify',
          idFieldExpression: '$.records[*].refundOrReturnId',
        }),
        createSystemOption({
          enumId: 'OMS_RETURNS',
          fileSide: 'FILE_2',
          label: 'HotWax Returns (Reconciliation API)',
          systemParentEnumId: 'OMS',
          systemParentLabel: 'HotWax',
          idFieldExpression: '$.records[*].externalId',
        }),
      ],
    })

    const draft = buildRuleSetDraft(row)

    expect(draft?.file1SystemParentLabel).toBe('Shopify')
    expect(draft?.file2SystemParentLabel).toBe('HotWax')
    // The endpoint label is still carried — the Schema card shows it.
    expect(draft?.file1SystemLabel).toBe('Shopify Order Return References')
    expect(draft?.file2SystemLabel).toBe('HotWax Returns (Reconciliation API)')
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

  it('hydrates persisted exclusion filters for both sides', () => {
    // FINAL-REVIEW CRITICAL 2. This is the ONLY converter from a loaded saved run into a rule-set
    // draft. Dropping these keys made the manager card render an em dash for a configured run, left
    // every board mark unset, and — worst — let RuleSetBoard.applyExclusionEdit compute `others` from
    // an empty list, so saving one edited exclusion deleted the rest of that side.
    const row = createSavedRun({
      systemOptions: [
        createSystemOption({ enumId: 'OMS', fileSide: 'FILE_1', idFieldExpression: 'order_id' }),
        createSystemOption({ enumId: 'SHOPIFY', fileSide: 'FILE_2', idFieldExpression: 'shopify_order_id' }),
      ],
      file1ExcludeFilters: [
        { fieldExpression: '$.records[*].salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
        { fieldExpression: '$.records[*].statusId', operator: 'EXCLUDE_IN', values: ['ORDER_CANCELLED'] },
      ],
      file2ExcludeFilters: [
        { fieldExpression: '$.records[*].test', operator: 'EXCLUDE_IN', values: ['A', 'B'] },
      ],
    })

    const draft = buildRuleSetDraft(row)

    expect(draft?.file1ExcludeFilters).toEqual(row.file1ExcludeFilters)
    expect(draft?.file2ExcludeFilters).toEqual(row.file2ExcludeFilters)
  })

  it('leaves an absent exclusion key undefined rather than defaulting it to an empty array', () => {
    // `[]` is the wire signal for "clear this side". Merely opening a run must never send it.
    const row = createSavedRun({
      systemOptions: [
        createSystemOption({ enumId: 'OMS', fileSide: 'FILE_1', idFieldExpression: 'order_id' }),
        createSystemOption({ enumId: 'SHOPIFY', fileSide: 'FILE_2', idFieldExpression: 'shopify_order_id' }),
      ],
      file2ExcludeFilters: [],
    })

    const draft = buildRuleSetDraft(row)

    expect(draft?.file1ExcludeFilters).toBeUndefined()
    expect(draft?.file2ExcludeFilters).toEqual([])
  })
})
