import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const ensureAuthenticated = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listSavedRuns = vi.hoisted(() => vi.fn())
const saveDashboardPinnedSavedRuns = vi.hoisted(() => vi.fn())
const listReconciliations = vi.hoisted(() => vi.fn())
const importNetSuiteChecksAsRuns = vi.hoisted(() => vi.fn())
const getAudits = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))
const route = vi.hoisted(() => ({
  name: 'hub',
  path: '/',
  fullPath: '/',
  query: {},
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)"><slot /></a>',
  },
  useRoute: () => route,
  useRouter: () => ({
    replace,
  }),
}))

vi.mock('../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    username: 'john.doe',
    userId: 'aditi',
    sessionInfo: { userId: 'aditi', username: 'john.doe' },
    ensureAuthenticated,
  }),
}))

vi.mock('../../stores/permissions', () => ({ usePermissionsStore: () => permissions }))

vi.mock('../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => ({
    workflowOrigin: null,
    ruleSetDraftState: null,
    automationDraftState: null,
    setWorkflowOrigin: vi.fn(),
    setRuleSetDraft: vi.fn(),
    clearRuleSetDraft: vi.fn(),
    setAutomationDraft: vi.fn(),
    clearAutomationDraft: vi.fn(),
  }),
}))

vi.mock('../../lib/api/facade', () => ({
  reconciliationFacade: {
    listSavedRuns,
    listReconciliations,
    saveDashboardPinnedSavedRuns,
    importNetSuiteChecksAsRuns,
  },
  auditFacade: { getAudits },
}))

import HomePage from '../HomePage.vue'
import { invalidateReadCache } from '../../lib/api/readCache'

const GROUP = '[data-testid="run-group-oms-shopify"]'
const GROUP_MORE = '[data-testid="run-group-oms-shopify-more"]'

function buildSavedRun(index: number) {
  return {
    savedRunId: `RS${index + 1}`,
    runName: `Reconciliation ${index + 1}`,
    description: `Run ${index + 1}.`,
    runType: 'ruleset',
    ruleSetId: `RS${index + 1}`,
    compareScopeId: `CS${index + 1}`,
    requiresSystemSelection: false,
    defaultFile1SystemEnumId: 'OMS',
    defaultFile2SystemEnumId: 'SHOPIFY',
    systemOptions: [
      { enumId: 'OMS', label: 'OMS', fileSide: 'FILE_1' },
      { enumId: 'SHOPIFY', label: 'SHOPIFY', fileSide: 'FILE_2' },
    ],
  }
}

