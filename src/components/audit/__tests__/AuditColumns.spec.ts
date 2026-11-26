import { beforeEach, describe, expect, it, vi } from 'vitest'
import { enableAutoUnmount, flushPromises, mount } from '@vue/test-utils'
import { afterEach } from 'vitest'
import type { AuditAcknowledgement, AuditFindingDocument, AuditReport } from '../../../lib/api/auditTypes'
import { emptyFindingsMore, type AuditFilter } from '../../../lib/auditColumns'

// DAR-UI-144. The finding detail's acknowledgement: the icon on an open row, the note card on an acknowledged one, the
// reminder line once it is back in Open; and the list row's line under it.

const acknowledgeFinding = vi.hoisted(() => vi.fn())
const updateAcknowledgement = vi.hoisted(() => vi.fn())
const reopenAcknowledgement = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  auditFacade: { acknowledgeFinding, updateAcknowledgement, reopenAcknowledgement },
}))

import AuditColumns from '../AuditColumns.vue'

// Attached to the document so focus is real; each test's mount is removed after it.
enableAutoUnmount(afterEach)

const ACK: AuditAcknowledgement = {
  note: 'Refunded in Shopify\nNetSuite catches up on the 12th',
  by: { id: 'U1', label: 'Sam R.' },
  at: '2026-10-03T09:00:00-07:00',
  remindOn: '2026-10-08',
  reminded: false,
}

function report(acknowledgement: AuditAcknowledgement | null, state = 'open', remindDays?: number): AuditReport {
  const counts = { open: 1, newToday: 0, fixedToday: 0 }
  return {
    schema: 'darpan.audit.report/v1',
    about: '',
    report: {
      tenant: { id: 'GORJANA', name: 'Gorjana', timeZone: 'America/Los_Angeles' },
      audit: { id: 'month-close', name: 'Month close', period: 'month' },
      date: '2026-10-08',
      window: { from: '2026-10-01', thru: '2026-10-08' },
      running: false,
      period: '2026-10',
      generatedAt: '2026-10-08T06:12:40-07:00',
      ...(remindDays ? { acknowledgeRemindDays: remindDays } : {}),
    },
    health: { complete: true, summary: '', sources: {}, checks: { ran: 1, partial: 0, notRun: 0 }, notCovered: [] },
    summary: { ...counts, oldestOpen: null, byCategory: {} },
    categories: {
      orders: {
        label: 'Orders',
        counts,
        statements: {
          R2: {
            id: 'R2', text: 'Every invoice carries the Etail id.', weight: 'firm', status: 'ran', reason: null,
            checks: [], counts,
            findings: [
              { id: 'F-1', headline: 'Invoice INV1 has no Etail id', state, firstFound: '2026-10-02', ageDays: 6, records: {}, difference: null, next: '', acknowledgement },
            ],
            findingsOmitted: 0,
          },
        },
      },
    },
  } as unknown as AuditReport
}

function doc(acknowledgement: AuditAcknowledgement | null, state = 'open'): AuditFindingDocument {
  return {
    schema: 'darpan.audit.finding/v1',
    finding: {
      id: 'F-1', headline: 'Invoice INV1 has no Etail id', audit: { id: 'month-close', name: 'Month close' }, period: '2026-10',
      category: { id: 'orders', label: 'Orders' }, statement: { id: 'R2', text: 'Every invoice carries the Etail id.', weight: 'firm' },
      check: { id: 'c', label: 'c', matchedBy: null },
      status: { state, firstFound: '2026-10-02', lastSeen: '2026-10-08', lastChecked: null, ageDays: 6, timesSeen: 7, closedAt: null, closedBy: null },
      records: {},
      evidence: { rule: null, expected: null, actual: null, difference: null, checks: [] },
      diagnosis: { conclusion: null, explanation: null },
      fix: { owner: null, where: null, action: null, verify: { by: 'next check', nextCheck: null, passesWhen: null }, darpanChanges: '' },
      history: [],
      acknowledgement,
    },
    access: { mode: 'read-only', note: '' },
  } as unknown as AuditFindingDocument
}

function mountColumns(acknowledgement: AuditAcknowledgement | null, state = 'open', remindDays?: number, extra: Record<string, unknown> = {}) {
  return mount(AuditColumns, {
    attachTo: document.body,
    props: {
      report: report(acknowledgement, state, remindDays), category: 'orders', statement: 'R2', finding: 'F-1', source: '', filter: 'all',
      level: 4, findingDoc: doc(acknowledgement, state), findingLoading: false, findingError: '', more: emptyFindingsMore(),
      exporting: false, verifying: false, ...extra,
    },
  })
}

const ICON = '[aria-label="Acknowledge"]'
const PENCIL = '[aria-label="Edit acknowledgement"]'

beforeEach(() => {
  acknowledgeFinding.mockReset()
  updateAcknowledgement.mockReset()
  reopenAcknowledgement.mockReset()
})

