import { describe, expect, it } from 'vitest'
import type { AuditCategory, AuditFindingListItem, AuditProgress, AuditReport, AuditStatement, AuditStatementCheck } from '../api/auditTypes'
import {
  HEALTH,
  categoryItems,
  causeOptions,
  causeGroups,
  causeHeading,
  checkGroups,
  comparedBars,
  comparedGap,
  countFor,
  countsLine,
  defaultCategory,
  defaultSource,
  defaultStatement,
  filterCounts,
  findStatement,
  findingsLeft,
  isAuditFilter,
  lineLabel,
  matchesFindingFilters,
  narrowedCounts,
  orderKey,
  progressLine,
  statementFindings,
  sourceItems,
  statementItems,
} from '../auditColumns'

function counts(open = 0, pending = 0) {
  return { open, pending, newToday: 0, fixedToday: 0 }
}

function statement(id: string, open = 0, pending = 0, status: AuditStatement['status'] = 'ran'): AuditStatement {
  return { id, text: `${id} text`, weight: 'firm', status, reason: null, checks: [], counts: counts(open, pending), findings: [], findingsOmitted: 0 }
}

function category(label: string, statements: AuditStatement[], open = 0, pending = 0): AuditCategory {
  return { label, counts: counts(open, pending), statements: Object.fromEntries(statements.map((s) => [s.id, s])) }
}

function report(overrides: Partial<AuditReport['health']> = {}): AuditReport {
  return {
    schema: 'darpan.audit.report/v1',
    about: '',
    report: {
      tenant: { id: 'T', name: 'T', timeZone: 'UTC' },
      audit: { id: 'month-close', name: 'Month close', period: 'month' },
      date: '2026-10-22', window: { from: '2026-10-01', thru: '2026-10-22' }, running: true,
      period: '2026-10', generatedAt: '2026-10-22T06:12:00Z',
    },
    health: {
      complete: true, summary: 'ok',
      sources: {
        NetSuite: { read: 'complete', records: 4120, readAt: null, reason: null, affects: [] },
        OMS: { read: 'complete', records: 3871, readAt: null, reason: null, affects: [] },
      },
      checks: { ran: 4, partial: 0, notRun: 0 },
      notCovered: ['R5'],
      ...overrides,
    },
    summary: { ...counts(3, 1), oldestOpen: null, byCategory: {} },
    categories: {
      orders: category('Orders', [statement('R1', 1), statement('R2', 0, 1), statement('R19')], 1, 1),
      refunds: category('Refunds and credits', [statement('R4', 2), statement('R5', 0, 0, 'notRun')], 2),
      exchanges: category('Exchanges and warranty', [statement('R12')]),
    },
  }
}

