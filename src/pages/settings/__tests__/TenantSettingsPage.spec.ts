import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'

const getLlmSettings = vi.hoisted(() => vi.fn())
const saveLlmSettings = vi.hoisted(() => vi.fn())
const getTenantSettings = vi.hoisted(() => vi.fn())
const saveTenantSettings = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const saveTenantChatSpace = vi.hoisted(() => vi.fn())
const deleteTenantChatSpace = vi.hoisted(() => vi.fn())
const listSftpServers = vi.hoisted(() => vi.fn())
const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const listNsRestletConfigs = vi.hoisted(() => vi.fn())
const listShopifyAuthConfigs = vi.hoisted(() => vi.fn())
const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const push = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  fullPath: '/settings/tenant',
  query: {} as Record<string, unknown>,
}))
const authState = vi.hoisted(() => ({
  sessionInfo: {
    userId: 'admin',
    activeTenantUserGroupId: 'KREWE',
    activeTenantLabel: 'Krewe',
    timeZone: 'America/Los_Angeles',
    availableTenants: [
      { userGroupId: 'KREWE', label: 'Krewe' },
      { userGroupId: 'GORJANA', label: 'Gorjana' },
    ],
    canEditActiveTenantData: true,
    isSuperAdmin: true,
    canManageDarpanCore: true,
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    push,
    replace,
  }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    getLlmSettings,
    saveLlmSettings,
    getTenantSettings,
    listTenantChatSpaces,
    saveTenantChatSpace,
    deleteTenantChatSpace,
    listSftpServers,
    listNsAuthConfigs,
    listNsRestletConfigs,
    listShopifyAuthConfigs,
    listOmsRestSourceConfigs,
  },
}))

vi.mock('../../../lib/auth', () => ({
  saveTenantSettings,
  useAuthState: () => authState,
  useUiPermissions: () => permissionsShape,
}))

const permissionsShape = {
    get canEditTenantSettings() {
      return authState.sessionInfo.canEditActiveTenantData === true || authState.sessionInfo.isSuperAdmin === true
    },
    get canManageGlobalSettings() {
      return authState.sessionInfo.canManageDarpanCore === true
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
    saveTenantSettings,
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
    clearWorkflowOrigin: vi.fn(),
    setRuleSetDraft: vi.fn(),
    clearRuleSetDraft: vi.fn(),
    setAutomationDraft: vi.fn(),
    clearAutomationDraft: vi.fn(),
  }),
}))

import TenantSettingsPage from '../TenantSettingsPage.vue'

