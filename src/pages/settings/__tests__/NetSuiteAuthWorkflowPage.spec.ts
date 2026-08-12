import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'

const route = vi.hoisted(() => ({
  params: {} as Record<string, string>,
  name: 'settings-netsuite-auth-create',
  fullPath: '/settings/netsuite/auth/create',
}))
const push = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const saveNsAuthConfig = vi.hoisted(() => vi.fn())
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
    saveNsAuthConfig,
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

import NetSuiteAuthWorkflowPage from '../NetSuiteAuthWorkflowPage.vue'

describe('NetSuiteAuthWorkflowPage', () => {
  beforeEach(() => {
    route.params = {}
    route.name = 'settings-netsuite-auth-create'
    route.fullPath = '/settings/netsuite/auth/create'
    push.mockReset()
    listNsAuthConfigs.mockReset()
    saveNsAuthConfig.mockReset()
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
        configTypeEnumId: 'SCFG_NS_AUTH',
        configId: 'dev_auth',
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

  it('saves a new NetSuite auth config and returns to the combined dashboard', async () => {
    saveNsAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved auth config.'],
      errors: [],
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    expect(wrapper.find('input[name="nsAuthConfigId"]').exists()).toBe(false)

    await wrapper.get('[data-testid="netsuite-auth-type"]').trigger('click')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="BASIC"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="username"]').setValue('service-user')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="password"]').setValue('secret')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Primary Auth')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    expect(wrapper.find('input[name="nsAuthConfigId"]').exists()).toBe(true)

    await wrapper.get('input[name="nsAuthConfigId"]').setValue('auth-primary')
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).toHaveBeenCalledWith({
      nsAuthConfigId: 'auth-primary',
      description: 'Primary Auth',
      authType: 'BASIC',
      isActive: 'Y',
      username: 'service-user',
      password: 'secret',
      apiToken: '',
      tokenUrl: '',
      clientId: '',
      certId: '',
      scope: '',
      privateKeyPem: '',
    })
    expect(push).toHaveBeenCalledWith('/settings/netsuite')
  })

  it('caps auth config IDs at 20 characters in create and edit forms', async () => {
    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Primary Auth')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')

    const createConfigIdInput = wrapper.get('input[name="nsAuthConfigId"]')

    expect(createConfigIdInput.attributes('maxlength')).toBe('20')

    await createConfigIdInput.setValue('a'.repeat(21))
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Auth Config ID must be 20 characters or fewer.')

    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'NONE',
          isActive: 'Y',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const editWrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    expect(editWrapper.get('input[name="nsAuthConfigId"]').attributes('maxlength')).toBe('20')
  })

  it('saves selected oauth scopes from the create wizard as a space-delimited backend value', async () => {
    saveNsAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved auth config.'],
      errors: [],
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    await wrapper.get('[data-testid="netsuite-auth-type"]').trigger('click')
    await wrapper.get('[data-testid="workflow-select-option"][data-option-value="OAUTH2_M2M_JWT"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="tokenUrl"]').setValue('https://netsuite.example.com/token')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    expect(wrapper.get('input[name="clientId"]').attributes('type')).toBe('password')
    expect(wrapper.get('input[name="clientId"]').attributes('autocomplete')).toBe('off')
    await wrapper.get('input[name="clientId"]').setValue('client-id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="certId"]').setValue('cert-id')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[data-scope-value="rest_webservices"]').setValue(false)
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('textarea[name="privateKeyPem"]').setValue('private-key')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="description"]').setValue('Primary Auth')
    await wrapper.get('[data-testid="wizard-next"]').trigger('click')
    await wrapper.get('input[name="nsAuthConfigId"]').setValue('auth-primary')
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      authType: 'OAUTH2_M2M_JWT',
      tokenUrl: 'https://netsuite.example.com/token',
      clientId: 'client-id',
      certId: 'cert-id',
      scope: 'restlets',
      privateKeyPem: 'private-key',
    }))
  })

  it('toggles client ID visibility with the eye action in create and edit flows', async () => {
    const createWrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    await createWrapper.get('[data-testid="netsuite-auth-type"]').trigger('click')
    await createWrapper.get('[data-testid="workflow-select-option"][data-option-value="OAUTH2_M2M_JWT"]').trigger('click')
    await createWrapper.get('[data-testid="wizard-next"]').trigger('click')
    await createWrapper.get('[data-testid="wizard-next"]').trigger('click')
    await createWrapper.get('input[name="tokenUrl"]').setValue('https://netsuite.example.com/token')
    await createWrapper.get('[data-testid="wizard-next"]').trigger('click')

    const createClientIdInput = createWrapper.get('input[name="clientId"]')
    const createToggle = createWrapper.get('[data-testid="toggle-client-id-visibility"]')

    expect(createClientIdInput.attributes('type')).toBe('password')
    expect(createToggle.attributes('aria-label')).toBe('Show Client ID')

    await createToggle.trigger('click')

    expect(createWrapper.get('input[name="clientId"]').attributes('type')).toBe('text')
    expect(createWrapper.get('[data-testid="toggle-client-id-visibility"]').attributes('aria-label')).toBe('Hide Client ID')

    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const editWrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    const editClientIdInput = editWrapper.get('input[name="clientId"]')
    const editToggle = editWrapper.get('[data-testid="toggle-client-id-visibility"]')

    expect(editClientIdInput.attributes('type')).toBe('password')
    expect(editToggle.attributes('aria-label')).toBe('Show Client ID')

    await editToggle.trigger('click')

    expect(editWrapper.get('input[name="clientId"]').attributes('type')).toBe('text')
    expect(editWrapper.get('[data-testid="toggle-client-id-visibility"]').attributes('aria-label')).toBe('Hide Client ID')
  })

  it('loads an existing NetSuite auth config into the workflow for edit', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    expect(listNsAuthConfigs).toHaveBeenCalledWith({ pageIndex: 0, pageSize: 200 }, expect.any(AbortSignal))
    expect((wrapper.get('input[name="nsAuthConfigId"]').element as HTMLInputElement).value).toBe('auth-primary')
    expect((wrapper.get('input[name="description"]').element as HTMLInputElement).value).toBe('Primary Auth')
    expect(wrapper.get('[data-testid="netsuite-auth-type"]').text()).toContain('OAuth2 M2M JWT')
    expect((wrapper.get('input[name="tokenUrl"]').element as HTMLInputElement).value).toBe(
      'https://netsuite.example.com/token',
    )
    expect(wrapper.get('input[name="clientId"]').attributes('type')).toBe('password')
    expect(wrapper.get('input[name="clientId"]').attributes('autocomplete')).toBe('off')
    expect(wrapper.findAll('.workflow-form-grid--two')).toHaveLength(1)
    expect(wrapper.find('.workflow-form-grid--compact').exists()).toBe(false)
    expect(wrapper.get('[data-testid="netsuite-auth-scope-group"]').text()).toContain('RESTlets')
    expect(wrapper.get('[data-testid="netsuite-auth-scope-group"]').text()).toContain('REST Web Services')
    expect(wrapper.get('[data-testid="netsuite-auth-is-active"]').text()).toContain('No')
    expect(wrapper.get('[data-testid="netsuite-auth-type"]').element.closest('.wizard-answer-control')).toBeNull()
    expect(wrapper.get('[data-testid="netsuite-auth-is-active"]').element.closest('.wizard-answer-control')).toBeNull()
  })

  it('shows an X cancel action on edit and returns to the NetSuite dashboard without saving', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    const cancelButton = wrapper.get('[data-testid="cancel-netsuite-auth"]')

    expect(cancelButton.attributes('aria-label')).toBe('Cancel')
    expect(cancelButton.classes()).toContain('app-icon-action')
    expect(cancelButton.classes()).toContain('app-icon-action--large')

    await cancelButton.trigger('click')

    expect(push).toHaveBeenCalledWith('/settings/netsuite')
    expect(saveNsAuthConfig).not.toHaveBeenCalled()
  })

  it('saves selected oauth scopes as a space-delimited backend value', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveNsAuthConfig.mockResolvedValue({
      ok: true,
      messages: ['Saved auth config.'],
      errors: [],
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    const restletsScope = wrapper.get('input[data-scope-value="restlets"]')
    const restWebServicesScope = wrapper.get('input[data-scope-value="rest_webservices"]')

    expect((restletsScope.element as HTMLInputElement).checked).toBe(true)
    expect((restWebServicesScope.element as HTMLInputElement).checked).toBe(true)

    await restWebServicesScope.setValue(false)
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).toHaveBeenCalledWith(expect.objectContaining({
      authType: 'OAUTH2_M2M_JWT',
      scope: 'restlets',
    }))
  })

  it('styles oauth scope choices like the boxed run-result filters', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    const scopeOptions = wrapper.findAll('.workflow-choice-option--filter')
    const source = readFileSync('src/style.css', 'utf8')
    const pageSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')
    const runResultSource = readFileSync('src/pages/reconciliation/ReconciliationRunResultPage.vue', 'utf8')

    expect(scopeOptions).toHaveLength(2)
    scopeOptions.forEach((option) => {
      expect(option.classes()).toContain('workflow-choice-option--active')
    })
    expect(pageSource.match(/workflow-choice-option--filter/g)?.length ?? 0).toBeGreaterThanOrEqual(2)
    expect(source).toContain('.workflow-choice-option--filter {')
    expect(source).toContain('.workflow-choice-option--filter:hover {')
    expect(source).toContain('.workflow-choice-option--filter.workflow-choice-option--active {')
    expect(source).toContain('max-width: min(100%, 14rem);')
    // Now on the spacing scale (0.6/0.8rem -> --space-1-5/--space-2). What this test guards is that
    // the scope choices look like the run-result filter boxes, which is the border, background and
    // checkbox treatment asserted below - the padding literal was never part of that contract.
    expect(source).toContain('padding: var(--space-1-5) var(--space-2);')
    expect(source).toContain(".workflow-choice-option--filter input[type='checkbox']:not(.app-table__checkbox) {")
    expect(source).toContain('width: 1rem;')
    expect(source).toContain('height: 1rem;')
    expect(source).toContain('border: 1px solid var(--border-soft);')
    expect(source).toContain('background: color-mix(in oklab, var(--surface-2) 95%, white);')
    expect(source).toContain('transform: translateY(-1px);')
    expect(runResultSource).toContain('.reconciliation-diff-bucket {')
    expect(runResultSource).toContain('border: 1px solid var(--border-soft);')
    expect(runResultSource).toContain('background: color-mix(in oklab, var(--surface-2) 95%, white);')
  })

  it('applies the smaller edit-only typography contract on single-page auth edits', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    const workflowForm = wrapper.get('form')
    const source = readFileSync('src/style.css', 'utf8')
    const pageSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')

    expect(workflowForm.classes()).toContain('workflow-form--compact')
    expect(workflowForm.classes()).toContain('workflow-form--edit-single-page')
    expect(pageSource).toContain("'workflow-form--edit-single-page': isEditing")
    expect(source).toContain('.workflow-form--edit-single-page {')
    expect(source).toContain('--workflow-form-answer-size: clamp(0.89rem, 1.05vw, 1.09rem);')
  })

  it('keeps the private key PEM field collapsed to a single visible row by default', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'OAUTH2_M2M_JWT',
          tokenUrl: 'https://netsuite.example.com/token',
          clientId: 'client-id',
          certId: 'cert-id',
          scope: 'restlets rest_webservices',
          isActive: 'N',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: true,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    const privateKeyField = wrapper.get('textarea[name="privateKeyPem"]')
    const source = readFileSync('src/style.css', 'utf8')
    const pageSource = readFileSync('src/pages/settings/NetSuiteAuthWorkflowPage.vue', 'utf8')

    expect(privateKeyField.attributes('rows')).toBe('1')
    expect(privateKeyField.classes()).toContain('workflow-form-textarea')
    expect(privateKeyField.classes()).toContain('workflow-form-textarea--single-row')
    expect(pageSource).toContain('workflow-form-textarea--single-row')
    expect(source).toContain('.workflow-form-textarea--single-row {')
    expect(source).toContain('min-height: 2.2rem;')
  })

  // DAR-BE-005 Task 12 — the affects-N-tenants save gate. sharedEditWarning() returns null for an
  // unshared config (memberCount <= 1, the beforeEach default), so this is the "byte-identical to
  // today" case: no warning renders and Save works exactly as it did before this feature existed.
  it('saves an unshared config with no confirmation step (byte-identical save path)', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'NONE',
          isActive: 'Y',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveNsAuthConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="shared-edit-warning"]').exists()).toBe(false)

    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).toHaveBeenCalledTimes(1)
  })

  it('blocks Save behind an explicit inline confirmation when the config is shared across tenants', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'NONE',
          isActive: 'Y',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    listConfigTenantAccess.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_NS_AUTH',
        configId: 'auth-primary',
        ownerTenantUserGroupId: 'KREWE',
        ownerTenantLabel: 'Krewe',
        memberTenantUserGroupIds: ['GORJANA'],
        memberTenantLabels: [{ tenantUserGroupId: 'GORJANA', label: 'Gorjana' }],
        memberCount: 2,
        canManage: true,
      },
    })
    saveNsAuthConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="shared-edit-warning"]').text()).toContain('2 tenants')

    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()
    expect(saveNsAuthConfig).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="shared-edit-confirm"]').setValue(true)
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).toHaveBeenCalledTimes(1)
  })

  // DAR-BE-005 Task 12 review finding: the config fetch and the sharing fetch used to be two
  // independent races. If the config fetch (fast) resolved before the sharing fetch (slow), the
  // form went interactive with editWarning still null even for a genuinely shared config -- a
  // synchronous mock can never exercise this, both promises settle in the same microtask flush.
  // This test uses a manually-resolved promise for listConfigTenantAccess specifically so the two
  // fetches settle on different ticks, matching a real slow-sharing-fetch race.
  it('keeps Save disabled until the sharing fetch settles, even when it resolves after the config fetch', async () => {
    route.params = { nsAuthConfigId: 'auth-primary' }
    route.name = 'settings-netsuite-auth-edit'
    route.fullPath = '/settings/netsuite/auth/edit/auth-primary'
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authConfigs: [
        {
          nsAuthConfigId: 'auth-primary',
          description: 'Primary Auth',
          companyUserGroupId: 'KREWE',
          authType: 'NONE',
          isActive: 'Y',
          hasPassword: false,
          hasApiToken: false,
          hasPrivateKeyPem: false,
        },
      ],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
    })
    saveNsAuthConfig.mockResolvedValue({ ok: true, messages: ['Saved.'], errors: [] })

    let resolveSharing: (value: unknown) => void = () => {}
    listConfigTenantAccess.mockImplementation(
      () => new Promise((resolve) => { resolveSharing = resolve }),
    )

    const wrapper = mount(NetSuiteAuthWorkflowPage)
    await flushPromises()

    expect((wrapper.get('input[name="description"]').element as HTMLInputElement).value).toBe('Primary Auth')
    expect(wrapper.get('[data-testid="save-netsuite-auth"]').attributes('disabled')).toBeDefined()

    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    expect(saveNsAuthConfig).not.toHaveBeenCalled()

    resolveSharing({
      ok: true,
      messages: [],
      errors: [],
      sharing: {
        configTypeEnumId: 'SCFG_NS_AUTH',
        configId: 'auth-primary',
        ownerTenantUserGroupId: 'KREWE',
        ownerTenantLabel: 'Krewe',
        memberTenantUserGroupIds: ['GORJANA'],
        memberTenantLabels: [{ tenantUserGroupId: 'GORJANA', label: 'Gorjana' }],
        memberCount: 2,
        canManage: true,
      },
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="shared-edit-warning"]').text()).toContain('2 tenants')
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    expect(saveNsAuthConfig).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="shared-edit-confirm"]').setValue(true)
    await wrapper.get('[data-testid="save-netsuite-auth"]').trigger('click')
    await flushPromises()

    expect(saveNsAuthConfig).toHaveBeenCalledTimes(1)
  })
})
