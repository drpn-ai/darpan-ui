import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'

const route = vi.hoisted(() => ({
  params: { shopifyAuthConfigId: 'krewe-shopify' } as Record<string, string>,
  fullPath: '/settings/shopify/auth/krewe-shopify',
}))

const getShopifyAuthConfig = vi.hoisted(() => vi.fn())
const deleteShopifyAuthConfig = vi.hoisted(() => vi.fn())
const testSourceConnection = vi.hoisted(() => vi.fn())
const listSourceConfigEndpoints = vi.hoisted(() => vi.fn())
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
    testSourceConnection,
    listSourceConfigEndpoints,
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

import { ApiCallError } from '../../../lib/api/client'
import ShopifyAuthDashboardPage from '../ShopifyAuthDashboardPage.vue'

function dashboardConfigResponse() {
  return {
    ok: true,
    messages: [],
    errors: [],
    shopifyAuthConfig: {
      shopifyAuthConfigId: 'krewe-shopify',
      description: 'Krewe Shopify',
      companyUserGroupId: 'KREWE',
      shopApiUrl: 'https://krewe.myshopify.com',
      apiVersion: '2026-01',
      timeZone: 'America/Chicago',
      isActive: 'Y',
      canReadOrders: true,
      hasAccessToken: true,
    },
  }
}

