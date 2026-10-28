import { describe, expect, it } from 'vitest'
import {
  buildCreateRuleSetRunPayload,
  buildRuleSetRulePayloads,
  fieldSharesRecordRoot,
  type ReconciliationRuleSetDraft,
} from '../reconciliationRuleSetDraft'

function createDraft(overrides: Partial<ReconciliationRuleSetDraft> = {}): ReconciliationRuleSetDraft {
  return {
    savedRunId: 'RS_JSON_ORDER_COMPARE',
    runName: 'JSON Order Compare',
    file1SystemEnumId: 'OMS',
    file1FileTypeEnumId: 'DftJson',
    file1PrimaryIdExpression: ['$.orders[*].order_id'],
    file2SystemEnumId: 'SHOPIFY',
    file2FileTypeEnumId: 'DftJson',
    file2PrimaryIdExpression: ['$[*].shopify_order_id'],
    ...overrides,
  }
}

describe('reconciliationRuleSetDraft', () => {
  it('serializes rule pre-actions into expression JSON and applies them before operator comparison', () => {
    const [rule] = buildRuleSetRulePayloads(createDraft({
      rules: [
        {
          file1FieldPath: '$.orders[*].totalQuantity',
          file2FieldPath: '$[*].quantity',
          operator: '>',
          sequenceNum: 1,
          preActions: [
            { fieldSide: 'file1', action: 'STRING_TO_INT' },
            { fieldSide: 'file2', action: 'STRING_TO_NUMBER' },
          ],
        },
      ],
    }))
    expect(rule).toBeDefined()
    if (!rule) throw new Error('Expected a generated rule payload')

    expect(JSON.parse(rule.expression as string)).toEqual({
      type: 'FIELD_COMPARISON',
      file1FieldPath: '$.orders[*].totalQuantity',
      file2FieldPath: '$[*].quantity',
      operator: '>',
      preActions: [
        { fieldSide: 'file1', action: 'STRING_TO_INT' },
        { fieldSide: 'file2', action: 'STRING_TO_NUMBER' },
      ],
    })
    expect(rule.ruleText).toBe('totalQuantity > quantity')
    expect(rule.ruleLogic).toContain('RuleDiffSupport.applyPreActions')
    expect(rule.ruleLogic).toContain('RuleDiffSupport.violatesOperator')
    expect(rule.ruleLogic).toContain('"STRING_TO_INT"')
    expect(rule.ruleLogic).toContain('"STRING_TO_NUMBER"')
    expect(rule.ruleLogic).not.toContain('String.valueOf')
  })

  it('uses RuleDiffSupport for ordered comparisons even without pre-actions', () => {
    const [rule] = buildRuleSetRulePayloads(createDraft({
      rules: [
        {
          file1FieldPath: '$.orders[*].totalQuantity',
          file2FieldPath: '$[*].quantity',
          operator: '>',
          sequenceNum: 1,
        },
      ],
    }))
    expect(rule).toBeDefined()
    if (!rule) throw new Error('Expected a generated rule payload')

    expect(rule.ruleLogic).toContain('RuleDiffSupport.violatesOperator')
    expect(rule.ruleLogic).not.toContain('String.valueOf')
  })

  // DAR-BE-126. A one-way presence rule ("paid in Shopify needs a payment in HotWax") is its own operator, not "<=" on
  // Y/N strings that works only because N sorts before Y.
  // DAR-BE-153 adds the list pair: every Shopify payment id on a HotWax OPP.
  it.each(['requires', 'required by', 'all in', 'contains all'])('keeps the "%s" operator and checks it through RuleDiffSupport', (operator) => {
    const [rule] = buildRuleSetRulePayloads(createDraft({
      rules: [{ file1FieldPath: '$.orders[*].hasPayment', file2FieldPath: '$[*].hasPayment', operator, sequenceNum: 1 }],
    }))
    if (!rule) throw new Error('Expected a generated rule payload')

    expect(JSON.parse(rule.expression as string).operator).toBe(operator)
    expect(rule.ruleText).toBe(`hasPayment ${operator} hasPayment`)
    expect(rule.ruleLogic).toContain(`RuleDiffSupport.violatesOperator(((Map) $m.get("file1")).get("hasPayment"), ((Map) $m.get("file2")).get("hasPayment"), "${operator}")`)
  })

  it('persists API source config ids in create payloads', () => {
    const payload = buildCreateRuleSetRunPayload(createDraft({
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'OMS_REMOTE',
      file1SourceConfigId: 'KREWE_OMS',
      file1SourceConfigType: 'HOTWAX_OMS_REST',
      file1FileTypeEnumId: '',
      file1PrimaryIdExpression: ['$.records[*].orderId'],
    }))

    expect(payload).toMatchObject({
      file1SourceTypeEnumId: 'AUT_SRC_API',
      file1SystemMessageRemoteId: 'OMS_REMOTE',
      file1SourceConfigId: 'KREWE_OMS',
      file1SourceConfigType: 'HOTWAX_OMS_REST',
      file1PrimaryIdExpression: '$.records[*].orderId',
    })
  })

  it('emits the plural field when the draft has more than one primary-id-expression entry', () => {
    const draft: ReconciliationRuleSetDraft = {
      runName: 'Composite key run',
      file1SystemEnumId: 'SHOPIFY',
      file1FileTypeEnumId: 'DftJson',
      file1PrimaryIdExpression: ['return_id', 'product_id'],
      file2SystemEnumId: 'OMS',
      file2FileTypeEnumId: 'DftJson',
      file2PrimaryIdExpression: ['return_id', 'product_id'],
    }

    const payload = buildCreateRuleSetRunPayload(draft)

    expect(payload.file1PrimaryIdExpression).toBeUndefined()
    expect(payload.file1PrimaryIdExpressions).toEqual(['return_id', 'product_id'])
    expect(payload.file2PrimaryIdExpression).toBeUndefined()
    expect(payload.file2PrimaryIdExpressions).toEqual(['return_id', 'product_id'])
  })

  it('emits the singular field, not the plural, when the draft has exactly one primary-id-expression entry', () => {
    const draft: ReconciliationRuleSetDraft = {
      runName: 'Single key run',
      file1SystemEnumId: 'SHOPIFY',
      file1FileTypeEnumId: 'DftJson',
      file1PrimaryIdExpression: ['order_id'],
      file2SystemEnumId: 'OMS',
      file2FileTypeEnumId: 'DftJson',
      file2PrimaryIdExpression: ['order_id'],
    }

    const payload = buildCreateRuleSetRunPayload(draft)

    expect(payload.file1PrimaryIdExpression).toBe('order_id')
    expect(payload.file1PrimaryIdExpressions).toBeUndefined()
  })

  it('fieldSharesRecordRoot: true for two fields under the same exploded array, false across different roots', () => {
    expect(fieldSharesRecordRoot('$.returns[*].product_id', '$.returns[*].return_id')).toBe(true)
    expect(fieldSharesRecordRoot('$.order_id', '$.returns[*].return_id')).toBe(false)
    expect(fieldSharesRecordRoot('$.appeasements[*].product_id', '$.returns[*].return_id')).toBe(false)
  })
})

