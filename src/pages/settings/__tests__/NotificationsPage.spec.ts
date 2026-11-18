import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'

const getNotificationRoutes = vi.hoisted(() => vi.fn())
const setNotificationRoute = vi.hoisted(() => vi.fn())
const sendChatSpaceTest = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const saveTenantChatSpace = vi.hoisted(() => vi.fn())
const deleteTenantChatSpace = vi.hoisted(() => vi.fn())
const getSlackInstall = vi.hoisted(() => vi.fn())
const saveSlackBotToken = vi.hoisted(() => vi.fn())
const beginSlackInstall = vi.hoisted(() => vi.fn())
const listSlackChannels = vi.hoisted(() => vi.fn())
const disconnectSlackWorkspace = vi.hoisted(() => vi.fn())
const replace = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({ fullPath: '/settings/notifications', query: {} as Record<string, unknown> }))
const permissions = vi.hoisted(() => ({ canEditTenantSettings: true }))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ replace, push: vi.fn() }),
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    getNotificationRoutes,
    setNotificationRoute,
    sendChatSpaceTest,
    listTenantChatSpaces,
    saveTenantChatSpace,
    deleteTenantChatSpace,
    getSlackInstall,
    saveSlackBotToken,
    beginSlackInstall,
    listSlackChannels,
    disconnectSlackWorkspace,
  },
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissions,
}))

import NotificationsPage from '../NotificationsPage.vue'

