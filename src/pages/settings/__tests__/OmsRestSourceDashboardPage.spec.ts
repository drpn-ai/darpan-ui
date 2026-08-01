import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  params: { omsRestSourceConfigId: 'krewe-oms' } as Record<string, string>,
  fullPath: '/settings/hotwax/auth/krewe-oms',
}))

const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const deleteOmsRestSourceConfig = vi.hoisted(() => vi.fn())
const testSourceConnection = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'john.doe',
    isSuperAdmin: false,
    canEditActiveTenantData: true,
    activeTenantUserGroupId: 'KREWE',
  },
}))

vi.mock('vue-router', () => ({
  RouterLink: {
    props: ['to'],
    template: '<a :data-to="typeof to === \'string\' ? to : JSON.stringify(to)" v-bind="$attrs"><slot /></a>',
  },
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listOmsRestSourceConfigs,
    deleteOmsRestSourceConfig,
    testSourceConnection,
  },
}))

const permissionsShape = {
    get canEditTenantSettings() {
      return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
    },
    get canManageGlobalSettings() {
      return authState.sessionInfo.isSuperAdmin === true
    },
    get canViewTenantSettings() {
      return Boolean(authState.sessionInfo.userId)
    },
  
  get canRunActiveTenantReconciliation() {
    return ((authState.sessionInfo as Record<string, unknown>)?.canEditActiveTenantData === true ||
      (authState.sessionInfo as Record<string, unknown>)?.isSuperAdmin === true ||
      (authState.sessionInfo as Record<string, unknown>)?.canRunActiveTenantReconciliation === true)
  },
}

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsShape,
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

import OmsRestSourceDashboardPage from '../OmsRestSourceDashboardPage.vue'

function dashboardListResponse() {
  return {
    ok: true,
    messages: [],
    errors: [],
    omsRestSourceConfigs: [
      {
        omsRestSourceConfigId: 'krewe-oms',
        description: 'Krewe HotWax',
        companyUserGroupId: 'KREWE',
        baseUrl: 'https://oms.example.com',
        ordersPath: '/rest/s1/oms/orders',
        authType: 'BEARER',
        timeZone: 'America/Chicago',
        hasUsername: false,
        hasPassword: false,
        hasApiToken: true,
        customHeaderNames: ['X-Tenant'],
        connectTimeoutSeconds: 30,
        readTimeoutSeconds: 60,
        isActive: 'Y',
      },
    ],
    pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
  }
}

