import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import type { AuditAcknowledgement, AuditFindingDocument, AuditFindingSummary } from '../../lib/api/auditTypes'
import { lineWhy, useFindingDetail } from '../useFindingDetail'

// DAR-OPS-029 U05b. What the finding detail shows, read from the open finding: the choices it makes, each edge once.

const ACK: AuditAcknowledgement = { note: 'Refunded', by: { id: 'U1', label: null }, at: '2026-10-03T09:00:00-07:00', remindOn: null, reminded: false }

function doc(overrides: Record<string, unknown> = {}, state = 'open'): AuditFindingDocument {
  return {
    schema: 'darpan.audit.finding/v1',
    finding: {
      id: 'F-1', headline: 'Order M1: not invoiced', audit: { id: 'month-close', name: 'Month close' }, period: '2026-10',
      category: { id: 'orders', label: 'Orders' }, statement: { id: 'R2', text: 'Every order is invoiced.', weight: 'firm' },
      check: { id: 'c', label: 'c', matchedBy: null },
      status: { state, firstFound: '2026-10-02', lastSeen: '2026-10-08', lastChecked: null, ageDays: 6, timesSeen: 7, closedAt: null, closedBy: null },
      records: {},
      evidence: { rule: null, expected: null, actual: null, difference: null, checks: [] },
      diagnosis: { conclusion: null, explanation: null },
      fix: { owner: null, where: 'NETSUITE', action: null, verify: { by: 'next check', nextCheck: null, passesWhen: null }, darpanChanges: '' },
      history: [],
      ...overrides,
    },
    access: { mode: 'read-only', note: '' },
  } as unknown as AuditFindingDocument
}

function detail(input: { doc?: AuditFindingDocument; orderUnit?: AuditFindingSummary | null; row?: AuditFindingSummary | null; ack?: AuditAcknowledgement | null } = {}) {
  const acknowledgement = ref<AuditAcknowledgement | null>(input.ack ?? null)
  const view = useFindingDetail({
    findingDoc: () => input.doc ?? doc(),
    orderUnit: () => input.orderUnit ?? null,
    statement: () => 'R2',
    statementDoc: () => null,
    row: () => input.row ?? null,
    acknowledgement: () => acknowledgement.value,
    timeZone: () => 'America/Los_Angeles',
  })
  return { view, acknowledgement }
}

describe('useFindingDetail', () => {
  it('leads with what is wrong, the record moved up beside the statement', () => {
    const { view } = detail()
    expect(view.lead.value).toBe('Not invoiced')
    expect(view.eyebrow.value).toBe('R2 · Order M1')
  })

  // DAR-UI-140. The order's level wins over its row's, and a level set on a cause says which cause.
  it('takes the order\'s level, never its row\'s, and names the cause a level was set on', () => {
    const orderUnit = { id: 'M1', kind: 'order', headline: 'Order M1', state: 'open', priority: 'P0', prioritySource: 'reason', priorityReason: 'Gift card' } as unknown as AuditFindingSummary
    const row = { id: 'F-1', headline: '', state: 'open', priority: 'P2' } as unknown as AuditFindingSummary
    expect(detail({ orderUnit, row }).view.levelLine.value).toMatch(/set on "Gift card"$/)
    expect(detail({ row }).view.levelLine.value).toMatch(/from R2$/)
  })

  // DAR-UI-144. An open row with none, or one its reminder brought back, can be acknowledged; an acknowledged or fixed one cannot.
  it('offers Acknowledge only on an open row with none or a reminded one, and badges an acknowledged one', () => {
    const none = detail()
    expect(none.view.canAcknowledge.value).toBe(true)
    none.acknowledgement.value = ACK
    expect(none.view.canAcknowledge.value).toBe(false)
    expect(none.view.detailBadge.value.label).toBe('Acknowledged')
    expect(none.view.ackCardLine.value).toBe('U1 · Oct 3')
    none.acknowledgement.value = { ...ACK, reminded: true }
    expect(none.view.canAcknowledge.value).toBe(true)
    expect(none.view.detailBadge.value.label).toBe('Open')
    expect(detail({ doc: doc({}, 'fixed') }).view.canAcknowledge.value).toBe(false)
  })

  // DAR-UI-071/081. A one-line order names its line as what holds it; the fix's system is said once.
  it('names a one-line order\'s line as what it is stuck on, in the fix\'s system unless the cause says it', () => {
    const line = (cause: string) => ({ id: 'L1', headline: 'Line M1/01 is open', state: 'open', cause, records: { OMS: { orderItem: [{ id: 'M1/01', sku: 'SKU-1' }] } } })
    const unit = (cause: string) => ({ id: 'M1', order: 'M1', kind: 'order', headline: 'Order M1', state: 'open', lines: [line(cause)] }) as unknown as AuditFindingSummary
    expect(detail({ orderUnit: unit('Backordered') }).view.stuckOn.value).toBe('SKU-1: Backordered in NetSuite')
    expect(detail({ orderUnit: unit('Not in NetSuite') }).view.stuckOn.value).toBe('SKU-1: Not in NetSuite')
  })

  // The conclusion's words are dropped when the headline already says them.
  it('says only what the headline has not said', () => {
    const repeated = doc({ diagnosis: { conclusion: { label: 'Not invoiced.' }, explanation: 'NetSuite has no invoice yet' } })
    expect(detail({ doc: repeated }).view.whyLine.value).toBe('NetSuite has no invoice yet.')
  })

  // DAR-UI-081. A line held by the stuck one reads as its own item's status; with no status, its cause.
  it('reads a held line as its item\'s status, else its cause', () => {
    const held = { held: true, cause: 'Backordered', state: 'open', records: { OMS: { orderItem: [{ status: 'Completed' }] } } }
    expect(lineWhy(held as never)).toBe('Completed')
    expect(lineWhy({ ...held, records: {} } as never)).toBe('Backordered')
  })
})
