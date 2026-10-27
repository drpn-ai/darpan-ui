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
  auditFacade: { getAuditReport: vi.fn(), getAuditFinding: vi.fn(), getAuditFindingsByOrder: vi.fn(), getAuditCheckExtracts: vi.fn(), getAudits: vi.fn(), verifyAuditFinding: vi.fn(), getAuditProgress: vi.fn() },
  reconciliationFacade: { getGeneratedOutput: vi.fn() },
}))

vi.mock('../../../lib/utils/download', () => ({ downloadTextFile: vi.fn() }))

import { downloadTextFile } from '../../../lib/utils/download'
import { useRoute } from 'vue-router'
import { WORKFLOW_HINT_REQUEST_EVENT } from '../../../lib/uiEvents'
import { auditFacade, reconciliationFacade } from '../../../lib/api/facade'
import { ApiCallError } from '../../../lib/api/client'
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
    diagnosis: { conclusion: { code: 'CONC_NO_ETAIL', label: 'No Shopify order id (Etail id)' }, explanation: null },
    fix: { owner: 'Gorjana Accounting', where: 'NETSUITE', action: 'Enter the Shopify order id on invoice INV1.', verify: { by: 'next check', nextCheck: null, passesWhen: 'the invoice carries the Etail id.' }, darpanChanges: 'Nothing.' },
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
  f.getAuditProgress.mockResolvedValue({ ok: true, progress: { checks: 1, activeChecks: 0, active: [] } } as never)
})