const SPACES = [
  { chatSpaceId: 'CS1', spaceName: 'Ops', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', deliveryMode: 'WEBHOOK', webhookConfigured: true, isActive: 'Y' },
  { chatSpaceId: 'CS3', spaceName: '#alerts', chatProviderEnumId: 'CHAT_PROV_SLACK', chatProviderLabel: 'Slack', slackChannelName: 'alerts', deliveryMode: 'SLACK_BOT', webhookConfigured: true, isActive: 'Y' },
  { chatSpaceId: 'CS2', spaceName: 'Finance', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', deliveryMode: 'WEBHOOK', webhookConfigured: true, isActive: 'N' },
]

const ROUTES = [
  { sourceType: 'STREAKS', sourceId: null, label: 'Streaks', when: null, paused: false, chatSpaceId: 'CS1' },
  { sourceType: 'AUDIT_UPDATE', sourceId: 'month-close', label: 'Month close update', when: 'After each run', paused: true, chatSpaceId: null },
  { sourceType: 'AUTOMATION', sourceId: 'AUT1', label: 'Daily order sync', when: 'Daily 06:00', paused: false, chatSpaceId: 'CS2' },
  { sourceType: 'SCRIPT', sourceId: 'DEP1', label: 'Refund watch', when: 'Daily 07:00', paused: false, chatSpaceId: 'CS1' },
]

function fullSpace(space: (typeof SPACES)[number], extra: Record<string, unknown> = {}) {
  return { ...space, googleChatConfigured: true, inUse: true, slackChannelId: space.chatSpaceId === 'CS3' ? 'C1' : null, ...extra }
}

function routesResponse() {
  return { ok: true, messages: [], errors: [], spaces: SPACES.map((space) => ({ ...space })), routes: ROUTES.map((row) => ({ ...row })) }
}

function row(wrapper: VueWrapper, key: string) {
  return wrapper.get(`[data-testid="notifications-route-row"][data-route-key="${key}"]`)
}

function checkedSpaceIds(wrapper: VueWrapper, key: string): string[] {
  return row(wrapper, key).findAll('[data-testid="notifications-dot"][aria-checked="true"]').map((dot) => dot.attributes('data-space-id') ?? '')
}

function dot(wrapper: VueWrapper, key: string, spaceId: string) {
  return row(wrapper, key).get(`[data-testid="notifications-dot"][data-space-id="${spaceId}"]`)
}

function dialog(wrapper: VueWrapper) {
  return wrapper.get('[role="dialog"]')
}

async function click(wrapper: VueWrapper, testId: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await flushPromises()
}

const originalLocation = window.location

describe('NotificationsPage', () => {
  beforeEach(() => {
    route.query = {}
    permissions.canEditTenantSettings = true
    window.sessionStorage.clear()
    for (const mock of [
      getNotificationRoutes, setNotificationRoute, sendChatSpaceTest, listTenantChatSpaces, saveTenantChatSpace,
      deleteTenantChatSpace, getSlackInstall, saveSlackBotToken, beginSlackInstall, listSlackChannels,
      disconnectSlackWorkspace, replace,
    ]) mock.mockReset()
    getNotificationRoutes.mockImplementation(async () => routesResponse())
    listTenantChatSpaces.mockResolvedValue({
      ok: true, messages: [], errors: [],
      chatSpaces: [fullSpace(SPACES[0]!), fullSpace(SPACES[1]!), fullSpace(SPACES[2]!, { inUse: false })],
    })
    getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: true, installs: [] })
    replace.mockResolvedValue(undefined)
  })

  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation })
  })

  it('draws one row per thing that posts and one column per space, plus Nowhere', async () => {
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    const heads = wrapper.findAll('[data-testid="notifications-space-column"]')
    expect(heads.map((head) => head.attributes('data-space-id'))).toEqual(['CS1', 'CS3', 'CS2'])
    expect(wrapper.get('thead').text()).toContain('Nowhere')
    const rows = wrapper.findAll('[data-testid="notifications-route-row"]')
    expect(rows.map((candidate) => [
      candidate.get('.notifications-grid__source-name').text(),
      candidate.find('.notifications-grid__when').exists() ? candidate.get('.notifications-grid__when').text() : '',
    ])).toEqual([
      ['Streaks', ''],
      ['Month close update', 'After each run · paused'],
      ['Daily order sync', 'Daily 06:00'],
      ['Refund watch', 'Daily 07:00'],
    ])
    expect(wrapper.findAll('[data-testid="notifications-paused"]')).toHaveLength(1)
  })

  it('checks exactly one dot in each row, where the route posts now', async () => {
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    expect(checkedSpaceIds(wrapper, 'STREAKS-tenant')).toEqual(['CS1'])
    expect(checkedSpaceIds(wrapper, 'AUDIT_UPDATE-month-close')).toEqual([''])
    expect(checkedSpaceIds(wrapper, 'AUTOMATION-AUT1')).toEqual(['CS2'])
    expect(checkedSpaceIds(wrapper, 'SCRIPT-DEP1')).toEqual(['CS1'])
  })

  it('moves a row when a dot is clicked and says what the service said', async () => {
    setNotificationRoute.mockResolvedValue({
      ok: true, messages: ['Posts to #alerts.'], errors: [],
      route: { ...ROUTES[0], chatSpaceId: 'CS3' },
    })
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    await dot(wrapper, 'STREAKS-tenant', 'CS3').trigger('click')
    await flushPromises()

    // Streaks has no source id, so none is sent.
    expect(setNotificationRoute).toHaveBeenCalledWith({ sourceType: 'STREAKS', chatSpaceId: 'CS3' }, expect.any(AbortSignal))
    expect(checkedSpaceIds(wrapper, 'STREAKS-tenant')).toEqual(['CS3'])
    expect(wrapper.get('[data-testid="notifications-status"]').text()).toBe('Posts to #alerts.')
  })

  it('sends Nowhere as no space, with the source id', async () => {
    setNotificationRoute.mockResolvedValue({
      ok: true, messages: ['Posts nowhere.'], errors: [],
      route: { ...ROUTES[2], chatSpaceId: null },
    })
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    await dot(wrapper, 'AUTOMATION-AUT1', '').trigger('click')
    await flushPromises()

    expect(setNotificationRoute).toHaveBeenCalledWith(
      { sourceType: 'AUTOMATION', sourceId: 'AUT1', chatSpaceId: null }, expect.any(AbortSignal))
    expect(checkedSpaceIds(wrapper, 'AUTOMATION-AUT1')).toEqual([''])
  })

  it('shows a refusal in the service\'s words and leaves the dot where it was', async () => {
    setNotificationRoute.mockRejectedValue(new ApiCallError('Only a tenant admin can move an audit update.', 400))
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    await dot(wrapper, 'AUDIT_UPDATE-month-close', 'CS1').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="notifications-page-error"]').text()).toBe('Only a tenant admin can move an audit update.')
    expect(checkedSpaceIds(wrapper, 'AUDIT_UPDATE-month-close')).toEqual([''])
  })

  it('gives a deployed script no Nowhere', async () => {
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    expect(row(wrapper, 'SCRIPT-DEP1').findAll('[data-testid="notifications-dot"]').map((candidate) => candidate.attributes('data-space-id')))
      .toEqual(['CS1', 'CS3', 'CS2'])
    expect(row(wrapper, 'STREAKS-tenant').find('[data-testid="notifications-dot"][data-space-id=""]').exists()).toBe(true)
  })

  it('marks a switched-off space off and disables its dots', async () => {
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    const off = wrapper.get('[data-testid="notifications-space-column"][data-space-id="CS2"]')
    expect(off.text()).toContain('Google Chat · off')
    for (const key of ['STREAKS-tenant', 'AUDIT_UPDATE-month-close', 'AUTOMATION-AUT1', 'SCRIPT-DEP1']) {
      expect(dot(wrapper, key, 'CS2').attributes('disabled')).toBeDefined()
      expect(dot(wrapper, key, 'CS1').attributes('disabled')).toBeUndefined()
    }
  })

  it('sends a test to a space and shows the service\'s answer', async () => {
    sendChatSpaceTest.mockResolvedValue({ ok: true, messages: ['Sent a test to Ops.'], errors: [] })
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    await wrapper.get('[data-testid="notifications-space-column"][data-space-id="CS1"] [data-testid="notifications-send-test"]').trigger('click')
    await flushPromises()

    expect(sendChatSpaceTest).toHaveBeenCalledWith({ chatSpaceId: 'CS1' }, expect.any(AbortSignal))
    expect(wrapper.get('[data-testid="notifications-status"]').text()).toBe('Sent a test to Ops.')
  })

  it('opens a space\'s menu from its Edit, without Delete while it is in use', async () => {
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    await wrapper.get('[data-testid="notifications-space-column"][data-space-id="CS1"] [data-testid="notifications-space-edit"]').trigger('click')
    await flushPromises()

    expect(dialog(wrapper).text()).toContain('What do you want to do with Ops?')
    expect(wrapper.find('[data-testid="notifications-space-menu-rename"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notifications-space-menu-webhook"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notifications-space-menu-deactivate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="notifications-space-menu-delete"]').exists()).toBe(false)
  })

  it('switches an off space back on from its menu', async () => {
    saveTenantChatSpace.mockResolvedValue({ ok: true, messages: ['Saved chat space.'], errors: [], chatSpace: fullSpace(SPACES[2]!, { isActive: 'Y' }) })
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    await wrapper.get('[data-testid="notifications-space-column"][data-space-id="CS2"] [data-testid="notifications-space-edit"]').trigger('click')
    await flushPromises()
    await click(wrapper, 'notifications-space-menu-activate')

    expect(saveTenantChatSpace).toHaveBeenCalledWith({ chatSpaceId: 'CS2', spaceName: 'Finance', isActive: true }, expect.any(AbortSignal))
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(getNotificationRoutes).toHaveBeenCalledTimes(2)
  })

  it('keeps edits away from a read-only user', async () => {
    permissions.canEditTenantSettings = false
    const wrapper = mount(NotificationsPage)
    await flushPromises()

    expect(dot(wrapper, 'STREAKS-tenant', 'CS3').attributes('disabled')).toBeDefined()
    expect(wrapper.find('[data-testid="notifications-add-space"]').exists()).toBe(false)
  })

  describe('Add space', () => {
    it('adds a Google Chat space: webhook, name, what moves there, then a test', async () => {
      const added = { chatSpaceId: 'CS9', spaceName: 'Warehouse', chatProviderEnumId: 'CHAT_PROV_GOOGLE', chatProviderLabel: 'Google Chat', webhookConfigured: true, googleChatConfigured: true, isActive: 'Y', inUse: false }
      saveTenantChatSpace.mockResolvedValue({ ok: true, messages: ['Saved chat space.'], errors: [], chatSpace: added })
      setNotificationRoute.mockImplementation(async (payload: { sourceType: string, sourceId?: string, chatSpaceId: string }) => ({
        ok: true, messages: ['Posts to Warehouse.'], errors: [],
        route: { ...ROUTES.find((candidate) => candidate.sourceType === payload.sourceType)!, chatSpaceId: payload.chatSpaceId },
      }))
      sendChatSpaceTest.mockResolvedValue({ ok: true, messages: ['Sent a test to Warehouse.'], errors: [] })
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      await click(wrapper, 'notifications-add-space')
      expect(dialog(wrapper).text()).toContain('Where should it post?')
      expect(dialog(wrapper).text()).toContain('Connect a Slack workspace first')
      expect(dialog(wrapper).text()).toContain('Paste its webhook')

      await click(wrapper, 'add-chat-space-where-google')
      expect(dialog(wrapper).text()).toContain('Paste the webhook.')
      expect(dialog(wrapper).text()).toContain('Apps & integrations ▸ Webhooks')
      await wrapper.get('[data-testid="add-chat-space-webhook"]').setValue('https://chat.googleapis.com/v1/spaces/AAA')
      await click(wrapper, 'add-chat-space-next')
      expect(dialog(wrapper).text()).toContain('Name it.')
      await wrapper.get('[data-testid="add-chat-space-name"]').setValue('Warehouse')
      await click(wrapper, 'add-chat-space-save')

      expect(saveTenantChatSpace).toHaveBeenCalledWith({
        spaceName: 'Warehouse',
        chatProviderEnumId: 'CHAT_PROV_GOOGLE',
        webhookUrl: 'https://chat.googleapis.com/v1/spaces/AAA',
        isActive: true,
      }, expect.any(AbortSignal))
      expect(dialog(wrapper).text()).toContain('What should post in Warehouse?')
      const picks = wrapper.get('[data-testid="add-chat-space-routes"]').text()
      expect(picks).toContain('Streaks')
      expect(picks).toContain('moves from Ops')
      expect(picks).toContain('posts nowhere now')
      expect(picks).toContain('moves from Finance')

      await click(wrapper, 'add-chat-space-pick-STREAKS-tenant')
      await click(wrapper, 'add-chat-space-pick-AUDIT_UPDATE-month-close')
      await click(wrapper, 'add-chat-space-routes-apply')

      expect(setNotificationRoute).toHaveBeenCalledTimes(2)
      expect(setNotificationRoute).toHaveBeenCalledWith({ sourceType: 'STREAKS', chatSpaceId: 'CS9' }, expect.any(AbortSignal))
      expect(setNotificationRoute).toHaveBeenCalledWith({ sourceType: 'AUDIT_UPDATE', sourceId: 'month-close', chatSpaceId: 'CS9' }, expect.any(AbortSignal))
      expect(dialog(wrapper).text()).toContain('Warehouse is added.')

      await click(wrapper, 'add-chat-space-send-test')
      expect(sendChatSpaceTest).toHaveBeenCalledWith({ chatSpaceId: 'CS9' }, expect.any(AbortSignal))
      expect(wrapper.get('[data-testid="add-chat-space-test-message"]').text()).toBe('Sent a test to Warehouse.')

      await click(wrapper, 'add-chat-space-done')
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      // The grid reloads to draw the new column.
      expect(getNotificationRoutes).toHaveBeenCalledTimes(2)
    })

    it('picks a connected Slack workspace\'s channel from a searchable list without channels that have a space', async () => {
      getSlackInstall.mockResolvedValue({
        ok: true, slackConfigured: true, oauthAvailable: true,
        installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', isActive: 'Y' }],
      })
      listSlackChannels.mockResolvedValue({
        ok: true, nextCursor: null,
        channels: [
          { id: 'C1', name: 'alerts', isPrivate: false, isMember: true },
          { id: 'C2', name: 'ops-feed', isPrivate: false, isMember: false },
          { id: 'C3', name: 'secret', isPrivate: true, isMember: false },
        ],
      })
      saveTenantChatSpace.mockResolvedValue({
        ok: true, messages: [], errors: [],
        chatSpace: { chatSpaceId: 'CS9', spaceName: '#ops-feed', chatProviderEnumId: 'CHAT_PROV_SLACK', isActive: 'Y', inUse: false },
      })
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      await click(wrapper, 'notifications-add-space')
      expect(dialog(wrapper).text()).toContain('Acme')
      await click(wrapper, 'add-chat-space-where-slack')

      expect(dialog(wrapper).text()).toContain('Which channel?')
      expect(listSlackChannels).toHaveBeenCalledWith({ slackInstallId: 'SI1' }, expect.any(AbortSignal))
      await wrapper.get('[data-testid="add-chat-space-channel"]').trigger('click')
      expect(wrapper.find('[data-testid="app-select-search"]').exists()).toBe(true)
      const offered = wrapper.findAll('[data-testid="app-select-option"]').map((option) => option.attributes('data-option-value'))
      expect(offered).toEqual(['C2', 'C3'])

      await wrapper.get('[data-testid="app-select-option"][data-option-value="C3"]').trigger('click')
      expect(wrapper.find('[data-testid="add-chat-space-invite-note"]').exists()).toBe(true)
      await wrapper.get('[data-testid="add-chat-space-channel"]').trigger('click')
      await wrapper.get('[data-testid="app-select-option"][data-option-value="C2"]').trigger('click')
      await click(wrapper, 'add-chat-space-save')

      expect(saveTenantChatSpace).toHaveBeenCalledWith({
        spaceName: '#ops-feed',
        chatProviderEnumId: 'CHAT_PROV_SLACK',
        slackInstallId: 'SI1',
        slackChannelId: 'C2',
        slackChannelName: 'ops-feed',
        isActive: true,
      }, expect.any(AbortSignal))
      expect(dialog(wrapper).text()).toContain('What should post in #ops-feed?')
    })

    it('connects Slack first, then resumes at the channel card when the callback lands', async () => {
      const assign = vi.fn()
      Object.defineProperty(window, 'location', { configurable: true, value: { ...originalLocation, assign } })
      beginSlackInstall.mockResolvedValue({ ok: true, authorizeUrl: 'https://slack.com/oauth/v2/authorize?state=abc' })
      const first = mount(NotificationsPage)
      await flushPromises()

      await click(first, 'notifications-add-space')
      await click(first, 'add-chat-space-where-slack')
      expect(dialog(first).text()).toContain('Connect Slack first.')
      await click(first, 'add-chat-space-connect-oauth')

      expect(assign).toHaveBeenCalledWith('https://slack.com/oauth/v2/authorize?state=abc')
      first.unmount()

      // Slack sends the browser back through /settings?slack=connected, which lands here.
      route.query = { slack: 'connected', team: 'Acme' }
      getSlackInstall.mockResolvedValue({
        ok: true, slackConfigured: true, oauthAvailable: true,
        installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', isActive: 'Y' }],
      })
      listSlackChannels.mockResolvedValue({ ok: true, nextCursor: null, channels: [{ id: 'C2', name: 'ops-feed', isPrivate: false, isMember: true }] })
      const back = mount(NotificationsPage)
      await flushPromises()

      expect(dialog(back).text()).toContain('Which channel?')
      expect(listSlackChannels).toHaveBeenCalledWith({ slackInstallId: 'SI1' }, expect.any(AbortSignal))
      // The callback's params go, so a refresh does not resume twice.
      expect(replace).toHaveBeenCalledWith({ query: {} })
      back.unmount()

      const refreshed = mount(NotificationsPage)
      await flushPromises()
      expect(refreshed.find('[role="dialog"]').exists()).toBe(false)
    })

    it('connects by bot token when the deployment has no OAuth, then asks for the channel', async () => {
      getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: false, installs: [] })
      saveSlackBotToken.mockImplementation(async () => {
        getSlackInstall.mockResolvedValue({
          ok: true, slackConfigured: true, oauthAvailable: false,
          installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', isActive: 'Y' }],
        })
        return { ok: true, messages: ['Connected to Acme as darpan.'], missingScopes: [] }
      })
      listSlackChannels.mockResolvedValue({ ok: true, nextCursor: null, channels: [{ id: 'C2', name: 'ops-feed', isPrivate: false, isMember: true }] })
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      await click(wrapper, 'notifications-add-space')
      await click(wrapper, 'add-chat-space-where-slack')
      // One way in, so no card asking which.
      expect(dialog(wrapper).text()).toContain('Paste the bot token.')
      await wrapper.get('[data-testid="add-chat-space-token"]').setValue('xoxb-1')
      await click(wrapper, 'add-chat-space-connect')

      expect(saveSlackBotToken).toHaveBeenCalledWith({ botAccessToken: 'xoxb-1' }, expect.any(AbortSignal))
      expect(dialog(wrapper).text()).toContain('Which channel?')
      expect(dialog(wrapper).text()).toContain('Connected to Acme as darpan.')
    })
  })

  describe('the Slack callback', () => {
    it('shows a refused authorisation on the page and does not resume', async () => {
      window.sessionStorage.setItem('darpan.notifications.pendingAddSpace', String(Date.now()))
      route.query = { slack: 'error', reason: 'declined' }
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      expect(wrapper.get('[data-testid="notifications-page-error"]').text()).toContain('cancelled')
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(window.sessionStorage.getItem('darpan.notifications.pendingAddSpace')).toBeNull()
    })

    it('says a workspace connected with no flow waiting', async () => {
      route.query = { slack: 'connected', team: 'Acme' }
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      expect(wrapper.get('[data-testid="notifications-status"]').text()).toContain('Connected to Acme.')
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    })
  })

  describe('the Slack line', () => {
    beforeEach(() => {
      getSlackInstall.mockResolvedValue({
        ok: true, slackConfigured: true, oauthAvailable: true,
        installs: [{ slackInstallId: 'SI1', teamId: 'T1', teamName: 'Acme', isActive: 'Y' }],
      })
    })

    it('names the workspace and offers its upkeep', async () => {
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      const line = wrapper.get('[data-testid="notifications-slack-line"]')
      expect(line.text()).toContain('Acme')
      expect(line.findAll('button').map((button) => button.text())).toEqual(['Reconnect', 'Replace token', 'Disconnect'])
    })

    it('disconnects and says so', async () => {
      disconnectSlackWorkspace.mockResolvedValue({ ok: true, messages: ['Disconnected Acme.'], errors: [] })
      const wrapper = mount(NotificationsPage)
      await flushPromises()
      getSlackInstall.mockResolvedValue({ ok: true, slackConfigured: true, oauthAvailable: true, installs: [] })

      await click(wrapper, 'notifications-slack-disconnect')

      expect(disconnectSlackWorkspace).toHaveBeenCalledWith({ slackInstallId: 'SI1' }, expect.any(AbortSignal))
      expect(wrapper.get('[data-testid="notifications-status"]').text()).toBe('Disconnected Acme.')
      expect(wrapper.find('[data-testid="notifications-slack-line"]').exists()).toBe(false)
    })

    it('replaces the bot token in a popup', async () => {
      saveSlackBotToken.mockResolvedValue({ ok: true, messages: ['Connected to Acme as darpan.'], missingScopes: [] })
      const wrapper = mount(NotificationsPage)
      await flushPromises()

      await click(wrapper, 'notifications-slack-token')
      expect(dialog(wrapper).text()).toContain('Paste the bot token.')
      await wrapper.get('[data-testid="notifications-slack-token-input"]').setValue('xoxb-2')
      await click(wrapper, 'notifications-save-slack-token')

      expect(saveSlackBotToken).toHaveBeenCalledWith({ botAccessToken: 'xoxb-2' }, expect.any(AbortSignal))
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="notifications-status"]').text()).toBe('Connected to Acme as darpan.')
    })
  })
})
