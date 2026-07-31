import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({
  fullPath: '/settings/shopify',
}))

const listShopifyAuthConfigs = vi.hoisted(() => vi.fn())
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
    listShopifyAuthConfigs,
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

import ShopifySettingsPage from '../ShopifySettingsPage.vue'

describe('ShopifySettingsPage', () => {
  beforeEach(() => {
    listShopifyAuthConfigs.mockReset()
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: true,
      activeTenantUserGroupId: 'KREWE',
    }
  })

  it('renders Shopify auth configs as saved-record tiles that open the config dashboard', async () => {
    listShopifyAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfigs: [
        {
          shopifyAuthConfigId: 'krewe-shopify',
          description: 'Krewe Shopify',
          companyUserGroupId: 'KREWE',
          shopApiUrl: 'https://krewe.myshopify.com',
          apiVersion: '2026-01',
          isActive: 'Y',
          canReadOrders: true,
          hasAccessToken: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(ShopifySettingsPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.text()).toContain('Shopify')
    expect(wrapper.text()).toContain('Saved Configs')
    expect(wrapper.findAll('[data-testid="shopify-auth-tile"]')).toHaveLength(1)
    const tile = wrapper.get('[data-testid="shopify-auth-tile"]')
    expect(tile.text()).toBe('Krewe Shopify')
    expect(tile.attributes('data-to')).toContain('"name":"settings-shopify-auth"')
    expect(tile.attributes('data-to')).toContain('"shopifyAuthConfigId":"krewe-shopify"')
    expect(wrapper.get('[data-testid="shopify-create-action"]').attributes('data-to')).toContain(
      '"name":"settings-shopify-create"',
    )
  })

  it('keeps records visible but hides create affordances for view-only tenants', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
    }
    listShopifyAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfigs: [
        {
          shopifyAuthConfigId: 'krewe-shopify',
          description: 'Krewe Shopify',
          companyUserGroupId: 'KREWE',
          shopApiUrl: 'https://krewe.myshopify.com',
          apiVersion: '2026-01',
          isActive: 'Y',
          canReadOrders: true,
          hasAccessToken: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(ShopifySettingsPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="shopify-auth-tile"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="shopify-create-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shopify-empty-create-action"]').exists()).toBe(false)
  })

  it('filters out Shopify configs from other tenants', async () => {
    listShopifyAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfigs: [
        {
          shopifyAuthConfigId: 'gorjana-shopify',
          description: 'Gorjana Shopify',
          companyUserGroupId: 'GORJANA',
          shopApiUrl: 'https://gorjana.myshopify.com',
          apiVersion: '2026-01',
          isActive: 'Y',
          canReadOrders: true,
          hasAccessToken: true,
        },
        {
          shopifyAuthConfigId: 'krewe-shopify',
          description: 'Krewe Shopify',
          companyUserGroupId: 'KREWE',
          shopApiUrl: 'https://krewe.myshopify.com',
          apiVersion: '2026-01',
          isActive: 'Y',
          canReadOrders: true,
          hasAccessToken: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 12, totalCount: 2, pageCount: 1 },
    })

    const wrapper = mount(ShopifySettingsPage)
    await flushPromises()

    expect(wrapper.findAll('[data-testid="shopify-auth-tile"]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Krewe Shopify')
    expect(wrapper.text()).not.toContain('Gorjana Shopify')
  })
})
