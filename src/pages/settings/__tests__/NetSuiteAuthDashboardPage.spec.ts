import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  params: { nsAuthConfigId: 'auth-primary' } as Record<string, string>,
  fullPath: '/settings/netsuite/auth/auth-primary',
}))

const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const listSourceConfigEndpoints = vi.hoisted(() => vi.fn())
const setWorkflowOrigin = vi.hoisted(() => vi.fn())
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
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listNsAuthConfigs,
    listSourceConfigEndpoints,
  },
}))

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({
    sessionInfo: authState.sessionInfo,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => ({
    get canEditTenantSettings() {
      return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
    },
  }),
}))

vi.mock('../../../stores/reconciliationDraft', () => ({
  useReconciliationDraftStore: () => ({
    setWorkflowOrigin,
  }),
}))

import { ApiCallError } from '../../../lib/api/client'
import { invalidateReadCache } from '../../../lib/api/readCache'
import NetSuiteAuthDashboardPage from '../NetSuiteAuthDashboardPage.vue'

function authConfigsResponse(overrides: Record<string, unknown> = {}) {
  return {
    ok: true,
    messages: [],
    errors: [],
    authConfigs: [
      {
        nsAuthConfigId: 'auth-primary',
        description: 'Rails Prod',
        companyUserGroupId: 'KREWE',
        authType: 'OAUTH2_M2M_JWT',
        tokenUrl: 'https://1234.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
        clientId: 'secret-client-id',
        certId: 'cert-id',
        scope: 'restlets rest_webservices',
        isActive: 'Y',
        hasPassword: false,
        hasApiToken: false,
        hasPrivateKeyPem: true,
        ...overrides,
      },
    ],
    pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
  }
}

describe('NetSuiteAuthDashboardPage', () => {
  beforeEach(() => {
    invalidateReadCache()
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.fullPath = '/settings/netsuite/auth/auth-primary'
    listNsAuthConfigs.mockReset()
    listSourceConfigEndpoints.mockReset()
    listSourceConfigEndpoints.mockResolvedValue({ ok: true, messages: [], errors: [], endpoints: [] })
    setWorkflowOrigin.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
    }
  })

  it('opens a read-only auth summary with endpoints, an edit icon, and a back action', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [
        { systemEnumId: 'NETSUITE_SUITEQL', endpointLabel: 'NetSuite SuiteQL', isEnabled: true },
        { systemEnumId: 'NETSUITE', endpointLabel: 'NetSuite RESTlet', isEnabled: false },
      ],
    })

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(listNsAuthConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_NS_AUTH', configId: 'auth-primary' },
      expect.any(AbortSignal),
    )
    expect(wrapper.get('h1').text()).toBe('Rails Prod')

    const cards = Object.fromEntries(wrapper.findAll('.static-page-summary-card').map((card) => [
      card.get('.static-page-summary-label').text(),
      card.findAll('span')[1]?.text(),
    ]))
    expect(cards).toEqual({
      'Config ID': 'auth-primary',
      'Auth Type': 'OAuth2 M2M JWT',
      'Token URL': 'https://1234.suitetalk.api.netsuite.com/services/rest/auth/oauth2/v1/token',
      Scope: 'RESTlets, REST Web Services',
      Active: 'Yes',
    })
    // The client ID is masked in the edit wizard; a read-only page must not print it in the clear.
    expect(wrapper.text()).not.toContain('secret-client-id')

    expect(wrapper.findAll('[data-testid="netsuite-endpoint-tile"]').map((tile) => tile.text())).toEqual(['NetSuite SuiteQL'])

    const editAction = wrapper.get('[data-testid="netsuite-auth-edit-action"]')
    expect(editAction.attributes('aria-label')).toBe('Edit NetSuite Auth')
    expect(editAction.attributes('data-to')).toContain('"name":"settings-netsuite-auth-edit"')
    expect(editAction.attributes('data-to')).toContain('"nsAuthConfigId":"auth-primary"')
    await editAction.trigger('click')
    expect(setWorkflowOrigin).toHaveBeenCalledWith('Rails Prod', '/settings/netsuite/auth/auth-primary')

    const backAction = wrapper.get('[data-testid="back-netsuite-auth"]')
    expect(backAction.attributes('aria-label')).toBe('Back to NetSuite Settings')
    expect(backAction.attributes('data-to')).toBe('/settings/netsuite')
    expect(backAction.element.closest('.static-page-actions')).not.toBeNull()
  })

  it('shows the username for basic auth and no OAuth fields', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse({
      authType: 'BASIC',
      username: 'integration@rails.com',
      tokenUrl: undefined,
      clientId: undefined,
      certId: undefined,
      scope: undefined,
      isActive: 'N',
      hasPassword: true,
    }))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    const labels = wrapper.findAll('.static-page-summary-label').map((label) => label.text())
    expect(labels).toEqual(['Config ID', 'Auth Type', 'Username', 'Active'])
    expect(wrapper.text()).toContain('integration@rails.com')
    expect(wrapper.text()).toContain('Basic')
  })

  it('hides the edit icon for view-only users but keeps the summary and back action', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
    }
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(wrapper.get('h1').text()).toBe('Rails Prod')
    expect(wrapper.find('[data-testid="netsuite-auth-edit-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="back-netsuite-auth"]').exists()).toBe(true)
  })

  it('reports a config that is not in the active tenant instead of drawing an empty summary', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse({ companyUserGroupId: 'OTHER' }))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to find NetSuite auth config "auth-primary".')
    expect(wrapper.find('.static-page-summary-card').exists()).toBe(false)
  })

  it('shows the API error when the auth list fails to load', async () => {
    listNsAuthConfigs.mockRejectedValue(new ApiCallError('NetSuite settings are unavailable.', 500))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('NetSuite settings are unavailable.')
  })
})