describe('auditColumns', () => {
  it('lists Run health first, then each category with its counts and a one-word rail label', () => {
    const items = categoryItems(report())
    expect(items.map((item) => item.id)).toEqual([HEALTH, 'orders', 'refunds', 'exchanges'])
    expect(items[0]).toMatchObject({ label: 'Run health', sub: 'complete · 1 not covered', attention: false })
    expect(items[1]).toMatchObject({ sub: '1 open · 1 pending', attention: true, short: 'Orders' })
    expect(items[2]).toMatchObject({ sub: '2 open · 1 not checked', short: 'Refunds' })
    expect(items[3]).toMatchObject({ sub: 'nothing found', attention: false })
    // DAR-UI-087. A category nothing checked does not say nothing was found.
    const unchecked = report()
    unchecked.categories.exchanges = category('Exchanges and warranty', [statement('R12', 0, 0, 'notRun')])
    expect(categoryItems(unchecked)[3]).toMatchObject({ sub: '1 not checked' })
    expect(categoryItems(report({ complete: false, notCovered: [] }))[0]).toMatchObject({ sub: 'not complete', attention: true })
  })

  it('filters a category\'s statements, and badges each by open, else pending, else clean, else a dash', () => {
    const orders = report().categories.orders
    expect(statementItems(orders, 'all').map((item) => [item.id, item.badge, item.tone])).toEqual([
      ['R1', '1', 'open'], ['R2', '1', 'pending'], ['R19', '0', 'clean'],
    ])
    expect(statementItems(orders, 'open').map((item) => item.id)).toEqual(['R1'])
    expect(statementItems(orders, 'pending').map((item) => item.id)).toEqual(['R2'])
    expect(statementItems(report().categories.refunds, 'notChecked').map((item) => [item.id, item.badge, item.tone]))
      .toEqual([['R5', '–', 'notChecked']])
  })

  // DAR-UI-073. The pill decides what every column counts and lists: Open open, Pending pending, the rest both.
  it('counts what the picked pill shows, in every column', () => {
    expect([countFor(counts(340, 285), 'open'), countFor(counts(340, 285), 'pending'), countFor(counts(340, 285), 'all'),
      countFor(counts(340, 285), 'notChecked'), countFor(undefined, 'open')]).toEqual([340, 285, 625, 625, 0])
    expect(categoryItems(report(), 'pending').map((item) => item.count)).toEqual([0, 1, 0, 0])
    expect(categoryItems(report(), 'all')[1]!.count).toBe(2)
    const orders = { ...report().categories.orders!, statements: { R1: { ...statement('R1', 340, 285) } } }
    expect(['open', 'pending', 'all'].map((f) => statementItems(orders, f as 'open')[0]!.badge)).toEqual(['340', '285', '625'])
    const summary = (id: string, state: 'open' | 'pending') => ({ id, headline: id, state, firstFound: '', ageDays: 0, records: {}, difference: null, next: '' })
    const doc = { ...statement('R1', 400, 6), findings: [summary('F-1', 'open'), summary('F-2', 'pending')], findingsOmitted: 404 }
    expect(statementFindings(doc, [], 'open').map((item) => item.id)).toEqual(['F-1'])
    expect(statementFindings(doc, [summary('F-3', 'pending')], 'pending').map((item) => item.id)).toEqual(['F-2', 'F-3'])
    expect([findingsLeft(doc, 1, null, 'open'), findingsLeft(doc, 2, null, 'pending'), findingsLeft(doc, 2, null, 'all')]).toEqual([399, 4, 404])
  })

  // DAR-UI-073. All counts findings too (open + pending), as everything under it does; only unchecked counts statements.
  it('counts findings on open, pending and all, and statements on unchecked', () => {
    expect(filterCounts(report())).toEqual({ open: 3, pending: 1, notChecked: 1, all: 4 })
  })

  it('opens on the category with the most open findings the filter keeps, and its first statement with findings', () => {
    const doc = report()
    expect(defaultCategory(doc, 'all')).toBe('refunds')
    expect(defaultCategory(doc, 'pending')).toBe('orders')
    // A morning with nothing open opens where the most is pending.
    doc.categories.refunds!.counts = counts(0, 0)
    doc.categories.orders!.counts = counts(0, 1)
    doc.categories.exchanges!.counts = counts(0, 4)
    expect(defaultCategory(doc, 'all')).toBe('exchanges')
    expect(defaultStatement(doc.categories.orders, 'all')).toBe('R1')
    expect(defaultStatement(doc.categories.exchanges, 'all')).toBe('R12')
    expect(defaultStatement(doc.categories.exchanges, 'open')).toBe('')
  })

  it('lists each system read, the checks, and the uncovered statements under Run health', () => {
    expect(sourceItems(report()).map((item) => [item.key, item.label, item.sub])).toEqual([
      ['NetSuite', 'NetSuite', '4,120 records'],
      ['OMS', 'HotWax', '3,871 records'],
      ['checks', 'Checks', '4 ran'],
      ['notCovered', 'Not covered', 'R5'],
    ])
    expect(defaultSource(report())).toBe('checks')
    const partial = report({ sources: { NetSuite: { read: 'partial', records: 9, readAt: null, reason: 'page failed', affects: ['R1'] } } })
    expect(defaultSource(partial)).toBe('NetSuite')
  })

  // DAR-UI-085 (Aditi: "some sort of indicator on the run health.. to ensure the user can see that it is running").
  describe('a play in progress', () => {
    const progress: AuditProgress = {
      checks: 7,
      activeChecks: 3,
      active: [
        { run: 'Completed - HotWax vs NetSuite', checks: ['completed-not-billed'], state: 'running', attempt: 1,
          stage: 'EXTRACT_FILE2', progressPercent: 40, elapsedMs: 4 * 60000, health: 'healthy' },
        { run: 'Warranty claims - credit memos', checks: ['warranty-claims-without-a-credit-memo', 'warranty-memos-not-at-the-claimed-amount'],
          state: 'queued', attempt: 1 },
      ],
    }

    it('says on Run health that checks are running and how many, and marks it live', () => {
      const health = categoryItems(report({ complete: false, notCovered: [] }), 'all', progress)[0]
      expect(health).toMatchObject({ sub: 'running · 3 of 7 checks', running: true, attention: false })
      expect(categoryItems(report(), 'all', { checks: 7, activeChecks: 0, active: [] })[0]).toMatchObject({ running: false })
      expect(categoryItems(report())[0]).toMatchObject({ running: false })
    })

    it('a stuck run on Run health is attention, not just running', () => {
      const stuck = { ...progress, active: [{ ...progress.active[0]!, health: 'stuck' as const }] }
      expect(categoryItems(report(), 'all', stuck)[0]).toMatchObject({ running: true, attention: true })
    })

    it('lists Running now first under Run health and opens on it', () => {
      const items = sourceItems(report(), progress)
      expect(items[0]).toMatchObject({ key: 'running', label: 'Running now', sub: '1 running · 1 queued', tag: '3', attention: false })
      expect(items.find((item) => item.key === 'checks')?.sub).toBe('4 ran · 3 running')
      expect(defaultSource(report(), progress)).toBe('running')
      expect(sourceItems(report()).map((item) => item.key)).not.toContain('running')
    })

    it('says where each run is in words: stage, progress, time against its usual, or why it waits', () => {
      expect(progressLine({ ...progress.active[0]!, usualDurationMs: 10 * 60000 })).toBe('Extracting source 2 · 40% · 4m, usually 10m')
      expect(progressLine({ ...progress.active[0]!, stage: null, progressPercent: null, elapsedMs: 30000 })).toBe('Starting · <1m')
      expect(progressLine(progress.active[1]!)).toBe('Queued')
      expect(progressLine({ ...progress.active[1]!, attempt: 2 })).toBe('Queued · retry, attempt 2')
      expect(progressLine({ ...progress.active[0]!, elapsedMs: 125 * 60000 })).toBe('Extracting source 2 · 40% · 2h 5m')
    })
  })

  it('finds a statement in any category', () => {
    expect(findStatement(report(), 'R4')?.categoryId).toBe('refunds')
    expect(findStatement(report(), 'R99')).toBeNull()
  })

  it('draws a check\'s compared counts as shares of the largest and says the gap', () => {
    const check = { id: 'c', label: 'c', status: 'ran' as const, reason: null, matchedBy: null, graceDays: 1, compared: { OMS: 412, NetSuite: 409 } }
    expect(comparedBars(check)).toEqual([
      { key: 'OMS', system: 'HotWax', count: '412', share: '100%' },
      { key: 'NetSuite', system: 'NetSuite', count: '409', share: '99%' },
    ])
    expect(comparedGap(check)).toBe('3 records not matched')
    expect(comparedGap({ ...check, compared: { NetSuite: 2210 } })).toBe('')
    expect(comparedGap({ ...check, compared: { OMS: 9, NetSuite: 9 } })).toBe('every record matched')
  })

  // DAR-UI-070. The report lists 50 a statement; "N more" pages through the rest.
  it('lists a statement\'s findings past the report\'s 50, without the fixed or a repeat', () => {
    const summary = (id: string, state: 'open' | 'pending' | 'fixed' = 'open') =>
      ({ id, headline: id, state, firstFound: '2026-10-01', ageDays: 1, records: {}, difference: null, next: '' })
    const doc = { ...statement('R1', 3, 1), findings: [summary('F-1'), summary('F-2', 'fixed'), summary('F-3', 'pending')], findingsOmitted: 2 }
    expect(statementFindings(doc, [])).toEqual([summary('F-1'), summary('F-3', 'pending')])
    expect(statementFindings(doc, [summary('F-1'), summary('F-4'), summary('F-5')]).map((item) => item.id)).toEqual(['F-1', 'F-3', 'F-4', 'F-5'])
    expect(statementFindings(null, [])).toEqual([])
  })

  it('says how many findings are left to show, and none once the last page is in', () => {
    const doc = { ...statement('R1', 400, 6), findingsOmitted: 357 }
    expect(findingsLeft(doc, 50, null)).toBe(356)
    expect(findingsLeft(doc, 150, true)).toBe(256)
    expect(findingsLeft(doc, 406, false)).toBe(0)
    expect(findingsLeft(doc, 380, false)).toBe(0)
    expect(findingsLeft({ ...doc, findingsOmitted: 0 }, 50, null)).toBe(0)
    expect(findingsLeft(null, 0, null)).toBe(0)
  })

  // DAR-UI-072. Findings of one order sit together under it; an order with one finding needs no heading.
  it('keys a finding by its order: HotWax first, then Shopify, then NetSuite', () => {
    const item = (records: Record<string, Record<string, { id: string }[]>>) =>
      ({ id: 'F', headline: '', state: 'open' as const, firstFound: '', ageDays: 0, difference: null, next: '',
        records: Object.fromEntries(Object.entries(records).map(([system, byType]) => [system,
          Object.fromEntries(Object.entries(byType).map(([type, list]) => [type, list.map((r) => ({ ...r, internalId: null, status: null }))]))])) })
    expect(orderKey(item({ OMS: { orderItem: [{ id: 'M1168149/02' }] }, NetSuite: { salesOrderLine: [{ id: 'SO7' }] } }))).toBe('M1168149')
    expect(orderKey(item({ OMS: { order: [{ id: 'M1168007' }] } }))).toBe('M1168007')
    expect(orderKey(item({ NetSuite: { invoice: [{ id: 'INV1' }] }, Shopify: { order: [{ id: '1895' }] } }))).toBe('1895')
    expect(orderKey(item({ NetSuite: { salesOrder: [{ id: 'SO9' }] } }))).toBe('SO9')
    expect(orderKey(item({ NetSuite: { creditMemo: [{ id: 'CM1' }] } }))).toBe('')
  })

  // DAR-UI-073. The toolbar's search, cause and age narrow the whole board.
  it('narrows findings by a search over ids, a cause and an age, and counts what is left per category and statement', () => {
    const item = (id: string, over: Partial<AuditFindingListItem>): AuditFindingListItem => ({
      id, headline: `Item ${id} is completed in HotWax and not billed in NetSuite`, state: 'open', firstFound: '', ageDays: 2,
      difference: null, next: '', audit: 'month-close', period: '2026-10', statement: 'R1', category: 'orders', cause: null,
      records: { OMS: { orderItem: [{ id: 'M1168149/01', internalId: null, status: null }] },
        NetSuite: { salesOrderLine: [{ id: 'SO7330652', internalId: '81049165', status: null }] } }, ...over })
    const a = item('F-1', { cause: 'Backordered in NetSuite', ageDays: 9 })
    const b = item('F-2', { records: {}, statement: 'R3', ageDays: 1 })
    const none = { q: '', cause: '', age: 0 }
    expect(matchesFindingFilters(a, none)).toBe(true)
    expect(['m1168149', 'SO7330652', '81049165', 'f-1', 'billed'].map((q) => matchesFindingFilters(a, { ...none, q }))).toEqual([true, true, true, true, true])
    expect(matchesFindingFilters(b, { ...none, q: 'M1168149' })).toBe(false)
    expect([a, b].filter((x) => matchesFindingFilters(x, { ...none, cause: 'Backordered in NetSuite' })).map((x) => x.id)).toEqual(['F-1'])
    expect([a, b].filter((x) => matchesFindingFilters(x, { ...none, age: 7 })).map((x) => x.id)).toEqual(['F-1'])
    expect(causeOptions([a, b, item('F-3', { cause: 'Another line backordered' }), item('F-4', { cause: 'Backordered in NetSuite' })]))
      .toEqual(['Another line backordered', 'Backordered in NetSuite'])
    const counted = narrowedCounts([a, b, item('F-5', { category: 'returns', statement: 'R8' })])
    expect([counted.byCategory.get('orders'), counted.byCategory.get('returns'), counted.byStatement.get('R1'), counted.byStatement.get('R3')]).toEqual([2, 1, 1, 1])
  })

  // DAR-UI-075. An order is one finding; its lines are named by their place in it, and the filters see every line.
  it('names an order\'s line by its place in the order, and filters an order by any of its lines', () => {
    const line = (id: string, item: string, cause: string | null, held = false) => ({
      id, headline: `Item ${item} is completed in HotWax and not billed in NetSuite`, state: 'open' as const, firstFound: '',
      ageDays: 2, difference: null, next: '', cause, held,
      records: { OMS: { orderItem: [{ id: item, internalId: null, status: 'Completed' }] } } })
    const lines = [line('F-1', 'M1168785/01', 'Backordered in NetSuite'),
      line('F-2', 'M1168785/02', 'Shipped, not billed: another line of its order is backordered in NetSuite', true)]
    expect(lines.map((l) => lineLabel('M1168785', l))).toEqual(['Line 1', 'Line 2'])
    expect(lineLabel('M1168785', { ...lines[0]!, records: {} })).toBe('F-1')
    // DAR-UI-081 (Aditi: "show SKU instead of line 1, line 2").
    expect(lineLabel('M1168785', { ...lines[0]!, records: { OMS: { orderItem: [{ id: 'M1168785/01', internalId: null, status: null, sku: '263-203-186-G' }] } } }))
      .toBe('263-203-186-G')
    // The same SKU on two lines of one order: each is named by its line too.
    const twins = lines.map((l, i) => ({ ...l, records: { OMS: { orderItem: [{ id: `M1168785/0${i + 1}`, internalId: null, status: null, sku: '259-118-G' }] } } }))
    expect(twins.map((l) => lineLabel('M1168785', l, twins))).toEqual(['259-118-G · line 1', '259-118-G · line 2'])
    const order: AuditFindingListItem = { id: 'M1168785', kind: 'order', order: 'M1168785', headline: 'Order M1168785: line 1 backordered in NetSuite, holding 1 more line',
      state: 'open', firstFound: '', ageDays: 2, difference: null, next: '', records: {}, statement: 'R1', category: 'orders',
      cause: 'Backordered in NetSuite', stuck: ['F-1'], lines }
    const none = { q: '', cause: '', age: 0 }
    expect(matchesFindingFilters(order, { ...none, q: 'M1168785/02' })).toBe(true)
    expect(matchesFindingFilters(order, { ...none, cause: 'Shipped, not billed: another line of its order is backordered in NetSuite' })).toBe(true)
    expect(causeOptions([order])).toEqual(['Backordered in NetSuite', 'Shipped, not billed: another line of its order is backordered in NetSuite'])
  })

  it('reads counts and filters in words', () => {
    expect(countsLine(counts(0, 0))).toBe('nothing found')
    expect(countsLine(counts(2, 0))).toBe('2 open')
    expect(isAuditFilter('open')).toBe(true)
    expect(isAuditFilter('everything')).toBe(false)
  })

  // DAR-BE-125 (Aditi: "the findings subheadings are not organized properly"). A cause is said once: its findings sit
  // together under it, causes in the order their first finding came, findings in their own order within a cause.
  it('keeps each cause\'s findings together under one heading', () => {
    const f = (id: string, rest: string, kind?: 'order') => ({ id, headline: `Return ${id}: ${rest}`, kind }) as AuditFindingListItem
    const items = [f('a', 'Waits'), f('b', 'No order'), f('c', 'Backordered'), f('d', 'No order'), f('e', 'Backordered'), f('o', 'Held', 'order')]
    expect(causeGroups(items).map((item) => item.id)).toEqual(['a', 'b', 'd', 'c', 'e', 'o'])
  })

  // A finding written before its cause was renamed heads by the cause's new words, beside one written after.
  it('heads a finding by its cause as the catalog names it now', () => {
    const old = { id: 'a', headline: 'Return a: Its order is backordered in NetSuite', cause: 'Order backordered' } as AuditFindingListItem
    const fresh = { id: 'b', headline: 'Return b: Order backordered', cause: 'Order backordered' } as AuditFindingListItem
    const bare = { id: 'c', headline: 'Return c: No RMA', cause: null } as AuditFindingListItem
    expect([old, fresh, bare].map(causeHeading)).toEqual(['Order backordered', 'Order backordered', 'No RMA'])
    expect(causeGroups([old, bare, fresh]).map((item) => item.id)).toEqual(['a', 'b', 'c'])
  })

  // DAR-UI-087 (Aditi: "i dont like how this looks"): Run health › Checks lists every check under its category, a
  // statement's per-store checks as one row naming the stores, the ones that did not run first.
  it('groups the checks by category, folds a statement\'s per-store checks into one row, and puts not run first', () => {
    const check = (id: string, status: AuditStatementCheck['status'] = 'notRun'): AuditStatementCheck =>
      ({ id, label: `${id} label`, status, reason: null, matchedBy: null, graceDays: null, compared: null })
    const withChecks = (id: string, checks: AuditStatementCheck[]) => ({ ...statement(id), checks })
    const doc = report()
    doc.categories = {
      orders: category('Orders', [
        withChecks('R1', [check('completed-not-billed', 'ran'), check('completed-not-shipped')]),
        withChecks('R2', [check('shopify-orders-not-in-hotwax-usa', 'ran'), check('shopify-orders-not-in-hotwax-eu'), check('shopify-orders-not-in-hotwax-uk', 'partial')]),
        // The same check under a second statement is listed once.
        withChecks('R3', [check('completed-not-billed', 'ran')]),
      ]),
      returns: category('Returns', [withChecks('R6', [check('refunded-returns-without-credit-memo-usa', 'ran'), check('refunded-returns-without-credit-memo-uk', 'ran')])]),
      exchanges: category('Exchanges and warranty', [statement('R12')]),
    }
    const groups = checkGroups(doc)
    expect(groups.map((group) => group.label)).toEqual(['Orders', 'Returns'])
    const [orders, returns] = groups
    // Two checks in one statement that only share a prefix are not a family: a family is one statement's stores.
    expect(orders!.rows.map((row) => [row.id, row.variants, row.status, row.ran, row.checks.length])).toEqual([
      ['completed-not-shipped', [], 'notRun', 0, 1],
      ['shopify-orders-not-in-hotwax', ['usa', 'eu', 'uk'], 'notRun', 1, 3],
      ['completed-not-billed', [], 'ran', 1, 1],
    ])
    expect(orders!.rows[0]).toMatchObject({ label: 'completed-not-shipped label', category: 'orders', statement: 'R1' })
    expect(orders!.rows[1]).toMatchObject({ label: '', statement: 'R2' })
    expect(returns!.rows.map((row) => [row.id, row.status])).toEqual([['refunded-returns-without-credit-memo', 'ran']])
  })
})
