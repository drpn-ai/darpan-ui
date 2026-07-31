import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  fullPath: '/reconciliation/automations',
}))
const listAutomations = vi.hoisted(() => vi.fn())
const permissions = vi.hoisted(() => ({
  canEditTenantSettings: true,
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRoute: () => route,
}))

vi.mock('../../../lib/api/facade', () => ({
  reconciliationFacade: {
    listAutomations,
  },
}))

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({ sessionInfo: null }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
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

import ReconciliationAutomationsPage from '../ReconciliationAutomationsPage.vue'

function mockAutomationRows() {
  return [
    {
      automationId: 'AUT_ACTIVE_API',
      automationName: 'Daily API orders',
      savedRunId: 'RS_API',
      savedRunName: 'API Orders',
      inputModeLabel: 'API date-range extraction',
      sourceSummary: 'API: OMS via NS_ORDERS -> Shopify via SHOPIFY_ORDERS',
      scheduleSummary: 'Cron: 0 0 6 * * ?',
      active: true,
    },
    {
      automationId: 'AUT_PAUSED_SFTP',
      automationName: 'SFTP inventory',
      savedRunId: 'RS_SFTP',
      savedRunName: 'Inventory SFTP',
      inputModeLabel: 'SFTP file inputs',
      sourceSummary: 'SFTP: OMS via SFTP_OMS -> Shopify via SFTP_SHOPIFY',
      scheduleSummary: 'Cron: 0 0/10 * * * ?',
      active: false,
    },
  ]
}

describe('ReconciliationAutomationsPage', () => {
  beforeEach(() => {
    route.fullPath = '/reconciliation/automations'
    permissions.canEditTenantSettings = true
    listAutomations.mockReset()
    listAutomations.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      automations: mockAutomationRows(),
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 2, pageCount: 1 },
    })
  })

  it('renders automations as main-content tiles that open the selected automation dashboard', async () => {
    const wrapper = mount(ReconciliationAutomationsPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.text()).toContain('Automations')
    expect(wrapper.text()).toContain('Automation Runs')
    expect(wrapper.findAll('[data-testid="automation-create-action"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="automation-create-action"]').text()).toBe('Create Automation')
    expect(wrapper.findAll('[data-testid="automation-tile"]')).toHaveLength(2)

    const firstTile = wrapper.get('[data-testid="automation-tile"]')
    expect(firstTile.text()).toBe('Daily API orders')
    expect(JSON.parse(firstTile.attributes('data-to') ?? '{}')).toEqual({
      name: 'reconciliation-automation-dashboard',
      params: { automationId: 'AUT_ACTIVE_API' }
    })
    expect(wrapper.get('[data-testid="saved-automations"]').classes()).toContain('static-page-record-grid--fixed')
    expect(wrapper.text()).not.toContain('Based on API Orders')
    expect(wrapper.text()).not.toContain('API date-range extraction')
    expect(wrapper.text()).not.toContain('Cron: 0 0 6')
    expect(wrapper.find('[data-testid="automation-run-now-AUT_ACTIVE_API"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="automation-delete-AUT_ACTIVE_API"]').exists()).toBe(false)
  })

  it('allows view-only users to open automation dashboards but hides create actions', async () => {
    permissions.canEditTenantSettings = false

    const wrapper = mount(ReconciliationAutomationsPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="automation-tile"]')).toHaveLength(2)
    expect(wrapper.find('[data-testid="automation-create-action"]').exists()).toBe(false)
  })

  it('handles empty and error states', async () => {
    listAutomations.mockResolvedValueOnce({
      ok: true,
      messages: [],
      errors: [],
      automations: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 0, pageCount: 1 },
    })
    const emptyWrapper = mount(ReconciliationAutomationsPage)
    await flushPromises()

    expect(emptyWrapper.text()).toContain('No automations')
    expect(emptyWrapper.find('[data-testid="automation-create-action"]').exists()).toBe(true)

    listAutomations.mockRejectedValueOnce(new Error('Unavailable'))
    const errorWrapper = mount(ReconciliationAutomationsPage)
    await flushPromises()

    expect(errorWrapper.text()).toContain('Unable to load automations.')
  })
})
