import { describe, expect, it } from 'vitest'
import type { AuditAcknowledgement, AuditFindingSummary, AuditReport } from '../api/auditTypes'
import { filterCounts, pendingAcknowledgement, withAckPatches, withAckRows, type AckPatch } from '../auditColumns'

// DAR-UI-155. An acknowledgement on screen before the backend has it: the row and every count move at once, and a report
// that already carries it is not moved twice.

const ACK: AuditAcknowledgement = { note: 'Refunded', by: { id: 'U1', label: 'Sam R.' }, at: '2026-10-03T09:00:00', remindOn: null, reminded: false }

function row(id: string, acknowledgement: AuditAcknowledgement | null = null, extra: Partial<AuditFindingSummary> = {}): AuditFindingSummary {
  return { id, headline: id, state: 'open', firstFound: '2026-10-01', ageDays: 2, records: {}, difference: null, next: '', acknowledgement, ...extra }
}

const zero = { P0: 0, P1: 0, P2: 0, KNOWN: 0 }
function report(findings: AuditFindingSummary[], counts = { open: 2, acknowledged: 0 }): AuditReport {
  const c = { ...counts, newToday: 0, fixedToday: 0, byPriority: { ...zero, P1: counts.open } }
  return {
    report: { tenant: { id: 'T', name: 'T', timeZone: 'America/Los_Angeles' } },
    summary: { ...c, oldestOpen: null },
    categories: {
      orders: {
        label: 'Orders', counts: c,
        statements: { R2: { id: 'R2', text: 'R2', weight: 'firm', status: 'ran', reason: null, checks: [], counts: c, findings, findingsOmitted: 0, priority: 'P1' } },
      },
    },
  } as unknown as AuditReport
}

function patch(base: AuditReport, acknowledgement: AuditAcknowledgement | null, was: AuditAcknowledgement | null = null): AckPatch {
  return { statement: 'R2', acknowledgement, was, priority: null, base }
}

describe('withAckPatches', () => {
  it('moves an acknowledged row from open to acknowledged in the statement, category, summary and pills', () => {
    const base = report([row('F-1'), row('F-2')])
    const next = withAckPatches(base, new Map([['F-1', patch(base, ACK)]]))
    const statement = next.categories.orders!.statements.R2!
    expect(statement.findings[0]!.acknowledgement).toEqual(ACK)
    expect(statement.counts).toMatchObject({ open: 1, acknowledged: 1, byPriority: { P1: 1 } })
    expect(next.categories.orders!.counts).toMatchObject({ open: 1, acknowledged: 1 })
    expect(filterCounts(next)).toMatchObject({ open: 1, acknowledged: 1, all: 2 })
    // The backend's report is left as it was.
    expect(base.categories.orders!.statements.R2!.counts.open).toBe(2)
  })

  it('moves a reopened row back to open', () => {
    const base = report([row('F-1', ACK), row('F-2')], { open: 1, acknowledged: 1 })
    const next = withAckPatches(base, new Map([['F-1', patch(base, null, ACK)]]))
    expect(next.summary).toMatchObject({ open: 2, acknowledged: 0 })
    expect(next.categories.orders!.statements.R2!.findings[0]!.acknowledgement).toBeNull()
  })

  it('does not move a row twice once a reload already carries the acknowledgement', () => {
    const base = report([row('F-1'), row('F-2')])
    const reloaded = report([row('F-1', ACK), row('F-2')], { open: 1, acknowledged: 1 })
    expect(withAckPatches(reloaded, new Map([['F-1', patch(base, ACK)]])).summary).toMatchObject({ open: 1, acknowledged: 1 })
  })

  it('changing a note moves no count, and a reminded row counts as open', () => {
    const base = report([row('F-1', ACK), row('F-2')], { open: 1, acknowledged: 1 })
    expect(withAckPatches(base, new Map([['F-1', patch(base, { ...ACK, note: 'Twice' }, ACK)]])).summary).toMatchObject({ open: 1, acknowledged: 1 })
    const reminded = report([row('F-1', { ...ACK, reminded: true }), row('F-2')])
    expect(withAckPatches(reminded, new Map([['F-1', patch(reminded, ACK, { ...ACK, reminded: true })]])).summary).toMatchObject({ open: 1, acknowledged: 1 })
  })

  // A row past the report's 50 is counted from what it was, but only on the report it was acted on.
  it('counts a row the report does not list from what it was, on that report only', () => {
    const base = report([row('F-2')])
    expect(withAckPatches(base, new Map([['F-9', patch(base, ACK)]])).summary).toMatchObject({ open: 1, acknowledged: 1 })
    const reloaded = report([row('F-2')], { open: 1, acknowledged: 1 })
    expect(withAckPatches(reloaded, new Map([['F-9', patch(base, ACK)]])).summary).toMatchObject({ open: 1, acknowledged: 1 })
  })

  it('patches an order row by any of its lines', () => {
    const order = row('M1', null, { kind: 'order', lines: [{ id: 'F-7' } as never] })
    const base = report([order, row('F-2')])
    const next = withAckPatches(base, new Map([['F-7', patch(base, ACK)]]))
    expect(next.categories.orders!.statements.R2!.findings[0]!.acknowledgement).toEqual(ACK)
    expect(withAckRows([order, row('F-2')], new Map([['F-7', patch(base, ACK)]])).map((item) => item.acknowledgement)).toEqual([ACK, null])
  })
})

describe('pendingAcknowledgement', () => {
  const me = { id: 'U9', label: 'Aditi P.' }
  // 03:00 UTC on Oct 10 is 20:00 on Oct 9 in Los Angeles.
  const now = new Date('2026-10-10T03:00:00Z')

  it('is by the person, now on the tenant\'s clock, reminding after the remind days', () => {
    expect(pendingAcknowledgement({ note: 'Refunded', remind: true, remindDays: 5, me, timeZone: 'America/Los_Angeles', initial: null, now }))
      .toEqual({ note: 'Refunded', by: me, at: '2026-10-09T20:00:00', remindOn: '2026-10-14', reminded: false })
  })

  it('keeps who acknowledged first on a change, and a blank note is no note', () => {
    expect(pendingAcknowledgement({ note: '', remind: false, remindDays: 5, me, timeZone: 'America/Los_Angeles', initial: ACK, now }))
      .toEqual({ note: null, by: ACK.by, at: ACK.at, remindOn: null, reminded: false })
  })
})
