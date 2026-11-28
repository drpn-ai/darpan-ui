import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const getTenantSettings = vi.hoisted(() => vi.fn())
const saveTenantSettings = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const getSlackInstall = vi.hoisted(() => vi.fn())
const listSftpServers = vi.hoisted(() => vi.fn())
const listNsAuthConfigs = vi.hoisted(() => vi.fn())
const listShopifyAuthConfigs = vi.hoisted(() => vi.fn())
const listOmsRestSourceConfigs = vi.hoisted(() => vi.fn())
const listPeakPeriods = vi.hoisted(() => vi.fn())
const listSyncPairs = vi.hoisted(() => vi.fn())
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
  pulseFacade: { listSyncPairs },
  settingsFacade: {
    getTenantSettings,
    listTenantChatSpaces,
    getSlackInstall,
    listSftpServers,
    listNsAuthConfigs,
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

/** The value of a Schedule row (the row is its own button). */
function rowValue(wrapper: ReturnType<typeof mount>, testId: string): string {
  const row = wrapper.get(`[data-testid="${testId}"]`).element.closest('.tenant-settings-row')
  return row?.querySelector('.tenant-settings-row__value')?.textContent?.trim() ?? ''
}

/** The value of a header fact. */
function factValue(wrapper: ReturnType<typeof mount>, testId: string): string {
  return wrapper.get(`[data-testid="${testId}"]`).get('.static-fact__value').text()
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
    getTenantSettings.mockReset()
    saveTenantSettings.mockReset()
    listTenantChatSpaces.mockReset()
    listSftpServers.mockReset()
    listNsAuthConfigs.mockReset()
    listShopifyAuthConfigs.mockReset()
    listOmsRestSourceConfigs.mockReset()
    listPeakPeriods.mockReset()
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [] })
    listSyncPairs.mockReset()
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [] })

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
          webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA111/messages?key=k&token=t',
          isActive: 'Y',
          inUse: true,
        },
        {
          chatSpaceId: 'CS2',
          spaceName: 'Finance',
          chatProviderEnumId: 'CHAT_PROV_GOOGLE',
          chatProviderLabel: 'Google Chat',
          webhookConfigured: false,
          webhookUrl: null,
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

    expect(factValue(wrapper, 'tenant-module-notifications')).toBe('—')

    releaseChatSpaces({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: true, isActive: 'Y', inUse: true },
        { chatSpaceId: 'CS2', spaceName: 'Finance', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: false, isActive: 'Y', inUse: false },
      ],
    })
    await flushPromises()

    expect(factValue(wrapper, 'tenant-module-notifications')).toBe('2 spaces')
  })

  // DAR-UI-159 (RAILS 2026-11-27, "this page needs help"): the settings header, then one Schedule group.
  it('opens with the tenant name and a facts strip of Timezone and Notifications', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="tenant-settings-name"]').text()).toBe('Krewe')
    expect(wrapper.get('[data-testid="tenant-settings-name"]').attributes('contenteditable')).toBe('false')
    expect(wrapper.findAll('[data-testid="tenant-settings-facts"] .static-page-summary-label').map((l) => l.text()))
      .toEqual(['Timezone', 'Notifications'])
    expect(factValue(wrapper, 'tenant-module-timezone')).toBe('America/Los_Angeles')
    expect(factValue(wrapper, 'tenant-module-notifications')).toBe('2 spaces')
    expect(getTenantSettings).toHaveBeenCalledTimes(1)
    expect(listTenantChatSpaces).toHaveBeenCalledTimes(1)
    expect(listSftpServers).not.toHaveBeenCalled()
    expect(listNsAuthConfigs).not.toHaveBeenCalled()
    expect(listShopifyAuthConfigs).not.toHaveBeenCalled()
    expect(listOmsRestSourceConfigs).not.toHaveBeenCalled()
  })

  it('says Tenant Settings when no tenant is active', async () => {
    authState.sessionInfo = { ...authState.sessionInfo, activeTenantUserGroupId: '' }
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="tenant-settings-name"]').text()).toBe('Tenant Settings')
  })

  it('groups Peak periods and Sync pulse under Schedule, with no Audit or AI group and no Open buttons', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    const sections = wrapper.findAll('.static-page-section')
    expect(sections.map((section) => section.get('h2').text())).toEqual(['Schedule'])
    expect(wrapper.findAll('.tenant-settings-row__label').map((label) => label.text())).toEqual(['Peak periods', 'Sync pulse'])
    for (const row of wrapper.findAll('.tenant-settings-row')) expect(row.element.tagName).toBe('BUTTON')
    expect(wrapper.text()).not.toContain('Open')
    // DAR-UI-159: Config history is on Audit settings; AI provider settings are not in the app.
    expect(wrapper.find('[data-testid="tenant-module-config-history"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Config history')
    expect(wrapper.text()).not.toContain('Provider')
    expect(wrapper.text()).not.toContain('OpenAI')
    expect(wrapper.html()).not.toContain('/settings/ai')
    // DAR-UI-138: Queries are a page of their own (/queries), not a setting.
    expect(wrapper.find('[data-testid="tenant-module-scripts"]').exists()).toBe(false)
  })

  // DAR-BE-328. The Peak periods row: None, else the period on now or the next one, with when it is.
  it('reads None and opens the page to set one up when there are no peak periods', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-peak-periods')).toBe('None')
    expect(wrapper.get('[data-testid="tenant-module-peak-periods"]').attributes('aria-label')).toBe('Set up peak periods')
    await wrapper.get('[data-testid="tenant-module-peak-periods"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-periods' })
  })

  it('names the period on now and says so, not its dates again (RAILS read "PEAK Nov 27 · Nov 27 – Nov 27")', async () => {
    const year = new Date().getFullYear()
    listPeakPeriods.mockResolvedValue({ ok: true, errors: [], messages: [], peakPeriods: [
      { peakPeriodId: '2', periodName: 'Later sale', fromDate: `${year}-12-20`, thruDate: `${year}-12-22`, isActive: 'Y', state: 'upcoming' },
      { peakPeriodId: '1', periodName: 'Black Friday', fromDate: `${year}-11-27`, thruDate: `${year}-11-27`, isActive: 'Y', state: 'on' },
      { peakPeriodId: '3', periodName: 'Old sale', fromDate: `${year}-01-01`, thruDate: `${year}-01-03`, isActive: 'Y', state: 'ended' },
    ] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-peak-periods')).toBe('Black Friday · on now')
    expect(wrapper.get('[data-testid="tenant-module-peak-periods"]').attributes('aria-label')).toBe('Open peak periods')
  })

  // DAR-BE-328. The Sync pulse row: None, else how many pairs pulse (and their cadence when they share one).
  it('reads None and opens the page to set one up when there are no sync pairs', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-sync-pulse')).toBe('None')
    expect(wrapper.get('[data-testid="tenant-module-sync-pulse"]').attributes('aria-label')).toBe('Set up sync pulse')
    await wrapper.get('[data-testid="tenant-module-sync-pulse"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-sync-pairs' })
  })

  // DAR-UI-154 (prod-roll look 2026-11-26): no "None" flash while the reads are in flight.
  it('shows Loading… on the peak and sync rows, not pressable, until their reads return', async () => {
    listPeakPeriods.mockReturnValue(new Promise(() => {}))
    listSyncPairs.mockReturnValue(new Promise(() => {}))
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="tenant-peak-value"]').text()).toBe('Loading…')
    expect(wrapper.get('[data-testid="tenant-sync-value"]').text()).toBe('Loading…')
    expect(wrapper.get('[data-testid="tenant-module-peak-periods"]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-testid="tenant-module-sync-pulse"]').attributes('disabled')).toBeDefined()
  })

  it('counts the pulsing pairs, with the cadence they share', async () => {
    const pair = (over: Record<string, unknown>) => ({ syncPairId: '1', label: 'Approved orders', pulseEveryMinutes: 120, ...over })
    // DAR-UI-153: a pair that only carries a start allowance (no pulse, no peak period pulse) is not counted.
    listSyncPairs.mockResolvedValue({ ok: true, errors: [], messages: [], syncPairs: [pair({}), pair({ syncPairId: '2', label: 'Returns' }),
      pair({ syncPairId: '3', label: 'Exchanges', pulseEveryMinutes: null })] })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(rowValue(wrapper, 'tenant-module-sync-pulse')).toBe('2 pairs · every 2h')
    expect(wrapper.get('[data-testid="tenant-module-sync-pulse"]').attributes('aria-label')).toBe('Open sync pulse')
  })

  // DAR-UI-123. The spaces, streaks among the things that post, moved to Notifications; its fact opens it.
  it('opens Notifications from its fact, with no chat popups left here', async () => {
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
      chatSpaces: [{ chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: true, isActive: 'Y', inUse: true }],
    })
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(factValue(wrapper, 'tenant-module-notifications')).toBe('1 space')
  })

  it('edits tenant timezone from its fact\'s popup', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.get('[data-testid="tenant-module-timezone"]').attributes('aria-label')).toBe('Change tenant timezone: America/Los_Angeles')
    await wrapper.get('[data-testid="tenant-module-timezone"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Set the tenant timezone.')
    expect(wrapper.get('.static-page-frame').classes()).toContain('static-page-frame--popup-open')
    expect(wrapper.get('[data-testid="tenant-timezone-select"]').text()).toContain('America/Los_Angeles')
    await wrapper.get('[data-testid="tenant-timezone-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-search"]').setValue('Europe/London')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="Europe/London"]').trigger('click')
    await wrapper.get('[data-testid="save-tenant-timezone"]').trigger('click')
    await flushPromises()

    expect(saveTenantSettings).toHaveBeenCalledWith({ timeZone: 'Europe/London' })
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('Saved tenant settings.')
    expect(factValue(wrapper, 'tenant-module-timezone')).toBe('Europe/London')
  })

  // DAR-OPS-029 U12: a read that failed is not an answer. "None" or "No spaces" after a failed read says the tenant has
  // none; the rows hold a neutral mark and the page says some settings did not load. A failed row still opens its page,
  // which reads again and says why.
  it('says some settings did not load, never None, when the peak, sync or chat-space reads fail', async () => {
    listPeakPeriods.mockRejectedValue(new Error('down'))
    listSyncPairs.mockRejectedValue(new Error('down'))
    listTenantChatSpaces.mockRejectedValue(new Error('down'))
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()

    expect(wrapper.text()).toContain('Some tenant settings could not be loaded.')
    expect(rowValue(wrapper, 'tenant-module-peak-periods')).toBe('—')
    expect(rowValue(wrapper, 'tenant-module-sync-pulse')).toBe('—')
    expect(factValue(wrapper, 'tenant-module-notifications')).toBe('—')
    expect(wrapper.get('[data-testid="tenant-module-peak-periods"]').attributes('aria-label')).toBe('Open peak periods')
    expect(wrapper.get('[data-testid="tenant-module-sync-pulse"]').attributes('aria-label')).toBe('Open sync pulse')
    await wrapper.get('[data-testid="tenant-module-peak-periods"]').trigger('click')
    expect(push).toHaveBeenCalledWith({ name: 'settings-tenant-peak-periods' })
  })

  it('closes the timezone popup without touching the address', async () => {
    const wrapper = mount(TenantSettingsPage)
    await flushPromises()
    await wrapper.get('[data-testid="tenant-module-timezone"]').trigger('click')
    await wrapper.get('[data-testid="tenant-timezone-workflow-cancel"]').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(replace).not.toHaveBeenCalled()
  })
})