describe('TenantSettingsPage', () => {
  beforeEach(() => {
    route.fullPath = '/settings/tenant'
    route.query = {}
    authState.sessionInfo = {
      userId: 'admin',
      activeTenantUserGroupId: 'KREWE',
      activeTenantLabel: 'Krewe',
      timeZone: 'America/Los_Angeles',
      availableTenants: [
        { userGroupId: 'KREWE', label: 'Krewe' },
        { userGroupId: 'GORJANA', label: 'Gorjana' },
      ],
      canEditActiveTenantData: true,
      isSuperAdmin: true,
      canManageDarpanCore: true,
    }
    push.mockReset()
    push.mockResolvedValue(undefined)
    replace.mockReset()
    replace.mockResolvedValue(undefined)
    getLlmSettings.mockReset()
    saveLlmSettings.mockReset()
    getTenantSettings.mockReset()
    saveTenantSettings.mockReset()
    listTenantChatSpaces.mockReset()
    saveTenantChatSpace.mockReset()
    deleteTenantChatSpace.mockReset()
    listSftpServers.mockReset()
    listNsAuthConfigs.mockReset()
    listNsRestletConfigs.mockReset()
    listShopifyAuthConfigs.mockReset()
    listOmsRestSourceConfigs.mockReset()

    getLlmSettings.mockImplementation(async (payload?: { llmProvider?: string }) => ({
      ok: true,
      messages: [],
      errors: [],
      llmSettings: {
        activeProvider: 'GEMINI',
        llmProvider: payload?.llmProvider ?? 'OPENAI',
        llmModel: payload?.llmProvider === 'GEMINI' ? 'gemini-2.5-flash' : 'gpt-4.1-mini',
        llmBaseUrl: payload?.llmProvider === 'GEMINI'
          ? 'https://generativelanguage.googleapis.com'
          : 'https://api.openai.com',
        llmTimeoutSeconds: '45',
        llmEnabled: 'Y',
        hasStoredLlmApiKey: true,
      },
    }))
    getTenantSettings.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      tenantSettings: {
        companyUserGroupId: 'KREWE',
        companyLabel: 'Krewe',
        timeZone: 'America/Los_Angeles',
      },
    })
    saveTenantSettings.mockResolvedValue({
      ok: true,
      messages: ['Saved tenant settings.'],
      errors: [],
      tenantSettings: {
        companyUserGroupId: 'KREWE',
        companyLabel: 'Krewe',
        timeZone: 'Europe/London',
      },
    })
    listSftpServers.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      servers: [{ sftpServerId: 'SFTP_KREWE', companyUserGroupId: 'KREWE', description: 'Warehouse' }],
    })
    listNsAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      authConfigs: [{ nsAuthConfigId: 'NS_AUTH', companyUserGroupId: 'KREWE' }],
    })
    listNsRestletConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      restletConfigs: [{ nsRestletConfigId: 'NS_ENDPOINT', companyUserGroupId: 'KREWE' }],
    })
    listShopifyAuthConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      shopifyAuthConfigs: [{ shopifyAuthConfigId: 'SHOPIFY', companyUserGroupId: 'KREWE' }],
    })
    listOmsRestSourceConfigs.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      pagination: { pageIndex: 0, pageSize: 200, totalCount: 1, pageCount: 1 },
      omsRestSourceConfigs: [{ omsRestSourceConfigId: 'OMS', companyUserGroupId: 'KREWE' }],
    })
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        {
          chatSpaceId: 'CS1',
          spaceName: 'Ops',
          googleChatConfigured: true,
          googleChatWebhookUrlMasked: 'https://chat.googleapis.com/***',
          isActive: 'Y',
          inUse: true,
        },
        {
          chatSpaceId: 'CS2',
          spaceName: 'Finance',
          googleChatConfigured: false,
          googleChatWebhookUrlMasked: null,
          isActive: 'Y',
          inUse: false,
        },
      ],
    })
    saveTenantChatSpace.mockResolvedValue({
      ok: true,
      messages: ['Saved chat space.'],
      errors: [],
      chatSpace: {
        chatSpaceId: 'CS1',
        spaceName: 'Ops',
        googleChatConfigured: true,
        googleChatWebhookUrlMasked: 'https://chat.googleapis.com/***',
        isActive: 'Y',
        inUse: true,
      },
    })
    deleteTenantChatSpace.mockResolvedValue({
      ok: true,
      messages: ['Deleted chat space.'],
      errors: [],
    })
  })

  it('renders one tenant settings surface with AI moved into the page', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Krewe Settings')
    expect(wrapper.text()).not.toContain('Active Tenant')
    expect(wrapper.find('.tenant-settings-summary-grid').exists()).toBe(false)
    expect(wrapper.text()).toContain('AI Configuration')
    expect(wrapper.text()).toContain('Gemini')
    expect(wrapper.text()).not.toContain('OpenAI')
    expect(wrapper.get('[data-testid="tenant-ai-providers"]').classes()).toContain('tenant-settings-list-grid')
    expect(wrapper.findAll('[data-testid="tenant-ai-provider-tile"]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="tenant-ai-provider-tile"]').classes()).toContain('static-page-list-tile')
    expect(wrapper.get('[data-testid="tenant-ai-provider-tile"]').text()).toContain('Primary · Enabled · Key stored')
    expect(wrapper.text()).toContain('Localization')
    expect(wrapper.text()).toContain('Timezone')
    expect(wrapper.get('[data-testid="tenant-module-timezone"]').text()).toContain('America/Los_Angeles')
    expect(wrapper.text()).toContain('Operations')
    expect(wrapper.text()).not.toContain('Connections')
    expect(wrapper.find('[data-testid="tenant-module-sftp"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-netsuite"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-shopify"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-oms"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-runs"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Run Editor')
    expect(wrapper.text()).toContain('Notifications')
    expect(wrapper.get('[data-testid="tenant-module-notifications"]').text()).toContain('2 spaces')
    expect(wrapper.find('.static-page-module-grid').exists()).toBe(false)
    expect(getLlmSettings).toHaveBeenNthCalledWith(1, { llmProvider: 'OPENAI' }, expect.any(AbortSignal))
    expect(getLlmSettings).toHaveBeenNthCalledWith(2, { llmProvider: 'GEMINI' }, expect.any(AbortSignal))
    expect(getTenantSettings).toHaveBeenCalledTimes(1)
    expect(listTenantChatSpaces).toHaveBeenCalledTimes(1)
    expect(listSftpServers).not.toHaveBeenCalled()
    expect(listNsAuthConfigs).not.toHaveBeenCalled()
    expect(listNsRestletConfigs).not.toHaveBeenCalled()
    expect(listShopifyAuthConfigs).not.toHaveBeenCalled()
    expect(listOmsRestSourceConfigs).not.toHaveBeenCalled()
    expect(wrapper.html()).not.toContain('/settings/ai')
  })

  it('edits tenant timezone from the Tenant Settings popup', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-timezone"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Set the tenant timezone.')
    expect(wrapper.get('[data-testid="tenant-timezone-select"]').text()).toContain('America/Los_Angeles')
    await wrapper.get('[data-testid="tenant-timezone-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-search"]').setValue('Europe/London')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="Europe/London"]').trigger('click')
    await wrapper.get('[data-testid="save-tenant-timezone"]').trigger('click')
    await flushPromises()

    expect(saveTenantSettings).toHaveBeenCalledWith({ timeZone: 'Europe/London' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved tenant settings.')
    expect(wrapper.get('[data-testid="tenant-module-timezone"]').text()).toContain('Europe/London')
  })

  it('opens AI edits as a popup workflow and saves through the settings facade', async () => {
    saveLlmSettings.mockResolvedValue({
      ok: true,
      messages: ['Saved LLM settings.'],
      errors: [],
      llmSettings: {
        activeProvider: 'OPENAI',
        llmProvider: 'OPENAI',
        llmModel: 'gpt-4.1-mini',
        llmBaseUrl: 'https://api.openai.com',
        llmTimeoutSeconds: '45',
        llmEnabled: 'Y',
      },
    })

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-ai-provider-tile"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('What do you want to do with the AI provider?')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Update Gemini')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Change selected provider')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Add provider settings')
    await wrapper.get('[data-testid="tenant-ai-provider-workflow-update"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Update the AI provider settings.')
    expect(wrapper.get('.static-page-frame').classes()).toContain('static-page-frame--popup-open')
    await wrapper.get('input[name="llmModel"]').setValue('gemini-2.5-pro')
    await wrapper.get('[data-testid="save-tenant-llm-settings"]').trigger('click')
    await flushPromises()

    expect(saveLlmSettings).toHaveBeenCalledWith({
      llmProvider: 'GEMINI',
      llmModel: 'gemini-2.5-pro',
      llmBaseUrl: 'https://generativelanguage.googleapis.com',
      llmTimeoutSeconds: '45',
      llmEnabled: 'Y',
      llmApiKey: '',
    })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved LLM settings.')
  })

  it('starts add/change provider setup from the selected AI provider workflow', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-ai-provider-tile"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-ai-provider-workflow-change"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Which AI provider should Darpan configure?')
    expect(wrapper.find('[data-testid="tenant-llm-provider"]').exists()).toBe(true)
  })

  it('lists chat spaces and adds one through the two-step popup', async () => {
    const WEBHOOK = 'https://chat.googleapis.com/v1/spaces/KREWE_SPACE/messages?key=test-key&token=test-token'
    listTenantChatSpaces.mockResolvedValue({ ok: true, chatSpaces: [
      { chatSpaceId: 'CS1', spaceName: 'Ops', googleChatConfigured: true, isActive: 'Y', inUse: true }] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Ops')
    await wrapper.get('[data-testid="tenant-chat-space-add"]').trigger('click')
    await wrapper.get('input[name="chatSpaceName"]').setValue('Finance')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('input[name="googleChatWebhookUrl"]').setValue(WEBHOOK)
    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()
    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      { spaceName: 'Finance', googleChatWebhookUrl: WEBHOOK, isActive: true }, expect.anything())
    expect(push).not.toHaveBeenCalledWith('/settings/notifications')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved chat space.')
  })

  it('blocks delete for in-use spaces and offers deactivate', async () => {
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      chatSpaces: [
        {
          chatSpaceId: 'CS1',
          spaceName: 'Ops',
          googleChatConfigured: true,
          googleChatWebhookUrlMasked: 'https://chat.googleapis.com/***',
          isActive: 'Y',
          inUse: true,
        },
      ],
    })
    saveTenantChatSpace.mockResolvedValue({
      ok: true,
      messages: ['Saved chat space.'],
      errors: [],
      chatSpace: {
        chatSpaceId: 'CS1',
        spaceName: 'Ops',
        googleChatConfigured: true,
        googleChatWebhookUrlMasked: 'https://chat.googleapis.com/***',
        isActive: 'N',
        inUse: true,
      },
    })

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()

    // Tile menu for CS1 (inUse): offers deactivate, never delete.
    await wrapper.get('[data-testid="tenant-chat-space-CS1"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Ops')
    expect(wrapper.find('[data-testid="tenant-chat-space-menu-deactivate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="tenant-chat-space-menu-delete"]').exists()).toBe(false)

    await wrapper.get('[data-testid="tenant-chat-space-menu-deactivate"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: false },
      expect.anything(),
    )
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved chat space.')
  })

  it('edits an existing chat space and preserves its active state when the webhook is left blank', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-CS1"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="tenant-chat-space-menu-edit"]').trigger('click')
    await flushPromises()

    expect((wrapper.get('input[name="chatSpaceName"]').element as HTMLInputElement).value).toBe('Ops')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')

    expect(wrapper.get('[data-testid="google-chat-webhook-status"]').text()).toContain('Current webhook: https://chat.googleapis.com/***')
    // Leave the webhook input blank and save — the backend keeps the existing webhook.
    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: true },
      expect.anything(),
    )
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('deletes a chat space that is not in use', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-CS2"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="tenant-chat-space-menu-delete"]').exists()).toBe(true)
    await wrapper.get('[data-testid="tenant-chat-space-menu-delete"]').trigger('click')
    await flushPromises()

    expect(deleteTenantChatSpace).toHaveBeenCalledWith({ chatSpaceId: 'CS2' }, expect.anything())
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Deleted chat space.')
  })

  it('surfaces the backend in-use error when a delete race loses to a new automation reference', async () => {
    // callService throws ApiCallError on ok:false envelopes -- it never resolves with one --
    // so a faithful mock rejects, exercising the real catch path instead of the dead
    // `if (!response.ok)` branch.
    deleteTenantChatSpace.mockRejectedValue(
      new ApiCallError("Chat space 'Finance' is in use; deactivate it instead of deleting.", 400),
    )

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-CS2"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-menu-delete"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('is in use; deactivate it instead of deleting.')
  })

  it('opens the notifications popup when old notification routes redirect with workflow state', async () => {
    route.query = { workflow: 'notifications' }

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Ops')
  })

  it('keeps AI settings visible but locked for super-admins without Darpan-admin access', async () => {
    authState.sessionInfo = {
      userId: 'super-admin',
      activeTenantUserGroupId: 'KREWE',
      activeTenantLabel: 'Krewe',
      timeZone: 'America/Los_Angeles',
      availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
      canEditActiveTenantData: true,
      isSuperAdmin: true,
      canManageDarpanCore: false,
    }

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(getLlmSettings).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Darpan admin only')
    expect(wrapper.find('[data-testid="tenant-ai-create-action"]').exists()).toBe(false)
  })
})