describe('HomePage', () => {
  beforeEach(() => {
    invalidateReadCache()
    ensureAuthenticated.mockClear()
    replace.mockClear()
    listSavedRuns.mockReset()
    saveDashboardPinnedSavedRuns.mockReset()
    listReconciliations.mockReset()
    listReconciliations.mockResolvedValue({ reconciliations: [] })
    getAudits.mockReset()
    getAudits.mockResolvedValue({ audits: [] })
    importNetSuiteChecksAsRuns.mockReset()
    permissions.canEditTenantSettings = true

    listSavedRuns.mockResolvedValue({
      pinnedSavedRunIds: ['RS8'],
      savedRuns: Array.from({ length: 8 }, (_, index) => buildSavedRun(index)),
    })
    saveDashboardPinnedSavedRuns.mockImplementation(async ({ pinnedSavedRunIds }) => ({
      ok: true,
      messages: [],
      errors: [],
      pinnedSavedRunIds,
    }))
  })

  it('relies on the router-verified session instead of forcing a check (DAR-UI-051)', async () => {
    mount(HomePage)
    await flushPromises()
    expect(ensureAuthenticated).toHaveBeenCalledTimes(1)
    expect(ensureAuthenticated).not.toHaveBeenCalledWith(true)
  })

  it('shows the last visit\'s runs at once on a revisit, before the network answers (DAR-UI-051)', async () => {
    mount(HomePage).unmount()
    await flushPromises()

    listSavedRuns.mockReturnValue(new Promise(() => {}))
    listReconciliations.mockReturnValue(new Promise(() => {}))
    const revisit = mount(HomePage)
    await flushPromises()

    expect(revisit.find('[data-testid="pinned-runs"]').text()).toContain('Reconciliation 8')
    expect(revisit.text()).toContain('OMS ↔ SHOPIFY · 7')
  })

  it('groups runs into one section per system family, counted', async () => {
    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    // Pinned, plus one family section. Every fixture run is OMS vs SHOPIFY.
    expect(wrapper.findAll('.static-page-section')).toHaveLength(2)
    expect(wrapper.text()).toContain("Let's Investigate")
    expect(wrapper.text()).toContain('Pinned Runs')
    // The count is in the heading, and it counts the GROUP, not what is currently shown —
    // seven others with six on screen still reads seven.
    expect(wrapper.text()).toContain('OMS ↔ SHOPIFY · 7')
    expect(wrapper.text()).not.toContain('Other Runs')

    expect(wrapper.find('[data-testid="pinned-runs"]').text()).toContain('Reconciliation 8')
    expect(wrapper.findAll(`${GROUP} .static-page-tile`)).toHaveLength(6)
    expect(wrapper.get(GROUP_MORE).text()).toBe('1 more')
    expect(wrapper.find('[data-testid="dashboard-create-action"]').exists()).toBe(true)

    expect(JSON.parse(wrapper.find('[data-flow-id="saved-run:RS1"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-diff',
      query: {
        savedRunId: 'RS1',
        runName: 'Reconciliation 1',
        file1SystemLabel: 'OMS',
        file2SystemLabel: 'SHOPIFY',
      },
    })

    // Raised with the grouping, not incidentally: a heading that states a count has to be
    // counting the whole set.
    expect(listSavedRuns).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 100,
      query: '',
    }, expect.any(AbortSignal))

    await wrapper.get(GROUP_MORE).trigger('click')
    await flushPromises()

    expect(wrapper.findAll(`${GROUP} .static-page-tile`)).toHaveLength(7)
    expect(wrapper.find(GROUP_MORE).exists()).toBe(false)
  })

  it('splits families into their own sections and orders them predictably', async () => {
    listSavedRuns.mockResolvedValue({
      pinnedSavedRunIds: [],
      savedRuns: [
        {
          ...buildSavedRun(0),
          savedRunId: 'NS1',
          runName: 'Pending Billing',
          scopeMode: 'EVALUATE',
          defaultFile1SystemEnumId: 'NETSUITE_SUITEQL',
          defaultFile2SystemEnumId: undefined,
          // systemParentLabel is the family; the option's own label is the ENDPOINT.
          systemOptions: [
            { enumId: 'NETSUITE_SUITEQL', label: 'NetSuite SuiteQL', systemParentLabel: 'NetSuite', fileSide: 'FILE_1' },
          ],
        },
        buildSavedRun(0),
      ],
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    // Grouped by FAMILY, so the heading reads NetSuite rather than the endpoint's own label.
    expect(wrapper.text()).toContain('NetSuite · 1')
    expect(wrapper.text()).toContain('OMS ↔ SHOPIFY · 1')
    expect(wrapper.text()).not.toContain('NetSuite SuiteQL ·')

    // Alphabetical, so a section does not move under the operator when runs are added.
    const headings = wrapper.findAll('.static-page-section-heading').map((h) => h.text())
    expect(headings).toEqual(['Pinned Runs', 'NetSuite · 1', 'OMS ↔ SHOPIFY · 1'])
  })

  /**
   * Found against real data: the naive label produced "HotWax ↔ Shopify · 1" beside
   * "Shopify ↔ HotWax · 3" — two sections for one pairing, which reads as two families and a
   * stray. The pair is the family; direction belongs to the run's own name.
   */
  it('groups a pair of systems together whichever side each is on', async () => {
    const swapped = {
      ...buildSavedRun(1),
      savedRunId: 'RS_SWAP',
      runName: 'Returns Shopify to OMS',
      defaultFile1SystemEnumId: 'SHOPIFY',
      defaultFile2SystemEnumId: 'OMS',
      systemOptions: [
        { enumId: 'SHOPIFY', label: 'SHOPIFY', fileSide: 'FILE_1' },
        { enumId: 'OMS', label: 'OMS', fileSide: 'FILE_2' },
      ],
    }
    listSavedRuns.mockResolvedValue({ pinnedSavedRunIds: [], savedRuns: [buildSavedRun(0), swapped] })

    const wrapper = mount(HomePage)
    await flushPromises()

    const headings = wrapper.findAll('.static-page-section-heading').map((h) => h.text())
    expect(headings).toEqual(['Pinned Runs', 'OMS ↔ SHOPIFY · 2'])
  })

  /**
   * A single-sided run is filed by the one system it interrogates. Read from scopeMode, not from
   * how many systemOptions came back — one option is also what a BROKEN two-sided run looks like,
   * and inferring would file it under a heading that made the breakage look deliberate.
   */
  it('files a two-sided run missing its second system under the first, not as single-sided', async () => {
    listSavedRuns.mockResolvedValue({
      pinnedSavedRunIds: [],
      savedRuns: [{
        ...buildSavedRun(0),
        defaultFile2SystemEnumId: undefined,
        systemOptions: [{ enumId: 'OMS', label: 'OMS', fileSide: 'FILE_1' }],
      }],
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.text()).toContain('OMS · 1')
  })

  /** A count that covers only part of the set is a wrong number, so the page admits the gap. */
  it('says so when it is showing fewer runs than the tenant has', async () => {
    listSavedRuns.mockResolvedValue({
      pinnedSavedRunIds: [],
      savedRuns: [buildSavedRun(0)],
      pagination: { pageIndex: 0, pageSize: 100, totalCount: 140, pageCount: 2 },
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="runs-truncated"]').text()).toContain('Showing 1 of 140 runs')
  })

  it('stays quiet when every run is on the page', async () => {
    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.find('[data-testid="runs-truncated"]').exists()).toBe(false)
  })

  it('supports pinning by drag and drop', async () => {
    const wrapper = mount(HomePage)
    await flushPromises()

    const transferStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: 'move',
      setData: (type: string, value: string) => {
        transferStore.set(type, value)
      },
      getData: (type: string) => transferStore.get(type) ?? '',
    }

    await wrapper.find('[data-flow-id="saved-run:RS1"]').trigger('dragstart', { dataTransfer })
    await wrapper.find('[data-testid="pinned-runs"]').trigger('drop', { dataTransfer })
    await flushPromises()

    expect(saveDashboardPinnedSavedRuns).toHaveBeenLastCalledWith({
      pinnedSavedRunIds: ['RS8', 'RS1'],
    })
    expect(wrapper.find('[data-testid="pinned-runs"]').text()).toContain('Reconciliation 1')
    expect(wrapper.find(GROUP).text()).not.toContain('Reconciliation 1')
  })

  it('does not shout all-uppercase saved run names on dashboard tiles', async () => {
    listSavedRuns.mockResolvedValue({
      pinnedSavedRunIds: [],
      savedRuns: [
        {
          ...buildSavedRun(0),
          savedRunId: 'RS_GORJANA_ORDERS_SYNC',
          runName: 'GORJANA ORDERS SYNC',
        },
      ],
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    const runTile = wrapper.get('[data-flow-id="saved-run:RS_GORJANA_ORDERS_SYNC"]')
    expect(runTile.get('.static-page-tile-title').text()).toBe('Gorjana Orders Sync')
    expect(JSON.parse(runTile.attributes('data-to') ?? '{}')).toMatchObject({
      query: {
        runName: 'Gorjana Orders Sync',
      },
    })
  })

  it('restores the previous pin state when saving fails', async () => {
    saveDashboardPinnedSavedRuns.mockRejectedValueOnce(new Error('save failed'))

    const wrapper = mount(HomePage)
    await flushPromises()

    const transferStore = new Map<string, string>()
    const dataTransfer = {
      effectAllowed: 'move',
      setData: (type: string, value: string) => {
        transferStore.set(type, value)
      },
      getData: (type: string) => transferStore.get(type) ?? '',
    }

    await wrapper.find('[data-flow-id="saved-run:RS1"]').trigger('dragstart', { dataTransfer })
    await wrapper.find('[data-testid="pinned-runs"]').trigger('drop', { dataTransfer })
    await flushPromises()

    expect(wrapper.find('[data-testid="pinned-runs"]').text()).not.toContain('Reconciliation 1')
    expect(wrapper.find('[data-testid="pinned-runs"]').text()).toContain('Reconciliation 8')
    expect(wrapper.find(GROUP).text()).toContain('Reconciliation 1')
  })

  it('shows the pinned drop hint and in-section create action when there are no runs', async () => {
    listSavedRuns.mockResolvedValue({
      pinnedSavedRunIds: [],
      savedRuns: [],
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.get('[data-testid="pinned-empty-state"]').text()).toBe('drag and drop runs to pin')
    expect(wrapper.find('[data-testid="dashboard-create-action"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="other-runs-empty-action"]').text()).toBe('Create Run')
    expect(JSON.parse(wrapper.get('[data-testid="other-runs-empty-action"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'run-create',
    })
    expect(wrapper.findAll('[data-testid="other-runs"] .static-page-tile')).toHaveLength(0)
  })
  // DAR-UI-058. An audit is a run too: one tile per audit, in its type's section, after the lifecycle runs.
  it('lists the tenant\'s audits as their own section, last', async () => {
    listReconciliations.mockResolvedValue({
      reconciliations: [{ reconciliationId: 'R1', reconciliationName: 'Order chain', defaultTimeWindow: '7d', questionCount: 4 }],
    })
    getAudits.mockResolvedValue({ audits: [{ id: 'month-close', name: 'Month close', period: 'month' }] })

    const wrapper = mount(HomePage)
    await flushPromises()

    const audit = wrapper.get('[data-testid="run-group-audit"]')
    expect(wrapper.text()).toContain('Audit · 1')
    const tile = wrapper.get('[data-flow-id="audit:month-close"]')
    expect(tile.text()).toBe('Month close')
    expect(JSON.parse(tile.attributes('data-to') ?? '{}')).toEqual({ name: 'audit-report', params: { audit: 'month-close' } })
    expect(tile.attributes('draggable')).toBe('false')
    const sections = wrapper.findAll('[data-testid^="run-group-"]').map((node) => node.attributes('data-testid'))
    expect(sections.slice(-2)).toEqual(['run-group-lifecycle', 'run-group-audit'])
    expect(audit.findAll('.static-page-tile')).toHaveLength(1)
  })

  it('keeps every other section when the audits fail to load', async () => {
    getAudits.mockRejectedValue(new Error('boom'))
    const wrapper = mount(HomePage)
    await flushPromises()
    expect(wrapper.find('[data-testid="run-group-audit"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="run-group-oms-shopify"]').exists()).toBe(true)
  })

  // DAR-UI-049. Everything is a run; the type tells them apart.
  it('lists lifecycle runs beside sync runs, each wearing its type', async () => {
    listReconciliations.mockResolvedValue({
      reconciliations: [
        { reconciliationId: 'R2', reconciliationName: 'Return chain', defaultTimeWindow: '1d', questionCount: 1 },
        { reconciliationId: 'R1', reconciliationName: 'NetSuite order chain', defaultTimeWindow: '7d', questionCount: 4 },
      ],
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    const lifecycle = wrapper.get('[data-testid="run-group-lifecycle"]')
    expect(wrapper.text()).toContain('Lifecycle · 2')
    expect(lifecycle.findAll('.static-page-tile')).toHaveLength(2)

    const chain = wrapper.get('[data-flow-id="lifecycle:R1"]')
    // A tile is the run's name alone: its kind is its section, and the rest is on its page.
    expect(chain.text()).toBe('NetSuite order chain')
    expect(JSON.parse(chain.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-run-flowchart',
      params: { reconciliationId: 'R1' },
    })

    expect(wrapper.find('[data-flow-id="saved-run:RS1"] [data-run-type]').exists()).toBe(false)
    // The type section follows every system-family section rather than sorting in among them.
    const titles = wrapper.findAll('.static-page-section').map((section) => section.text())
    expect(titles.findIndex((t) => t.startsWith('Lifecycle'))).toBe(titles.length - 1)
  })

  it('does not offer to pin a lifecycle run, since the server keeps only sync-run pins today', async () => {
    // save#DashboardPinnedSavedRuns validates against RuleSet ids, so a dragged lifecycle run
    // would be dropped by the server and silently un-pin. Not draggable beats a pin that vanishes.
    listReconciliations.mockResolvedValue({
      reconciliations: [{ reconciliationId: 'R1', reconciliationName: 'NetSuite order chain', defaultTimeWindow: '7d', questionCount: 4 }],
    })

    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.get('[data-flow-id="lifecycle:R1"]').attributes('draggable')).toBe('false')
    expect(wrapper.get('[data-flow-id="saved-run:RS1"]').attributes('draggable')).toBe('true')
  })

  it('still shows sync runs when lifecycle runs fail to load', async () => {
    listReconciliations.mockRejectedValue(new Error('boom'))

    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.text()).toContain('OMS ↔ SHOPIFY · 7')
    expect(wrapper.find('[data-testid="run-group-lifecycle"]').exists()).toBe(false)
  })

  it('creates a run through the type choice', async () => {
    const wrapper = mount(HomePage)
    await flushPromises()

    expect(JSON.parse(wrapper.get('[data-testid="dashboard-create-action"]').attributes('data-to') ?? '{}')).toEqual({ name: 'run-create' })
  })

  // DAR-UI-048 plan 3. The NetSuite checks a tenant already has become Lifecycle runs.
  describe('Import NetSuite Checks', () => {
    const netsuiteCheck = () => ({
      ...buildSavedRun(0),
      savedRunId: 'NS1',
      runName: 'Pending Billing',
      scopeMode: 'EVALUATE',
      defaultFile1SystemEnumId: 'NETSUITE_SUITEQL',
      defaultFile2SystemEnumId: undefined,
      systemOptions: [{ enumId: 'NETSUITE_SUITEQL', label: 'NetSuite SuiteQL', systemParentLabel: 'NetSuite', fileSide: 'FILE_1', sourceConfigType: 'NETSUITE_SUITEQL' }],
    })

    it('imports, says what it did, and lists the runs it made', async () => {
      listSavedRuns.mockResolvedValue({ pinnedSavedRunIds: [], savedRuns: [netsuiteCheck(), buildSavedRun(1)] })
      importNetSuiteChecksAsRuns.mockResolvedValue({ runs: [{ reconciliationId: 'R1', reconciliationName: 'NetSuite checks: sales orders', questionCount: 3 }], imported: 2, skipped: 0 })
      const wrapper = mount(HomePage)
      await flushPromises()
      await wrapper.get('[data-testid="dashboard-import-netsuite-checks"]').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="dashboard-import-result"]').text()).toBe('Imported 2 checks into 1 run.')
      expect(listReconciliations).toHaveBeenCalledTimes(2)
    })

    it('names the skips, and says so when there is nothing new', async () => {
      listSavedRuns.mockResolvedValue({ pinnedSavedRunIds: [], savedRuns: [netsuiteCheck()] })
      importNetSuiteChecksAsRuns
        .mockResolvedValueOnce({
          runs: [{ reconciliationId: 'R1', reconciliationName: 'a', questionCount: 2 }, { reconciliationId: 'R2', reconciliationName: 'b', questionCount: 6 }],
          imported: 7,
          skipped: 1,
          messages: ["Check 'Late invoices' was not imported: its query has no column for the key field tranId, so a start could not list its records."],
        })
        .mockResolvedValueOnce({ runs: [], imported: 0, skipped: 0 })
      const wrapper = mount(HomePage)
      await flushPromises()
      await wrapper.get('[data-testid="dashboard-import-netsuite-checks"]').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="dashboard-import-result"]').text()).toBe('Imported 7 checks into 2 runs. 1 check was skipped.')
      expect(wrapper.get('[data-testid="dashboard-import-skips"]').text()).toContain("Check 'Late invoices' was not imported")
      await wrapper.get('[data-testid="dashboard-import-netsuite-checks"]').trigger('click')
      await flushPromises()
      expect(wrapper.get('[data-testid="dashboard-import-result"]').text()).toBe('No new NetSuite checks to import.')
    })

    it('a refused import shows why', async () => {
      listSavedRuns.mockResolvedValue({ pinnedSavedRunIds: [], savedRuns: [netsuiteCheck()] })
      importNetSuiteChecksAsRuns.mockRejectedValue(new Error('Your active tenant only has view access for runs.'))
      const wrapper = mount(HomePage)
      await flushPromises()
      await wrapper.get('[data-testid="dashboard-import-netsuite-checks"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('only has view access')
      expect(wrapper.find('[data-testid="dashboard-import-result"]').exists()).toBe(false)
    })

    it('is offered only to an editor whose tenant has a NetSuite check', async () => {
      const wrapper = mount(HomePage)
      await flushPromises()
      expect(wrapper.find('[data-testid="dashboard-import-netsuite-checks"]').exists()).toBe(false)

      listSavedRuns.mockResolvedValue({ pinnedSavedRunIds: [], savedRuns: [netsuiteCheck()] })
      permissions.canEditTenantSettings = false
      const viewer = mount(HomePage)
      await flushPromises()
      expect(viewer.find('[data-testid="dashboard-import-netsuite-checks"]').exists()).toBe(false)
    })
  })
})