describe('ShopifyAuthDashboardPage', () => {
  beforeEach(() => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.fullPath = '/settings/shopify/auth/krewe-shopify'
    getShopifyAuthConfig.mockReset()
    deleteShopifyAuthConfig.mockReset()
    testSourceConnection.mockReset()
    listSourceConfigEndpoints.mockReset()
    // Safety-net default so tests unrelated to the Endpoints section don't have to stub this call;
    // tests that assert on endpoint tiles override it explicitly.
    listSourceConfigEndpoints.mockResolvedValue({ ok: true, messages: [], errors: [], endpoints: [] })
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
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [{ systemEnumId: 'SHOPIFY_ORDERS', endpointLabel: 'Admin GraphQL Orders', isEnabled: true }],
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(getShopifyAuthConfig).toHaveBeenCalledWith({ shopifyAuthConfigId: 'krewe-shopify' }, expect.any(AbortSignal))
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith(
      { configTypeEnumId: 'SCFG_SHOPIFY_AUTH', configId: 'krewe-shopify' },
      expect.any(AbortSignal),
    )
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
    // The registry only supplies a label (no method/path/response-schema) -- the tile shows
    // exactly that, not a fabricated meta line built from data the registry doesn't provide.
    expect(wrapper.get('[data-testid="shopify-endpoint-tile"]').text()).toBe('Admin GraphQL Orders')

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
      'diagnose-shopify-auth',
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

  it('shows no endpoint tiles when no Shopify endpoints are enabled', async () => {
    // Gating now comes entirely from the registry's per-endpoint isEnabled flag, not the legacy
    // canReadOrders column -- a disabled registry row is what drives the empty state.
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
        hasAccessToken: true,
      },
    })
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [{ systemEnumId: 'SHOPIFY_ORDERS', endpointLabel: 'Admin GraphQL Orders', isEnabled: false }],
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shopify-endpoint-tile"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="shopify-endpoint-configs"]').text()).toContain('No available endpoints')
  })

  it('shows a loading note for endpoints while the registry fetch is in flight, not an empty state', async () => {
    // A read-only surface that shows "No available endpoints" before the fetch has even resolved
    // would tell an operator the config can do nothing -- a confident wrong answer. It must show
    // nothing-yet instead.
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
        hasAccessToken: true,
      },
    })
    let resolveEndpoints: ((value: unknown) => void) | undefined
    listSourceConfigEndpoints.mockReturnValue(new Promise((resolve) => { resolveEndpoints = resolve }))

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Loading endpoints')
    expect(wrapper.find('[data-testid="shopify-endpoint-tile"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shopify-endpoint-configs"]').exists()).toBe(false)

    resolveEndpoints?.({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [{ systemEnumId: 'SHOPIFY_ORDERS', endpointLabel: 'Admin GraphQL Orders', isEnabled: true }],
    })
    await flushPromises()

    expect(wrapper.text()).not.toContain('Loading endpoints')
    expect(wrapper.get('[data-testid="shopify-endpoint-tile"]').text()).toBe('Admin GraphQL Orders')
  })

  it('shows an error instead of a false empty state when the endpoint registry fetch fails', async () => {
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
        hasAccessToken: true,
      },
    })
    listSourceConfigEndpoints.mockRejectedValue(new ApiCallError('Unable to reach the endpoint registry.', 500))

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Unable to reach the endpoint registry.')
    expect(wrapper.find('[data-testid="shopify-endpoint-tile"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shopify-endpoint-configs"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('No available endpoints')
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
  it('runs connection diagnostics from the footer and renders the check rows', async () => {
    getShopifyAuthConfig.mockResolvedValue(dashboardConfigResponse())
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: true,
      connectionOk: true,
      nextStage: null,
      durationMillis: 496,
      checks: [
        { key: 'credential', label: 'Credential readable', status: 'PASS' },
        { key: 'reachable', label: 'Shop reachable', status: 'PASS', durationMillis: 84 },
        { key: 'apiVersion', label: 'API version supported', status: 'PASS', detail: '2026-01' },
        { key: 'ordersRead', label: 'Orders readable', status: 'PASS', durationMillis: 412 },
      ],
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="connection-diagnostics-popup"]').exists()).toBe(false)

    await wrapper.get('[data-testid="diagnose-shopify-auth"]').trigger('click')
    await flushPromises()

    // Staged run: the first call opts in, and this response ends the walk (nextStage null).
    expect(testSourceConnection).toHaveBeenCalledWith(
      { systemEnumId: 'SHOPIFY', configId: 'krewe-shopify', staged: true },
      expect.any(AbortSignal),
    )
    expect(wrapper.find('[data-testid="connection-diagnostics-popup"]').exists()).toBe(true)
    expect(wrapper.findAll('[data-testid="connection-diagnostics-check"]')).toHaveLength(4)
    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is valid.')
  })

  it('renders a failed connection as check rows rather than throwing away the result', async () => {
    // The backend reports a bad credential as a SUCCESSFUL call with connectionOk false, because
    // the client throws on ok:false — a regression there would lose the failure rows entirely.
    getShopifyAuthConfig.mockResolvedValue(dashboardConfigResponse())
    testSourceConnection.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      available: true,
      connectionOk: false,
      nextStage: null,
      checks: [
        { key: 'credential', label: 'Credential readable', status: 'PASS' },
        { key: 'reachable', label: 'Shop reachable', status: 'FAIL', detail: 'The access token was rejected (HTTP 401).' },
        { key: 'apiVersion', label: 'API version supported', status: 'SKIP', detail: 'Not attempted.' },
        { key: 'ordersRead', label: 'Orders readable', status: 'SKIP', detail: 'Not attempted.' },
      ],
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="diagnose-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="connection-diagnostics-verdict"]').text()).toBe('Connection is not usable.')
    expect(wrapper.text()).toContain('The access token was rejected (HTTP 401).')
  })

  it('surfaces a diagnostics service failure instead of hanging on the spinner', async () => {
    getShopifyAuthConfig.mockResolvedValue(dashboardConfigResponse())
    testSourceConnection.mockRejectedValue(new ApiCallError('Your active tenant is read-only for this action.', 200))

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()
    await wrapper.get('[data-testid="diagnose-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="connection-diagnostics-running"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Your active tenant is read-only for this action.')
  })

  it('hides the diagnostics action from a read-only tenant', async () => {
    authState.sessionInfo = {
      userId: 'john.doe',
      isSuperAdmin: false,
      canEditActiveTenantData: false,
      activeTenantUserGroupId: 'KREWE',
    }
    getShopifyAuthConfig.mockResolvedValue(dashboardConfigResponse())

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="diagnose-shopify-auth"]').exists()).toBe(false)
  })
  it('blurs the page behind the popup, matching every other popup in the app', async () => {
    // The app never dims behind a popup — it blurs and fades the page itself via
    // *--popup-open (style.css). A bespoke scrim here would make this popup the odd one out.
    getShopifyAuthConfig.mockResolvedValue(dashboardConfigResponse())
    testSourceConnection.mockResolvedValue({
      ok: true, messages: [], errors: [], available: true, connectionOk: true, nextStage: null,
      checks: [{ key: 'credential', label: 'Credential readable', status: 'PASS' }],
    })

    const wrapper = mount(ShopifyAuthDashboardPage)
    await flushPromises()
    expect(wrapper.find('.static-page-frame--popup-open').exists()).toBe(false)

    await wrapper.get('[data-testid="diagnose-shopify-auth"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('.static-page-frame--popup-open').exists()).toBe(true)
  })
})