describe('AuditReportPage', () => {
  // DAR-UI-065. Drill-down columns: category › statement › finding › the deepest pick.
  it('opens on the category with the most open findings, its first statement with findings, and that statement\'s check', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(f.getAuditReport).toHaveBeenCalledWith({ audit: 'month-close' }, expect.anything())
    expect(w.get('h1').text()).toBe('Month close')
    expect(w.get('[data-testid="run-type-audit"]').text()).toBe('Audit · 2026-10')
    expect(w.get('[data-testid="audit-window"]').text()).toBe('Oct 1 – 8')
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
    expect(findings[0]!.text()).toContain('Open · 6d')
    expect(w.get('[data-testid="audit-statement-text"]').text()).toBe('Every invoice carries the Etail id.')
    expect(w.get('[data-testid="audit-check-invoices-without-etail-id"]').text()).toContain('Invoices with no Etail id')
    expect(w.get('[data-testid="audit-compared-bar"]').text()).toContain('3,311')
    // The counts are the filters.
    expect(w.get('[data-testid="audit-filter-open"]').text()).toBe('1 open')
    expect(w.get('[data-testid="audit-filter-all"]').text()).toBe('2 all')
    expect(w.get('[data-testid="audit-filter-all"]').attributes('aria-pressed')).toBe('true')
    expect(w.get('[data-testid="audit-today"]').text()).toBe('2 new · 0 fixed today · oldest R2, 6d')
    // DAR-UI-074. The day's note describes the morning, so it sits under the window in the hero; the toolbar holds controls.
    expect(w.find('.static-page-hero [data-testid="audit-today"]').exists()).toBe(true)
    expect(w.find('.audit-toolbar [data-testid="audit-today"]').exists()).toBe(false)
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

  // DAR-UI-085 (Aditi: "when an audit is running... i cannot see any indication"). Mid-play every check still reads
  // "not run" in the report, so Run health says it is running and where each run is.
  it('shows a play in progress on Run health and in the running check, then reloads the report when it finishes', async () => {
    vi.useFakeTimers()
    try {
      const running = {
        run: 'Invoices vs Shopify', checks: ['invoices-without-etail-id'], state: 'running', attempt: 1,
        stage: 'COMPARE', progressPercent: 60, elapsedMs: 6 * 60000, usualDurationMs: 5 * 60000, health: 'healthy',
      }
      f.getAuditProgress.mockResolvedValue({ ok: true, progress: { checks: 1, activeChecks: 1, active: [running] } } as never)
      const w = mount(AuditReportPage)
      await flushPromises()

      const health = w.get('[data-testid="audit-category-health"]')
      expect(health.text()).toContain('running · 1 of 1 checks')
      expect(health.find('[data-testid="audit-health-running"]').exists()).toBe(true)
      // The statement's check says where it is instead of this morning's status.
      expect(w.get('[data-testid="audit-check-invoices-without-etail-id"]').text()).toContain('Running')
      expect(w.get('[data-testid="audit-check-running-invoices-without-etail-id"]').text()).toBe('Comparing records · 60% · 6m, usually 5m')

      liveRoute.query = { category: 'health' }
      await flushPromises()
      expect(w.get('[data-testid="audit-running-lead"]').text()).toBe('1 of 1 checks')
      expect(w.get('[data-testid="audit-running-invoices-without-etail-id"]').text()).toContain('Invoices vs Shopify')

      // The run ends: the next read finds nothing in flight, the report is read again, and polling stops.
      const reportReads = f.getAuditReport.mock.calls.length
      f.getAuditProgress.mockResolvedValue({ ok: true, progress: { checks: 1, activeChecks: 0, active: [] } } as never)
      await vi.advanceTimersByTimeAsync(10_000)
      await flushPromises()
      expect(f.getAuditReport.mock.calls.length).toBe(reportReads + 1)
      expect(w.get('[data-testid="audit-category-health"]').text()).toContain('complete')
      expect(w.find('[data-testid="audit-health-running"]').exists()).toBe(false)
      const progressReads = f.getAuditProgress.mock.calls.length
      await vi.advanceTimersByTimeAsync(60_000)
      expect(f.getAuditProgress.mock.calls.length).toBe(progressReads)
      w.unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  // DAR-UI-078 (walked in Chrome): a new audit's statement with a check that has not run yet is not "No check yet".
  it('says a statement whose check has not run is not run yet, and one with no check has none', async () => {
    const doc = report()
    const orders = doc.categories.orders!
    const check = orders.statements.R2!.checks[0]!
    orders.statements.R3 = { ...orders.statements.R3!, status: 'notRun', checks: [{ ...check, status: 'notRun' }] }
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    liveRoute.query = { category: 'orders', statement: 'R3' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-statement-empty-R3"]').text()).toBe('Not run yet')
    orders.statements.R3 = { ...orders.statements.R3!, checks: [] }
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    const w2 = mount(AuditReportPage)
    await flushPromises()
    expect(w2.get('[data-testid="audit-statement-empty-R3"]').text()).toBe('No check yet')
  })

  it('walks the columns through the URL, one history step per pick, and says why a statement has no findings', async () => {
    const w = mount(AuditReportPage)
    await flushPromises()
    await w.findAll('[data-testid="audit-statement-row-orders"]')[1]!.trigger('click')
    expect(push).toHaveBeenCalledWith({ query: { category: 'orders', statement: 'R3', finding: undefined } })

    liveRoute.query = { category: 'orders', statement: 'R3' }
    await flushPromises()
    expect(w.get('[data-testid="audit-statement-empty-R3"]').text()).toBe('Holds')
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
    expect(records[0]).toContain('Invoice : Open')
    expect(records[1]).toContain('HotWax')
    // A finding its cause explains needs no evidence: the fix and the records say it.
    expect(w.find('[data-testid="audit-evidence-row"]').exists()).toBe(false)
    expect(w.get('[data-testid="audit-finding-fix"]').text()).toBe('Enter the Shopify order id on invoice INV1.')
    expect(w.findAll('[data-testid="audit-history-row"]')).toHaveLength(1)
    // DAR-UI-081. Verdict first: what is wrong, then the fix, then each system's record and its status.
    const order = ['audit-finding-headline', 'audit-finding-fix', 'audit-record-row']
      .map((id) => w.get('[data-testid="audit-columns"]').html().indexOf(`data-testid="${id}"`))
    expect(order).toEqual([...order].sort((a, b) => a - b))
    expect(w.find('.audit-record-id').exists()).toBe(false)
    // Half the words: the fix is written per cause, so the cause, "done when", the internal id and the sighting count go.
    const detail = w.get('[aria-label="Detail"]').text()
    for (const gone of ['No Shopify order id', 'Done when', '801', 'seen']) expect(detail).not.toContain(gone)
    // DAR-UI-081. The fix's system leads the cards (solid), a record whose read gave no status is dashed; nothing is stuck
    // beyond what the headline says, so the verdict holds the fix alone.
    const cards = w.findAll('[data-testid="audit-record-row"]')
    expect(cards[0]!.classes()).toContain('audit-system--attention')
    expect(cards[1]!.classes()).toContain('audit-system--unread')
    expect(w.find('[data-testid="audit-finding-stuck"]').exists()).toBe(false)

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
    // DAR-UI-073: the toolbar's cause and age selects come first; take the period's by its test id.
    const select = w.findAllComponents({ name: 'AppSelect' }).find((c) => c.props('testId') === 'audit-period')!
    expect(select.props('options').map((o: { value: string }) => o.value)).toEqual(['2026-10', '2026-09', '2026-08'])
    select.vm.$emit('update:modelValue', '2026-09')
    expect(replace).toHaveBeenCalledWith({ query: { period: '2026-09', finding: undefined } })

    liveRoute.query = { period: '2026-09' }
    await flushPromises()
    expect(f.getAuditReport).toHaveBeenLastCalledWith({ audit: 'month-close', period: '2026-09' }, expect.anything())
  })

  // DAR-UI-069. A fixed finding is gone from the board: the report keeps it for the day's "fixed today" count only.
  it('lists only open and pending findings', async () => {
    const doc = report()
    doc.categories.orders!.statements.R2!.findings.push({ id: 'F-3', headline: 'Invoice INV3 has no Etail id', state: 'fixed',
      firstFound: '2026-10-01', ageDays: 7, records: {}, difference: null, next: 'darpan findings show F-3' })
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    liveRoute.query = { category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.findAll('[data-testid="audit-finding-row"]').map((row) => row.attributes('title'))).toEqual(['F-1', 'F-2'])
  })

  // DAR-UI-070. The report lists 50 a statement; "N more" pages through the rest, a page at a time.
  it('shows a statement\'s findings past the report\'s 50 when "more" is picked', async () => {
    const doc = report()
    const r2 = doc.categories.orders!.statements.R2!
    r2.counts = counts(3, 1)
    r2.findingsOmitted = 2
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    const summary = (id: string) => ({ id, headline: `Invoice ${id} has no Etail id`, state: 'open', firstFound: '2026-10-08',
      ageDays: 0, records: {}, difference: null, next: '' })
    // DAR-UI-075. "More" reads the rest as the report lists them, one per order, in one call.
    f.getAuditFindingsByOrder.mockResolvedValue({ ok: true, findings: [summary('F-1'), summary('F-2'), summary('F-4'), summary('F-5')] } as never)
    liveRoute.query = { category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    const rows = () => w.findAll('[data-testid="audit-finding-row"]').map((row) => row.attributes('title'))
    const more = () => w.find('[data-testid="audit-findings-more"]')
    expect(more().text()).toBe('2 more')
    // The heading counts the statement's open and pending findings, not the rows the report listed.
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('4')

    await more().trigger('click')
    await flushPromises()
    expect(f.getAuditFindingsByOrder).toHaveBeenLastCalledWith({ audit: 'month-close', statement: 'R2', period: '2026-10' }, expect.anything())
    expect(rows()).toEqual(['F-1', 'F-2', 'F-4', 'F-5'])
    expect(more().exists()).toBe(false)

    // Another statement starts over from the report's own list.
    liveRoute.query = { category: 'orders', statement: 'R3' }
    await flushPromises()
    liveRoute.query = { category: 'orders', statement: 'R2' }
    await flushPromises()
    expect(rows()).toEqual(['F-1', 'F-2'])
  })

  // DAR-UI-071. With no cause to explain it, the checks are the only explanation, so the evidence shows.
  it('shows the evidence only for a finding no cause explains', async () => {
    f.getAuditFinding.mockResolvedValue({ ok: true, finding: { ...findingDocument,
      finding: { ...findingDocument.finding, diagnosis: { conclusion: null, explanation: null } } } } as never)
    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'F-1' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-evidence-row"]').text()).toContain('The invoice has no Etail id')
  })

  // DAR-UI-072. The findings of one order sit together under it.
  // DAR-UI-075. An order is one finding: its row names the order, its detail the line holding it up and every line.
  it('shows an order as one finding and names the line holding it up', async () => {
    const doc = report()
    const line = (id: string, item: string, cause: string, held: boolean) => ({ id, headline: `Item ${item} is completed in HotWax and not billed in NetSuite`,
      state: 'open' as const, firstFound: '2026-10-02', ageDays: 6, difference: null, next: '', cause, held,
      records: { OMS: { orderItem: [{ id: item, internalId: null, status: 'Completed', location: '58', locationName: 'Chicago' }] },
        NetSuite: { salesOrderLine: [{ id: 'SO1', internalId: null, status: null, fulfillments: held ? ['IF7456843'] : [] }] } } })
    doc.categories.orders!.statements.R2!.findings = [{ id: 'M1168785', kind: 'order', order: 'M1168785',
      headline: 'Order M1168785: line 1 backordered in NetSuite, holding 1 more line', state: 'open', firstFound: '2026-10-02', ageDays: 6,
      difference: null, next: 'darpan findings show F-1', records: {}, cause: 'Backordered in NetSuite', stuck: ['F-1'],
      lines: [line('F-1', 'M1168785/01', 'Backordered in NetSuite', false),
        line('F-2', 'M1168785/02', 'Shipped, not billed: another line of its order is backordered in NetSuite', true)] }]
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    liveRoute.query = { category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    const row = w.get('[data-testid="audit-finding-row"]')
    expect(row.text()).toContain('Order M1168785')
    expect(row.text()).toContain('line 1 backordered in NetSuite, holding 1 more line')

    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'M1168785' }
    await flushPromises()
    expect(f.getAuditFinding).toHaveBeenLastCalledWith({ findingId: 'F-1' }, expect.anything())
    // DAR-UI-081. The record moves up beside the statement; the lead says what is wrong, the verdict what holds it.
    expect(w.get('[data-testid="audit-finding-eyebrow"]').text()).toBe('R2 · Order M1168785')
    expect(w.get('[data-testid="audit-finding-headline"]').text()).toBe('Line 1 backordered in NetSuite, holding 1 more line')
    expect(w.get('[data-testid="audit-finding-stuck"]').text()).toBe('Line 1: Backordered in NetSuite')
    const lines = w.findAll('[data-testid="audit-order-line"]')
    expect(lines.map((l) => l.text())).toEqual([expect.stringContaining('Line 1'), expect.stringContaining('Line 2')])
    expect(lines.map((l) => l.text()).join(' ')).not.toContain('/0')
    expect(lines[0]!.classes()).toContain('audit-line--stuck')
    // DAR-UI-081: a held line reads as its item's own status, not "Held by".
    expect(lines[1]!.text()).toContain('Completed')
    expect(lines[1]!.text()).not.toContain('Held by')
    // DAR-UI-081 (Aditi: "add location ID to the line box", "show the location name").
    // And "add the IF id here too": the shipped line names its item fulfillment.
    expect(w.findAll('[data-testid="audit-line-location"]').map((l) => l.text())).toEqual(['Chicago · 58', 'IF7456843 · Chicago · 58'])
    // DAR-UI-081 (Aditi: "remove the click and detail page"): a line opens nothing, and has no page: its id opens its order.
    expect(w.find('button[data-testid="audit-order-line"]').exists()).toBe(false)
    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'F-2' }
    await flushPromises()
    expect(w.findAll('[data-testid="audit-order-line"]')).toHaveLength(2)
    expect(w.get('[data-testid="audit-finding-eyebrow"]').text()).toBe('R2 · Order M1168785')

    // DAR-UI-079. Resolve on the order re-checks the line holding it up, not the order id.
    f.verifyAuditFinding.mockResolvedValue({ ok: true, submitted: true } as never)
    await w.get('[data-testid="audit-verify-finding"]').trigger('click')
    expect(f.verifyAuditFinding).toHaveBeenCalledWith({ findingId: 'F-1' })
    w.unmount()
  })

  // DAR-UI-075. An order past the report's 50 (a reload, a link) is found by reading the statement's orders first.
  it('opens an order the report does not list by reading the statement\'s orders', async () => {
    const line = { id: 'F-7', headline: 'Item M77/01 is completed in HotWax and not billed in NetSuite', state: 'open' as const,
      firstFound: '2026-10-02', ageDays: 6, difference: null, next: '', cause: null, held: false,
      records: { OMS: { orderItem: [{ id: 'M77/01', internalId: null, status: 'Completed' }] } } }
    f.getAuditFindingsByOrder.mockResolvedValue({ ok: true, findings: [{ id: 'M77', kind: 'order', order: 'M77',
      headline: 'Order M77: line 1 is completed in HotWax and not billed in NetSuite', state: 'open', firstFound: '2026-10-02',
      ageDays: 6, difference: null, next: '', records: {}, cause: null, stuck: [], lines: [line], statement: 'R2', category: 'orders' }] } as never)
    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'M77' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(f.getAuditFindingsByOrder).toHaveBeenLastCalledWith({ audit: 'month-close', statement: 'R2', period: '2026-10' }, expect.anything())
    expect(f.getAuditFinding).toHaveBeenLastCalledWith({ findingId: 'F-7' }, expect.anything())
    expect(f.getAuditFinding).not.toHaveBeenCalledWith({ findingId: 'M77' }, expect.anything())
    expect(w.get('[data-testid="audit-finding-headline"]').text()).toBe('Line 1 is completed in HotWax and not billed in NetSuite')
  })

  // DAR-UI-072. JSON exports: the morning's report, every page of a statement's findings, the open finding.
  it('exports the report, a statement\'s findings and the open finding as JSON', async () => {
    const download = vi.mocked(downloadTextFile)
    download.mockReset()
    const summary = (id: string, item: string) => ({ id, headline: id, state: 'open', firstFound: '2026-10-02', ageDays: 6,
      difference: null, next: '', records: { OMS: { orderItem: [{ id: item, internalId: null, status: null }] } } })
    f.getAuditFindingsByOrder.mockResolvedValue({ ok: true, findings: [summary('F-1', 'M1/01'), summary('F-9', 'M2/01')] } as never)
    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'F-1' }
    const w = mount(AuditReportPage)
    await flushPromises()

    await w.get('[data-testid="audit-export-report"]').trigger('click')
    expect(download).toHaveBeenLastCalledWith('month-close-2026-10-08.json', JSON.stringify(report(), null, 2), 'application/json')

    await w.get('[data-testid="audit-export-findings"]').trigger('click')
    await flushPromises()
    expect(f.getAuditFindingsByOrder).toHaveBeenLastCalledWith({ audit: 'month-close', statement: 'R2', period: '2026-10' }, expect.anything())
    const [name, text] = download.mock.lastCall!
    expect(name).toBe('month-close-2026-10-R2-findings.json')
    const doc = JSON.parse(text)
    expect([doc.audit, doc.period, doc.statement]).toEqual(['month-close', '2026-10', 'R2'])
    expect(doc.findings.map((item: { id: string; order: string }) => [item.id, item.order])).toEqual([['F-1', 'M1'], ['F-9', 'M2']])

    await w.get('[data-testid="audit-export-finding"]').trigger('click')
    expect(download).toHaveBeenLastCalledWith('F-1.json', JSON.stringify(findingDocument, null, 2), 'application/json')
  })

  // DAR-UI-072. Each system's bar on a check downloads what that system's read wrote that morning.
  it('downloads a check\'s extract for one system', async () => {
    const download = vi.mocked(downloadTextFile)
    download.mockReset()
    f.getAuditCheckExtracts.mockResolvedValue({ ok: true, extracts: [
      { system: 'NetSuite', records: 3311, filePath: 'reconciliation-runs/GORJANA/ns.json' }] } as never)
    vi.mocked(reconciliationFacade.getGeneratedOutput).mockResolvedValue({ ok: true,
      outputFile: { contentText: '[{"tranId":"INV1"}]', contentType: 'application/json' } } as never)
    liveRoute.query = { category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()

    await w.get('[data-testid="audit-extract-NetSuite"]').trigger('click')
    await flushPromises()
    expect(f.getAuditCheckExtracts).toHaveBeenCalledWith(
      { audit: 'month-close', check: 'invoices-without-etail-id', date: '2026-10-08', period: '2026-10' }, expect.anything())
    expect(reconciliationFacade.getGeneratedOutput).toHaveBeenCalledWith({ fileName: 'reconciliation-runs/GORJANA/ns.json', format: 'json' })
    expect(download).toHaveBeenLastCalledWith('month-close-2026-10-08-invoices-without-etail-id-NetSuite.json', '[{"tranId":"INV1"}]', 'application/json')
  })

  it('says so when a check\'s run kept no extract', async () => {
    f.getAuditCheckExtracts.mockResolvedValue({ ok: true, extracts: [] } as never)
    liveRoute.query = { category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    await w.get('[data-testid="audit-extract-NetSuite"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="audit-export-error"]').text()).toContain('No NetSuite extract')
  })

  // DAR-UI-073. The pill decides what every column counts and lists.
  it('counts and lists what the picked pill shows, in every column', async () => {
    const rows = (w: ReturnType<typeof mount>) => w.findAll('[data-testid="audit-finding-row"]').map((row) => row.attributes('title'))
    liveRoute.query = { show: 'open', category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(rows(w)).toEqual(['F-1'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('1')

    liveRoute.query = { show: 'pending', category: 'orders', statement: 'R2' }
    await flushPromises()
    expect(rows(w)).toEqual(['F-2'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('1')

    liveRoute.query = { category: 'orders', statement: 'R2' }
    await flushPromises()
    expect(rows(w)).toEqual(['F-1', 'F-2'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('2')
  })

  it('asks only for the picked pill\'s findings when "more" is picked', async () => {
    const doc = report()
    doc.categories.orders!.statements.R2!.counts = counts(3, 1)
    doc.categories.orders!.statements.R2!.findingsOmitted = 2
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    f.getAuditFindingsByOrder.mockResolvedValue({ ok: true, findings: [] } as never)
    liveRoute.query = { show: 'open', category: 'orders', statement: 'R2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(w.get('[data-testid="audit-findings-more"]').text()).toBe('2 more')
    await w.get('[data-testid="audit-findings-more"]').trigger('click')
    expect(f.getAuditFindingsByOrder).toHaveBeenLastCalledWith({ audit: 'month-close', statement: 'R2', period: '2026-10', state: 'open' }, expect.anything())
  })

  // DAR-UI-073. The toolbar's search, cause and age narrow the whole board, over every finding of the period.
  it('narrows the whole board by a search, a cause and an age', async () => {
    const item = (id: string, statement: string, invoice: string, cause: string | null, ageDays: number) => ({
      id, headline: `Invoice ${invoice} has no Etail id`, state: 'open', firstFound: '2026-10-02', ageDays, difference: null, next: '',
      audit: 'month-close', period: '2026-10', statement, category: 'orders', cause,
      records: { NetSuite: { invoice: [{ id: invoice, internalId: null, status: null }] } } })
    f.getAuditFindingsByOrder.mockResolvedValue({ ok: true, findings: [
      item('F-1', 'R2', 'INV1', 'Never reached NetSuite', 6), item('F-2', 'R2', 'INV2', 'Backordered in NetSuite', 0),
      item('F-9', 'R3', 'INV9', 'Backordered in NetSuite', 9)] } as never)
    const rows = (w: ReturnType<typeof mount>) => w.findAll('[data-testid="audit-finding-row"]').map((row) => row.attributes('title'))
    const badges = (w: ReturnType<typeof mount>) => w.findAll('[data-testid="audit-statement-row-orders"]').map((row) => row.text())

    liveRoute.query = { category: 'orders', statement: 'R2', q: 'inv2' }
    const w = mount(AuditReportPage)
    await flushPromises()
    expect(f.getAuditFindingsByOrder).toHaveBeenLastCalledWith({ audit: 'month-close', period: '2026-10' }, expect.anything())
    expect(rows(w)).toEqual(['F-2'])
    expect(w.get('[data-testid="audit-findings-count"]').text()).toBe('1')
    expect(badges(w)).toEqual([expect.stringContaining('R2')])
    // Pages earlier tests mounted are still live; count only what the later picks ask for.
    const reads = f.getAuditFindingsByOrder.mock.calls.length

    liveRoute.query = { category: 'orders', statement: 'R3', cause: 'Backordered in NetSuite' }
    await flushPromises()
    expect(rows(w)).toEqual(['F-9'])
    expect(badges(w).length).toBe(2)

    liveRoute.query = { category: 'orders', statement: 'R2', age: '7' }
    await flushPromises()
    expect(rows(w)).toEqual([])
    liveRoute.query = { category: 'orders', statement: 'R3', age: '7' }
    await flushPromises()
    expect(rows(w)).toEqual(['F-9'])
    // One read of the period serves every filter.
    expect(f.getAuditFindingsByOrder.mock.calls.length).toBe(reads)

    await w.get('[data-testid="audit-search"]').setValue('SO7330652')
    await w.get('[data-testid="audit-search"]').trigger('change')
    expect(replace).toHaveBeenLastCalledWith({ query: expect.objectContaining({ q: 'SO7330652', finding: undefined }) })
  })

  // DAR-UI-068. A pick changes only ?category, ?statement or ?finding; the report on screen is still the one to show.
  it('asks for the report once while columns are picked', async () => {
    mount(AuditReportPage)
    await flushPromises()
    // Pages earlier tests mounted are still live, so count only what the picks ask for.
    const before = f.getAuditReport.mock.calls.length
    liveRoute.query = { category: 'orders' }
    await flushPromises()
    liveRoute.query = { category: 'orders', statement: 'R3' }
    await flushPromises()
    expect(f.getAuditReport.mock.calls.length).toBe(before)
  })

  // DAR-UI-067. On an older month the list still starts at the report date's month, so the way back is there.
  it('keeps the current month on the list while an older one is on show', async () => {
    const doc = report()
    doc.report.period = '2026-08'
    f.getAuditReport.mockResolvedValue({ ok: true, report: doc } as never)
    const w = mount(AuditReportPage)
    await flushPromises()
    // DAR-UI-073: the toolbar's cause and age selects come first; take the period's by its test id.
    const select = w.findAllComponents({ name: 'AppSelect' }).find((c) => c.props('testId') === 'audit-period')!
    expect(select.props('options').map((o: { value: string }) => o.value)).toEqual(['2026-10', '2026-09', '2026-08'])
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
    expect(w.get('[data-testid="audit-window"]').text()).toBe('Oct 1 – 8 · read Oct 1 – 5')

    const morning = report()
    for (const category of Object.values(morning.categories)) {
      for (const statement of Object.values(category.statements)) {
        statement.checks = statement.checks.map((check) => ({ ...check, window: { from: '2026-10-01', thru: '2026-10-08' } }))
      }
    }
    f.getAuditReport.mockResolvedValue({ ok: true, report: morning } as never)
    const w2 = mount(AuditReportPage)
    await flushPromises()
    expect(w2.get('[data-testid="audit-window"]').text()).toBe('Oct 1 – 8')
  })

  it('hands the period and date on, so coming back shows the same morning, but not the open finding', async () => {
    liveRoute.query = { period: '2026-09', date: '2026-09-30', finding: 'F-1' }
    const w = mount(AuditReportPage)
    await flushPromises()
    const query = { period: '2026-09', date: '2026-09-30' }
    expect(JSON.parse(w.get('[data-testid="audit-run-button"]').attributes('data-to') ?? '{}').query).toEqual(query)
    expect(JSON.parse(w.get('[data-testid="audit-settings-button"]').attributes('data-to') ?? '{}').query).toEqual(query)
  })

  // DAR-BE-123. Resolve re-checks the finding in the background and reads it again until its last check moves.
  it('resolves a finding: re-checks it, waits for the check, and says it closed', async () => {
    vi.useFakeTimers()
    const heard: string[] = []
    const listener = (event: Event) => heard.push((event as CustomEvent<{ message: string }>).detail.message)
    document.addEventListener(WORKFLOW_HINT_REQUEST_EVENT, listener)
    try {
      liveRoute.query = { category: 'orders', statement: 'R2', finding: 'F-1' }
      const w = mount(AuditReportPage)
      await flushPromises()
      f.verifyAuditFinding.mockResolvedValue({ ok: true, submitted: true } as never)
      const closed = { ...findingDocument, finding: { ...findingDocument.finding,
        status: { ...findingDocument.finding.status, state: 'fixed', lastChecked: '2026-10-24T13:05:00Z', closedAt: '2026-10-24T13:05:00Z' } } }
      f.getAuditFinding.mockResolvedValueOnce({ ok: true, finding: findingDocument } as never)
        .mockResolvedValueOnce({ ok: true, finding: closed } as never)
      const reportCalls = f.getAuditReport.mock.calls.length

      await w.get('[data-testid="audit-verify-finding"]').trigger('click')
      expect(f.verifyAuditFinding).toHaveBeenCalledWith({ findingId: 'F-1' })
      expect(w.get('[data-testid="audit-verify-finding"]').attributes('disabled')).toBeDefined()
      await vi.advanceTimersByTimeAsync(3000)
      expect(heard).toEqual([])   // the first read is from before the check: keep waiting
      await vi.advanceTimersByTimeAsync(3000)
      await flushPromises()
      expect(heard).toEqual(['Resolved. The finding is closed.'])
      expect(w.find('[data-testid="audit-verify-finding"]').exists()).toBe(false)
      expect(f.getAuditReport.mock.calls.length).toBe(reportCalls + 1)
    } finally {
      document.removeEventListener(WORKFLOW_HINT_REQUEST_EVENT, listener)
      vi.useRealTimers()
    }
  })

  it('says in words why a finding cannot be resolved', async () => {
    liveRoute.query = { category: 'orders', statement: 'R2', finding: 'F-1' }
    const w = mount(AuditReportPage)
    await flushPromises()
    const refusal = 'Finding F-1 cannot be re-checked: its check has no automation yet (play the audit once).'
    f.verifyAuditFinding.mockRejectedValue(new ApiCallError(refusal, 200, { result: { errors: [refusal] } }))
    const reads = f.getAuditFinding.mock.calls.length
    await w.get('[data-testid="audit-verify-finding"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="audit-finding-error"]').text()).toContain('its check has no automation yet')
    expect(f.getAuditFinding.mock.calls.length).toBe(reads)   // nothing to wait for
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
