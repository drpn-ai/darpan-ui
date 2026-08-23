import { readFileSync } from 'node:fs'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import { WORKFLOW_CANCEL_REQUEST_EVENT, WORKFLOW_HINT_REQUEST_EVENT } from '../../../lib/uiEvents'

type TestSessionInfo = {
  userId: string
  username: string
  displayName: string
  timeZone: string
  userTimeZone?: string
  tenantTimeZone?: string
  lastLoginDate?: string
  lastRun?: {
    savedRunId?: string
    reconciliationRunId?: string
    reconciliationRunResultId?: string
    createdDate?: string
  } | null
  activeTenantUserGroupId: string
  activeTenantLabel: string
  availableTenants: Array<{ userGroupId: string; label: string }>
  canRunActiveTenantReconciliation?: boolean
  canEditActiveTenantData: boolean
  canManageDarpanCore?: boolean
  isSuperAdmin: boolean
}

const saveActiveTenant = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const verifyOwnPassword = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const changeOwnPassword = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const getUserNotificationDefault = vi.hoisted(() => vi.fn())
const saveUserNotificationDefault = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const saveUserSettings = vi.hoisted(() => vi.fn(async ({ displayName, timeZone }: { displayName?: string; timeZone?: string }) => {
  authState.sessionInfo = {
    ...authState.sessionInfo,
    ...(displayName !== undefined ? { displayName: displayName?.toString().trim() || authState.sessionInfo.username } : {}),
    ...(timeZone !== undefined ? { userTimeZone: timeZone?.toString().trim() || undefined } : {}),
  }
  return true
}))
// authState.error mirrors authStore.error: the store's saveUserSettings always resolves to a
// boolean and reports failure via this side-channel rather than throwing (see stores/auth.ts).
// The useAuthStore mock below exposes it through a getter so a mid-test mutation (e.g. inside a
// mockImplementationOnce) is visible to the page without needing to remount.
const authState = vi.hoisted<{ sessionInfo: TestSessionInfo; error: string | null }>(() => ({
  sessionInfo: {
    userId: 'M100000',
    username: 'john.doe',
    displayName: 'john.doe',
    timeZone: 'America/Los_Angeles',
    tenantTimeZone: 'America/New_York',
    lastLoginDate: '2026-04-30T14:14:00Z',
    lastRun: {
      savedRunId: 'ORDER_SYNC',
      createdDate: '2026-04-30T14:44:00Z',
    },
    activeTenantUserGroupId: 'KREWE',
    activeTenantLabel: 'Krewe',
    availableTenants: [
      { userGroupId: 'KREWE', label: 'Krewe' },
      { userGroupId: 'GORJANA', label: 'Gorjana' },
    ],
    canEditActiveTenantData: true,
    isSuperAdmin: false,
  },
  error: null,
}))

vi.mock('../../../lib/api/facade', () => ({
  settingsFacade: {
    getUserNotificationDefault,
    saveUserNotificationDefault,
    listTenantChatSpaces,
  },
}))

const permissionsShape = {
    canViewTenantSettings: true,
    canRunActiveTenantReconciliation: authState.sessionInfo.canRunActiveTenantReconciliation === true ||
      authState.sessionInfo.canEditActiveTenantData === true ||
      authState.sessionInfo.isSuperAdmin === true,
    canEditTenantSettings: authState.sessionInfo.canEditActiveTenantData === true,
    canManageGlobalSettings: authState.sessionInfo.canManageDarpanCore === true,
}

vi.mock('../../../stores/auth', () => ({
  buildAuthRedirect: (redirect: unknown) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    sessionInfo: authState.sessionInfo,
    get error() { return authState.error },
    saveActiveTenant,
    saveUserSettings,
    changeOwnPassword,
    verifyOwnPassword,
  }),
}))

vi.mock('../../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsShape,
}))

