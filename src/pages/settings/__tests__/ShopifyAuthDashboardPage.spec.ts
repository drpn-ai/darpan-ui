import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'

const route = vi.hoisted(() => ({
  params: { shopifyAuthConfigId: 'krewe-shopify' } as Record<string, string>,
  fullPath: '/settings/shopify/auth/krewe-shopify',
}))

const getShopifyAuthConfig = vi.hoisted(() => vi.fn())
const deleteShopifyAuthConfig = vi.hoisted(() => vi.fn())
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
    getShopifyAuthConfig,
    deleteShopifyAuthConfig,
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

import ShopifyAuthDashboardPage from '../ShopifyAuthDashboardPage.vue'

describe('ShopifyAuthDashboardPage', () => {
  beforeEach(() => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.fullPath = '/settings/shopify/auth/krewe-shopify'
    getShopifyAuthConfig.mockReset()
    deleteShopifyAuthConfig.mockReset()
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

  it('opens a Shopify auth dashboard with endpoint management and an edit icon', async () => {
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'krewe-shopify',
        description: 'Krewe Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(getShopifyAuthConfig).toHaveBeenCalledWith({ shopifyAuthConfigId: 'krewe-shopify' }, expect.any(AbortSignal))
    expect(wrapper.text()).toContain('Krewe Shopify')
    expect(wrapper.text()).toContain('Auth')
    expect(wrapper.text()).toContain('Endpoints')
    expect(wrapper.text()).toContain('https://hotwax-sandbox.myshopify.com')
    expect(wrapper.text()).toContain('America/Chicago')
    const authSummaryCards = wrapper.findAll('.static-page-summary-card').map((card) => card.text())
    expect(authSummaryCards.some((cardText) => cardText.includes('Orders'))).toBe(false)
    expect(authSummaryCards.some((cardText) => cardText.includes('Read Orders'))).toBe(false)
    const urlCard = wrapper.findAll('.static-page-summary-card').find((card) => card.text().includes('Shop/API URL'))
    expect(urlCard?.classes()).toContain('static-page-summary-card--wide')
    const styleSource = readFileSync('src/style.css', 'utf8')
    expect(styleSource).toMatch(/\.static-page-summary-card--wide\s*\{[^}]*grid-column: span 2;/)
    expect(styleSource).toMatch(/\.static-page-summary-card > span:not\(\.static-page-summary-label\)\s*\{[^}]*overflow-wrap: anywhere;/)
    expect(wrapper.get('[data-testid="shopify-endpoint-tile"]').text()).toContain('Admin GraphQL Orders')
    expect(wrapper.get('[data-testid="shopify-endpoint-tile"]').text()).toContain('POST /admin/api/2026-01/graphql.json')
    expect(wrapper.get('[data-testid="shopify-endpoint-tile"]').text()).toContain('OrderConnection')

    const editAction = wrapper.get('[data-testid="shopify-auth-edit-action"]')
    expect(editAction.classes()).toContain('app-icon-action')
    expect(editAction.attributes('aria-label')).toBe('Edit Shopify Config')
    expect(editAction.attributes('data-to')).toContain('"name":"settings-shopify-edit"')
    expect(editAction.attributes('data-to')).toContain('"shopifyAuthConfigId":"krewe-shopify"')

    const footerActions = wrapper.get('.static-page-actions')
    const deleteAction = wrapper.get('[data-testid="delete-shopify-auth"]')
    const backAction = wrapper.get('[data-testid="back-shopify-auth"]')

    expect(deleteAction.attributes('aria-label')).toBe('Delete Shopify config')
    expect(deleteAction.classes()).toContain('app-icon-action')
    expect(deleteAction.classes()).toContain('app-icon-action--large')
    expect(deleteAction.classes()).toContain('app-icon-action--danger')
    expect(deleteAction.element.closest('.static-page-actions')).toBe(footerActions.element)
    expect(deleteAction.element.closest('.static-page-board')).toBeNull()
    expect(backAction.attributes('aria-label')).toBe('Back to Shopify Settings')
    expect(backAction.classes()).toContain('app-icon-action')
    expect(backAction.classes()).toContain('app-icon-action--large')
    expect(backAction.attributes('data-to')).toBe('/settings/shopify')
    expect(backAction.element.closest('.static-page-actions')).toBe(footerActions.element)
    expect(backAction.element.closest('.static-page-board')).toBeNull()
    const footerActionRow = wrapper.get('.settings-dashboard-footer-row')
    expect([...footerActionRow.element.children].map((child) => child.getAttribute('data-testid'))).toEqual([
      'back-shopify-auth',
      'delete-shopify-auth',
    ])
  })

  it('deletes a Shopify config from the bottom trash action after confirmation', async () => {
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'krewe-shopify',
        description: 'Krewe Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })
    deleteShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Deleted Shopify config krewe-shopify.'],
      errors: [],
      deleted: true,
      deletedShopifyAuthConfigId: 'krewe-shopify',
    })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    await wrapper.get('[data-testid="delete-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(confirmSpy).toHaveBeenCalledWith('Delete Shopify config "Krewe Shopify"?')
    expect(deleteShopifyAuthConfig).toHaveBeenCalledWith({ shopifyAuthConfigId: 'krewe-shopify' })
    expect(push).toHaveBeenCalledWith('/settings/shopify')
  })

  it('shows no endpoint tiles when no Shopify endpoints are available', async () => {
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'krewe-shopify',
        description: 'Krewe Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        isActive: 'Y',
        canReadOrders: false,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shopify-endpoint-tile"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="shopify-endpoint-configs"]').text()).toContain('No available endpoints')
  })

  it('keeps the dashboard readable but hides the edit icon for view-only users', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
    }
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'krewe-shopify',
        description: 'Krewe Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://krewe.myshopify.com',
        apiVersion: '2026-01',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Krewe Shopify')
    expect(wrapper.find('[data-testid="shopify-auth-edit-action"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="delete-shopify-auth"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="back-shopify-auth"]').exists()).toBe(true)
  })
})
