import { describe, expect, it } from 'vitest'
import type { GeneratedOutputDifferenceRow } from '../api/types'
import {
  ALL_RULE_FILTER_KEY,
  BASE_RULE_FILTER_KEY,
  DIFF_BUCKET_ORDER,
  buildDiffDetailPayload,
  buildPageRow,
  createEmptyDiffBucketCounts,
  isJsonCollapseValue,
  normalizeDiffBucketSelection,
  normalizeServerBucketCounts,
  normalizeServerRuleOption,
  parseDiffData,
  resolveDiffType,
  stringifyDiffJson,
} from '../runResultDiffDetails'

describe('runResultDiffDetails', () => {
  it('exposes the canonical bucket order and filter keys', () => {
    expect(DIFF_BUCKET_ORDER).toEqual(['file-1', 'file-2', 'rule'])
    expect(ALL_RULE_FILTER_KEY).toBe('all')
    expect(BASE_RULE_FILTER_KEY).toBe('base-diff')
  })

  it('createEmptyDiffBucketCounts returns zeroed counts for every bucket', () => {
    expect(createEmptyDiffBucketCounts()).toEqual({ 'file-1': 0, 'file-2': 0, rule: 0 })
  })

  it('normalizeDiffBucketSelection preserves canonical order regardless of input order', () => {
    expect(normalizeDiffBucketSelection(['rule', 'file-1'])).toEqual(['file-1', 'rule'])
    expect(normalizeDiffBucketSelection([])).toEqual([])
  })

  it('stringifyDiffJson pretty-prints JSON strings, objects, and falls back on invalid input', () => {
    expect(stringifyDiffJson(null)).toBe('')
    expect(stringifyDiffJson('{"a":1}')).toBe('{\n  "a": 1\n}')
    expect(stringifyDiffJson('not json')).toBe('not json')
    expect(stringifyDiffJson({ a: 1 })).toBe('{\n  "a": 1\n}')
  })

  it('isJsonCollapseValue accepts only non-null objects', () => {
    expect(isJsonCollapseValue({ a: 1 })).toBe(true)
    expect(isJsonCollapseValue([1])).toBe(true)
    expect(isJsonCollapseValue(null)).toBe(false)
    expect(isJsonCollapseValue('text')).toBe(false)
  })

  it('resolveDiffType prefers diffType over type and trims values', () => {
    expect(resolveDiffType({ diffType: ' FIELD_MISMATCH ', type: 'other' })).toBe('FIELD_MISMATCH')
    expect(resolveDiffType({ type: 'missing_in_OMS' })).toBe('missing_in_OMS')
    expect(resolveDiffType({})).toBe('')
  })

  it('parseDiffData parses JSON strings and passes through everything else', () => {
    expect(parseDiffData('{"order_id":"1001"}')).toEqual({ order_id: '1001' })
    expect(parseDiffData('not json')).toBe('not json')
    expect(parseDiffData({ raw: true })).toEqual({ raw: true })
  })

  it('buildDiffDetailPayload returns parsed data when present', () => {
    expect(buildDiffDetailPayload({}, { order_id: '1001' })).toEqual({ order_id: '1001' })
  })

  it('buildDiffDetailPayload assembles rule metadata when parsed data is empty', () => {
    const payload = buildDiffDetailPayload(
      {
        diffType: 'FIELD_MISMATCH',
        primaryId: ' 6678 ',
        field: 'grand_total = total_amount',
        file1Value: '89.89',
        file2Value: '90.32',
        ruleId: 'FIELD_COMPARISON_1',
        severity: 'WARN',
        message: 'Field comparison failed',
      },
      null,
    )
    expect(payload).toEqual({
      diffType: 'FIELD_MISMATCH',
      primaryId: '6678',
      field: 'grand_total = total_amount',
      file1Value: '89.89',
      file2Value: '90.32',
      severity: 'WARN',
      ruleId: 'FIELD_COMPARISON_1',
      message: 'Field comparison failed',
    })
  })

  it('buildDiffDetailPayload returns null when there is nothing to show', () => {
    expect(buildDiffDetailPayload({}, '   ')).toBeNull()
  })

  it('buildPageRow keeps server classification and rebuilds the detail payload', () => {
    const serverRow = {
      rowKey: 'file-1-1001-0',
      recordId: '1001',
      bucket: 'file-1',
      ruleFilterKey: 'base-diff',
      ruleId: 'base-diff',
      ruleLabel: 'Base comparison',
      record: { id: '1001', data: '{"order_id":"1001"}' },
    } as unknown as GeneratedOutputDifferenceRow

    expect(buildPageRow(serverRow)).toEqual({
      rowKey: 'file-1-1001-0',
      recordId: '1001',
      bucket: 'file-1',
      detailValue: { order_id: '1001' },
      ruleFilterKey: 'base-diff',
      ruleId: 'base-diff',
      ruleLabel: 'Base comparison',
    })
  })

  it('normalizeServerBucketCounts keeps known buckets and zeroes bad values', () => {
    expect(normalizeServerBucketCounts(undefined)).toEqual({ 'file-1': 0, 'file-2': 0, rule: 0 })
    expect(
      normalizeServerBucketCounts({ 'file-1': 3, 'file-2': Number.NaN, rule: 2, unknown: 9 }),
    ).toEqual({ 'file-1': 3, 'file-2': 0, rule: 2 })
  })

  it('normalizeServerRuleOption drops unknown bucket keys', () => {
    expect(
      normalizeServerRuleOption({
        key: 'order_id_match',
        label: 'Rule 1',
        detail: 'OMS order id = Shopify order id',
        count: 4,
        bucketKeys: ['rule', 'bogus', 'file-1'],
      }),
    ).toEqual({
      key: 'order_id_match',
      label: 'Rule 1',
      detail: 'OMS order id = Shopify order id',
      count: 4,
      bucketKeys: ['rule', 'file-1'],
    })
  })
})
