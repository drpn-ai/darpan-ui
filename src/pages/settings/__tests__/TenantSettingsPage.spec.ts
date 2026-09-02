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
const getSlackInstall = vi.hoisted(() => vi.fn())
const saveSlackBotToken = vi.hoisted(() => vi.fn())
const beginSlackInstall = vi.hoisted(() => vi.fn())
const listSlackChannels = vi.hoisted(() => vi.fn())
const disconnectSlackWorkspace = vi.hoisted(() => vi.fn())
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
    getSlackInstall,
    saveSlackBotToken,
    beginSlackInstall,
    listSlackChannels,
    disconnectSlackWorkspace,
    listSftpServers,
    listNsAuthConfigs,
    listNsRestletConfigs,
    listShopifyAuthConfigs,
    listOmsRestSourceConfigs,
  },
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
    // Default: Slack is configured on the deployment but no workspace is connected, so the wizard
    // keeps its webhook step. Tests that need a connection override this.
    getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: true, installs: [] })
    saveSlackBotToken.mockResolvedValue({
      ok: true, messages: ['Connected to Acme as darpan.'], missingScopes: [],
      install: { slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', isActive: 'Y' } })
    beginSlackInstall.mockResolvedValue({
      ok: true, authorizeUrl: 'https://slack.com/oauth/v2/authorize?client_id=1&state=abc' })
    listSlackChannels.mockResolvedValue({ ok: true, channels: [], nextCursor: null })
    disconnectSlackWorkspace.mockResolvedValue({ ok: true, messages: ['Disconnected Acme.'] })
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
          chatProviderEnumId: 'CHAT_PROV_GOOGLE',
          chatProviderLabel: 'Google Chat',
          webhookConfigured: true,
          googleChatConfigured: true,
          webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
          isActive: 'Y',
          inUse: true,
        },
        {
          chatSpaceId: 'CS2',
          spaceName: 'Finance',
          chatProviderEnumId: 'CHAT_PROV_GOOGLE',
          chatProviderLabel: 'Google Chat',
          webhookConfigured: false,
          googleChatConfigured: false,
          googleChatWebhookUrl: null,
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
        chatProviderEnumId: 'CHAT_PROV_GOOGLE',
        chatProviderLabel: 'Google Chat',
        webhookConfigured: true,
        googleChatConfigured: true,
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
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

  it('does not claim notifications are unconfigured while chat spaces are still loading', async () => {
    // An unresolved chat-space fetch leaves `chatSpaces` empty, which is indistinguishable from
    // "loaded and genuinely empty" unless the summary consults the loading flag. It used to render
    // a definitive "Not configured" and then flip to "2 spaces" once the fetch landed.
    let releaseChatSpaces: (value: unknown) => void = () => {}
    listTenantChatSpaces.mockReturnValue(new Promise((resolve) => { releaseChatSpaces = resolve }))

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    const summaryWhileLoading = wrapper.get('[data-testid="tenant-module-notifications"]').text()
    expect(summaryWhileLoading).not.toContain('Not configured')

    releaseChatSpaces({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: true, googleChatConfigured: true, isActive: 'Y', inUse: true },
        { chatSpaceId: 'CS2', spaceName: 'Finance', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: false, googleChatConfigured: false, isActive: 'Y', inUse: false },
      ],
    })
    await flushPromises()

    expect(wrapper.get('[data-testid="tenant-module-notifications"]').text()).toContain('2 spaces')
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

  // The webhook URL is not a secret here by the 2026-08-14 decision that removed encrypt="true"
  // from the column: the entity description says reads "are no longer masked either", and the step
  // prints the stored URL in clear directly below this input ("Current webhook: ..."). A masked
  // entry box therefore hid nothing, while making it impossible to eyeball a pasted URL for the
  // truncation that otherwise only surfaces at delivery time.
  it('does not mask the webhook input, which sits above the URL printed in clear', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-add"]').trigger('click')
    await wrapper.get('input[name="chatSpaceName"]').setValue('Finance')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')

    expect(wrapper.get('input[name="webhookUrl"]').attributes('type')).not.toBe('password')
  })

  it('lists chat spaces and adds one through the three-step popup', async () => {
    const WEBHOOK = 'https://chat.googleapis.com/v1/spaces/KREWE_SPACE/messages?key=test-key&token=test-token'
    listTenantChatSpaces.mockResolvedValue({ ok: true, chatSpaces: [
      { chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: true, googleChatConfigured: true, isActive: 'Y', inUse: true }] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Ops')
    await wrapper.get('[data-testid="tenant-chat-space-add"]').trigger('click')
    await wrapper.get('input[name="chatSpaceName"]').setValue('Finance')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    // Provider step — defaults to Google Chat, so it is answerable without touching it.
    expect(wrapper.get('[role="dialog"]').text()).toContain('Which chat product does it post to?')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('input[name="webhookUrl"]').setValue(WEBHOOK)
    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()
    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      { spaceName: 'Finance', chatProviderEnumId: 'CHAT_PROV_GOOGLE', webhookUrl: WEBHOOK, isActive: true },
      expect.anything())
    expect(push).not.toHaveBeenCalledWith('/settings/notifications')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved chat space.')
  })

  it('creates a Slack space and sends the Slack provider with the webhook', async () => {
    const SLACK_WEBHOOK = 'https://hooks.slack.com/services/T-EXAMPLE/B-EXAMPLE/placeholder-not-a-real-secret'
    listTenantChatSpaces.mockResolvedValue({ ok: true, chatSpaces: [] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-add"]').trigger('click')

    await wrapper.get('input[name="chatSpaceName"]').setValue('Ops Slack')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('[data-testid="tenant-chat-provider-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="CHAT_PROV_SLACK"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('input[name="webhookUrl"]').setValue(SLACK_WEBHOOK)
    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      { spaceName: 'Ops Slack', chatProviderEnumId: 'CHAT_PROV_SLACK', webhookUrl: SLACK_WEBHOOK, isActive: true },
      expect.anything(),
    )
  })

  // A space's provider decides which credential it carries and which address shape means anything.
  // Changing it is not an edit of that space, it is a different destination — which is what delete
  // and create already say. Offering the card invited a save that strands the old credential.
  it('never asks for the provider when editing an existing space', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-CS1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-menu-edit"]').trigger('click')
    await flushPromises()

    // One Next from the name card lands on the destination card, not on a provider card.
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')

    expect(wrapper.find('[data-testid="tenant-chat-provider-select"]').exists()).toBe(false)
    expect(wrapper.find('input[name="webhookUrl"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="save-tenant-chat-space"]').exists()).toBe(true)
  })

  it('sends the space its existing provider unchanged when edited', async () => {
    const NEW_WEBHOOK = 'https://chat.googleapis.com/v1/spaces/OPS_MOVED/messages?key=k2&token=t2'
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-CS1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-menu-edit"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('input[name="webhookUrl"]').setValue(NEW_WEBHOOK)
    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      {
        chatSpaceId: 'CS1',
        spaceName: 'Ops',
        chatProviderEnumId: 'CHAT_PROV_GOOGLE',
        webhookUrl: NEW_WEBHOOK,
        isActive: true,
      },
      expect.anything(),
    )
  })

  // Replaced the former "will not save an edited space on its old webhook after the provider is
  // switched". That test guarded a mid-edit provider switch, which is no longer reachable: the card
  // is gone from the edit path and save#TenantChatSpace refuses the change. What still matters is
  // that the stored webhook shows and counts, so an edit that only renames does not demand a re-paste.
  it('shows the stored webhook on edit and lets a rename save without re-pasting it', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-CS1"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-menu-edit"]').trigger('click')
    await flushPromises()

    await wrapper.get('input[name="chatSpaceName"]').setValue('Ops renamed')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')

    expect(wrapper.find('[data-testid="google-chat-webhook-status"]').exists()).toBe(true)
    expect(
      (wrapper.get('[data-testid="save-tenant-chat-space"]').element as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it('offers a Slack connection and sends the admin to the authorize URL', async () => {
    const assign = vi.fn()
    const original = window.location
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, assign } })
    try {
      const wrapper = mount(TenantSettingsPage)
      await flushPromises()
      await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
      await flushPromises()

      await wrapper.get('[data-testid="tenant-chat-space-slack"]').trigger('click')
      await flushPromises()
      await wrapper.get('[data-testid="tenant-slack-menu-connect"]').trigger('click')
      await flushPromises()

      expect(beginSlackInstall).toHaveBeenCalled()
      // Full-page navigation, not a popup: Slack's consent screen refuses to render in an iframe.
      expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?client_id=1&state=abc')
    } finally {
      Object.defineProperty(window, 'location', { configurable: true, value: original })
    }
  })

  it('connects with a pasted bot token when OAuth is not configured on the deployment', async () => {
    // The whole point of this path: a deployment with no client id still offers Slack, and a
    // workspace whose admins will not install apps can still be connected.
    getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: false, installs: [] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-slack"]').trigger('click')
    await flushPromises()

    // No OAuth option offered, because this deployment cannot complete it.
    expect(wrapper.find('[data-testid="tenant-slack-menu-connect"]').exists()).toBe(false)
    await wrapper.get('[data-testid="tenant-slack-menu-token"]').trigger('click')
    await flushPromises()

    const input = wrapper.get('[data-testid="slack-bot-token-input"]')
    expect(input.attributes('type')).toBe('password')
    await input.setValue('xoxb-real-token')
    await wrapper.get('[data-testid="save-slack-bot-token"]').trigger('click')
    await flushPromises()

    expect(saveSlackBotToken).toHaveBeenCalledWith({ botAccessToken: 'xoxb-real-token' }, expect.anything())
    expect(wrapper.text()).toContain('Connected to Acme')

    // Connecting a workspace creates NO destination, so the flow must not end here. Closing the
    // popup on the success message read as completion and left "Add a chat space" undiscovered.
    expect(wrapper.find('[data-testid="tenant-chat-space-add"]').exists()).toBe(true)
  })

  it('offers a route to a channel from the connected-workspace menu, with Slack preselected', async () => {
    // Without this the connected menu is workspace maintenance only — replace token / disconnect —
    // and the operator who just connected has no route to the thing they connected FOR.
    getSlackInstall.mockResolvedValue({
      ok: true, slackConfigured: true, oauthAvailable: false,
      installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', botUserId: 'U_BOT', isActive: 'Y' }],
    })
    listSlackChannels.mockResolvedValue({
      ok: true, nextCursor: null,
      channels: [{ id: 'C1', name: 'darpan-test', isPrivate: false, isMember: false }],
    })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-slack"]').trigger('click')
    await flushPromises()

    await wrapper.get('[data-testid="tenant-slack-menu-add-space"]').trigger('click')
    await wrapper.get('input[name="chatSpaceName"]').setValue('Ops Slack')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await flushPromises()

    // ONE Next, not two: the provider card is skipped because coming from the Slack menu already
    // answered it. Showing it pre-filled made the operator confirm a choice they had just made.
    expect(wrapper.find('[data-testid="tenant-chat-provider-select"]').exists()).toBe(false)
    expect(wrapper.find('input[name="webhookUrl"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-slack-channel-select"]').exists()).toBe(true)
  })

  it('still asks which product when the space is added from the generic entry point', async () => {
    // The provider card is only redundant when the entry point fixed it. Reached from "Add a chat
    // space" in the list, nothing has been chosen yet and the question is real.
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-add"]').trigger('click')
    await wrapper.get('input[name="chatSpaceName"]').setValue('Somewhere')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')

    expect(wrapper.find('[data-testid="tenant-chat-provider-select"]').exists()).toBe(true)
  })

  it('says so when the Slack connection lookup fails, instead of just losing the option', async () => {
    // An empty install list silently removes the channel picker, which is indistinguishable from
    // "no workspace connected" and sends the operator hunting for a step that is still there.
    getSlackInstall.mockRejectedValue(new ApiCallError('Slack lookup failed.', 500, {}))
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="slack-load-error"]').text()).toContain('Slack lookup failed.')
  })

  it('surfaces a missing-scope warning alongside the success message', async () => {
    // A partially scoped token connects successfully and then produces an empty channel picker.
    // A success-only banner would make that look like a bug rather than a permissions gap.
    saveSlackBotToken.mockResolvedValue({
      ok: true,
      messages: ['Connected to Thin as darpan.', 'Missing scope(s): channels:read. Notifications will still send, but channel listing or posting to channels the app has not joined may fail.'],
      missingScopes: ['channels:read'],
      install: { slackInstallId: 'SI2', teamId: 'T2', teamName: 'Thin', isActive: 'Y' },
    })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-slack"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-slack-menu-token"]').trigger('click')
    await wrapper.get('[data-testid="slack-bot-token-input"]').setValue('xoxb-thin')
    await wrapper.get('[data-testid="save-slack-bot-token"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Missing scope(s): channels:read')
  })

  it('reports a token Slack rejected without claiming success', async () => {
    saveSlackBotToken.mockResolvedValue({ ok: false, errors: ['Slack rejected that token: Slack rejected Darpan\u2019s access.'] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-slack"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-slack-menu-token"]').trigger('click')
    await wrapper.get('[data-testid="slack-bot-token-input"]').setValue('xoxb-bad')
    await wrapper.get('[data-testid="save-slack-bot-token"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Slack rejected that token')
    // The popup stays open so the paste can be corrected in place.
    expect(wrapper.find('[data-testid="slack-bot-token-input"]').exists()).toBe(true)
  })

  it('replaces the webhook card with a channel picker once a workspace is connected', async () => {
    getSlackInstall.mockResolvedValue({
      ok: true,
      slackConfigured: true,
      installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', botUserId: 'U_BOT', isActive: 'Y' }],
    })
    listSlackChannels.mockResolvedValue({
      ok: true,
      botUserId: 'U_BOT',
      channels: [
        { id: 'C1', name: 'ops', isPrivate: false, isMember: false },
        { id: 'G2', name: 'secret', isPrivate: true, isMember: false },
      ],
      nextCursor: null,
    })
    listTenantChatSpaces.mockResolvedValue({ ok: true, chatSpaces: [] })

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="tenant-chat-space-add"]').trigger('click')
    await wrapper.get('input[name="chatSpaceName"]').setValue('Ops Slack')
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await wrapper.get('[data-testid="tenant-chat-provider-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="CHAT_PROV_SLACK"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')
    await flushPromises()

    // No webhook to paste — the workspace token plus a channel id is the whole configuration.
    expect(wrapper.find('input[name="webhookUrl"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-slack-channel-select"]').exists()).toBe(true)
    expect(listSlackChannels).toHaveBeenCalledWith({ slackInstallId: 'SI1' }, expect.anything())

    await wrapper.get('[data-testid="tenant-slack-channel-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="G2"]').trigger('click')
    await flushPromises()
    // chat:write.public covers public channels; a PRIVATE one the bot is not in fails at the first
    // run, so the warning has to appear here rather than hours later.
    expect(wrapper.get('[data-testid="slack-invite-note"]').text()).toContain('invite the Darpan app')

    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()
    expect(saveTenantChatSpace).toHaveBeenCalledWith({
      spaceName: 'Ops Slack',
      isActive: true,
      chatProviderEnumId: 'CHAT_PROV_SLACK',
      slackInstallId: 'SI1',
      slackChannelId: 'G2',
      slackChannelName: 'secret',
    }, expect.anything())
  })

  it('reports the Slack callback result and clears it from the URL', async () => {
    route.query = { slack: 'connected', team: 'Acme' }
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Connected to Acme.')
    // Left in place, a refresh would replay the banner.
    expect(replace).toHaveBeenCalledWith({ query: {} })
  })

  it('explains a refused Slack authorisation', async () => {
    route.query = { slack: 'error', reason: 'declined' }
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    expect(wrapper.text()).toContain('cancelled')
  })

  it('blocks delete for in-use spaces and offers deactivate', async () => {
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      chatSpaces: [
        {
          chatSpaceId: 'CS1',
          spaceName: 'Ops',
          chatProviderEnumId: 'CHAT_PROV_GOOGLE',
          chatProviderLabel: 'Google Chat',
          webhookConfigured: true,
          googleChatConfigured: true,
          webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
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
        chatProviderEnumId: 'CHAT_PROV_GOOGLE',
        chatProviderLabel: 'Google Chat',
        webhookConfigured: true,
        googleChatConfigured: true,
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
        googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
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
    // ONE Next, not two: editing skips the provider card, because a space cannot change chat product.
    await wrapper.get('[data-testid="chat-space-form-next"]').trigger('click')

    expect(wrapper.get('[data-testid="google-chat-webhook-status"]').text()).toContain('Current webhook: https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t')
    // Leave the webhook input blank and save — the backend keeps the existing webhook.
    await wrapper.get('[data-testid="save-tenant-chat-space"]').trigger('click')
    await flushPromises()

    expect(saveTenantChatSpace).toHaveBeenCalledWith(
      { chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', isActive: true },
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
