import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const ensureAuthenticated = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listSavedRuns = vi.hoisted(() => vi.fn())
const saveDashboardPinnedSavedRuns = vi.hoisted(() => vi.fn())
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
    saveDashboardPinnedSavedRuns,
  },
}))

import HomePage from '../HomePage.vue'

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
    ensureAuthenticated.mockClear()
    replace.mockClear()
    listSavedRuns.mockReset()
    saveDashboardPinnedSavedRuns.mockReset()

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
    expect(runTile.text()).toBe('Gorjana Orders Sync')
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
      name: 'reconciliation-create',
    })
    expect(wrapper.findAll('[data-testid="other-runs"] .static-page-tile')).toHaveLength(0)
  })
})