describe('AuditColumns acknowledgement', () => {
  it('offers Acknowledge on an open finding with none, and nothing on a fixed one', async () => {
    const open = mountColumns(null)
    expect(open.find(ICON).exists()).toBe(true)
    expect(open.find('[data-testid="audit-ack-card"]').exists()).toBe(false)
    expect(open.find('[data-testid="audit-finding-ack"]').exists()).toBe(false)

    const fixed = mountColumns(null, 'fixed')
    expect(fixed.find(ICON).exists()).toBe(false)
    expect(fixed.find(PENCIL).exists()).toBe(false)
    expect(fixed.find('[data-testid="audit-ack-card"]').exists()).toBe(false)
  })

  it('opens the popover from the icon with the report\'s remind days, and says acknowledged once saved', async () => {
    acknowledgeFinding.mockResolvedValue({ ok: true, acknowledgement: ACK })
    const w = mountColumns(null, 'open', 7)
    expect(w.find('[data-testid="audit-ack-popover"]').exists()).toBe(false)
    await w.get(ICON).trigger('click')
    expect(w.get('[data-testid="audit-ack-remind-label"]').text()).toBe('Remind me in 7 days if still open')
    await w.get('[data-testid="audit-ack-note-input"]').setValue('Refunded')
    await w.get('[data-testid="audit-ack-popover"] form').trigger('submit')
    await flushPromises()
    expect(acknowledgeFinding).toHaveBeenCalledWith('F-1', 'Refunded', true)
    expect(w.emitted('acknowledged')).toHaveLength(1)
    expect(w.find('[data-testid="audit-ack-popover"]').exists()).toBe(false)
    // The row reads acknowledged at once, before the quiet reload brings the report.
    expect(w.get('[data-testid="audit-ack-card"]').text()).toContain('Sam R.')
    expect(w.find(ICON).exists()).toBe(false)
  })

  it('reads 5 remind days when the report says none', async () => {
    const w = mountColumns(null)
    await w.get(ICON).trigger('click')
    expect(w.get('[data-testid="audit-ack-remind-label"]').text()).toBe('Remind me in 5 days if still open')
  })

  // DAR-UI-152: acknowledged with no note, the card says who and when and shows no empty note line.
  it('shows an acknowledgement with no note without a note line', () => {
    const card = mountColumns({ ...ACK, note: null }).get('[data-testid="audit-ack-card"]')
    expect(card.text()).toContain('Sam R.')
    expect(card.find('[data-testid="audit-ack-note"]').exists()).toBe(false)
  })

  it('shows an acknowledged finding\'s badge, note card, pencil and Reopen', async () => {
    reopenAcknowledgement.mockResolvedValue({ ok: true })
    const w = mountColumns(ACK)
    expect(w.get('.audit-col--detail .status-badge').text()).toBe('Acknowledged')
    expect(w.find(ICON).exists()).toBe(false)
    const card = w.get('[data-testid="audit-ack-card"]')
    expect(card.text()).toContain('Sam R.')
    expect(card.text()).toContain('Oct 3')
    expect(card.get('[data-testid="audit-ack-note"]').text()).toBe(ACK.note)

    await card.get(PENCIL).trigger('click')
    expect((w.get('[data-testid="audit-ack-note-input"]').element as HTMLTextAreaElement).value).toBe(ACK.note)

    await w.get('[data-testid="audit-ack-reopen"]').trigger('click')
    await flushPromises()
    expect(reopenAcknowledgement).toHaveBeenCalledWith('F-1')
    expect(w.emitted('acknowledged')).toHaveLength(1)
  })

  // T10-M1. Days count to the tenant's today: 03:00 UTC on Oct 10 is Oct 9 in Los Angeles, 6 days after Oct 3 (the
  // report's morning, Oct 8, would say 5; UTC would say 7).
  it('keeps a reminded finding open, says how long ago and offers Acknowledge again', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-10T03:00:00Z'))
    const w = mountColumns({ ...ACK, reminded: true })
    vi.useRealTimers()
    expect(w.get('.audit-col--detail .status-badge').text()).toBe('Open')
    expect(w.get('[data-testid="audit-ack-card"]').text()).toContain('Acknowledged 6 days ago by Sam R., still open')
    expect(w.get('[data-testid="audit-ack-note"]').text()).toBe(ACK.note)
    expect(w.find(ICON).exists()).toBe(true)
    expect(w.find(PENCIL).exists()).toBe(true)
    expect(w.find('[data-testid="audit-ack-reopen"]').exists()).toBe(false)
  })

  it('names who, when and the note\'s first line on an acknowledged list row', () => {
    const w = mountColumns(ACK)
    const row = w.get('[data-testid="audit-finding-row"]')
    expect(row.text()).toContain('Acknowledged')
    expect(row.get('[data-testid="audit-finding-ack"]').text()).toBe('Sam R. · Oct 3 · Refunded in Shopify')
  })

  // Review I1. Focus never falls to the page: Esc hands it back to the trigger, a save to the pencil, a reopen to the icon.
  it('hands focus back to the trigger on Esc, to the pencil after a save and to the icon after a reopen', async () => {
    acknowledgeFinding.mockResolvedValue({ ok: true, acknowledgement: ACK })
    reopenAcknowledgement.mockResolvedValue({ ok: true })
    const w = mountColumns(null)
    await w.get(ICON).trigger('click')
    expect(document.activeElement).toBe(w.get('[data-testid="audit-ack-note-input"]').element)
    await w.get('[data-testid="audit-ack-popover"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(w.find('[data-testid="audit-ack-popover"]').exists()).toBe(false)
    expect(document.activeElement).toBe(w.get(ICON).element)

    await w.get(ICON).trigger('click')
    await w.get('[data-testid="audit-ack-note-input"]').setValue('Refunded')
    await w.get('[data-testid="audit-ack-popover"] form').trigger('submit')
    await flushPromises()
    expect(document.activeElement).toBe(w.get(PENCIL).element)

    await w.get(PENCIL).trigger('click')
    await w.get('[data-testid="audit-ack-popover"]').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(document.activeElement).toBe(w.get(PENCIL).element)

    await w.get('[data-testid="audit-ack-reopen"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(w.get(ICON).element)
  })

  it('closes on a press outside without pulling focus back from where it went', async () => {
    const w = mountColumns(null)
    await w.get(ICON).trigger('click')
    const outside = w.get('[data-testid="audit-export-finding"]').element as HTMLButtonElement
    outside.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    outside.focus()
    await flushPromises()
    expect(w.find('[data-testid="audit-ack-popover"]').exists()).toBe(false)
    expect(document.activeElement).toBe(outside)
  })

  // Review I2. The finding's own read wins over its list row, which can be a cached copy from before the acknowledgement.
  it('reads the acknowledgement from the finding once it is read, not from a stale list row', () => {
    const staleRow = { id: 'M1', kind: 'order', order: 'M1', headline: 'Order M1', state: 'open', acknowledgement: null, lines: [] }
    const w = mountColumns(ACK, 'open', undefined, { orderUnit: staleRow })
    expect(w.get('.audit-col--detail .status-badge').text()).toBe('Acknowledged')
    expect(w.find(ICON).exists()).toBe(false)
    expect(w.get('[data-testid="audit-ack-card"]').text()).toContain('Sam R.')
  })

  it('shows a refused reopen beside the note', async () => {
    reopenAcknowledgement.mockResolvedValue({ ok: false, errors: ['Finding F-1 was not found'] })
    const w = mountColumns(ACK)
    await w.get('[data-testid="audit-ack-reopen"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="audit-ack-reopen-error"]').text()).toBe('Finding F-1 was not found')
    expect(w.emitted('acknowledged')).toBeUndefined()
  })
})

