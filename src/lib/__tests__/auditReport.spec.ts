import { describe, expect, it } from 'vitest'
import { basicFacts, checkStatusBadge, eventLabel, findingStateBadge, heldChain, orderLineRows, orderNameOf, periodOptions, recordDetails, recordKind, typeDetails, recordLabel, recordRows, recordTypeLabel, shortDate, shortRange, splitHeadline, systemLabel } from '../auditReport'

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

  // DAR-BE-125: a finding's order reads by its HotWax order name.
  it('names the order a finding is about by its HotWax order name', () => {
    const rows = recordRows({
      Shopify: { order: [{ id: '18957262782595', internalId: null, status: null }] },
      OMS: { order: [{ id: '#GOR197395235', internalId: 'M1173432', status: 'Completed' }] },
    })
    expect(orderNameOf(rows)).toBe('#GOR197395235')
  })

  // DAR-UI-080 (Aditi: "add return channel ... warranty ID when available ... order total or return total"; "add order
  // name ... status of order"; "customer deposit info from NS"); DAR-UI-081 ("add customer name", "add order date and
  // return date"). The facts, only when known.
  it('lists what explains a record, only when known', () => {
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

  // DAR-UI-081 (R8 M259806, "Exchange held by open return"). DAR-UI-092 (Aditi: "the order looks like a lifecycle... the
  // order records are expected to appear"). Aditi 2026-11-10: "the RMA wouldnt come after the exchange". Each record after
  // the one it is made from: this return, its exchange (HotWax), then NetSuite's RMA, then the exchange's sales order.
  // The open return holds the first missing record, the RMA, so it sits on that step.
  it('lays a held return out as the chain holding it, in lifecycle order', () => {
    const rows = recordRows({ OMS: { return: [{ id: 'M259806', internalId: null, status: 'Completed', channel: 'AFTSHIP_RTN_CHANNEL',
      warrantyId: 'FV2MPKXZ', heldBy: { id: 'M192313', status: 'Requested' }, exchange: { id: 'EXC-#GOR196740771-3', netsuiteId: null } }] } })
    const chain = heldChain(rows)
    expect(chain.map((step) => [step.label, step.sub, step.status, step.present, step.heldBy?.label ?? null])).toEqual([
      ['Return M259806', 'HotWax · this finding', 'Completed', true, null],
      ['Exchange EXC-#GOR196740771-3', 'HotWax · from M259806', 'Created', true, null],
      ['RMA for M259806', 'NetSuite · the return', 'Not created', false, 'Return M192313'],
      ['Exchange in NetSuite', 'NetSuite · after the RMA', 'Not sent', false, null],
    ])
    expect(chain[2]?.heldBy).toEqual({ label: 'Return M192313', sub: 'HotWax · open on the same order', status: 'Requested' })
    // No exchange: the return, then its RMA, held.
    const plain = heldChain(recordRows({ OMS: { return: [{ id: 'M259806', internalId: null, status: null, heldBy: { id: 'M192313', status: null } }] } }))
    expect(plain.map((step) => [step.label, step.status, step.heldBy?.status ?? null])).toEqual([
      ['Return M259806', 'Open', null], ['RMA for M259806', 'Not created', 'Open'],
    ])
    // A read that finds the exchange in NetSuite says so as read, even though it should come after the RMA.
    const synced = recordRows({ OMS: { return: [{ id: 'M259806', internalId: null, status: 'Completed',
      heldBy: { id: 'M192313', status: 'Requested' }, exchange: { id: 'EXC-#GOR196740771-3', netsuiteId: '88123' } }] } })
    expect(heldChain(synced).at(-1)).toMatchObject({ label: 'Exchange in NetSuite', sub: 'NetSuite · 88123', status: 'Sent', present: true })
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

  // DAR-UI-139 (Aditi: "all finding have the basix details row. and then based on type the detaisl are displayed slightly
  // differently"). Four cells on every finding: each system the check compared and its record's status (None when that
  // system holds no record), the amount, the day.
  it('reads every finding as the same four basics: each compared system, the amount, the day', () => {
    const order = recordRows({
      OMS: { order: [{ id: '#931462', internalId: '118451', status: 'Approved', orderTotal: { amount: '486.53', currency: 'USD' }, orderDate: '2026-11-16' }] },
    })
    expect(basicFacts(order, ['OMS', 'NetSuite']).map((f) => [f.label, f.value])).toEqual([
      ['HotWax', 'Approved'], ['NetSuite', 'None'], ['Order total', '486.53 USD'], ['Ordered', 'Nov 16'],
    ])
    // An item's card reads its order's status; a return's total and day win over its order's.
    const ret = recordRows({
      Shopify: { return: [{ id: '40112', internalId: null, status: 'Completed', returnTotal: { amount: '128.00', currency: 'USD' }, returnDate: '2026-11-18',
        orderTotal: { amount: '236.00', currency: 'USD' }, orderDate: '2026-11-02' }] },
      NetSuite: { salesOrderLine: [{ id: 'SO1', internalId: null, status: 'Pending Billing' }] },
    })
    expect(basicFacts(ret, ['Shopify', 'NetSuite']).map((f) => [f.label, f.value])).toEqual([
      ['Shopify', 'Completed'], ['NetSuite', 'Pending Billing'], ['Return total', '128.00 USD'], ['Returned', 'Nov 18'],
    ])
    // A check that has not run names no systems: the records' own, and a fact nobody read is a dash.
    const bare = recordRows({ OMS: { orderItem: [{ id: 'M1/01', internalId: null, status: 'Completed', orderStatus: 'Completed' }] } })
    expect(basicFacts(bare, []).map((f) => [f.label, f.value])).toEqual([
      ['HotWax', 'Completed'], ['Other system', '—'], ['Total', '—'], ['Day', '—'],
    ])
    // DAR-BE-360 (Aditi: "add payment status to all orders and refunds"): each system's payment status beside its status,
    // from another of its records when the first has none (an item's order); alone when its record has no status.
    const paid = recordRows({
      OMS: { orderItem: [{ id: 'M1/01', internalId: null, status: 'Completed', orderStatus: 'Completed' }],
        order: [{ id: 'M1', internalId: null, status: 'Completed', paymentStatus: 'Settled, Refunded' }] },
      Shopify: { order: [{ id: '501', internalId: null, status: null, paymentStatus: 'Paid' }] },
    })
    expect(basicFacts(paid, ['OMS', 'Shopify']).slice(0, 2).map((f) => [f.label, f.value])).toEqual([
      ['HotWax', 'Completed · Settled, Refunded'], ['Shopify', 'Paid'],
    ])
    // DAR-BE-371 (Gorjana R7 F-126390). A HotWax-to-NetSuite check shows HotWax and NetSuite, never the Shopify record
    // beside them; a one-system check shows its one system.
    const r7 = recordRows({
      OMS: { order: [{ id: '#GOR197449616', internalId: 'M1237624', status: 'Approved' }] },
      Shopify: { order: [{ id: '18997506769027', internalId: null, status: null }] },
    })
    expect(basicFacts(r7, ['OMS', 'NetSuite']).slice(0, 2).map((f) => [f.label, f.value])).toEqual([['HotWax', 'Approved'], ['NetSuite', 'None']])
    expect(basicFacts(r7, ['NetSuite']).map((f) => f.label)).toEqual(['NetSuite', 'Total', 'Day'])
  })

  // DAR-UI-139. What kind of record the finding is about, from its category, else its records.
  it('tells an order, a return and an exchange apart', () => {
    const rows = (records: Parameters<typeof recordRows>[0]) => recordRows(records)
    expect(recordKind('orders', rows({ OMS: { return: [{ id: 'R1', internalId: null, status: null }] } }))).toBe('Order')
    expect(recordKind('returns', [])).toBe('Return')
    expect(recordKind('exchangesAndWarranty', [])).toBe('Exchange')
    expect(recordKind('', rows({ NetSuite: { rma: [{ id: 'RMA1', internalId: null, status: null }] } }))).toBe('Return')
    expect(recordKind('', rows({ OMS: { order: [{ id: 'O1', internalId: null, status: null }] } }))).toBe('Order')
  })

  // DAR-UI-139. Under the record kind: the facts the basics did not already say, each once.
  it('leaves the basics out of the record facts', () => {
    const rows = recordRows({
      OMS: { order: [{ id: 'O1', internalId: null, status: 'Approved', customer: 'Ada Lovelace', orderDate: '2026-11-16', salesChannel: 'Web',
        orderTotal: { amount: '486.53', currency: 'USD' } }] },
    })
    // DAR-UI-151. Every order finding shows the same rows, a dash where its reads gave none.
    expect(typeDetails(rows, 'Order').map((f) => [f.label, f.value])).toEqual([
      ['Customer', 'Ada Lovelace'], ['Sales channel', 'Web'], ['Ship method', '—'],
    ])
    const exchange = recordRows({ OMS: { order: [{ id: 'O2', internalId: null, status: null, shipMethod: 'POS_COMPLETED' }] } })
    expect(typeDetails(exchange, 'Exchange').map((f) => [f.label, f.value])).toEqual([
      ['Customer', '—'], ['Sales channel', '—'], ['Warranty ID', '—'], ['Ship method', 'POS_COMPLETED'],
    ])
  })

  it('says a history code in words', () => {
    expect(eventLabel('stillOpen')).toBe('Still open')
    expect(eventLabel('found')).toBe('Found')
  })

  // DAR-BE-368: an order finding's lines, a Shopify line and the HotWax item keeping its id as one row, by SKU.
  it("pairs each Shopify line with the HotWax item that keeps its id, labelled by SKU, each system's status in order", () => {
    const rows = recordRows({
      Shopify: { order: [{ id: '19007848448310', internalId: null, status: 'Unfulfilled', lines: [
        { id: '71', sku: 'SKU-A', name: 'Anorak', quantity: 2, status: 'Unfulfilled' },
        { id: '72', sku: null, name: 'Gift card', quantity: 1, status: 'Fulfilled' }] }] },
      OMS: { order: [{ id: '#9281CAN', internalId: '167426', status: 'Completed', lines: [
        { id: '71', sku: 'SKU-A', name: null, quantity: 2, status: 'Completed' },
        { id: '00103', sku: 'SKU-C', name: null, quantity: 1, status: 'Cancelled' }] }] },
    })
    expect(orderLineRows(rows)).toEqual([
      { key: '71', label: 'SKU-A', quantity: '2', statuses: [{ system: 'Shopify', status: 'Unfulfilled' }, { system: 'HotWax', status: 'Completed' }] },
      { key: '72', label: 'Gift card', quantity: '1', statuses: [{ system: 'Shopify', status: 'Fulfilled' }] },
      { key: '00103', label: 'SKU-C', quantity: '1', statuses: [{ system: 'HotWax', status: 'Cancelled' }] },
    ])
    expect(orderLineRows(recordRows({ OMS: { order: [{ id: 'M1', internalId: null, status: null }] } }))).toEqual([])
    // DAR-BE-371. A HotWax-to-NetSuite check lists only HotWax's and NetSuite's lines.
    expect(orderLineRows(rows, ['OMS', 'NetSuite']).map((line) => [line.key, line.statuses.map((x) => x.system)])).toEqual([
      ['71', ['HotWax']], ['00103', ['HotWax']],
    ])
  })
})
