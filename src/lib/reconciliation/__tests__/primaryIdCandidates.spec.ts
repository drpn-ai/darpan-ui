import { describe, expect, it } from 'vitest'
import { rankPrimaryIdCandidates } from '../primaryIdCandidates'

describe('rankPrimaryIdCandidates', () => {
  it('puts an exact id column first', () => {
    expect(rankPrimaryIdCandidates(['status', 'total', 'id'])).toEqual(['id', 'status', 'total'])
  })

  it('ranks camelCase and snake_case id suffixes above plain columns', () => {
    expect(rankPrimaryIdCandidates(['status', 'orderId', 'total', 'customer_id'])).toEqual([
      'orderId',
      'customer_id',
      'status',
      'total',
    ])
  })

  it('does not treat an ordinary word ending in id as a key', () => {
    // "paid" and "valid" end in the letters i-d but have no boundary before them.
    expect(rankPrimaryIdCandidates(['paid', 'valid', 'orderId'])).toEqual(['orderId', 'paid', 'valid'])
  })

  it('ranks recognisable identifier words above plain columns', () => {
    expect(rankPrimaryIdCandidates(['total', 'sku', 'status', 'orderNumber'])).toEqual([
      'sku',
      'orderNumber',
      'total',
      'status',
    ])
  })

  it('keeps original column order within a tier', () => {
    expect(rankPrimaryIdCandidates(['bId', 'aId', 'zzz', 'aaa'])).toEqual(['bId', 'aId', 'zzz', 'aaa'])
  })

  it('ranks an exact id above an id suffix', () => {
    expect(rankPrimaryIdCandidates(['orderId', 'id'])).toEqual(['id', 'orderId'])
  })

  it('handles upper-case separated ids', () => {
    expect(rankPrimaryIdCandidates(['STATUS', 'ORDER_ID'])).toEqual(['ORDER_ID', 'STATUS'])
  })

  it('returns an empty list unchanged', () => {
    expect(rankPrimaryIdCandidates([])).toEqual([])
  })

  it('does not drop or duplicate any column', () => {
    const columns = ['a', 'orderId', 'b', 'id', 'sku', 'c']
    const ranked = rankPrimaryIdCandidates(columns)
    expect([...ranked].sort()).toEqual([...columns].sort())
  })
})
