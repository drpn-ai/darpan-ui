import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const getLlmSettings = vi.hoisted(() => vi.fn())
const saveLlmSettings = vi.hoisted(() => vi.fn())
const getTenantSettings = vi.hoisted(() => vi.fn())
const saveTenantSettings = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const getSlackInstall = vi.hoisted(() => vi.fn())
const listSftpServers = vi.hoisted(() => vi.fn())
const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const listNsRestletConfigs = vi.hoisted(() => vi.fn())
const listShopifyAuthConfigs = vi.hoisted(() => vi.fn())
const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const listPeakPeriods = vi.hoisted(() => vi.fn())
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
  peakFacade: { listPeakPeriods },
  settingsFacade: {
    getLlmSettings,
    saveLlmSettings,
    getTenantSettings,
    listTenantChatSpaces,
    getSlackInstall,
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

/** The value column of the row that holds this action button. */
function rowValue(wrapper: ReturnType<typeof mount>, testId: string): string {
  const row = wrapper.get(`[data-testid="${testId}"]`).element.closest('.tenant-settings-row')
  return row?.querySelector('.tenant-settings-row__value')?.textContent?.trim() ?? ''
}

describe('TenantSettingsPage', () => {
  beforeEach(() => {
    route.fullPath = '/settings/tenant'
    route.query = {}
    // Slack lives on Notifications now (DAR-UI-123); this page must not ask about it.
    getSlackInstall.mockReset()
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
    listSftpServers.mockReset()
    listNsAuthConfigs.mockReset()
    listNsRestletConfigs.mockReset()
    listShopifyAuthConfigs.mockReset()
    listOmsRestSourceConfigs.mockReset()
    listPeakPeriods.mockReset()
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [] })

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
  })

  it('does not claim notifications are unconfigured while chat spaces are still loading', async () => {
    // An unresolved chat-space fetch leaves `chatSpaces` empty, which is indistinguishable from
    // "loaded and genuinely empty" unless the summary consults the loading flag. It used to render
    // a definitive "None" and then flip to "2" once the fetch landed.
    let releaseChatSpaces: (value: unknown) => void = () => {}
    listTenantChatSpaces.mockReturnValue(new Promise((resolve) => { releaseChatSpaces = resolve }))

    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-notifications')).toBe('—')

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

    expect(rowValue(wrapper, 'tenant-module-notifications')).toBe('2 spaces')
  })

  it('renders one tenant settings surface as groups of rows, with no tiles left', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.find('h1').text()).toBe('Krewe Settings')
    expect(wrapper.text()).not.toContain('Active Tenant')
    expect(wrapper.find('.tenant-settings-summary-grid').exists()).toBe(false)
    expect(wrapper.find('.static-page-list-tile').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('AI Configuration')
    expect(wrapper.text()).not.toContain('Localization')
    expect(wrapper.text()).not.toContain('Operations')
    expect(rowValue(wrapper, 'tenant-module-notifications')).toBe('2 spaces')
    expect(rowValue(wrapper, 'tenant-module-timezone')).toBe('America/Los_Angeles')
    expect(rowValue(wrapper, 'tenant-ai-provider-tile')).toBe('Gemini · gemini-2.5-flash · Primary · Enabled · Key stored')
    expect(wrapper.text()).not.toContain('OpenAI')
    expect(wrapper.text()).not.toContain('Connections')
    expect(wrapper.find('[data-testid="tenant-module-sftp"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-netsuite"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-shopify"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-oms"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-module-runs"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Run Editor')
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

  it('orders the groups Chat, Time, Audit, AI, each one list of rows', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    const sections = wrapper.findAll('.static-page-section')
    expect(sections.map((section) => section.attributes('data-testid'))).toEqual([
      'tenant-section-chat', 'tenant-section-time', 'tenant-section-audit', 'tenant-section-ai',
    ])
    expect(sections.map((section) => section.get('h2').text())).toEqual(['Chat', 'Time', 'Audit', 'AI'])
    for (const section of sections) expect(section.findAll('.tenant-settings-rows')).toHaveLength(1)
    expect(wrapper.findAll('.tenant-settings-row__label').map((label) => label.text())).toEqual([
      'Notifications', 'Timezone', 'Config history', 'Scripts', 'Peak periods', 'Provider',
    ])
  })

  it('names popups with a verb and pages with Open', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="tenant-module-notifications"]').text()).toBe('Open →')
    expect(wrapper.find('[data-testid="tenant-module-streaks-space"]').exists()).toBe(false)
    // DAR-UI-129: edit buttons are icons; the words are the accessible name.
    expect(wrapper.get('[data-testid="tenant-module-timezone"]').attributes('aria-label')).toBe('Change tenant timezone')
    expect(wrapper.get('[data-testid="tenant-module-timezone"]').text()).toBe('')
    expect(wrapper.get('[data-testid="tenant-ai-provider-tile"]').attributes('aria-label')).toBe('Edit AI provider')
    expect(wrapper.get('[data-testid="tenant-ai-provider-tile"]').text()).toBe('')
    expect(wrapper.get('[data-testid="tenant-module-config-history"]').text()).toBe('Open →')
    expect(wrapper.get('[data-testid="tenant-module-scripts"]').text()).toBe('Open →')
    expect(rowValue(wrapper, 'tenant-module-config-history')).toBe('Versions and restores')
    expect(rowValue(wrapper, 'tenant-module-scripts')).toBe('JEXL used by checks')
  })

  // DAR-BE-328. The Peak periods row: None + Set up, else the current or next period + Open.
  it('shows None and Set up when there are no peak periods', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-peak-periods')).toBe('None')
    expect(wrapper.get('[data-testid="tenant-module-peak-periods"]').text()).toBe('Set up')
    await wrapper.get('[data-testid="tenant-module-peak-periods"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-periods' })
  })

  it('shows the next peak period with its dates and Open', async () => {
    const year = new Date().getFullYear()
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [
      { peakPeriodId: '2', periodName: 'Later sale', fromDate: `${year}-12-20`, thruDate: `${year}-12-22`, isActive: 'Y', state: 'upcoming' },
      { peakPeriodId: '1', periodName: 'Black Friday sale', fromDate: `${year}-11-24`, thruDate: `${year}-12-01`, isActive: 'Y', state: 'upcoming' },
      { peakPeriodId: '3', periodName: 'Old sale', fromDate: `${year}-01-01`, thruDate: `${year}-01-03`, isActive: 'Y', state: 'ended' },
    ] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-peak-periods')).toBe('Black Friday sale · Nov 24 – Dec 1')
    expect(wrapper.get('[data-testid="tenant-module-peak-periods"]').text()).toBe('Open →')
  })

  // DAR-UI-123. The spaces, streaks among the things that post, moved to Notifications; one row opens it.
  it('opens Notifications from its row, with a count of spaces and no chat popups left here', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="tenant-chat-space-row"]').exists()).toBe(false)
    await wrapper.get('[data-testid="tenant-module-notifications"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-notifications' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(getSlackInstall).not.toHaveBeenCalled()
  })

  it('counts one space as one', async () => {
    listTenantChatSpaces.mockResolvedValue({
      ok: true, messages: [], errors: [],
      chatSpaces: [{ chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: true, googleChatConfigured: true, isActive: 'Y', inUse: true }],
    })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-notifications')).toBe('1 space')
  })

  it('opens the timezone popup from its Change', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-timezone"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="dialog"]').text()).toContain('Set the tenant timezone.')
  })

  it('opens the config history and scripts pages from their rows', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    await wrapper.get('[data-testid="tenant-module-config-history"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-config-history' })
    await wrapper.get('[data-testid="tenant-module-scripts"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-scripts' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
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
    expect(rowValue(wrapper, 'tenant-module-timezone')).toContain('Europe/London')
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

  it('leaves the AI group out for super-admins without Darpan-admin access', async () => {
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
    expect(wrapper.find('[data-testid="tenant-section-ai"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="tenant-ai-provider-tile"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Darpan admin only')
    expect(wrapper.findAll('.static-page-section h2').map((heading) => heading.text())).toEqual(['Chat', 'Time', 'Audit'])
  })
})
