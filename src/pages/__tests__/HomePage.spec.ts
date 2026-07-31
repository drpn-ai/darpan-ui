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

  it('shows saved runs with pagination for the other runs list', async () => {
    const wrapper = mount(HomePage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.findAll('.static-page-section')).toHaveLength(2)
    expect(wrapper.text()).toContain("Let's Investigate")
    expect(wrapper.text()).toContain('Pinned Runs')
    expect(wrapper.text()).toContain('Other Runs')
    expect(wrapper.text()).toContain('Reconciliation 1')
    expect(wrapper.text()).toContain('Reconciliation 5')
    expect(wrapper.text()).not.toContain('Reconciliation 6')
    expect(wrapper.text()).toContain('Reconciliation 8')
    expect(wrapper.text()).toContain('Create Run')
    expect(wrapper.find('[data-testid="pinned-runs"]').text()).toContain('Reconciliation 8')
    expect(wrapper.find('[data-testid="pinned-empty-state"]').exists()).toBe(false)
    expect(wrapper.findAll('[data-testid="other-runs"] .static-page-tile')).toHaveLength(5)
    expect(wrapper.find('[data-testid="other-runs-empty-action"]').exists()).toBe(false)
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
    expect(JSON.parse(wrapper.get('[data-testid="dashboard-create-action"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-create',
    })
    expect(wrapper.get('[data-testid="other-runs-more"]').text()).toBe('More...')

    expect(listSavedRuns).toHaveBeenCalledWith({
      pageIndex: 0,
      pageSize: 12,
      query: '',
    }, expect.any(AbortSignal))

    await wrapper.get('[data-testid="other-runs-more"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="other-runs"]').text()).toContain('Reconciliation 6')
    expect(wrapper.find('[data-testid="other-runs"]').text()).toContain('Reconciliation 7')
    expect(wrapper.findAll('[data-testid="other-runs"] .static-page-tile')).toHaveLength(7)
    expect(wrapper.find('[data-testid="other-runs-more"]').exists()).toBe(false)
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
    expect(wrapper.find('[data-testid="other-runs"]').text()).not.toContain('Reconciliation 1')
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
    expect(wrapper.find('[data-testid="other-runs"]').text()).toContain('Reconciliation 1')
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
    expect(wrapper.find('[data-testid="other-runs-more"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="other-runs-empty-action"]').text()).toBe('Create Run')
    expect(JSON.parse(wrapper.get('[data-testid="other-runs-empty-action"]').attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-create',
    })
    expect(wrapper.findAll('[data-testid="other-runs"] .static-page-tile')).toHaveLength(0)
  })
})
