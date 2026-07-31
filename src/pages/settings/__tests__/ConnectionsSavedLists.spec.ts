import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  fullPath: '/settings/netsuite',
}))

const listSftpServers = vi.hoisted(() => vi.fn())
const saveSftpServer = vi.hoisted(() => vi.fn())
const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const saveNsAuthConfig = vi.hoisted(() => vi.fn())
const listNsRestletConfigs = vi.hoisted(() => vi.fn())
const saveNsRestletConfig = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'john.doe',
    isSuperAdmin: false,
    canEditActiveTenantData: true,
    activeTenantUserGroupId: 'KREWE',
    availableTenants: [] as Array<{ userGroupId: string; label?: string }>,
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
    listSftpServers,
    saveSftpServer,
    listNsAuthConfigs,
    saveNsAuthConfig,
    listNsRestletConfigs,
    saveNsRestletConfig,
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

import NetSuiteSettingsPage from '../NetSuiteSettingsPage.vue'

describe('connections saved-name lists', () => {
  beforeEach(() => {
    route.fullPath = '/settings/netsuite'

    listSftpServers.mockReset()
    saveSftpServer.mockReset()
    listNsAuthConfigs.mockReset()
    saveNsAuthConfig.mockReset()
    listNsRestletConfigs.mockReset()
    saveNsRestletConfig.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
      availableTenants: [],
    }
  })

  it('renders the auth section as saved-record tiles that open the auth edit workflow', async () => {
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'BASIC',
          username: 'service-user',
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
    })
    listNsRestletConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      restletConfigs: [],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 0, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteSettingsPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.find('.settings-module-tile').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('connections // static_surface')
    expect(wrapper.text()).not.toContain('Saved records stay secondary until you need to reopen one.')
    expect(wrapper.text()).not.toContain('Save reusable NetSuite auth profiles')
    expect(wrapper.find('.sparse-table').exists()).toBe(false)
    expect(wrapper.findAll('.static-page-record-tile')).toHaveLength(1)
    expect(wrapper.text()).toContain('Auth')
    const tile = wrapper.get('[data-testid="netsuite-auth-tile"]')
    expect(tile.text()).toBe('Primary Auth')
    expect(wrapper.get('[data-testid="saved-auth-configs"]').classes()).toContain('static-page-record-grid--fixed')
    expect(tile.attributes('data-to')).toContain('"name":"settings-netsuite-auth-edit"')
    expect(tile.attributes('data-to')).toContain('"nsAuthConfigId":"auth-primary"')
    expect(wrapper.get('[data-testid="netsuite-auth-create-action"]').attributes('data-to')).toContain(
      '"name":"settings-netsuite-auth-create"',
    )
  })

  it('renders the endpoint section as saved-record tiles that open the endpoint edit workflow', async () => {
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'BASIC',
          username: 'service-user',
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
    })
    listNsRestletConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      restletConfigs: [
        {
          nsRestletConfigId: 'endpoint-primary',
          description: 'Invoice Export',
          companyUserGroupId: 'KREWE',
          endpointUrl: 'https://netsuite.example.com/restlet',
          httpMethod: 'POST',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 60,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteSettingsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Endpoints')
    const tile = wrapper.get('[data-testid="netsuite-endpoint-tile"]')
    expect(tile.text()).toBe('Invoice Export')
    expect(wrapper.text()).not.toContain('Configure NetSuite endpoint URLs')
    expect(wrapper.get('[data-testid="saved-endpoint-configs"]').classes()).toContain('static-page-record-grid--fixed')
    expect(tile.attributes('data-to')).toContain('"name":"settings-netsuite-endpoints-edit"')
    expect(tile.attributes('data-to')).toContain('"nsRestletConfigId":"endpoint-primary"')
    expect(wrapper.get('[data-testid="netsuite-endpoint-create-action"]').attributes('data-to')).toContain(
      '"name":"settings-netsuite-endpoints-create"',
    )
  })

  it('keeps NetSuite records visible but hides create affordances for view-only tenants', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
      availableTenants: [],
    }
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'BASIC',
          username: 'service-user',
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
    })
    listNsRestletConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      restletConfigs: [
        {
          nsRestletConfigId: 'endpoint-primary',
          description: 'Invoice Export',
          companyUserGroupId: 'KREWE',
          endpointUrl: 'https://netsuite.example.com/restlet',
          httpMethod: 'POST',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 60,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteSettingsPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="netsuite-auth-tile"]')).toHaveLength(1)
    expect(wrapper.findAll('[data-testid="netsuite-endpoint-tile"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="netsuite-auth-create-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="netsuite-endpoint-create-action"]').exists()).toBe(false)
  })

  it('filters out auth and endpoint tiles from other tenants without rendering tenant labels', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: true,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
      availableTenants: [
        { userGroupId: 'GORJANA', label: 'Gorjana' },
        { userGroupId: 'KREWE', label: 'Krewe' },
      ],
    }
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-gorjana',
          description: 'Gorjana Auth',
          companyUserGroupId: 'GORJANA',
          authType: 'BASIC',
          username: 'gorjana-user',
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
        {
          nsAuthConfigId: 'auth-krewe',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'BASIC',
          username: 'krewe-user',
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 2, pageCount: 1 },
    })
    listNsRestletConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      restletConfigs: [
        {
          nsRestletConfigId: 'endpoint-krewe',
          description: 'Invoice Export',
          companyUserGroupId: 'KREWE',
          endpointUrl: 'https://netsuite.example.com/restlet',
          httpMethod: 'POST',
          nsAuthConfigId: 'auth-krewe',
          authType: 'BASIC',
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 60,
          isActive: 'Y',
        },
        {
          nsRestletConfigId: 'endpoint-gorjana',
          description: 'Gorjana Endpoint',
          companyUserGroupId: 'GORJANA',
          endpointUrl: 'https://gorjana.example.com/restlet',
          httpMethod: 'POST',
          nsAuthConfigId: 'auth-gorjana',
          authType: 'BASIC',
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 60,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 10, totalCount: 2, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteSettingsPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="netsuite-auth-tile"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="netsuite-auth-tile"]').text()).toBe('Primary Auth')
    expect(wrapper.findAll('[data-testid="netsuite-endpoint-tile"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="netsuite-endpoint-tile"]').text()).toBe('Invoice Export')
    expect(wrapper.text()).not.toContain('Gorjana Auth')
    expect(wrapper.text()).not.toContain('Gorjana Endpoint')
    expect(wrapper.text()).not.toContain('Krewe')
  })
})
