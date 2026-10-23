import { describe, expect, it } from 'vitest'
import type { AuditCategory, AuditReport, AuditStatement } from '../api/auditTypes'
import {
  HEALTH,
  categoryItems,
  comparedBars,
  comparedGap,
  countsLine,
  defaultCategory,
  defaultSource,
  defaultStatement,
  filterCounts,
  findStatement,
  isAuditFilter,
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
      date: '2026-10-22', window: { from: '2026-10-01', thru: '2026-10-22' }, running: true, extendedThru: null,
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
    expect(items[3]).toMatchObject({ sub: 'holds', attention: false })
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

  it('counts findings on the open and pending pills and statements on the other two', () => {
    expect(filterCounts(report())).toEqual({ open: 3, pending: 1, notChecked: 1, all: 6 })
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

  it('finds a statement in any category', () => {
    expect(findStatement(report(), 'R4')?.categoryId).toBe('refunds')
    expect(findStatement(report(), 'R99')).toBeNull()
  })

  it('draws a check\'s compared counts as shares of the largest and says the gap', () => {
    const check = { id: 'c', label: 'c', status: 'ran' as const, reason: null, matchedBy: null, graceDays: 1, compared: { OMS: 412, NetSuite: 409 } }
    expect(comparedBars(check)).toEqual([
      { system: 'HotWax', count: '412', share: '100%' },
      { system: 'NetSuite', count: '409', share: '99%' },
    ])
    expect(comparedGap(check)).toBe('3 records not matched')
    expect(comparedGap({ ...check, compared: { NetSuite: 2210 } })).toBe('')
    expect(comparedGap({ ...check, compared: { OMS: 9, NetSuite: 9 } })).toBe('every record matched')
  })

  it('reads counts and filters in words', () => {
    expect(countsLine(counts(0, 0))).toBe('holds')
    expect(countsLine(counts(2, 0))).toBe('2 open')
    expect(isAuditFilter('open')).toBe(true)
    expect(isAuditFilter('everything')).toBe(false)
  })
})
