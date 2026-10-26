import { describe, expect, it } from 'vitest'
import { ageLabel, checkStatusBadge, eventLabel, findingStateBadge, periodOptions, recordFacts, recordLabel, recordRows, recordTypeLabel, shortDate, shortRange, splitHeadline, systemLabel } from '../auditReport'

// DAR-UI-058. The audit view's words for the report JSON's codes, and rows for its keyed objects.
describe('auditReport', () => {
  it('names each code in words, toned by grey only', () => {
    expect(findingStateBadge('open')).toEqual({ label: 'Open', tone: 'danger' })
    expect(findingStateBadge('fixed')).toEqual({ label: 'Fixed', tone: 'success' })
    expect(checkStatusBadge('notRun')).toEqual({ label: 'Not run', tone: 'neutral' })
    // An unknown code shows as it came.
    expect(findingStateBadge('excused')).toEqual({ label: 'excused', tone: 'neutral' })
  })

  it('says HotWax for the OMS, as every page does', () => {
    expect(systemLabel('OMS')).toBe('HotWax')
    expect(systemLabel('NetSuite')).toBe('NetSuite')
  })

  it('flattens records by system and type, in the document order', () => {
    const records = { NetSuite: { rma: [{ id: 'RMA1', internalId: '51', status: 'Pending Refund' }], creditMemo: [{ id: 'CM1', internalId: null, status: null }] },
      OMS: { return: [{ id: 'M1', internalId: null, status: 'Completed' }] } }
    expect(recordRows(records).map((r) => [r.system, r.recordType, r.id, r.internalId, r.status])).toEqual([
      ['NetSuite', 'rma', 'RMA1', '51', 'Pending Refund'], ['NetSuite', 'creditMemo', 'CM1', '', ''], ['HotWax', 'return', 'M1', '', 'Completed'],
    ])
    expect(recordRows(null)).toEqual([])
  })

  // DAR-BE-117. A finding now names records in several systems; their types read as words.
  it('says a record type in words', () => {
    expect(recordTypeLabel('creditMemo')).toBe('credit memo')
    expect(recordTypeLabel('replacementOrder')).toBe('replacement order')
    expect(recordTypeLabel('rma')).toBe('RMA')
    expect(recordTypeLabel('order')).toBe('order')
  })

  // DAR-UI-071. Fewer words: a record is named by its system, and by its type only beside another of that system.
  it('names a record by its system, adding the type only when the system has two', () => {
    const rows = recordRows({
      HotWax: { orderItem: [{ id: 'M1/01', internalId: null, status: 'Completed' }] },
      NetSuite: { rma: [{ id: 'RMA1', internalId: '51', status: null }], creditMemo: [{ id: 'CM1', internalId: null, status: null }] },
    })
    expect(rows.map((row) => recordLabel(row, rows))).toEqual(['HotWax', 'NetSuite RMA', 'NetSuite credit memo'])
  })

  // DAR-BE-125 (Aditi: "there should be a Order ID, Order Name, and HC ID"). An order reads by those three names.
  it('names an order by its Order ID, Order Name and HotWax Order ID, and every other record as before', () => {
    const rows = recordRows({
      Shopify: { order: [{ id: '18957262782595', internalId: null, status: null }] },
      OMS: { order: [{ id: '#GOR197395235', internalId: 'M1173432', status: null }] },
      NetSuite: { salesOrder: [{ id: 'SO1', internalId: null, status: 'Pending Billing' }] },
    })
    expect(recordFacts(rows).map((f) => [f.label, f.value, f.status])).toEqual([
      ['Order ID', '18957262782595', ''],
      ['Order Name', '#GOR197395235', ''],
      ['HotWax Order ID', 'M1173432', ''],
      ['NetSuite', 'SO1', 'Pending Billing'],
    ])
  })

  // DAR-UI-080 (Aditi: "add return channel ... warranty ID when available ... order total or return total").
  it('lists a record\'s channel, warranty and total under it, only when known', () => {
    const rows = recordRows({
      OMS: { return: [{ id: 'M263376', internalId: null, status: null, channel: 'AFTSHIP_RTN_CHANNEL', warrantyId: '6URJ7WK3', total: { amount: '118.00', currency: 'USD' } }] },
      Shopify: { order: [{ id: '7186636636291', internalId: null, status: null, total: { amount: '236.00', currency: 'USD' } }] },
      NetSuite: { rma: [{ id: 'RMA1', internalId: null, status: null }] },
    })
    expect(recordFacts(rows).map((f) => [f.label, f.value])).toEqual([
      ['HotWax', 'M263376'],
      ['Channel', 'AFTSHIP_RTN_CHANNEL'],
      ['Warranty ID', '6URJ7WK3'],
      ['Return total', '118.00 USD'],
      ['Order ID', '7186636636291'],
      ['Order total', '236.00 USD'],
      ['NetSuite', 'RMA1'],
    ])
  })

  // DAR-UI-080 (Aditi on R1 M1167975: "add order name ... status of order").
  it('names an item\'s order and that order\'s status under it', () => {
    const rows = recordRows({ HotWax: { orderItem: [{ id: 'M1167975/01', internalId: null, status: 'Completed', orderName: '#GOR195470263', orderStatus: 'ORDER_COMPLETED' }] } })
    expect(recordFacts(rows).map((f) => [f.label, f.value, f.status])).toEqual([
      ['HotWax', 'M1167975/01', 'Completed'],
      ['Order Name', '#GOR195470263', ''],
      ['Order status', 'ORDER_COMPLETED', ''],
    ])
  })

  // DAR-UI-080 (Aditi: "customer deposit info from NS"). A NetSuite order's deposits, each with its amount and status.
  it('lists a NetSuite order\'s customer deposits under it', () => {
    const rows = recordRows({ NetSuite: { salesOrderLine: [{ id: 'SO7330484', internalId: null, status: 'Pending Billing', deposits: [{ id: 'CD1', amount: '118', status: 'Deposited' }, { id: 'CD2', amount: null, status: null }] }] } })
    expect(recordFacts(rows).map((f) => [f.label, f.value, f.status])).toEqual([
      ['NetSuite', 'SO7330484', 'Pending Billing'],
      ['Deposit', 'CD1 · 118', 'Deposited'],
      ['Deposit', 'CD2', ''],
    ])
  })

  it('offers a monthly audit its period and the two before, across a year end', () => {
    expect(periodOptions('2026-10')).toEqual(['2026-10', '2026-09', '2026-08'])
    expect(periodOptions('2027-01')).toEqual(['2027-01', '2026-12', '2026-11'])
    expect(periodOptions('2026-Q4')).toEqual(['2026-Q4'])
    expect(periodOptions(null)).toEqual([])
  })

  // DAR-UI-067. Picking an older month must not take the current one off the list.
  it('lists from the report date, keeping an older period on show', () => {
    expect(periodOptions('2026-08', '2026-10-23')).toEqual(['2026-10', '2026-09', '2026-08'])
    expect(periodOptions('2026-06', '2026-10-23')).toEqual(['2026-10', '2026-09', '2026-08', '2026-06'])
    expect(periodOptions('2026-10', '2026-10-23')).toEqual(['2026-10', '2026-09', '2026-08'])
  })

  it('counts age in days', () => {
    expect(ageLabel(1)).toBe('1 day')
    expect(ageLabel(0)).toBe('0 days')
  })

  // DAR-UI-066. Short words for the busy finding view.
  it('writes days and instants short, without the offset', () => {
    expect(shortDate('2026-10-22')).toBe('Oct 22')
    expect(shortDate('2026-10-22T07:28:00-07:00')).toBe('Oct 22, 07:28')
    expect(shortDate('soon')).toBe('soon')
    expect(shortDate(null)).toBe('')
    expect(shortRange('2026-10-01', '2026-10-23')).toBe('Oct 1 – 23')
    expect(shortRange('2026-09-28', '2026-10-03')).toBe('Sep 28 – Oct 3')
  })

  it('splits a headline into the record and what is wrong', () => {
    expect(splitHeadline('Return 630208: Completed return with no order, never synced')).toEqual({
      subject: 'Return 630208', rest: 'Completed return with no order, never synced',
    })
    expect(splitHeadline('Invoice INV1 has no Etail id')).toEqual({ subject: 'Invoice INV1 has no Etail id', rest: '' })
  })

  it('says a history code in words', () => {
    expect(eventLabel('stillOpen')).toBe('Still open')
    expect(eventLabel('found')).toBe('Found')
  })
})