describe('OmsRestSourceDashboardPage', () => {
  beforeEach(() => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.fullPath = '/settings/hotwax/auth/krewe-oms'
    listOmsRestSourceConfigs.mockReset()
    deleteOmsRestSourceConfig.mockReset()
    testSourceConnection.mockReset()
    push.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('opens a HotWax auth dashboard with endpoint management and an edit icon', async () => {
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'krewe-oms',
          description: 'Krewe HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          ordersPath: '/rest/s1/oms/orders',
          authType: 'BEARER',
          timeZone: 'America/Chicago',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: true,
          customHeaderNames: ['X-Tenant'],
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 60,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()

    expect(listOmsRestSourceConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Krewe HotWax')
    expect(wrapper.text()).toContain('Auth')
    expect(wrapper.text()).toContain('Endpoints')
    expect(wrapper.text()).toContain('https://oms.example.com')
    expect(wrapper.text()).toContain('Timezone')
    expect(wrapper.text()).toContain('America/Chicago')
    const summaryCards = wrapper.findAll('.static-page-summary-card')
    expect(summaryCards.map((card) => card.find('.static-page-summary-label').text())).toEqual([
      'Config ID',
      'Base URL',
      'Active',
      'Timezone',
    ])
    const timezoneCard = summaryCards.find((card) => card.text().includes('Timezone'))
    expect(timezoneCard?.classes()).toContain('static-page-summary-card--wide')
    expect(wrapper.text()).not.toContain('Auth Type')
    expect(wrapper.text()).not.toContain('BEARER')
    expect(wrapper.get('[data-testid="oms-endpoint-tile"]').text()).toContain('Orders API')
    expect(wrapper.get('[data-testid="oms-endpoint-tile"]').text()).toContain('GET /rest/s1/oms/orders')
    expect(wrapper.get('[data-testid="oms-endpoint-tile"]').text()).not.toContain('OrderHeader.default[]')

    const editAction = wrapper.get('[data-testid="oms-auth-edit-action"]')
    expect(editAction.classes()).toContain('app-icon-action')
    expect(editAction.attributes('aria-label')).toBe('Edit HotWax Auth')
    expect(editAction.attributes('data-to')).toContain('"name":"settings-oms-edit"')
    expect(editAction.attributes('data-to')).toContain('"omsRestSourceConfigId":"krewe-oms"')

    const footerActions = wrapper.get('.static-page-actions')
    const deleteAction = wrapper.get('[data-testid="delete-oms-rest-source"]')
    const backAction = wrapper.get('[data-testid="back-oms-rest-source"]')
    const listAction = wrapper.get('[data-testid="list-oms-rest-sources"]')

    expect(deleteAction.attributes('aria-label')).toBe('Delete HotWax source')
    expect(deleteAction.classes()).toContain('app-icon-action')
    expect(deleteAction.classes()).toContain('app-icon-action--large')
    expect(deleteAction.classes()).toContain('app-icon-action--danger')
    expect(deleteAction.element.closest('.static-page-actions')).toBe(footerActions.element)
    expect(deleteAction.element.closest('.static-page-board')).toBeNull()
    expect(backAction.attributes('aria-label')).toBe('Back to HotWax Settings')
    expect(backAction.classes()).toContain('app-icon-action')
    expect(backAction.classes()).toContain('app-icon-action--large')
    expect(backAction.attributes('data-to')).toBe('/settings/hotwax')
    expect(backAction.element.closest('.static-page-actions')).toBe(footerActions.element)
    expect(backAction.element.closest('.static-page-board')).toBeNull()
    expect(listAction.attributes('aria-label')).toBe('View HotWax sources')
    expect(listAction.classes()).toContain('app-icon-action')
    expect(listAction.classes()).toContain('app-icon-action--large')
    expect(listAction.attributes('data-to')).toBe('/settings/hotwax')
    expect(listAction.get('svg').attributes('viewBox')).toBe('0 0 20 20')
    expect(listAction.element.closest('.static-page-actions')).toBe(footerActions.element)
    expect(listAction.element.closest('.static-page-board')).toBeNull()
    const footerActionRow = wrapper.get('.settings-dashboard-footer-row')
    expect([...footerActionRow.element.children].map((child) => child.getAttribute('data-testid'))).toEqual([
      'back-oms-rest-source',
      'list-oms-rest-sources',
      'diagnose-oms-rest-source',
      'delete-oms-rest-source',
    ])
  })

  it('deletes a HotWax source from the bottom trash action after confirmation', async () => {
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'krewe-oms',
          description: 'Krewe HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          ordersPath: '/rest/s1/oms/orders',
          authType: 'BEARER',
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    deleteOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Deleted HotWax source krewe-oms.'],
      errors: [],
      deleted: true,
      deletedOmsRestSourceConfigId: 'krewe-oms',
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()

    await wrapper.get('[data-testid="delete-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('Delete HotWax source "Krewe HotWax"?')
    expect(deleteOmsRestSourceConfig).toHaveBeenCalledWith({ omsRestSourceConfigId: 'krewe-oms' })
    expect(push).toHaveBeenCalledWith('/settings/hotwax')
  })

  it('shows no endpoint tiles when no HotWax endpoints are available', async () => {
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'krewe-oms',
          description: 'Krewe HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          ordersPath: '/rest/s1/oms/orders',
          authType: 'BEARER',
          isActive: 'Y',
          canReadOrders: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="oms-endpoint-tile"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="oms-endpoint-configs"]').text()).toContain('No available endpoints')
  })

  it('keeps the dashboard readable but hides the edit icon for view-only users', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
    }
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'krewe-oms',
          description: 'Krewe HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          ordersPath: '/rest/s1/oms/orders',
          authType: 'NONE',
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Krewe HotWax')
    expect(wrapper.find('[data-testid="oms-auth-edit-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-oms-rest-source"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="back-oms-rest-source"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="list-oms-rest-sources"]').exists()).toBe(true)
  })
  it('runs connection diagnostics from the footer against the OMS connector', async () => {
    listOmsRestSourceConfigs.mockResolvedValue(dashboardListResponse())
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: true,
      connectionOk: true,
      nextStage: null,
      checks: [
        { key: 'credential', label: 'Credential readable', status: 'PASS' },
        { key: 'reachable', label: 'Base URL reachable', status: 'PASS', durationMillis: 63 },
        { key: 'auth', label: 'Credentials accepted', status: 'PASS' },
        { key: 'ordersRead', label: 'Orders readable', status: 'PASS', detail: '1 order returned' },
      ],
    })

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()

    await wrapper.get('[data-testid="diagnose-oms-rest-source"]').trigger('click')
    await flushPromises()

    // Staged run: the first call opts in, and this response ends the walk (nextStage null).
    expect(testSourceConnection).toHaveBeenCalledWith(
      { systemEnumId: 'OMS', configId: 'krewe-oms', staged: true },
      expect.any(AbortSignal),
    )
    expect(wrapper.findAll('[data-testid="connection-diagnostics-check"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
  })

  it('reports an undecryptable stored credential as a credential fault', async () => {
    // The live production failure: the apiToken cannot be decrypted, so nothing downstream ran.
    listOmsRestSourceConfigs.mockResolvedValue(dashboardListResponse())
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: true,
      connectionOk: false,
      nextStage: null,
      checks: [
        { key: 'credential', label: 'Credential readable', status: 'FAIL', detail: 'The stored credentials could not be decrypted.' },
        { key: 'reachable', label: 'Base URL reachable', status: 'SKIP', detail: 'Not attempted.' },
        { key: 'auth', label: 'Credentials accepted', status: 'SKIP', detail: 'Not attempted.' },
        { key: 'ordersRead', label: 'Orders readable', status: 'SKIP', detail: 'Not attempted.' },
      ],
    })

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="diagnose-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('The stored credentials could not be decrypted.')
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is not usable.')
    expect(wrapper.get('[data-check-key="credential"]').attributes('data-check-status')).toBe('FAIL')
    // The network rows are untested, not broken.
    expect(wrapper.get('[data-check-key="reachable"]').attributes('data-check-status')).toBe('SKIP')
  })

  it('hides the diagnostics action from a read-only tenant', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
    }
    listOmsRestSourceConfigs.mockResolvedValue(dashboardListResponse())

    const wrapper = mount(OmsRestSourceDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnose-oms-rest-source"]').exists()).toBe(false)
  })
})
