import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { WORKFLOW_CANCEL_REQUEST_EVENT } from '../../../lib/uiEvents'

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  name: 'settings-oms-create',
  fullPath: '/settings/hotwax/create',
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const saveOmsRestSourceConfig = vi.hoisted(() => vi.fn())
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
    listOmsRestSourceConfigs,
    saveOmsRestSourceConfig,
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

import OmsRestSourceWorkflowPage from '../OmsRestSourceWorkflowPage.vue'

async function chooseAppSelectOption(
  wrapper: ReturnType<typeof mount>,
  testId: string,
  value: string,
): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await wrapper.get('[data-testid="app-select-search"]').setValue(value)
  await wrapper.get(`[data-testid="app-select-option"][data-option-value="${value}"]`).trigger('click')
}

describe('OmsRestSourceWorkflowPage', () => {
  beforeEach(() => {
    route.params = {}
    route.name = 'settings-oms-create'
    route.fullPath = '/settings/hotwax/create'
    push.mockReset()
    listOmsRestSourceConfigs.mockReset()
    saveOmsRestSourceConfig.mockReset()
    listConfigTenantAccess.mockReset()
    grantConfigTenantAccess.mockReset()
    revokeConfigTenantAccess.mockReset()
    listSourceConfigEndpoints.mockReset()
    storeSourceConfigEndpointAccess.mockReset()
    // Default: just the Orders endpoint, enabled — mirrors the pre-registry single-checkbox
    // reality so every pre-existing test in this file (which never asserts on the endpoint list
    // itself) keeps seeing canReadOrders resolve to true, unmodified.
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [{ systemEnumId: 'OMS', endpointLabel: 'Orders API', isEnabled: true }],
    })
    storeSourceConfigEndpointAccess.mockResolvedValue({ ok: true, messages: [], errors: [], stored: true })
    // Default: an unshared config (memberCount 1, no peers) — the common case, and the shape
    // that keeps every pre-existing test in this file on the unmodified save path.
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_HOTWAX_OMS',
        configId: 'dev_oms',
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

  it('returns to the selected HotWax source dashboard when canceling an edit', async () => {
    route.params = { omsRestSourceConfigId: 'dev_oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/dev_oms'
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'dev_oms',
          description: 'Dev HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          timeZone: 'America/Chicago',
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="cancel-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(push).toHaveBeenCalledWith({
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: 'dev_oms' },
    })
  })

  it('returns to the selected HotWax source dashboard when Escape aborts an edit', async () => {
    route.params = { omsRestSourceConfigId: 'dev_oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/dev_oms'
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'dev_oms',
          description: 'Dev HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          timeZone: 'America/Chicago',
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })
    document.dispatchEvent(cancelRequest)
    await flushPromises()
    wrapper.unmount()

    expect(cancelRequest.defaultPrevented).toBe(true)
    expect(push).toHaveBeenCalledWith({
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: 'dev_oms' },
    })
  })

  it('saves a new HotWax source config with Swagger API key auth and orders endpoint available by default', async () => {
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="baseUrl"]').setValue('https://oms.example.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await chooseAppSelectOption(wrapper, 'oms-create-timezone-select', 'America/Chicago')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="oms-auth-type-choice-API_KEY"]').trigger('click')
    await wrapper.get('input[name="apiToken"]').setValue('oms-api-key')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Krewe HotWax')
    expect(wrapper.find('input[name="omsRestSourceConfigId"]').exists()).toBe(false)
    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith({
      omsRestSourceConfigId: 'krewe_hotwax',
      description: 'Krewe HotWax',
      baseUrl: 'https://oms.example.com',
      timeZone: 'America/Chicago',
      authType: 'API_KEY',
      username: '',
      password: '',
      apiToken: 'oms-api-key',
      headersJson: '',
      connectTimeoutSeconds: 30,
      readTimeoutSeconds: 60,
      isActive: true,
      canReadOrders: true,
    })
    expect(push).toHaveBeenCalledWith('/settings/hotwax')
  })

  it('renders HotWax auth type with Darpan shortcut choice cards in create flow', async () => {
    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="baseUrl"]').setValue('https://oms.example.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.get('[data-testid="oms-create-timezone-select"]').text()).toContain('UTC')
    expect(wrapper.text()).toContain('Which timezone should Darpan use for HotWax date windows?')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    const authChoiceCards = wrapper.findAll('.workflow-shortcut-choice-card')

    expect(wrapper.text()).not.toContain('Orders Path')
    expect(authChoiceCards).toHaveLength(4)
    expect(wrapper.get('[data-testid="oms-auth-type-choice-NONE"]').text()).toContain('A')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-NONE"]').text()).toContain('None')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-BASIC"]').text()).toContain('B')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-BASIC"]').text()).toContain('Basic')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-BEARER"]').text()).toContain('C')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-BEARER"]').text()).toContain('Bearer')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-API_KEY"]').text()).toContain('D')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-API_KEY"]').text()).toContain('API Key')
    expect(wrapper.get('[data-testid="oms-auth-type-choice-NONE"]').classes()).toContain('workflow-shortcut-choice-card--active')
    expect(wrapper.find('input[type="radio"]').exists()).toBe(false)
    expect(wrapper.find('.workflow-choice-option--filter').exists()).toBe(false)
    expect(wrapper.find('[data-testid="workflow-select-option"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="wizard-next"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('press Enter')

    await wrapper.get('[data-testid="oms-auth-type-choice-API_KEY"]').trigger('click')

    expect(wrapper.find('input[name="apiToken"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('What API key should Darpan use?')
    expect(wrapper.find('input[name="username"]').exists()).toBe(false)
    expect(wrapper.find('input[name="password"]').exists()).toBe(false)
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.text()).not.toContain('Active')
    expect(wrapper.find('[data-testid="oms-is-active"]').exists()).toBe(false)
  })

  it('loads an existing basic HotWax config with only basic secret fields visible', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'BASIC',
          hasUsername: true,
          hasPassword: true,
          hasApiToken: false,
          customHeaderNames: ['X-Tenant'],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          timeZone: 'America/Chicago',
          isActive: 'Y',
          canReadOrders: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    expect(wrapper.get('input[name="omsRestSourceConfigId"]').element).toHaveProperty('value', 'krewe-oms')
    expect(wrapper.get('input[name="username"]').element).toHaveProperty('value', '')
    expect(wrapper.get('input[name="password"]').element).toHaveProperty('value', '')
    expect(wrapper.get('input[name="password"]').attributes('autocomplete')).toBe('off')
    expect(wrapper.find('.workflow-form-grid--hotwax-auth').exists()).toBe(true)
    expect(wrapper.get('[data-testid="oms-timezone-select"]').text()).toContain('America/Chicago')
    const ordersEndpointCheckbox = wrapper.get('[data-testid="endpoint-OMS"]')
    expect(ordersEndpointCheckbox.attributes('name')).toBe('endpoint-OMS')
    expect((ordersEndpointCheckbox.element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.get('[data-testid="endpoint-access-block"]').text()).toContain('Orders API')
    expect(wrapper.find('input[name="apiToken"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="oms-is-active"]').exists()).toBe(true)
    expect(wrapper.get('input[name="isActive"]').attributes('type')).toBe('checkbox')
    expect(wrapper.get('input[name="isActive"]').classes()).toContain('app-table__checkbox')
    expect((wrapper.get('input[name="isActive"]').element as HTMLInputElement).checked).toBe(true)
    expect(wrapper.text()).not.toContain('Orders Path')
    expect(wrapper.text()).not.toContain('Headers JSON')
    expect(wrapper.text()).not.toContain('Connect Timeout')
    expect(wrapper.text()).not.toContain('Read Timeout')
    expect(wrapper.find('textarea[name="headersJson"]').exists()).toBe(false)
    expect(wrapper.find('input[name="connectTimeoutSeconds"]').exists()).toBe(false)
    expect(wrapper.find('input[name="readTimeoutSeconds"]').exists()).toBe(false)
  })

  it('loads an existing bearer HotWax config with only token replacement visible', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'BEARER',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: true,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
          canReadOrders: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    expect(wrapper.get('input[name="apiToken"]').element).toHaveProperty('value', '')
    expect(wrapper.find('input[name="username"]').exists()).toBe(false)
    expect(wrapper.find('input[name="password"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Orders Path')
  })

  it('returns to the selected HotWax source dashboard after saving an edit', async () => {
    route.params = { omsRestSourceConfigId: 'dev_oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/dev_oms'
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'dev_oms',
          description: 'Dev HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          timeZone: 'America/Chicago',
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
      savedOmsRestSourceConfig: {
        omsRestSourceConfigId: 'dev_oms',
        description: 'Dev HotWax',
        companyUserGroupId: 'KREWE',
        baseUrl: 'https://oms.example.com',
        ordersPath: '/rest/s1/oms/orders',
        authType: 'NONE',
        connectTimeoutSeconds: 10,
        readTimeoutSeconds: 20,
        timeZone: 'America/Chicago',
        isActive: 'Y',
      },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith({
      omsRestSourceConfigId: 'dev_oms',
      description: 'Dev HotWax',
      baseUrl: 'https://oms.example.com',
      timeZone: 'America/Chicago',
      authType: 'NONE',
      username: '',
      password: '',
      apiToken: '',
      headersJson: '',
      connectTimeoutSeconds: 10,
      readTimeoutSeconds: 20,
      isActive: true,
      canReadOrders: true,
    })
    expect(push).toHaveBeenCalledWith({
      name: 'settings-oms-auth',
      params: { omsRestSourceConfigId: 'dev_oms' },
    })
  })

  it('saves disabled HotWax endpoint availability from the edit workflow', async () => {
    route.params = { omsRestSourceConfigId: 'dev_oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/dev_oms'
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'dev_oms',
          description: 'Dev HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
          canReadOrders: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
      savedOmsRestSourceConfig: {
        omsRestSourceConfigId: 'dev_oms',
        description: 'Dev HotWax',
        companyUserGroupId: 'KREWE',
        baseUrl: 'https://oms.example.com',
        ordersPath: '/rest/s1/oms/orders',
        authType: 'NONE',
        connectTimeoutSeconds: 10,
        readTimeoutSeconds: 20,
        isActive: 'Y',
        canReadOrders: false,
      },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="endpoint-OMS"]').setValue(false)
    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith(expect.objectContaining({
      omsRestSourceConfigId: 'dev_oms',
      canReadOrders: false,
    }))
    expect(storeSourceConfigEndpointAccess).toHaveBeenCalledWith({
      configTypeEnumId: 'SCFG_HOTWAX_OMS',
      configId: 'dev_oms',
      enabledSystemEnumIds: [],
    })
  })

  it('derives a capped config ID from the create label', async () => {
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="baseUrl"]').setValue('https://oms.example.com')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="oms-auth-type-choice-NONE"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Long HotWax Source Name')
    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith(expect.objectContaining({
      omsRestSourceConfigId: 'long_hotwax_source_n',
      description: 'Long HotWax Source Name',
      isActive: true,
    }))
  })

  it('enforces the shared 20 character config-id cap on edit', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    const idInput = wrapper.get('input[name="omsRestSourceConfigId"]')
    expect(idInput.attributes('maxlength')).toBe('20')

    await idInput.setValue('b'.repeat(21))
    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('HotWax Config ID must be 20 characters or fewer.')
  })

  // DAR-BE-005 Task 12 — the affects-N-tenants save gate. sharedEditWarning() returns null for an
  // unshared config (memberCount <= 1, the beforeEach default), so this is the "byte-identical to
  // today" case: no warning renders and Save works exactly as it did before this feature existed.
  it('saves an unshared config with no confirmation step (byte-identical save path)', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveOmsRestSourceConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-edit-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledTimes(1)
  })

  // The affects-N-tenants warning and its confirm checkbox were removed with the chip field
  // group: the tenant list is now rendered inside the form, so the sentence restated what the
  // chips already show. This pins the removal -- absence alone would let it silently return.
  it('saves a shared config with no warning and no acknowledgment step', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'BEARER',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_HOTWAX_OMS',
        configId: 'krewe-oms',
        ownerTenantUserGroupId: 'KREWE',
        ownerTenantLabel: 'Krewe',
        memberTenantUserGroupIds: ['GORJANA'],
        memberTenantLabels: [{ tenantUserGroupId: 'GORJANA', label: 'Gorjana' }],
        memberCount: 2,
        canManage: true,
      },
    })
    saveOmsRestSourceConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-edit-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="shared-edit-confirm"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="save-oms-rest-source"]').attributes('disabled')).toBeUndefined()

    // Shared with is a field group inside the form, above the divider and the actions --
    // not a panel appended after the form's terminal Save/Cancel row.
    const html = wrapper.html()
    expect(html).toContain('Shared with')
    expect(html.indexOf('Shared with')).toBeLessThan(html.indexOf('save-oms-rest-source'))
    // Credentials sit above capability: identity -> connection -> credentials -> capability -> access.
    expect(html.indexOf('leave blank to keep existing')).toBeLessThan(html.indexOf('endpoint-access-block'))

    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledTimes(1)
  })

  // Renders the REAL EndpointAccessPanel inside the REAL page and asserts the actual save
  // payload, not an isolated mock of the panel's shape — a field-shape bug here (e.g. `.enumId`
  // vs `.value`) would pass a panel-only unit test but silently corrupt what gets persisted.
  it('renders every registered endpoint and saves the ticked set', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [
        { systemEnumId: 'OMS', endpointLabel: 'Orders API', isEnabled: true },
        { systemEnumId: 'OMS_RETURNS', endpointLabel: 'Reconciliation Returns API', isEnabled: false },
      ],
    })
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
      savedOmsRestSourceConfig: { omsRestSourceConfigId: 'krewe-oms' },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    // Proves the panel is actually wired to THIS config, not just rendered — reading a literal out
    // of save() would satisfy the assertions below without ever threading configType/configId
    // through the panel's own props (e.g. a copy-paste leaving :config-type="shopifyAuth" here
    // would still pass every assertion after this one).
    expect(listSourceConfigEndpoints).toHaveBeenCalledWith(
      expect.objectContaining({ configTypeEnumId: 'SCFG_HOTWAX_OMS', configId: 'krewe-oms' }),
      expect.anything(),
    )
    expect(wrapper.find('input[data-testid="endpoint-OMS_RETURNS"]').exists()).toBe(true)

    await wrapper.find('input[data-testid="endpoint-OMS_RETURNS"]').setValue(true)
    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith(expect.objectContaining({
      omsRestSourceConfigId: 'krewe-oms',
      canReadOrders: true,
    }))
    expect(storeSourceConfigEndpointAccess).toHaveBeenCalledWith({
      configTypeEnumId: 'SCFG_HOTWAX_OMS',
      configId: 'krewe-oms',
      enabledSystemEnumIds: ['OMS', 'OMS_RETURNS'],
    })
  })

  // Fix round 1, CRITICAL: before this fix, applyRecord() reset enabledEndpoints to [] and nothing
  // gated the follow-up write on the panel's own load outcome, so a failed GET silently disabled
  // every endpoint for the config (and flipped the legacy canReadOrders gate off in the same
  // stroke). Verified failing against the pre-fix code in a scratch worktree at b04b64f before this
  // fix landed: saveOmsRestSourceConfig was called with canReadOrders: false instead of true.
  it('does not touch endpoint access, and preserves the loaded canReadOrders, when the endpoint read fails', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'
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
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
          canReadOrders: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    listSourceConfigEndpoints.mockRejectedValue(new Error('network down'))
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
      savedOmsRestSourceConfig: { omsRestSourceConfigId: 'krewe-oms' },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="description"]').setValue('Krewe HotWax (renamed)')
    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith(expect.objectContaining({
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
  // gorjana_prod: the Shopify config's CONFIG fetch resolved after its ENDPOINTS fetch, so
  // applyRecord()'s reset clobbered the panel's already-correct seed -- every checkbox rendered
  // unticked even though the database had zero override rows (absent rows = enabled). This test
  // reproduces that exact ordering by holding the config fetch open with a deferred promise until
  // after the (resolved) endpoints fetch has already settled and seeded the form.
  it('keeps the endpoint seed when the config fetch resolves after the endpoints fetch', async () => {
    route.params = { omsRestSourceConfigId: 'krewe-oms' }
    route.name = 'settings-oms-edit'
    route.fullPath = '/settings/hotwax/edit/krewe-oms'

    let resolveConfigFetch!: (value: unknown) => void
    listOmsRestSourceConfigs.mockReturnValue(
      new Promise((resolve) => {
        resolveConfigFetch = resolve
      }),
    )
    listSourceConfigEndpoints.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      endpoints: [
        { systemEnumId: 'OMS', endpointLabel: 'Orders API', isEnabled: true },
        { systemEnumId: 'OMS_RETURNS', endpointLabel: 'Reconciliation Returns API', isEnabled: true },
      ],
    })
    saveOmsRestSourceConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved HotWax source config.'],
      errors: [],
      savedOmsRestSourceConfig: { omsRestSourceConfigId: 'krewe-oms' },
    })

    const wrapper = mount(OmsRestSourceWorkflowPage)
    // Let the endpoints fetch (already resolved) settle and seed the form BEFORE the config fetch
    // resolves -- this is the ordering that broke on gorjana_prod.
    await flushPromises()
    expect((wrapper.get('[data-testid="endpoint-OMS"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-testid="endpoint-OMS_RETURNS"]').element as HTMLInputElement).checked).toBe(true)

    resolveConfigFetch({
      ok: true,
      messages: [],
      errors: [],
      omsRestSourceConfigs: [
        {
          omsRestSourceConfigId: 'krewe-oms',
          description: 'Krewe HotWax',
          companyUserGroupId: 'KREWE',
          baseUrl: 'https://oms.example.com',
          authType: 'NONE',
          hasUsername: false,
          hasPassword: false,
          hasApiToken: false,
          customHeaderNames: [],
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          isActive: 'Y',
          canReadOrders: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    await flushPromises()

    // The config fetch resolving after the endpoints fetch must not wipe the already-seeded set.
    expect((wrapper.get('[data-testid="endpoint-OMS"]').element as HTMLInputElement).checked).toBe(true)
    expect((wrapper.get('[data-testid="endpoint-OMS_RETURNS"]').element as HTMLInputElement).checked).toBe(true)

    await wrapper.get('[data-testid="save-oms-rest-source"]').trigger('click')
    await flushPromises()

    expect(saveOmsRestSourceConfig).toHaveBeenCalledWith(expect.objectContaining({
      canReadOrders: true,
    }))
    expect(storeSourceConfigEndpointAccess).toHaveBeenCalledWith({
      configTypeEnumId: 'SCFG_HOTWAX_OMS',
      configId: 'krewe-oms',
      enabledSystemEnumIds: ['OMS', 'OMS_RETURNS'],
    })
  })
})