describe('single-sided runs (DAR-BE-058)', () => {
  const singleSided = {
    runName: 'NetSuite chain — Pending Billing',
    scopeMode: 'EVALUATE',
    file1SystemEnumId: 'NETSUITE_SUITEQL',
    file1SourceTypeEnumId: 'AUT_SRC_API',
    file1SourceConfigId: 'NS_PENDING_BILLING',
    file1SourceConfigType: 'NETSUITE_SUITEQL',
    file1PrimaryIdExpression: ['internalId'],
    file2SystemEnumId: 'SHOPIFY',
    file2SourceTypeEnumId: 'AUT_SRC_API',
    file2PrimaryIdExpression: ['id'],
  } as ReconciliationRuleSetDraft

  it('sends scopeMode so the backend builds an EVALUATE scope', () => {
    expect(buildCreateRuleSetRunPayload(singleSided).scopeMode).toBe('EVALUATE')
  })

  /**
   * The draft can still be CARRYING a second side — the operator may have picked one, then gone
   * back and changed the run kind. Sending it would create a FILE_2 compare source, and every
   * surface that asks "is this two-sided" reads whether that row exists.
   */
  it('sends no second side even when the draft still holds one', () => {
    const payload = buildCreateRuleSetRunPayload(singleSided) as unknown as Record<string, unknown>

    expect(payload.file2SystemEnumId).toBeUndefined()
    expect(Object.keys(payload).filter((k) => k.startsWith('file2'))).toEqual([])
  })

  it('leaves two-sided runs exactly as they were', () => {
    const payload = buildCreateRuleSetRunPayload({ ...singleSided, scopeMode: undefined })

    expect(payload.scopeMode).toBeUndefined()
    expect(payload.file2SystemEnumId).toBe('SHOPIFY')
  })

  it('treats the mode case-insensitively, since it round-trips through the backend', () => {
    expect(buildCreateRuleSetRunPayload({ ...singleSided, scopeMode: 'evaluate' }).scopeMode)
      .toBe('EVALUATE')
  })
  // DAR-UI-064: a side's duplicate-key handling and extract options.
  describe('side options', () => {
    it('sends FINDING and only the true / non-blank options, and nothing for the defaults', () => {
      const payload = buildCreateRuleSetRunPayload(createDraft({
        file1DuplicateKeyHandling: 'FINDING',
        file2DuplicateKeyHandling: '',
        file1ExtractOptions: { onlyCancelledReturns: true, includeReturnsWithoutShopifyRef: false, note: '  ' },
        file2ExtractOptions: {},
      }))
      expect(payload.file1DuplicateKeyHandling).toBe('FINDING')
      expect(payload.file1ExtractOptions).toEqual({ onlyCancelledReturns: true })
      expect(payload).not.toHaveProperty('file2DuplicateKeyHandling')
      expect(payload).not.toHaveProperty('file2ExtractOptions')
    })

    it('drops the second side\'s options on a single-sided run', () => {
      const payload = buildCreateRuleSetRunPayload(createDraft({
        scopeMode: 'EVALUATE',
        file2DuplicateKeyHandling: 'FINDING',
        file2ExtractOptions: { onlyCancelledReturns: true },
      }))
      expect(payload).not.toHaveProperty('file2DuplicateKeyHandling')
      expect(payload).not.toHaveProperty('file2ExtractOptions')
    })
  })
})

