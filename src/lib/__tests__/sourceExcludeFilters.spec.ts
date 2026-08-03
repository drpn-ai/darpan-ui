import { describe, expect, it } from 'vitest'

import {
  excludeFilterPayloadFields,
  normalizeExcludeFilters,
  parseExcludeFilterValues,
} from '../sourceExcludeFilters'

describe('parseExcludeFilterValues', () => {
  it('splits on commas and trims each value', () => {
    expect(parseExcludeFilterValues(' POS_SALES_CHANNEL , DRAFT_SALES_CHANNEL ')).toEqual([
      'POS_SALES_CHANNEL',
      'DRAFT_SALES_CHANNEL',
    ])
  })

  it('drops blank entries', () => {
    expect(parseExcludeFilterValues('POS_SALES_CHANNEL,,  ,')).toEqual(['POS_SALES_CHANNEL'])
  })

  it('returns an empty array for empty input', () => {
    expect(parseExcludeFilterValues('')).toEqual([])
    expect(parseExcludeFilterValues('   ')).toEqual([])
  })

  it('de-duplicates repeated values', () => {
    expect(parseExcludeFilterValues('POS_SALES_CHANNEL,POS_SALES_CHANNEL')).toEqual(['POS_SALES_CHANNEL'])
  })
})

describe('normalizeExcludeFilters', () => {
  it('drops rules with no field or no values', () => {
    expect(
      normalizeExcludeFilters([
        { fieldExpression: '  ', values: ['POS_SALES_CHANNEL'] },
        { fieldExpression: 'salesChannelEnumId', values: [] },
        { fieldExpression: ' salesChannelEnumId ', values: [' POS_SALES_CHANNEL '] },
      ]),
    ).toEqual([{ fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] }])
  })

  it('returns an empty array for undefined', () => {
    expect(normalizeExcludeFilters(undefined)).toEqual([])
  })
})

describe('excludeFilterPayloadFields', () => {
  it('sends the rules for the named side', () => {
    const payload = excludeFilterPayloadFields(
      [{ fieldExpression: 'salesChannelEnumId', values: ['POS_SALES_CHANNEL'] }],
      'file2',
    )

    expect(payload).toEqual({
      file2ExcludeFilters: [
        { fieldExpression: 'salesChannelEnumId', operator: 'EXCLUDE_IN', values: ['POS_SALES_CHANNEL'] },
      ],
    })
  })

  it('sends an explicit empty array so a cleared side is cleared server-side', () => {
    expect(excludeFilterPayloadFields([], 'file1')).toEqual({ file1ExcludeFilters: [] })
  })

  it('omits the key entirely when the draft has no opinion', () => {
    expect(excludeFilterPayloadFields(undefined, 'file1')).toEqual({})
  })
})
