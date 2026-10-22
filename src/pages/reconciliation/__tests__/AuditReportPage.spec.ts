import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { route, replace } = vi.hoisted(() => ({
  route: { params: { audit: 'month-close' }, query: {} as Record<string, string | undefined> },
  replace: vi.fn(),
}))
vi.mock('vue-router', async () => {
  const { reactive: r } = await import('vue')
  const reactiveRoute = r(route)
  return { useRoute: () => reactiveRoute, useRouter: () => ({ replace }) }
})
vi.mock('../../../lib/api/facade', () => ({
  auditFacade: { getAuditReport: vi.fn(), getAuditFinding: vi.fn(), getAudits: vi.fn() },
}))

import { useRoute } from 'vue-router'
import { auditFacade } from '../../../lib/api/facade'
import AuditReportPage from '../AuditReportPage.vue'
import type { AuditReport } from '../../../lib/api/auditTypes'

const f = vi.mocked(auditFacade)
// The page reads the reactive route the mock hands out; change it through that, or nothing reacts.
const liveRoute = useRoute() as unknown as { query: Record<string, string | undefined> }

function counts(open = 0, pending = 0) {
  return { open, pending, newToday: 0, fixedToday: 0 }
}

// The darpan.audit.report/v1 shape the assembler writes, cut to two statements.
function report(overrides: Partial<AuditReport['health']> = {}): AuditReport {
  return {
    schema: 'darpan.audit.report/v1',
    about: 'Month close audit for Gorjana, 2026-10.',
    report: {
      tenant: { id: 'GORJANA', name: 'Gorjana', timeZone: 'America/Los_Angeles' },
      audit: { id: 'month-close', name: 'Month close', period: 'month' },
      date: '2026-10-08',
      window: { from: '2026-10-01', thru: '2026-10-08' },
      running: true,
      extendedThru: null,
      period: '2026-10',
      generatedAt: '2026-10-08T06:12:40-07:00',
    },
    health: {
      complete: true,
      summary: 'Every configured check ran over complete reads.',
      sources: {
        NetSuite: { read: 'complete', records: 4120, readAt: null, reason: null, affects: [] },
        OMS: { read: 'complete', records: 3871, readAt: null, reason: null, affects: [] },
      },
      checks: { ran: 2, partial: 0, notRun: 0 },
      notCovered: [],
      ...overrides,
    },
    summary: { ...counts(1, 1), newToday: 2, fixedToday: 0, oldestOpen: { id: 'F-1', statement: 'R2', firstFound: '2026-10-02', ageDays: 6 }, byCategory: {} },
    categories: {
      orders: {
        label: 'Orders',
        counts: counts(1, 1),
        statements: {
          R2: {
            id: 'R2', text: 'Every invoice carries the Etail id.', weight: 'firm', status: 'ran', reason: null,
            checks: [{ id: 'invoices-without-etail-id', label: 'Invoices with no Etail id', status: 'ran', reason: null, matchedBy: null, graceDays: 1, compared: { NetSuite: 3311 } }],
            counts: counts(1, 1),
            findings: [
              { id: 'F-1', headline: 'Invoice INV1 has no Etail id', state: 'open', firstFound: '2026-10-02', ageDays: 6, records: { NetSuite: { invoice: [{ id: 'INV1', internalId: '801', status: 'Invoice : Open' }] } }, difference: null, next: 'darpan findings show F-1' },
              { id: 'F-2', headline: 'Invoice INV2 has no Etail id', state: 'pending', firstFound: '2026-10-08', ageDays: 0, records: { NetSuite: { invoice: [{ id: 'INV2', internalId: null, status: null }] } }, difference: null, next: 'darpan findings show F-2' },
            ],
            findingsOmitted: 0,
          },
          R3: {
            id: 'R3', text: 'Every store sale carries its store.', weight: 'derived', status: 'ran', reason: null,
            checks: [], counts: counts(), findings: [], findingsOmitted: 0,
          },
        },
      },
    },
  }
}

const findingDocument = {
  schema: 'darpan.audit.finding/v1',
  finding: {
    id: 'F-1', headline: 'Invoice INV1 has no Etail id', audit: { id: 'month-close', name: 'Month close' }, period: '2026-10',
    category: { id: 'orders', label: 'Orders' }, statement: { id: 'R2', text: 'Every invoice carries the Etail id.', weight: 'firm' },
    check: { id: 'invoices-without-etail-id', label: 'Invoices with no Etail id', matchedBy: null },
    status: { state: 'open', firstFound: '2026-10-02', lastSeen: '2026-10-08', lastChecked: null, ageDays: 6, timesSeen: 7, pendingUntil: null, closedAt: null, closedBy: null },
    records: { NetSuite: { invoice: [{ id: 'INV1', internalId: '801', status: 'Invoice : Open' }] }, OMS: { order: [{ id: 'M1', internalId: null, status: null }] } },
    evidence: { rule: null, expected: null, actual: null, difference: null, checks: [{ label: 'The invoice has no Etail id', passed: true, value: null }] },
    diagnosis: { conclusion: null, explanation: null },
    fix: { owner: 'Gorjana Accounting', where: 'NETSUITE', action: 'Enter the Shopify order id on invoice INV1.', verify: { by: 'next check', nextCheck: null, passesWhen: null }, darpanChanges: 'Nothing.' },
    history: [{ at: '2026-10-02T06:10:00-07:00', event: 'found', by: { type: 'check', id: 'invoices-without-etail-id', label: 'scheduled check' } }],
  },
  access: { mode: 'read-only', note: '' },
}

