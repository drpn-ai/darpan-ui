import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'

const route = vi.hoisted(() => ({
  params: { nsAuthConfigId: 'auth-primary' } as Record<string, string>,
  fullPath: '/settings/netsuite/auth/auth-primary',
}))

const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const listNsRestletConfigs = vi.hoisted(() => vi.fn())
const deleteNsAuthConfig = vi.hoisted(() => vi.fn())
const testSourceConnection = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
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
  useRouter: () => ({ push }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    listNsAuthConfigs,
    listNsRestletConfigs,
    deleteNsAuthConfig,
    testSourceConnection,
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

function restletConfigsResponse(restletConfigs: Record<string, unknown>[]) {
  return {
    ok: true,
    messages: [],
    errors: [],
    restletConfigs,
    pagination: { pageIndex: 0, pageSize: 200, totalCount: restletConfigs.length, pageCount: 1 },
  }
}

function restlet(nsRestletConfigId: string, description: string, nsAuthConfigId: string, companyUserGroupId = 'KREWE') {
  return {
    nsRestletConfigId,
    description,
    companyUserGroupId,
    endpointUrl: 'https://1234.restlets.api.netsuite.com/app/site/hosting/restlet.nl',
    httpMethod: 'POST',
    nsAuthConfigId,
    connectTimeoutSeconds: 30,
    readTimeoutSeconds: 60,
    isActive: 'Y',
  }
}

describe('NetSuiteAuthDashboardPage', () => {
  beforeEach(() => {
    invalidateReadCache()
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.fullPath = '/settings/netsuite/auth/auth-primary'
    listNsAuthConfigs.mockReset()
    listNsRestletConfigs.mockReset()
    listNsRestletConfigs.mockResolvedValue(restletConfigsResponse([]))
    setWorkflowOrigin.mockReset()
    deleteNsAuthConfig.mockReset()
    testSourceConnection.mockReset()
    push.mockClear()
    vi.restoreAllMocks()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
    }
  })

  it('opens a read-only auth summary with endpoints, an edit icon, and a back action', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())
    listNsRestletConfigs.mockResolvedValue(restletConfigsResponse([
      restlet('invoice-export', 'Invoice Export', 'auth-primary'),
      restlet('other-auth-endpoint', 'Uses Another Profile', 'auth-other'),
      restlet('foreign-endpoint', 'Another Tenant', 'auth-primary', 'OTHER'),
    ]))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(listNsAuthConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect(listNsRestletConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
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
    // The short cards share the first row; the token URL takes a row of its own so it does not wrap.
    const cardElements = wrapper.findAll('.static-page-summary-card')
    expect(cardElements.map((card) => card.get('.static-page-summary-label').text())).toEqual([
      'Config ID', 'Auth Type', 'Scope', 'Active', 'Token URL',
    ])
    expect(cardElements.at(-1)?.classes()).toContain('static-page-summary-card--full')
    expect(readFileSync('src/style.css', 'utf8')).toMatch(/\.static-page-summary-card--full\s*\{\s*grid-column: 1 \/ -1;/)
    // The client ID is masked in the edit wizard; a read-only page must not print it in the clear.
    expect(wrapper.text()).not.toContain('secret-client-id')

    // Only this profile's RESTlet endpoints, in this tenant; each opens its edit wizard.
    const endpointTiles = wrapper.findAll('[data-testid="netsuite-endpoint-tile"]')
    expect(endpointTiles.map((tile) => tile.text())).toEqual(['Invoice Export'])
    expect(endpointTiles[0]?.attributes('data-to')).toContain('"name":"settings-netsuite-endpoints-edit"')
    expect(endpointTiles[0]?.attributes('data-to')).toContain('"nsRestletConfigId":"invoice-export"')
    const createEndpoint = wrapper.get('[data-testid="netsuite-endpoint-create-action"]')
    expect(createEndpoint.attributes('data-to')).toContain('"name":"settings-netsuite-endpoints-create"')
    expect(createEndpoint.attributes('data-to')).toContain('"query":{"nsAuthConfigId":"auth-primary"}')

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

    const footerOrder = [...wrapper.get('.settings-dashboard-footer-row').element.children].map((child) => child.getAttribute('data-testid'))
    expect(footerOrder).toEqual(['back-netsuite-auth', 'diagnose-netsuite-auth', 'delete-netsuite-auth'])
    expect(wrapper.get('[data-testid="delete-netsuite-auth"]').classes()).toContain('app-icon-action--danger')
  })

  it('runs diagnostics against the NETSUITE connector and shows the check rows', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: true,
      connectionOk: true,
      nextStage: null,
      checks: [{ key: 'credential', label: 'Credential readable', status: 'PASS' }],
    })

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="diagnose-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(testSourceConnection).toHaveBeenCalledWith(
      { systemEnumId: 'NETSUITE', configId: 'auth-primary', staged: true },
      expect.any(AbortSignal),
    )
    expect(wrapper.find('[data-testid="connection-diagnostics-popup"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Credential readable')
  })

  it('offers diagnostics only for OAuth2 profiles, which are the only ones the probe tests', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse({ authType: 'BASIC', username: 'u' }))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnose-netsuite-auth"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-netsuite-auth"]').exists()).toBe(true)
  })

  it('deletes after confirmation and returns to the NetSuite list', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())
    deleteNsAuthConfig.mockResolvedValue({ ok: true, messages: [], errors: [], deleted: true, deletedNsAuthConfigId: 'auth-primary' })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="delete-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('Delete NetSuite auth profile "Rails Prod"?')
    expect(deleteNsAuthConfig).toHaveBeenCalledWith({ nsAuthConfigId: 'auth-primary' })
    expect(push).toHaveBeenCalledWith('/settings/netsuite')
  })

  it('stays put and shows why when the profile is still in use', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())
    deleteNsAuthConfig.mockRejectedValue(new ApiCallError(
      "NS Auth config 'auth-primary' is still used by 1 RESTlet endpoint. Move them to another auth profile or delete them first.", 200))
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="delete-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('is still used by 1 RESTlet endpoint')
    expect(push).not.toHaveBeenCalled()
  })

  it('does nothing when the confirmation is declined', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse())
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="delete-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(deleteNsAuthConfig).not.toHaveBeenCalled()
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
    expect(wrapper.find('[data-testid="netsuite-endpoint-create-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="diagnose-netsuite-auth"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-netsuite-auth"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="back-netsuite-auth"]').exists()).toBe(true)
  })

  it('reports a config that is not in the active tenant instead of drawing an empty summary', async () => {
    listNsAuthConfigs.mockResolvedValue(authConfigsResponse({ companyUserGroupId: 'OTHER' }))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('NetSuite auth config "auth-primary" is hiding in a saved search.')
    expect(wrapper.find('.static-page-summary-card').exists()).toBe(false)
  })

  it('shows the API error when the auth list fails to load', async () => {
    listNsAuthConfigs.mockRejectedValue(new ApiCallError('NetSuite settings are unavailable.', 500))

    const wrapper = mount(NetSuiteAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('NetSuite settings are unavailable.')
  })
})