// Only the browser-zone probe is stubbed: the timezone list stays real so the picker tests still
// choose from the ids the app actually offers. A real probe would make the fallback assertion
// depend on the machine running the suite.
vi.mock('../../../lib/timezones', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/timezones')>()),
  resolveBrowserTimeZone: () => 'Asia/Kolkata',
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

import UserSettingsPage from '../UserSettingsPage.vue'

function mountPage() {
  return mount(UserSettingsPage)
}

describe('UserSettingsPage', () => {
  beforeEach(() => {
    saveActiveTenant.mockClear()
    verifyOwnPassword.mockReset()
    verifyOwnPassword.mockResolvedValue(true)
    changeOwnPassword.mockClear()
    saveUserSettings.mockClear()
    getUserNotificationDefault.mockReset()
    getUserNotificationDefault.mockResolvedValue({ ok: true, messages: [], errors: [], userNotificationDefault: undefined })
    listTenantChatSpaces.mockReset()
    listTenantChatSpaces.mockResolvedValue({ ok: true, messages: [], errors: [], chatSpaces: [] })
    saveUserNotificationDefault.mockReset()
    saveUserNotificationDefault.mockResolvedValue({ ok: true, messages: [], errors: [], userNotificationDefault: undefined })
    authState.error = null
    authState.sessionInfo = {
      userId: 'M100000',
      username: 'john.doe',
      displayName: 'john.doe',
      timeZone: 'America/Los_Angeles',
      tenantTimeZone: 'America/New_York',
      lastLoginDate: '2026-04-30T14:14:00Z',
      lastRun: {
        savedRunId: 'ORDER_SYNC',
        createdDate: '2026-04-30T14:44:00Z',
      },
      activeTenantUserGroupId: 'KREWE',
      activeTenantLabel: 'Krewe',
      availableTenants: [
        { userGroupId: 'KREWE', label: 'Krewe' },
        { userGroupId: 'GORJANA', label: 'Gorjana' },
      ],
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('uses the shared static-page contracts for the user settings surface', () => {
    const wrapper = mountPage()
    const styleSource = readFileSync('src/style.css', 'utf8')

    expect(wrapper.find('.static-page-frame').exists()).toBe(true)
    expect(wrapper.find('.static-page-hero h1').text()).toBe('User Settings')
    expect(wrapper.find('.static-page-hero .static-page-section-description').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Manage account, tenant context, and personal execution settings')
    expect(wrapper.findAll('.static-page-section-heading').map((node) => node.text())).toEqual([
      'Account',
      'Tenant Context',
      'Preferences',
      'Activity',
    ])
    expect(wrapper.findAll('.static-page-summary-card')).toHaveLength(8)
    expect(wrapper.findAll('.static-page-record-tile').map((node) => node.text())).toEqual(['Krewe', 'Gorjana'])
    expect(wrapper.findAll('.static-page-list-tile')).toHaveLength(0)
    expect(wrapper.find('.static-page-section-head .user-settings-password-trigger').exists()).toBe(false)
    expect(wrapper.find('.user-settings-summary-field .static-page-summary-label').text()).toBe('Display name')
    const accountActionStack = wrapper.get('.user-settings-account-action-stack')
    expect(accountActionStack.get('.static-page-summary-label').text()).toBe('User ID')
    expect(accountActionStack.text()).toContain('M100000')
    const passwordTrigger = accountActionStack.get('.user-settings-password-trigger')
    expect(passwordTrigger.text()).toBe('Change password')
    expect(passwordTrigger.find('svg').exists()).toBe(false)
    expect(passwordTrigger.classes()).not.toContain('static-page-summary-card')
    expect(wrapper.find('.static-page-actions [aria-label="Save user settings"]').exists()).toBe(true)
    expect(wrapper.get('.user-settings-card-grid').classes()).toContain('static-page-summary-grid')
    expect(wrapper.findAll('.user-settings-stretch-card')).toHaveLength(4)
    expect(styleSource).toMatch(/\.static-page-summary-grid\s*\{[^}]*align-items: start;/)
    expect(styleSource).toMatch(/\.user-settings-card-grid\s*\{[^}]*align-items: stretch;/)
    expect(styleSource).toMatch(/\.user-settings-stretch-card\s*\{[^}]*height: 100%;/)
    expect(wrapper.text()).toContain('ORDER_SYNC')
    expect(wrapper.get('[data-testid="user-notification-default-card"]').text()).toContain('No default space')
  })

  it('saves a display name preference from the shared page action', async () => {
    const wrapper = mountPage()
    const input = wrapper.get('input[name="displayName"]')

    expect((input.element as HTMLInputElement).value).toBe('john.doe')

    await input.setValue('Aditi')
    await wrapper.get('.static-page-actions [aria-label="Save user settings"]').trigger('click')
    await flushPromises()

    expect(saveUserSettings).toHaveBeenCalledWith({ displayName: 'Aditi' })
  })

  it('autosaves display name edits after one second without additional input', async () => {
    vi.useFakeTimers()
    const wrapper = mountPage()
    const input = wrapper.get('input[name="displayName"]')

    await input.setValue('Aditi')

    expect(saveUserSettings).not.toHaveBeenCalled()

    vi.advanceTimersByTime(999)
    expect(saveUserSettings).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1)
    await flushPromises()

    expect(saveUserSettings).toHaveBeenCalledWith({ displayName: 'Aditi' })
  })

  it('switches tenant through the existing active tenant contract', async () => {
    const wrapper = mountPage()

    await wrapper.findAll('.static-page-record-tile')[1]?.trigger('click')
    await flushPromises()

    expect(saveActiveTenant).toHaveBeenCalledWith('GORJANA')
  })

  it('explains a missing company membership instead of showing an empty tenant section', () => {
    // Tenant-scoped writes refuse with "An active tenant is required" and this was the only screen
    // that could say why -- it rendered nothing at all, so the refusal read as a broken app.
    authState.sessionInfo = {
      ...authState.sessionInfo!,
      activeTenantUserGroupId: '',
      activeTenantLabel: '',
      availableTenants: [],
    }

    const wrapper = mountPage()

    expect(wrapper.findAll('.static-page-record-tile')).toHaveLength(0)
    const notice = wrapper.get('[data-testid="user-settings-no-tenant"]')
    expect(notice.text()).toContain('not a member of any company')
    expect(notice.text()).toContain('Ask a Darpan admin')
  })

  it('points an admin at the group they can fix it in themselves', () => {
    authState.sessionInfo = {
      ...authState.sessionInfo!,
      activeTenantUserGroupId: '',
      activeTenantLabel: '',
      availableTenants: [],
      isSuperAdmin: true,
    }

    const wrapper = mountPage()

    expect(wrapper.get('[data-testid="user-settings-no-tenant"]').text()).toContain('company permission group')
  })

  it('changes the current user password through the settings flow', async () => {
    const wrapper = mountPage()

    await wrapper.get('.user-settings-password-trigger').trigger('click')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Enter your current password.')
    expect(wrapper.get('.static-page-frame').classes()).toContain('user-settings-page--popup-open')
    expect(wrapper.get('form.wizard-question-shell').classes()).toContain('workflow-form--popup-compact')
    expect(wrapper.find('.popup-workflow-modal .workflow-panel-header button').exists()).toBe(false)
    expect(wrapper.get('.wizard-actions .wizard-enter-hint').text()).toContain('press Enter')
    await wrapper.get('input[name="currentPassword"]').setValue('old-password')
    await wrapper.get('form.wizard-question-shell').trigger('submit')
    await flushPromises()

    expect(verifyOwnPassword).toHaveBeenCalledWith('old-password')
    expect(wrapper.get('[role="dialog"]').text()).toContain('Enter your new password.')
    await wrapper.get('input[name="newPassword"]').setValue('new-password')
    await wrapper.get('form.wizard-question-shell').trigger('submit')

    expect(wrapper.get('[role="dialog"]').text()).toContain('Enter your new password again.')
    await wrapper.get('input[name="newPasswordVerify"]').setValue('new-password')
    await wrapper.get('form.wizard-question-shell').trigger('submit')
    await flushPromises()

    expect(changeOwnPassword).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      newPasswordVerify: 'new-password',
    })
  })

  it('keeps the current password step open and shows a five-second warning when verification fails', async () => {
    verifyOwnPassword.mockResolvedValueOnce(false)
    const warningEvents: CustomEvent[] = []
    const handleWarning = (event: Event) => warningEvents.push(event as CustomEvent)
    document.addEventListener(WORKFLOW_HINT_REQUEST_EVENT, handleWarning)
    const wrapper = mountPage()

    try {
      await wrapper.get('.user-settings-password-trigger').trigger('click')
      await wrapper.get('input[name="currentPassword"]').setValue('wrong-password')
      await wrapper.get('form.wizard-question-shell').trigger('submit')
      await flushPromises()

      expect(verifyOwnPassword).toHaveBeenCalledWith('wrong-password')
      expect(wrapper.get('[role="dialog"]').text()).toContain('Enter your current password.')
      expect(wrapper.get('[role="dialog"]').text()).not.toContain('Enter your new password.')
      expect(warningEvents).toHaveLength(1)
      expect(warningEvents[0]?.detail).toMatchObject({
        message: 'Password incorrect.',
        tone: 'warning',
        durationMs: 5000,
      })
    } finally {
      document.removeEventListener(WORKFLOW_HINT_REQUEST_EVENT, handleWarning)
    }
  })

  it('closes the password workflow through the shared workflow cancel request', async () => {
    const wrapper = mountPage()

    await wrapper.get('.user-settings-password-trigger').trigger('click')
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })
    document.dispatchEvent(cancelRequest)
    await flushPromises()

    expect(cancelRequest.defaultPrevented).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('.static-page-frame').classes()).not.toContain('user-settings-page--popup-open')
  })

  it('does not render missing activity placeholders', () => {
    authState.sessionInfo = {
      ...authState.sessionInfo,
      lastLoginDate: undefined,
      lastRun: null,
    }

    const wrapper = mountPage()

    expect(wrapper.text()).not.toContain('Not available')
    expect(wrapper.text()).toContain('Permissions')
  })

  it('shows the default chat space and changes it via popup', async () => {
    getUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      userNotificationDefault: { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: 'Y' },
    })
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', googleChatConfigured: true, isActive: 'Y', inUse: false },
        { chatSpaceId: 'CS2', spaceName: 'Finance', googleChatConfigured: true, isActive: 'Y', inUse: false },
      ],
    })
    saveUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: ['Saved notification default.'],
      errors: [],
      userNotificationDefault: { chatSpaceId: 'CS2', spaceName: 'Finance', isActive: 'Y' },
    })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-testid="user-notification-default-card"]').text()).toContain('Ops')

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Which chat space')
    expect(wrapper.get('[data-testid="user-chat-space-choice-CS1"]').text()).toContain('Ops')
    expect(wrapper.get('[data-testid="user-chat-space-choice-CS2"]').text()).toContain('Finance')
    expect(wrapper.get('[data-testid="user-chat-space-choice-clear"]').text()).toContain('No notifications')

    await wrapper.get('[data-testid="user-chat-space-choice-CS2"]').trigger('click')
    await flushPromises()

    expect(saveUserNotificationDefault).toHaveBeenCalledWith({ chatSpaceId: 'CS2' }, expect.anything())
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="user-notification-default-card"]').text()).toContain('Finance')
  })

  it('excludes inactive chat spaces from the default-space choices', async () => {
    getUserNotificationDefault.mockResolvedValue({ ok: true, messages: [], errors: [], userNotificationDefault: undefined })
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', googleChatConfigured: true, isActive: 'Y', inUse: false },
        { chatSpaceId: 'CS2', spaceName: 'Finance', googleChatConfigured: true, isActive: 'N', inUse: false },
      ],
    })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-testid="user-chat-space-choice-CS1"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="user-chat-space-choice-CS2"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="user-chat-space-choice-clear"]').exists()).toBe(true)
  })

  it('clears the default chat space via the clear choice card', async () => {
    getUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      userNotificationDefault: { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: 'Y' },
    })
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', googleChatConfigured: true, isActive: 'Y', inUse: false },
      ],
    })
    saveUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: ['Saved notification default.'],
      errors: [],
      userNotificationDefault: undefined,
    })
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-testid="user-notification-default-card"]').text()).toContain('Ops')

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="user-chat-space-choice-clear"]').trigger('click')
    await flushPromises()

    expect(saveUserNotificationDefault).toHaveBeenCalledWith({ chatSpaceId: '' }, expect.anything())
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="user-notification-default-card"]').text()).toContain('No default space')
  })

  it('surfaces a save error inside the popup and keeps it open', async () => {
    // callService throws ApiCallError on ok:false envelopes -- it never resolves with one --
    // so a faithful mock rejects, exercising the real catch path instead of the dead
    // `if (!response.ok)` branch.
    saveUserNotificationDefault.mockRejectedValue(new ApiCallError('Unable to save notification default.', 500))
    listTenantChatSpaces.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      chatSpaces: [
        { chatSpaceId: 'CS1', spaceName: 'Ops', googleChatConfigured: true, isActive: 'Y', inUse: false },
      ],
    })
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="user-chat-space-choice-CS1"]').trigger('click')
    await flushPromises()

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('Unable to save notification default.')
    // The choice cards must still be visible/interactable inside the dialog -- a save
    // failure is not a load failure, so the picker itself should not disappear.
    expect(dialog.find('[data-testid="user-chat-space-choice-CS1"]').exists()).toBe(true)
  })

  it('closes the notification default workflow through the shared workflow cancel request', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="dialog"]').exists()).toBe(true)

    const cancelRequest = new Event(WORKFLOW_CANCEL_REQUEST_EVENT, { cancelable: true })
    document.dispatchEvent(cancelRequest)
    await flushPromises()

    expect(cancelRequest.defaultPrevented).toBe(true)
    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('closes the notification default workflow when clicking the overlay background', async () => {
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()

    await wrapper.get('[role="dialog"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
  })

  it('surfaces a load error for the notification default and still shows the card fallback text', async () => {
    getUserNotificationDefault.mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    await flushPromises()

    expect(wrapper.get('[data-testid="user-notification-default-card"]').text()).toContain('No default space')
    expect(wrapper.get('.section-note[role="status"]').text()).toContain('Unable to load notification settings.')
  })

  it('surfaces a load error when chat spaces fail to load and does not silently offer only the clear option', async () => {
    listTenantChatSpaces.mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('Unable to load chat spaces.')
    expect(wrapper.find('[data-testid="user-chat-space-choice-clear"]').exists()).toBe(false)
    expect(wrapper.find('.workflow-shortcut-choice-grid').exists()).toBe(false)
  })

  it('names the tenant and its zone code in the fallback summary instead of "Tenant default"', () => {
    const wrapper = mountPage()
    const card = wrapper.get('[data-testid="user-timezone-card"]')

    expect(card.text()).toContain('Timezone')
    expect(card.text()).toContain('Krewe default (America/New_York)')
    expect(card.text()).not.toContain('Tenant default')
  })

  it('offers the same tenant-and-code label as the option that clears the preference', async () => {
    const wrapper = mountPage()

    await wrapper.get('[data-testid="user-timezone-card"]').trigger('click')
    await wrapper.get('[data-testid="user-timezone-select"]').trigger('click')

    expect(wrapper.get('[data-testid="app-select-option"][data-option-value=""]').text())
      .toBe('Krewe default (America/New_York)')
  })

  it('falls back to the browser zone when the tenant has no timezone configured', () => {
    // Display resolution is userTimeZone -> tenantTimeZone -> browser, so with no tenant timezone
    // the honest label is the browser zone, not the tenant's name.
    authState.sessionInfo = { ...authState.sessionInfo, tenantTimeZone: undefined }
    const wrapper = mountPage()

    expect(wrapper.get('[data-testid="user-timezone-card"]').text()).toContain('This browser (Asia/Kolkata)')
    expect(wrapper.get('[data-testid="user-timezone-card"]').text()).not.toContain('Krewe default')
  })

  it('saves a preferred timezone via the popup picker', async () => {
    const wrapper = mountPage()

    await wrapper.get('[data-testid="user-timezone-card"]').trigger('click')
    await wrapper.get('[data-testid="user-timezone-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-search"]').setValue('America/New_York')
    await wrapper.get('[data-testid="app-select-option"][data-option-value="America/New_York"]').trigger('click')
    await wrapper.get('[data-testid="save-user-timezone"]').trigger('click')
    await flushPromises()

    expect(saveUserSettings).toHaveBeenCalledWith({ timeZone: 'America/New_York' })
    expect(wrapper.get('[data-testid="user-timezone-card"]').text()).toContain('America/New_York')
  })

  it('clears the preference by choosing the tenant default option', async () => {
    authState.sessionInfo = { ...authState.sessionInfo, userTimeZone: 'America/New_York' }
    const wrapper = mountPage()

    await wrapper.get('[data-testid="user-timezone-card"]').trigger('click')
    expect(wrapper.get('[data-testid="user-timezone-select"]').text()).toContain('America/New_York')
    await wrapper.get('[data-testid="user-timezone-select"]').trigger('click')
    await wrapper.get('[data-testid="app-select-option"][data-option-value=""]').trigger('click')
    await wrapper.get('[data-testid="save-user-timezone"]').trigger('click')
    await flushPromises()

    expect(saveUserSettings).toHaveBeenCalledWith({ timeZone: '' })
  })

  it('surfaces a timezone save error inside the popup and keeps it open', async () => {
    // authStore.saveUserSettings never rejects (stores/auth.ts catches internally) -- it
    // resolves false and reports the message via authStore.error. A faithful mock mirrors that
    // contract instead of rejecting, exercising the real `if (!saved)` branch on the page.
    saveUserSettings.mockImplementationOnce(async () => {
      authState.error = 'Timezone is invalid.'
      return false
    })
    const wrapper = mountPage()

    await wrapper.get('[data-testid="user-timezone-card"]').trigger('click')
    await wrapper.get('[data-testid="save-user-timezone"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Timezone is invalid.')
    expect(wrapper.find('[data-testid="user-timezone-select"]').exists()).toBe(true)
  })
  it('keeps Preferences to things the user can change, and reports the rest elsewhere', async () => {
    // "Preference" on this page means settable. Last Login, Last Run and Permissions are facts the
    // system reports back, so filing them under Preferences made the heading untrue.
    const wrapper = mountPage()
    await flushPromises()

    const sectionFor = (heading: string) => {
      const section = wrapper.findAll('.static-page-section')
        .find((node) => node.find('.static-page-section-heading').text() === heading)
      expect(section, `no section titled ${heading}`).toBeTruthy()
      return section!
    }

    const preferences = sectionFor('Preferences')
    expect(preferences.findAll('.static-page-summary-label').map((n) => n.text()))
      .toEqual(['Timezone', 'Notifications'])
    // Every card in Preferences opens something; none is inert.
    expect(preferences.findAll('button.static-page-summary-card')).toHaveLength(2)
    expect(preferences.text()).not.toContain('Last Login')
    expect(preferences.text()).not.toContain('Permissions')

    expect(sectionFor('Activity').findAll('.static-page-summary-label').map((n) => n.text()))
      .toEqual(['Last Login', 'Last Run'])
    // Permissions is an access fact, so it sits with User ID and Username.
    expect(sectionFor('Account').text()).toContain('Permissions')
  })
})
