import { describe, expect, it } from 'vitest'
import { ageLabel, checkStatusBadge, eventLabel, findingStateBadge, heldChain, orderNameOf, periodOptions, recordDetails, recordLabel, recordRows, recordTypeLabel, shortDate, shortRange, splitHeadline, systemCards, systemLabel } from '../auditReport'

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

  // DAR-UI-081. Each system's record as a card; the fix's system outlined, a record with no status read marked so.
  // DAR-BE-125: a HotWax order reads by its name, its HotWax id under it.
  it('lays each system\'s record out as a card, the fix\'s system needing attention', () => {
    const rows = recordRows({
      Shopify: { order: [{ id: '18957262782595', internalId: null, status: null }] },
      OMS: { order: [{ id: '#GOR197395235', internalId: 'M1173432', status: 'Completed' }] },
      NetSuite: { salesOrder: [{ id: 'SO1', internalId: null, status: 'Pending Billing' }] },
    })
    expect(systemCards(rows, 'NetSuite').map((c) => [c.label, c.kind, c.id, c.sub, c.status, c.attention])).toEqual([
      ['Shopify', 'Order ID', '18957262782595', '', '', false],
      ['HotWax', 'Order name', '#GOR197395235', 'Order ID M1173432', 'Completed', false],
      ['NetSuite', 'Sales order', 'SO1', '', 'Pending Billing', true],
    ])
    expect(orderNameOf(rows)).toBe('#GOR197395235')
  })

  // DAR-UI-088 (Aditi: "there are 2 hotwax ids.. for all ids add a subheading to show what they are").
  it('says what each card\'s id is, so two cards of one system tell apart', () => {
    const rows = recordRows({
      NetSuite: { rma: [{ id: 'RMA341549', internalId: null, status: 'Return Authorization : Pending Refund' }] },
      OMS: { return: [{ id: 'GR1793159', internalId: null, status: null }], order: [{ id: 'M247005', internalId: null, status: null }] },
      Shopify: { order: [{ id: '6469595889795', internalId: null, status: null }] },
    })
    expect(systemCards(rows, 'NetSuite').map((c) => [c.label, c.kind, c.id])).toEqual([
      ['NetSuite', 'RMA', 'RMA341549'],
      ['HotWax', 'Return ID', 'GR1793159'],
      ['HotWax', 'Order ID', 'M247005'],
      ['Shopify', 'Order ID', '6469595889795'],
    ])
  })

  // DAR-UI-081 (Aditi: "group the boxes by system and order, and show item as a subheading with SKU").
  it('groups an order\'s items into one card under it, each by SKU, the order\'s status on the card', () => {
    const rows = recordRows({
      OMS: { orderItem: [
        { id: 'M1168118/01', internalId: null, status: 'Completed', orderStatus: 'Completed', sku: '263-203-186-G' },
        { id: 'M1168118/02', internalId: null, status: 'Completed', orderStatus: 'Completed' },
      ] },
      NetSuite: { salesOrderLine: [{ id: 'SO7330628', internalId: null, status: 'Pending Fulfillment' }, { id: 'SO7330628', internalId: null, status: 'Pending Fulfillment' }] },
    })
    const cards = systemCards(rows, 'NetSuite')
    expect(cards.map((c) => [c.label, c.id, c.status, c.attention, c.items.length])).toEqual([
      ['HotWax', 'M1168118', 'Completed', false, 2],
      ['NetSuite', 'SO7330628', 'Pending Fulfillment', true, 0],
    ])
    expect(cards[0]!.items.map((item) => [item.sku, item.id, item.status])).toEqual([
      ['263-203-186-G', 'M1168118/01', 'Completed'], ['', 'M1168118/02', 'Completed'],
    ])
    // One product on two items of one order: each names its item too.
    const twins = systemCards(recordRows({ OMS: { orderItem: [
      { id: 'M1168149/01', internalId: null, status: 'Completed', sku: '259-118-G' },
      { id: 'M1168149/02', internalId: null, status: 'Completed', sku: '259-118-G' }] } }), '')
    expect(twins[0]!.items.map((item) => item.sku)).toEqual(['259-118-G · 01', '259-118-G · 02'])
  })

  // DAR-UI-080 (Aditi: "add return channel ... warranty ID when available ... order total or return total"; "add order
  // name ... status of order"; "customer deposit info from NS"); DAR-UI-081 ("add customer name", "add order date and
  // return date"). The facts under the cards, only when known.
  it('lists what explains a record under the cards, only when known', () => {
    const rows = recordRows({
      OMS: {
        orderItem: [{ id: 'M1167975/01', internalId: null, status: 'Completed', orderName: '#GOR195470263', orderStatus: 'Completed',
          customer: 'Ada Lovelace', orderDate: '2026-10-21', shipMethod: 'STANDARD' },
        { id: 'M1167975/02', internalId: null, status: 'Completed', customer: 'Ada Lovelace', orderDate: '2026-10-21' }],
        return: [{ id: 'M263376', internalId: null, status: null, channel: 'AFTSHIP_RTN_CHANNEL', warrantyId: '6URJ7WK3', returnTotal: { amount: '118.00', currency: 'USD' },
          returnDate: '2026-10-16' }],
      },
      Shopify: { order: [{ id: '7186636636291', internalId: null, status: null, orderTotal: { amount: '236.00', currency: 'USD' } }] },
      NetSuite: { salesOrderLine: [{ id: 'SO7330484', internalId: null, status: 'Pending Billing', deposits: [{ id: 'CD1', amount: '118', status: 'Deposited' }, { id: 'CD2', amount: null, status: null }] }] },
    })
    // Said once: the second item's customer and date repeat the first's. One order on every finding: the order's facts,
    // then the return's, then deposits (Aditi: "maintain some consistency").
    expect(recordDetails(rows).map((f) => [f.label, f.value, f.status])).toEqual([
      ['Customer', 'Ada Lovelace', ''],
      ['Order date', 'Oct 21', ''],
      ['Ship method', 'STANDARD', ''],
      ['Order total', '236.00 USD', ''],
      ['Return date', 'Oct 16', ''],
      ['Channel', 'AFTSHIP_RTN_CHANNEL', ''],
      ['Warranty ID', '6URJ7WK3', ''],
      ['Return total', '118.00 USD', ''],
      ['Deposit', 'CD1 · 118', 'Deposited'],
      ['Deposit', 'CD2', ''],
    ])
    expect(orderNameOf(rows)).toBe('#GOR195470263')
  })

  // DAR-UI-081 (R8 M259806, "Exchange held by open return"). Where it stopped: the return holding it leads.
  it('lays a held return out as the chain holding it', () => {
    const rows = recordRows({ OMS: { return: [{ id: 'M259806', internalId: null, status: 'Completed', channel: 'AFTSHIP_RTN_CHANNEL',
      warrantyId: 'FV2MPKXZ', heldBy: { id: 'M192313', status: 'Requested' }, exchange: { id: 'EXC-#GOR196740771-3', netsuiteId: null } }] } })
    expect(heldChain(rows).map((step) => [step.label, step.sub, step.status, step.cause])).toEqual([
      ['Return M192313', 'HotWax · same order', 'Requested', true],
      ['Exchange EXC-#GOR196740771-3', 'HotWax exchange order', 'Not in NetSuite', false],
      ['Return M259806', 'this finding', 'Waits for the exchange', false],
      ['NetSuite RMA', 'for M259806', 'None yet', false],
    ])
    expect(heldChain(recordRows({ OMS: { return: [{ id: 'M1', internalId: null, status: null }] } }))).toEqual([])
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
