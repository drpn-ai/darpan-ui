import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  fullPath: '/settings/hotwax',
}))

const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
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
    listOmsRestSourceConfigs,
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
    return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
  },
}

vi.mock('../../../stores/auth', () => ({
  useAuthStore: () => ({ ...authState, sessionInfo: authState.sessionInfo }),
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

import OmsRestSettingsPage from '../OmsRestSettingsPage.vue'

describe('OmsRestSettingsPage', () => {
  beforeEach(() => {
    listOmsRestSourceConfigs.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
    }
  })

  it('renders HotWax auth configs as saved-record tiles that open the auth dashboard', async () => {
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
          hasUsername: false,
          hasPassword: false,
          hasApiToken: true,
          customHeaderNames: ['X-Tenant'],
          connectTimeoutSeconds: 30,
          readTimeoutSeconds: 60,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSettingsPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.text()).toContain('HotWax')
    expect(wrapper.text()).toContain('Auth')
    expect(wrapper.text()).not.toContain('Endpoints')
    expect(wrapper.find('[data-testid="oms-endpoint-tile"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('REST Sources')
    expect(wrapper.findAll('[data-testid="oms-auth-tile"]')).toHaveLength(1)
    const tile = wrapper.get('[data-testid="oms-auth-tile"]')
    expect(tile.text()).toBe('Krewe HotWax')
    expect(tile.attributes('data-to')).toContain('"name":"settings-oms-auth"')
    expect(tile.attributes('data-to')).toContain('"omsRestSourceConfigId":"krewe-oms"')
    expect(wrapper.get('[data-testid="saved-oms-auth-configs"]').classes()).toContain('static-page-record-grid--fixed')
    expect(wrapper.get('[data-testid="oms-auth-create-action"]').attributes('data-to')).toContain(
      '"name":"settings-oms-create"',
    )
  })

  it('filters out HotWax configs from other tenants and hides create actions for view-only users', async () => {
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
          omsRestSourceConfigId: 'gorjana-oms',
          description: 'Gorjana HotWax',
          companyUserGroupId: 'GORJANA',
          baseUrl: 'https://gorjana.example.com',
          ordersPath: '/rest/s1/oms/orders',
          authType: 'NONE',
          isActive: 'Y',
        },
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
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 2, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSettingsPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="oms-auth-tile"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Krewe HotWax')
    expect(wrapper.text()).not.toContain('Gorjana HotWax')
    expect(wrapper.find('[data-testid="oms-auth-create-action"]').exists()).toBe(false)
  })
})
