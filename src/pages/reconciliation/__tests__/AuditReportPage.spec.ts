import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { route, replace, push } = vi.hoisted(() => ({
  route: { params: { audit: 'month-close' }, query: {} as Record<string, string | undefined> },
  replace: vi.fn(),
  push: vi.fn(),
}))
vi.mock('vue-router', async () => {
  const { reactive: r } = await import('vue')
  const reactiveRoute = r(route)
  return {
    useRoute: () => reactiveRoute,
    useRouter: () => ({ replace, push }),
    RouterLink: { props: ['to'], template: '<a :data-to="JSON.stringify(to)"><slot /></a>' },
  }
})
vi.mock('../../../lib/api/facade', () => ({
  auditFacade: { getAuditReport: vi.fn(), getAuditFinding: vi.fn(), getAudits: vi.fn() },
}))

import { useRoute } from 'vue-router'
import { WORKFLOW_HINT_REQUEST_EVENT } from '../../../lib/uiEvents'
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
  push.mockReset()
  liveRoute.query = {}
  f.getAuditReport.mockResolvedValue({ ok: true, report: report() } as never)
  f.getAuditFinding.mockResolvedValue({ ok: true, finding: findingDocument } as never)
})

describe('AuditReportPage', () => {
  // DAR-UI-065. Drill-down columns: category › statement › finding › the deepest pick.
  it('opens on the category with the most open findings, its first statement with findings, and that statement\'s check', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(f.getAuditReport).toHaveBeenCalledWith({ audit: 'month-close' }, expect.anything())
    expect(w.get('h1').text()).toBe('Month close')
    expect(w.get('[data-testid="run-type-audit"]').text()).toBe('Audit · 2026-10')
    expect(w.get('[data-testid="audit-window"]').text()).toBe('2026-10-01 to 2026-10-08')
    // Column 1: Run health first, then the categories.
    expect(w.get('[data-testid="audit-category-health"]').text()).toContain('complete')
    expect(w.get('[data-testid="audit-category-orders"]').attributes('aria-current')).toBe('true')
    expect(w.get('[data-testid="audit-category-orders"]').text()).toContain('1 open · 1 pending')
    // Column 2: the category's statements; R2 has findings, so it is picked.
    const rows = w.findAll('[data-testid="audit-statement-row-orders"]')
    expect(rows.map((row) => row.text())).toEqual([expect.stringContaining('R2'), expect.stringContaining('R3')])
    expect(rows[0]!.attributes('aria-current')).toBe('true')
    // Column 3: its findings. Column 4: what checked it.
    const findings = w.findAll('[data-testid="audit-finding-row"]')
    expect(findings).toHaveLength(2)
    expect(findings[0]!.text()).toContain('F-1')
    expect(findings[0]!.text()).toContain('Open · 6 days')
    expect(w.get('[data-testid="audit-statement-text"]').text()).toBe('Every invoice carries the Etail id.')
    expect(w.get('[data-testid="audit-check-invoices-without-etail-id"]').text()).toContain('Invoices with no Etail id')
    expect(w.get('[data-testid="audit-compared-bar"]').text()).toContain('3,311')
    // The counts are the filters, and the day's movement sits beside them.
    expect(w.get('[data-testid="audit-filter-open"]').text()).toBe('1 open')
    expect(w.get('[data-testid="audit-filter-all"]').text()).toBe('2 statements')
    expect(w.get('[data-testid="audit-filter-all"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-testid="audit-today"]').text()).toBe('2 new today · 0 fixed today · oldest open R2, 6 days')
    expect(w.get('[data-testid="audit-columns"]').attributes('data-level')).toBe('1')
  })

  it('shows the run\'s health as its own column: each read, the checks, and why a morning is not complete', async () => {
    liveRoute.query = { category: 'health' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.findAll('[data-testid^="audit-source-"]').map((row) => row.attributes('data-testid'))).toEqual([
      'audit-source-NetSuite', 'audit-source-HotWax', 'audit-source-Checks', 'audit-source-detail',
    ])
    expect(w.get('[data-testid="audit-source-HotWax"]').text()).toContain('3,871 records')
    // Every read complete: it opens on the checks.
    expect(w.get('[data-testid="audit-health"]').text()).toBe('Complete')
    expect(w.get('[data-testid="audit-checks-ran"]').text()).toBe('2')

    f.getAuditReport.mockResolvedValue({ ok: true, report: report({
      complete: false,
      summary: 'Not complete: the NetSuite read was partial.',
      sources: { NetSuite: { read: 'partial', records: 900, readAt: null, reason: 'one page failed', affects: ['R2'] } },
      checks: { ran: 1, partial: 1, notRun: 0 },
    }) } as never)
    const w2 = mount(AuditReportPage)
    await flushPromises()
    expect(w2.get('[data-testid="audit-category-health"]').text()).toContain('not complete')
    // A partial read is what needs a look, so it opens on that.
    const detail = w2.get('[data-testid="audit-source-detail"]')
    expect(detail.text()).toContain('Partial')
    expect(detail.text()).toContain('one page failed')
    expect(detail.text()).toContain('R2')
  })

  it('walks the columns through the URL, one history step per pick, and says why a statement has no findings', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    await w.findAll('[data-testid="audit-statement-row-orders"]')[1]!.trigger('click')
    expect(push).toHaveBeenCalledWith({ query: { category: 'orders', statement: 'R3', finding: undefined } })

    liveRoute.query = { category: 'orders', statement: 'R3' }
    await flushPromises()
    expect(w.get('[data-testid="audit-statement-empty-R3"]').text()).toBe('Holds. Nothing found this period')
    expect(w.get('[data-testid="audit-columns"]').attributes('data-level')).toBe('3')

    await w.get('[data-testid="audit-category-health"]').trigger('click')
    expect(push).toHaveBeenLastCalledWith({ query: { category: 'health', statement: undefined, finding: undefined, source: undefined } })
  })

  it('opens a finding in the last column and folds the categories to a rail', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    await w.findAll('[data-testid="audit-finding-row"]')[0]!.trigger('click')
    expect(push).toHaveBeenCalledWith({ query: { category: 'orders', statement: 'R2', finding: 'F-1' } })

    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'F-1' }
    await flushPromises()
    expect(f.getAuditFinding).toHaveBeenCalledWith({ findingId: 'F-1' }, expect.anything())
    expect(w.get('[data-testid="audit-columns"]').classes()).toContain('audit-columns--rail')
    expect(w.get('[data-testid="audit-columns"]').attributes('data-level')).toBe('4')
    expect(w.get('[data-testid="audit-finding-headline"]').text()).toBe('Invoice INV1 has no Etail id')
    const records = w.findAll('[data-testid="audit-record-row"]').map((row) => row.text())
    expect(records[0]).toContain('NetSuite')
    expect(records[0]).toContain('801')
    expect(records[1]).toContain('HotWax')
    expect(w.get('[data-testid="audit-evidence-row"]').text()).toContain('The invoice has no Etail id')
    expect(w.get('[data-testid="audit-finding-fix"]').text()).toBe('Enter the Shopify order id on invoice INV1.')
    expect(w.findAll('[data-testid="audit-history-row"]')).toHaveLength(1)

    // The path steps back up: the statement drops the finding.
    await w.get('[data-testid="audit-path-statement"]').trigger('click')
    expect(push).toHaveBeenLastCalledWith({ query: { category: 'orders', statement: 'R2', finding: undefined } })
  })

  it('opens a linked finding under its own category and statement', async () => {
    const doc = report()
    // A busier category would win the default; the link still lands on the finding's own.
    doc.categories.returns = {
      label: 'Returns',
      counts: counts(5, 0),
      statements: { R8: { id: 'R8', text: 'Every return reaches NetSuite.', weight: 'derived', status: 'ran', reason: null, checks: [], counts: counts(5, 0), findings: [], findingsOmitted: 0 } },
    }
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    liveRoute.query = { finding: 'F-1' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-category-orders"]').attributes('aria-current')).toBe('true')
    expect(w.findAll('[data-testid="audit-finding-row"]')[0]!.attributes('aria-current')).toBe('true')
    expect(w.get('[data-testid="audit-finding-headline"]').text()).toBe('Invoice INV1 has no Etail id')
  })

  it('filters the statements by a count pill and starts the columns over', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    await w.get('[data-testid="audit-filter-pending"]').trigger('click')
    expect(replace).toHaveBeenCalledWith({
      query: { show: 'pending', category: undefined, statement: undefined, finding: undefined, source: undefined },
    })

    liveRoute.query = { show: 'pending' }
    await flushPromises()
    expect(w.get('[data-testid="audit-filter-pending"]').attributes('aria-pressed')).toBe('true')
    expect(w.findAll('[data-testid="audit-statement-row-orders"]').map((row) => row.text())).toEqual([expect.stringContaining('R2')])

    liveRoute.query = { show: 'notChecked', category: 'orders' }
    await flushPromises()
    expect(w.get('[data-testid="audit-statements-empty"]').text()).toBe('Nothing here for this filter')
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

  // DAR-UI-063. Play and the settings gear, as a lifecycle run's page carries them.
  it('carries play and the settings gear, each opening its own page for this audit', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    // Beside the name, so a long audit cannot push them below the fold.
    expect(w.get('.audit-hero-title').find('[data-testid="audit-run-button"]').exists()).toBe(true)
    const play = w.get('[data-testid="audit-run-button"]')
    expect(play.attributes('aria-label')).toBe('Run audit')
    expect(JSON.parse(play.attributes('data-to') ?? '{}')).toEqual({ name: 'audit-run-start', params: { audit: 'month-close' }, query: {} })
    const gear = w.get('[data-testid="audit-settings-button"]')
    expect(gear.attributes('aria-label')).toBe('Audit settings')
    expect(JSON.parse(gear.attributes('data-to') ?? '{}')).toEqual({ name: 'audit-settings', params: { audit: 'month-close' }, query: {} })
  })

  // DAR-UI-063. A played range is said beside the period, so the findings are not read as the whole month's.
  it('says which days the checks read when a person played a range, and nothing when they read the period', async () => {
    const played = report()
    for (const category of Object.values(played.categories)) {
      for (const statement of Object.values(category.statements)) {
        statement.checks = statement.checks.map((check) => ({ ...check, window: { from: '2026-10-01', thru: '2026-10-05' } }))
      }
    }
    f.getAuditReport.mockResolvedValue({ ok: true, report: played } as never)
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-window"]').text()).toBe('2026-10-01 to 2026-10-08 · read 2026-10-01 to 2026-10-05')

    const morning = report()
    for (const category of Object.values(morning.categories)) {
      for (const statement of Object.values(category.statements)) {
        statement.checks = statement.checks.map((check) => ({ ...check, window: { from: '2026-10-01', thru: '2026-10-08' } }))
      }
    }
    f.getAuditReport.mockResolvedValue({ ok: true, report: morning } as never)
    const w2 = mount(AuditReportPage)
    await flushPromises()
    expect(w2.get('[data-testid="audit-window"]').text()).toBe('2026-10-01 to 2026-10-08')
  })

  it('hands the period and date on, so coming back shows the same morning, but not the open finding', async () => {
    liveRoute.query = { period: '2026-09', date: '2026-09-30', finding: 'F-1' }
    const w = mount(AuditReportPage)
    await flushPromises()
    const query = { period: '2026-09', date: '2026-09-30' }
    expect(JSON.parse(w.get('[data-testid="audit-run-button"]').attributes('data-to') ?? '{}').query).toEqual(query)
    expect(JSON.parse(w.get('[data-testid="audit-settings-button"]').attributes('data-to') ?? '{}').query).toEqual(query)
  })

  it('says once in the top pill that a run it started is under way', async () => {
    const heard: string[] = []
    const listener = (event: Event) => heard.push((event as CustomEvent<{ message: string }>).detail.message)
    document.addEventListener(WORKFLOW_HINT_REQUEST_EVENT, listener)
    window.history.replaceState({ startedAudit: true }, '')
    mount(AuditReportPage)
    await flushPromises()
    expect(heard).toEqual(['Running. Findings arrive as each check finishes.'])
    expect((window.history.state as { startedAudit?: boolean }).startedAudit).toBeFalsy()
    mount(AuditReportPage)
    await flushPromises()
    expect(heard).toHaveLength(1)
    document.removeEventListener(WORKFLOW_HINT_REQUEST_EVENT, listener)
  })

  it('says so in words when the audit does not exist', async () => {
    f.getAuditReport.mockResolvedValue({ ok: false, errors: ['Audit month-close was not found'] } as never)
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-page-error"]').text()).toContain('Audit month-close was not found')
    expect(w.find('[data-testid="audit-columns"]').exists()).toBe(false)
  })
})
