import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../../lib/uiEvents'

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  name: 'settings-shopify-create',
  fullPath: '/settings/shopify/create',
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const getShopifyAuthConfig = vi.hoisted(() => vi.fn())
const saveShopifyAuthConfig = vi.hoisted(() => vi.fn())
const listConfigTenantAccess = vi.hoisted(() => vi.fn())
const grantConfigTenantAccess = vi.hoisted(() => vi.fn())
const revokeConfigTenantAccess = vi.hoisted(() => vi.fn())
const listSourceConfigEndpoints = vi.hoisted(() => vi.fn())
const storeSourceConfigEndpointAccess = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'john.doe',
    activeTenantUserGroupId: 'KREWE',
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    getShopifyAuthConfig,
    saveShopifyAuthConfig,
    listConfigTenantAccess,
    grantConfigTenantAccess,
    revokeConfigTenantAccess,
    listSourceConfigEndpoints,
    storeSourceConfigEndpointAccess,
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

import ShopifyAuthWorkflowPage from '../ShopifyAuthWorkflowPage.vue'

async function chooseAppSelectOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get('[data-testid="app-select-search"]').setValue(value)
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

describe('ShopifyAuthWorkflowPage', () => {
  beforeEach(() => {
    route.params = {}
    route.name = 'settings-shopify-create'
    route.fullPath = '/settings/shopify/create'
    push.mockReset()
    getShopifyAuthConfig.mockReset()
    saveShopifyAuthConfig.mockReset()
    listConfigTenantAccess.mockReset()
    grantConfigTenantAccess.mockReset()
    revokeConfigTenantAccess.mockReset()
    listSourceConfigEndpoints.mockReset()
    storeSourceConfigEndpointAccess.mockReset()
    // Default: just the Admin GraphQL Orders endpoint, enabled — mirrors the pre-registry
    // single-checkbox reality so every pre-existing test in this file (which never asserts on the
    // endpoint list itself) keeps seeing canReadOrders resolve to true, unmodified.
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [{ systemEnumId: 'SHOPIFY', endpointLabel: 'Admin GraphQL Orders', isEnabled: true }],
    })
    storeSourceConfigEndpointAccess.mockResolvedValue({ ok: true, messages: [], errors: [], stored: true })
    // Default: an unshared config (memberCount 1, no peers) — the common case, and the shape
    // that keeps every pre-existing test in this file on the unmodified save path.
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_SHOPIFY_AUTH',
        configId: 'dev_shopify',
        ownerTenantUserGroupId: 'KREWE',
        ownerTenantLabel: 'Krewe',
        memberTenantUserGroupIds: [],
        memberTenantLabels: [],
        memberCount: 1,
        canManage: true,
      },
    })
    authState.sessionInfo = {
      userId: 'john.doe',
      activeTenantUserGroupId: 'KREWE',
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }
  })

  it('returns to the selected Shopify config dashboard when canceling an edit', async () => {
    route.params = { shopifyAuthConfigId: 'dev_shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/dev_shopify'
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="cancel-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: 'settings-shopify-auth',
      params: { shopifyAuthConfigId: 'dev_shopify' },
    })
  })

  it('returns to the selected Shopify config dashboard when Escape aborts an edit', async () => {
    route.params = { shopifyAuthConfigId: 'dev_shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/dev_shopify'
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })
    document.dispatchEvent(cancelRequest)
    await flushPromises()
    wrapper.unmount()

    expect(cancelRequest.defaultPrevented).toBe(true)
    expect(push).toHaveBeenCalledWith({
      name: 'settings-shopify-auth',
      params: { shopifyAuthConfigId: 'dev_shopify' },
    })
  })

  it('saves a new Shopify auth config with the orders endpoint available by default', async () => {
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="shopApiUrl"]').setValue('https://krewe.myshopify.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="apiVersion"]').setValue('2026-01')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseAppSelectOption(wrapper, 'shopify-create-timezone-select', 'America/Chicago')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="accessToken"]').setValue('shpat_secret')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.find('input[name="canReadOrders"]').exists()).toBe(false)
    expect(wrapper.find('input[name="isActive"]').exists()).toBe(false)
    expect(wrapper.find('input[name="shopifyAuthConfigId"]').exists()).toBe(false)
    await wrapper.get('input[name="description"]').setValue('Krewe Shopify')
    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith({
      shopifyAuthConfigId: 'krewe_shopify',
      description: 'Krewe Shopify',
      shopApiUrl: 'https://krewe.myshopify.com',
      apiVersion: '2026-01',
      timeZone: 'America/Chicago',
      accessToken: 'shpat_secret',
      isActive: 'Y',
      canReadOrders: true,
    })
    expect(saveShopifyAuthConfig.mock.calls[0]?.[0]).not.toHaveProperty('endpointUrl')
    expect(push).toHaveBeenCalledWith('/settings/shopify')
  })

  it('loads an existing Shopify config with the token input blank for replacement only', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'
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
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    expect(getShopifyAuthConfig).toHaveBeenCalledWith({ shopifyAuthConfigId: 'krewe-shopify' }, expect.any(AbortSignal))
    expect(wrapper.get('input[name="shopifyAuthConfigId"]').element).toHaveProperty('value', 'krewe-shopify')
    expect(wrapper.get('[data-testid="shopify-timezone-select"]').text()).toContain('America/Chicago')
    expect(wrapper.find('input[name="timeZone"]').exists()).toBe(false)
    expect(wrapper.find('.workflow-form-grid--shopify-compact').exists()).toBe(true)
    expect(wrapper.get('input[name="apiVersion"]').classes()).toContain('shopify-inline-control')
    expect(wrapper.get('input[name="accessToken"]').element).toHaveProperty('value', '')
    expect(wrapper.get('input[name="accessToken"]').attributes('autocomplete')).toBe('off')
    const orderEndpointCheckbox = wrapper.get('[data-testid="endpoint-SHOPIFY"]')
    expect(orderEndpointCheckbox.attributes('name')).toBe('endpoint-SHOPIFY')
    expect((orderEndpointCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[data-testid="endpoint-access-block"]').text()).toContain('Admin GraphQL Orders')
    expect(wrapper.get('input[name="isActive"]').attributes('type')).toBe('checkbox')
    expect(wrapper.get('input[name="isActive"]').classes()).toContain('app-table__checkbox')
    expect((wrapper.get('input[name="isActive"]').element as HTMLInputElement).checked).toBe(true)
  })

  it('returns to the selected Shopify config dashboard after saving an edit', async () => {
    route.params = { shopifyAuthConfigId: 'dev_shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/dev_shopify'
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
      savedShopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith({
      shopifyAuthConfigId: 'dev_shopify',
      description: 'Dev Shopify',
      shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
      apiVersion: '2026-01',
      timeZone: 'America/Chicago',
      accessToken: '',
      isActive: 'Y',
      canReadOrders: true,
    })
    expect(push).toHaveBeenCalledWith({
      name: 'settings-shopify-auth',
      params: { shopifyAuthConfigId: 'dev_shopify' },
    })
  })

  it('normalizes legacy PST timezone values before saving an edit', async () => {
    route.params = { shopifyAuthConfigId: 'gorjana_uat' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/gorjana_uat'
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'gorjana_uat',
        description: 'Gorjana UAT',
        companyUserGroupId: 'GORJANA',
        shopApiUrl: 'https://gorjana-sandbox.myshopify.com',
        apiVersion: '2024-10',
        timeZone: 'PST',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
      savedShopifyAuthConfig: {
        shopifyAuthConfigId: 'gorjana_uat',
        description: 'Gorjana UAT',
        companyUserGroupId: 'GORJANA',
        shopApiUrl: 'https://gorjana-sandbox.myshopify.com',
        apiVersion: '2024-10',
        timeZone: 'America/Los_Angeles',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="shopify-timezone-select"]').text()).toContain('America/Los_Angeles')

    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      shopifyAuthConfigId: 'gorjana_uat',
      timeZone: 'America/Los_Angeles',
    }))
  })

  it('saves disabled Shopify endpoint availability from the edit workflow', async () => {
    route.params = { shopifyAuthConfigId: 'dev_shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/dev_shopify'
    getShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      shopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
      savedShopifyAuthConfig: {
        shopifyAuthConfigId: 'dev_shopify',
        description: 'Dev Shopify',
        companyUserGroupId: 'KREWE',
        shopApiUrl: 'https://hotwax-sandbox.myshopify.com',
        apiVersion: '2026-01',
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: false,
        hasAccessToken: true,
      },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="endpoint-SHOPIFY"]').setValue(false)
    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      shopifyAuthConfigId: 'dev_shopify',
      canReadOrders: false,
    }))
    expect(storeSourceConfigEndpointAccess).toHaveBeenCalledWith({
      configTypeEnumId: 'SCFG_SHOPIFY_AUTH',
      configId: 'dev_shopify',
      enabledSystemEnumIds: [],
    })
  })

  it('derives a capped config ID from the create label', async () => {
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="shopApiUrl"]').setValue('https://krewe.myshopify.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="apiVersion"]').setValue('2026-01')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseAppSelectOption(wrapper, 'shopify-create-timezone-select', 'America/Chicago')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="accessToken"]').setValue('shpat_secret')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Long Shopify Config Name')
    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      shopifyAuthConfigId: 'long_shopify_config',
      description: 'Long Shopify Config Name',
      timeZone: 'America/Chicago',
      isActive: 'Y',
    }))
  })

  it('enforces the shared 20 character config-id cap on edit', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'
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

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    const idInput = wrapper.get('input[name="shopifyAuthConfigId"]')
    expect(idInput.attributes('maxlength')).toBe('20')

    await idInput.setValue('a'.repeat(21))
    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Shopify Config ID must be 20 characters or fewer.')
  })

  // DAR-BE-005 Task 12 — the affects-N-tenants save gate. sharedEditWarning() returns null for an
  // unshared config (memberCount <= 1, the beforeEach default), so this is the "byte-identical to
  // today" case: no warning renders and Save works exactly as it did before this feature existed.
  it('saves an unshared config with no confirmation step (byte-identical save path)', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'
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
    saveShopifyAuthConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-edit-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledTimes(1)
  })

  // The affects-N-tenants warning and its confirm checkbox were removed with the chip field
  // group: the tenant list is now rendered inside the form, so the sentence restated what the
  // chips already show. This pins the removal -- absence alone would let it silently return.
  it('saves a shared config with no warning and no acknowledgment step', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'
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
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_SHOPIFY_AUTH',
        configId: 'krewe-shopify',
        ownerTenantUserGroupId: 'KREWE',
        ownerTenantLabel: 'Krewe',
        memberTenantUserGroupIds: ['GORJANA'],
        memberTenantLabels: [{ tenantUserGroupId: 'GORJANA', label: 'Gorjana' }],
        memberCount: 2,
        canManage: true,
      },
    })
    saveShopifyAuthConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-edit-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shared-edit-confirm"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="save-shopify-auth"]').attributes('disabled')).toBeUndefined()

    // Shared with is a field group inside the form, above the divider and the actions --
    // not a panel appended after the form's terminal Save/Cancel row.
    const html = wrapper.html()
    expect(html).toContain('Shared with')
    expect(html.indexOf('Shared with')).toBeLessThan(html.indexOf('save-shopify-auth'))
    // Credentials sit above capability: identity -> connection -> credentials -> capability -> access.
    expect(html.indexOf('leave blank to keep existing')).toBeLessThan(html.indexOf('endpoint-access-block'))

    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledTimes(1)
  })

  // Renders the REAL EndpointAccessPanel inside the REAL page and asserts the actual save
  // payload, not an isolated mock of the panel's shape — a field-shape bug here (e.g. `.enumId`
  // vs `.value`) would pass a panel-only unit test but silently corrupt what gets persisted.
  it('renders every registered endpoint and saves the ticked set', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'
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
        timeZone: 'America/Chicago',
        isActive: 'Y',
        hasAccessToken: true,
      },
    })
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [
        { systemEnumId: 'SHOPIFY', endpointLabel: 'Admin GraphQL Orders', isEnabled: true },
        { systemEnumId: 'SHOPIFY_RETURN_REFS', endpointLabel: 'Shopify Return References', isEnabled: false },
      ],
    })
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
      savedShopifyAuthConfig: { shopifyAuthConfigId: 'krewe-shopify' },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    // Proves the panel is actually wired to THIS config, not just rendered — reading a literal out
    // of save() would satisfy the assertions below without ever threading configType/configId
    // through the panel's own props (e.g. a copy-paste leaving :config-type="hotwaxOms" here would
    // still pass every assertion after this one).
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith(
      expect.objectContaining({ configTypeEnumId: 'SCFG_SHOPIFY_AUTH', configId: 'krewe-shopify' }),
      expect.anything(),
    )
    expect(wrapper.find('input[data-testid="endpoint-SHOPIFY_RETURN_REFS"]').exists()).toBe(true)

    await wrapper.find('input[data-testid="endpoint-SHOPIFY_RETURN_REFS"]').setValue(true)
    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      shopifyAuthConfigId: 'krewe-shopify',
      canReadOrders: true,
    }))
    expect(storeSourceConfigEndpointAccess).toHaveBeenCalledWith({
      configTypeEnumId: 'SCFG_SHOPIFY_AUTH',
      configId: 'krewe-shopify',
      enabledSystemEnumIds: ['SHOPIFY', 'SHOPIFY_RETURN_REFS'],
    })
  })

  // Fix round 1, CRITICAL: before this fix, applyRecord() reset enabledEndpoints to [] and nothing
  // gated the follow-up write on the panel's own load outcome, so a failed GET silently disabled
  // every endpoint for the config (and flipped the legacy canReadOrders gate off in the same
  // stroke). Mirrors the OMS-page regression test verified failing against the pre-fix code
  // (b04b64f) in a scratch worktree.
  it('does not touch endpoint access, and preserves the loaded canReadOrders, when the endpoint read fails', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'
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
        timeZone: 'America/Chicago',
        isActive: 'Y',
        canReadOrders: true,
        hasAccessToken: true,
      },
    })
    listSourceConfigEndpoints.mockRejectedValue(new Error('network down'))
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
      savedShopifyAuthConfig: { shopifyAuthConfigId: 'krewe-shopify' },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="description"]').setValue('Krewe Shopify (renamed)')
    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      canReadOrders: true,
    }))
    expect(storeSourceConfigEndpointAccess).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('endpoint access could not be verified')
    // Stayed on the edit page rather than navigating away as if the whole save succeeded.
    expect(push).not.toHaveBeenCalled()
  })

  // Task 15 fix, CRITICAL: applyRecord() used to unconditionally reset form.enabledEndpoints to []
  // and endpointsLoadState to 'loading', racing EndpointAccessPanel's own seed/ready emission. The
  // panel fetches independently of the config fetch, so whichever resolved LAST won. Verified live on
  // gorjana_prod: this page's CONFIG fetch resolved after its ENDPOINTS fetch, so applyRecord()'s
  // reset clobbered the panel's already-correct seed -- every checkbox rendered unticked even though
  // the database had zero override rows (absent rows = enabled). This test reproduces that exact
  // ordering by holding the config fetch open with a deferred promise until after the (resolved)
  // endpoints fetch has already settled and seeded the form.
  it('keeps the endpoint seed when the config fetch resolves after the endpoints fetch', async () => {
    route.params = { shopifyAuthConfigId: 'krewe-shopify' }
    route.name = 'settings-shopify-edit'
    route.fullPath = '/settings/shopify/edit/krewe-shopify'

    let resolveConfigFetch!: (value: unknown) => void
    getShopifyAuthConfig.mockReturnValue(
      new Promise((resolve) => {
        resolveConfigFetch = resolve
      }),
    )
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [
        { systemEnumId: 'SHOPIFY', endpointLabel: 'Admin GraphQL Orders', isEnabled: true },
        { systemEnumId: 'SHOPIFY_RETURN_REFS', endpointLabel: 'Shopify Return References', isEnabled: true },
      ],
    })
    saveShopifyAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved Shopify auth config.'],
      errors: [],
      savedShopifyAuthConfig: { shopifyAuthConfigId: 'krewe-shopify' },
    })

    const wrapper = mount(ShopifyAuthWorkflowPage)
    // Let the endpoints fetch (already resolved) settle and seed the form BEFORE the config fetch
    // resolves -- this is the ordering that broke on gorjana_prod.
    await flushPromises()
    expect((wrapper.get('[data-testid="endpoint-SHOPIFY"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-testid="endpoint-SHOPIFY_RETURN_REFS"]').element as HTMLInputElement).checked).toBe(true)

    resolveConfigFetch({
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
    })
    await flushPromises()

    // The config fetch resolving after the endpoints fetch must not wipe the already-seeded set.
    expect((wrapper.get('[data-testid="endpoint-SHOPIFY"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-testid="endpoint-SHOPIFY_RETURN_REFS"]').element as HTMLInputElement).checked).toBe(true)

    await wrapper.get('[data-testid="save-shopify-auth"]').trigger('click')
    await flushPromises()

    expect(saveShopifyAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      canReadOrders: true,
    }))
    expect(storeSourceConfigEndpointAccess).toHaveBeenCalledWith({
      configTypeEnumId: 'SCFG_SHOPIFY_AUTH',
      configId: 'krewe-shopify',
      enabledSystemEnumIds: ['SHOPIFY', 'SHOPIFY_RETURN_REFS'],
    })
  })
})
