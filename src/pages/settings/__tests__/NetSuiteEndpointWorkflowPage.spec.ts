import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  name: 'settings-netsuite-endpoints-create',
  fullPath: '/settings/netsuite/endpoints/create',
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const listNsRestletConfigs = vi.hoisted(() => vi.fn())
const saveNsRestletConfig = vi.hoisted(() => vi.fn())
const listConfigTenantAccess = vi.hoisted(() => vi.fn())
const grantConfigTenantAccess = vi.hoisted(() => vi.fn())
const revokeConfigTenantAccess = vi.hoisted(() => vi.fn())
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
    listNsAuthConfigs,
    listNsRestletConfigs,
    saveNsRestletConfig,
    listConfigTenantAccess,
    grantConfigTenantAccess,
    revokeConfigTenantAccess,
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

import NetSuiteEndpointWorkflowPage from '../NetSuiteEndpointWorkflowPage.vue'

describe('NetSuiteEndpointWorkflowPage', () => {
  beforeEach(() => {
    route.params = {}
    route.name = 'settings-netsuite-endpoints-create'
    route.fullPath = '/settings/netsuite/endpoints/create'
    push.mockReset()
    listNsAuthConfigs.mockReset()
    listNsRestletConfigs.mockReset()
    saveNsRestletConfig.mockReset()
    listConfigTenantAccess.mockReset()
    grantConfigTenantAccess.mockReset()
    revokeConfigTenantAccess.mockReset()
    // Default: an unshared config (memberCount 1, no peers) — the common case, and the shape
    // that keeps every pre-existing test in this file on the unmodified save path.
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_NS_RESTLET',
        configId: 'endpoint_primary',
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

  it('saves a new NetSuite endpoint config and returns to the combined dashboard', async () => {
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveNsRestletConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved endpoint config.'],
      errors: [],
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="endpointUrl"]').setValue('https://netsuite.example.com/restlet')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="netsuite-endpoint-http-method"]').trigger('click')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="POST"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="netsuite-endpoint-auth-config"]').trigger('click')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="auth-primary"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Invoice Export')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.find('input[name="nsRestletConfigId"]').exists()).toBe(true)

    await wrapper.get('input[name="nsRestletConfigId"]').setValue('endpoint-primary')
    await wrapper.get('[data-testid="save-netsuite-endpoint"]').trigger('click')
    await flushPromises()

    expect(saveNsRestletConfig).toHaveBeenCalledWith({
      nsRestletConfigId: 'endpoint-primary',
      description: 'Invoice Export',
      endpointUrl: 'https://netsuite.example.com/restlet',
      httpMethod: 'POST',
      nsAuthConfigId: 'auth-primary',
      headersJson: '',
      connectTimeoutSeconds: 30,
      readTimeoutSeconds: 60,
      isActive: 'Y',
    })
    expect(push).toHaveBeenCalledWith('/settings/netsuite')
  })

  it('caps endpoint config IDs at 20 characters in create and edit forms', async () => {
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    await wrapper.get('input[name="endpointUrl"]').setValue('https://netsuite.example.com/restlet')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="netsuite-endpoint-auth-config"]').trigger('click')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="auth-primary"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Invoice Export')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    const createConfigIdInput = wrapper.get('input[name="nsRestletConfigId"]')

    expect(createConfigIdInput.attributes('maxlength')).toBe('20')

    await createConfigIdInput.setValue('b'.repeat(21))
    await wrapper.get('[data-testid="save-netsuite-endpoint"]').trigger('click')
    await flushPromises()

    expect(saveNsRestletConfig).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Endpoint Config ID must be 20 characters or fewer.')

    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const editWrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    expect(editWrapper.get('input[name="nsRestletConfigId"]').attributes('maxlength')).toBe('20')
  })

  it('loads an existing NetSuite endpoint config into the workflow for edit', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
          httpMethod: 'GET',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          headersJson: '{"X-Test":"1"}',
          isActive: 'N',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    expect(listNsRestletConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect((wrapper.get('input[name="nsRestletConfigId"]').element as HTMLInputElement).value).toBe('endpoint-primary')
    expect((wrapper.get('input[name="description"]').element as HTMLInputElement).value).toBe('Invoice Export')
    expect((wrapper.get('input[name="endpointUrl"]').element as HTMLInputElement).value).toBe(
      'https://netsuite.example.com/restlet',
    )
    expect(wrapper.findAll('.workflow-form-grid--two')).toHaveLength(1)
    expect(wrapper.get('.workflow-form-grid--compact').text()).toContain('Auth Config')
    expect(wrapper.get('[data-testid="netsuite-endpoint-http-method"]').text()).toContain('GET')
    expect(wrapper.get('[data-testid="netsuite-endpoint-auth-config"]').text()).toContain('Primary Auth')
    expect(wrapper.get('[data-testid="netsuite-endpoint-is-active"]').text()).toContain('No')
    expect(wrapper.get('[data-testid="netsuite-endpoint-auth-config"]').element.closest('.wizard-answer-control')).toBeNull()
    expect(wrapper.get('[data-testid="netsuite-endpoint-http-method"]').element.closest('.wizard-answer-control')).toBeNull()
    expect(wrapper.get('[data-testid="netsuite-endpoint-is-active"]').element.closest('.wizard-answer-control')).toBeNull()
  })

  it('shows an X cancel action on edit and returns to the NetSuite dashboard without saving', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
          httpMethod: 'GET',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          headersJson: '{"X-Test":"1"}',
          isActive: 'N',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    const cancelButton = wrapper.get('[data-testid="cancel-netsuite-endpoint"]')

    expect(cancelButton.attributes('aria-label')).toBe('Cancel')
    expect(cancelButton.classes()).toContain('app-icon-action')
    expect(cancelButton.classes()).toContain('app-icon-action--large')

    await cancelButton.trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/netsuite')
    expect(saveNsRestletConfig).not.toHaveBeenCalled()
  })

  it('keeps the auth config placeholder out of the dropdown list', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
          httpMethod: 'GET',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          headersJson: '{"X-Test":"1"}',
          isActive: 'N',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="netsuite-endpoint-auth-config"]').trigger('click')

    const optionTexts = wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.text())
    expect(optionTexts).toEqual(['Primary Auth'])
    expect(optionTexts).not.toContain('Select auth config')
  })

  it('applies the smaller edit-only typography contract on single-page endpoint edits', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
          httpMethod: 'GET',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          headersJson: '{"X-Test":"1"}',
          isActive: 'N',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    const workflowForm = wrapper.get('form')
    const source = readFileSync('src/style.css', 'utf8')
    const pageSource = readFileSync('src/pages/settings/NetSuiteEndpointWorkflowPage.vue', 'utf8')

    expect(workflowForm.classes()).toContain('workflow-form--compact')
    expect(workflowForm.classes()).toContain('workflow-form--edit-single-page')
    expect(pageSource).toContain("'workflow-form--edit-single-page': isEditing")
    expect(source).toContain('.workflow-form--edit-single-page {')
    expect(source).toContain('--workflow-form-answer-size: clamp(0.89rem, 1.05vw, 1.09rem);')
  })

  it('keeps the headers JSON field collapsed to a single visible row by default', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
          httpMethod: 'GET',
          nsAuthConfigId: 'auth-primary',
          authType: 'BASIC',
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 20,
          headersJson: '{"X-Test":"1"}',
          isActive: 'N',
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    const headersField = wrapper.get('textarea[name="headersJson"]')
    const source = readFileSync('src/style.css', 'utf8')
    const pageSource = readFileSync('src/pages/settings/NetSuiteEndpointWorkflowPage.vue', 'utf8')

    expect(headersField.attributes('rows')).toBe('1')
    expect(headersField.classes()).toContain('workflow-form-textarea')
    expect(headersField.classes()).toContain('workflow-form-textarea--single-row')
    expect(pageSource.match(/workflow-form-textarea--single-row/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(source).toContain('.workflow-form-textarea--single-row {')
    expect(source).toContain('min-height: 2.2rem;')
  })

  // DAR-BE-005 Task 12 — the affects-N-tenants save gate. sharedEditWarning() returns null for an
  // unshared config (memberCount <= 1, the beforeEach default), so this is the "byte-identical to
  // today" case: no warning renders and Save works exactly as it did before this feature existed.
  it('saves an unshared config with no confirmation step (byte-identical save path)', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveNsRestletConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-edit-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="save-netsuite-endpoint"]').trigger('click')
    await flushPromises()

    expect(saveNsRestletConfig).toHaveBeenCalledTimes(1)
  })

  it('blocks Save behind an explicit inline confirmation when the config is shared across tenants', async () => {
    route.params = { nsRestletConfigId: 'endpoint-primary' }
    route.name = 'settings-netsuite-endpoints-edit'
    route.fullPath = '/settings/netsuite/endpoints/edit/endpoint-primary'
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
          isActive: 'Y',
          hasPassword: true,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
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
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_NS_RESTLET',
        configId: 'endpoint-primary',
        ownerTenantUserGroupId: 'KREWE',
        ownerTenantLabel: 'Krewe',
        memberTenantUserGroupIds: ['GORJANA'],
        memberTenantLabels: [{ tenantUserGroupId: 'GORJANA', label: 'Gorjana' }],
        memberCount: 2,
        canManage: true,
      },
    })
    saveNsRestletConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(NetSuiteEndpointWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="shared-edit-warning"]').text()).toContain('2 tenants')

    await wrapper.get('[data-testid="save-netsuite-endpoint"]').trigger('click')
    await flushPromises()
    expect(saveNsRestletConfig).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="shared-edit-confirm"]').setValue(true)
    await wrapper.get('[data-testid="save-netsuite-endpoint"]').trigger('click')
    await flushPromises()

    expect(saveNsRestletConfig).toHaveBeenCalledTimes(1)
  })
})