beforeEach(() => {
  Object.values(f).forEach((fn) => (fn as ReturnType<typeof vi.fn>).mockReset())
  replace.mockReset()
  liveRoute.query = {}
  f.getAuditReport.mockResolvedValue({ ok: true, report: report() } as never)
  f.getAuditFinding.mockResolvedValue({ ok: true, finding: findingDocument } as never)
})

describe('AuditReportPage', () => {
  it('shows a complete morning: health, counts, and each category of statements', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(f.getAuditReport).toHaveBeenCalledWith({ audit: 'month-close' }, expect.anything())
    expect(w.get('h1').text()).toBe('Month close')
    expect(w.get('[data-testid="run-type-audit"]').text()).toBe('Audit · 2026-10')
    expect(w.get('[data-testid="audit-window"]').text()).toBe('2026-10-01 to 2026-10-08')
    expect(w.get('[data-testid="audit-health"]').text()).toBe('Complete')
    expect(w.get('[data-testid="audit-source-HotWax"]').text()).toContain('3,871')
    expect(w.find('[data-testid="audit-health-summary"]').exists()).toBe(false)
    expect(w.get('[data-testid="audit-count-open"]').text()).toBe('1')
    expect(w.get('[data-testid="audit-oldest-open"]').text()).toBe('R2 · 6 days')
    expect(w.findAll('[data-testid="audit-statement-row-orders"]').map((row) => row.text())).toEqual([
      expect.stringContaining('R2'), expect.stringContaining('R3'),
    ])
  })

  it('says why a morning is not complete', async () => {
    f.getAuditReport.mockResolvedValue({ ok: true, report: report({
      complete: false,
      summary: 'Not complete: the NetSuite read was partial.',
      sources: { NetSuite: { read: 'partial', records: 900, readAt: null, reason: 'one page failed', affects: ['R2'] } },
      checks: { ran: 1, partial: 1, notRun: 0 },
    }) } as never)
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-health"]').text()).toBe('Not complete')
    expect(w.get('[data-testid="audit-source-NetSuite"]').text()).toContain('Partial')
    expect(w.get('[data-testid="audit-checks"]').text()).toBe('1 ran · 1 partial')
    expect(w.get('[data-testid="audit-health-summary"]').text()).toBe('Not complete: the NetSuite read was partial.')
  })

  it('opens a statement to its findings, and an empty one to an empty hint', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    const rows = w.findAll('[data-testid="audit-statement-row-orders"]')
    await rows[0]!.trigger('click')
    const detail = w.get('[data-testid="audit-statement-detail-R2"]')
    expect(detail.text()).toContain('Invoices with no Etail id · Ran')
    const findings = detail.findAll('[data-testid="audit-finding-row"]')
    expect(findings).toHaveLength(2)
    expect(findings[0]!.text()).toContain('INV1')
    expect(findings[0]!.text()).toContain('Open')
    expect(findings[1]!.text()).toContain('0 days')
    await rows[1]!.trigger('click')
    expect(w.get('[data-testid="audit-statement-empty-R3"]').text()).toBe('No findings')
  })

  it('opens a finding below the report: its records, fix and history', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    await w.findAll('[data-testid="audit-statement-row-orders"]')[0]!.trigger('click')
    await w.findAll('[data-testid="audit-finding-row"]')[0]!.trigger('click')
    expect(replace).toHaveBeenCalledWith({ query: { finding: 'F-1' } })

    liveRoute.query = { finding: 'F-1' }
    await flushPromises()
    expect(f.getAuditFinding).toHaveBeenCalledWith({ findingId: 'F-1' }, expect.anything())
    expect(w.get('[data-testid="audit-finding-headline"]').text()).toBe('Invoice INV1 has no Etail id')
    const records = w.findAll('[data-testid="audit-record-row"]').map((row) => row.text())
    expect(records[0]).toContain('NetSuite')
    expect(records[0]).toContain('801')
    expect(records[1]).toContain('HotWax')
    expect(w.get('[data-testid="audit-finding-fix"]').text()).toBe('Enter the Shopify order id on invoice INV1.')
    expect(w.findAll('[data-testid="audit-history-row"]')).toHaveLength(1)
  })

  it('reloads for another period and drops the open finding', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    const select = w.findComponent({ name: 'AppSelect' })
    expect(select.props('options').map((o: { value: string }) => o.value)).toEqual(['2026-10', '2026-09', '2026-08'])
    select.vm.$emit('update:modelValue', '2026-09')
    expect(replace).toHaveBeenCalledWith({ query: { period: '2026-09', finding: undefined } })

    liveRoute.query = { period: '2026-09' }
    await flushPromises()
    expect(f.getAuditReport).toHaveBeenLastCalledWith({ audit: 'month-close', period: '2026-09' }, expect.anything())
  })

  it('says so in words when the audit does not exist', async () => {
    f.getAuditReport.mockResolvedValue({ ok: false, errors: ['Audit month-close was not found'] } as never)
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-page-error"]').text()).toContain('Audit month-close was not found')
    expect(w.find('[data-testid="audit-health"]').exists()).toBe(false)
  })
})