// DAR-UI-144 (review C1/I1). The report lists every open row of a statement, acknowledged ones too: the findings column and
// its count follow the pill. Open leaves out acknowledged rows (a reminded one is open again), acknowledged lists only
// those, all lists every open row and counts open plus acknowledged.
describe('AuditColumns findings under each pill', () => {
  function pillReport(): AuditReport {
    const doc = report(null)
    const counts = { open: 2, newToday: 0, fixedToday: 0, acknowledged: 1 }
    const r2 = doc.categories.orders!.statements.R2!
    r2.counts = counts
    doc.categories.orders!.counts = counts
    doc.summary = { ...doc.summary, ...counts }
    r2.findings = [
      { ...r2.findings[0]!, id: 'F-1', headline: 'Plain open row', acknowledgement: null },
      { ...r2.findings[0]!, id: 'F-2', headline: 'Acknowledged row', acknowledgement: ACK },
      { ...r2.findings[0]!, id: 'F-3', headline: 'Reminded row', acknowledgement: { ...ACK, reminded: true } },
      { ...r2.findings[0]!, id: 'F-4', headline: 'Fixed row', state: 'fixed', acknowledgement: ACK },
    ]
    return doc
  }
  function mountPill(filter: AuditFilter) {
    return mount(AuditColumns, {
      props: {
        report: pillReport(), category: 'orders', statement: 'R2', finding: '', source: '', filter, level: 3,
        findingDoc: null, findingLoading: false, findingError: '', more: emptyFindingsMore(), exporting: false, verifying: false,
      },
    })
  }
  const shown = (w: ReturnType<typeof mountPill>) => w.findAll('[data-testid="audit-finding-row"]').map((row) =>
    ['Plain open row', 'Acknowledged row', 'Reminded row', 'Fixed row'].find((text) => row.text().includes(text)))

  it('open: hides the acknowledged row, keeps the reminded one, counts 2', () => {
    const w = mountPill('open')
    expect(shown(w)).toEqual(['Plain open row', 'Reminded row'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('2')
  })

  it('acknowledged: lists only the acknowledged row, counts 1', () => {
    const w = mountPill('acknowledged')
    expect(shown(w)).toEqual(['Acknowledged row'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('1')
  })

  it('all: lists every open row, counts open plus acknowledged', () => {
    const w = mountPill('all')
    expect(shown(w)).toEqual(['Plain open row', 'Acknowledged row', 'Reminded row'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('3')
  })
})
