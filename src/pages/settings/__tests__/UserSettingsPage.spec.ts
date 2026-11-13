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
  activeTenantPermissionGroupIds?: string[]
  isSuperAdmin: boolean
  twoFactorEnabled?: boolean
  twoFactorDueDate?: string | null
}

const saveActiveTenant = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const verifyOwnPassword = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const changeOwnPassword = vi.hoisted(() => vi.fn().mockResolvedValue(true))
const saveRecoveryEmail = vi.hoisted(() => vi.fn())
const getUserNotificationDefault = vi.hoisted(() => vi.fn())
const saveUserNotificationDefault = vi.hoisted(() => vi.fn())
const listTenantChatSpaces = vi.hoisted(() => vi.fn())
const listCliSessions = vi.hoisted(() => vi.fn())
const getMyCliAccess = vi.hoisted(() => vi.fn())
const requestCliAccess = vi.hoisted(() => vi.fn())
const revokeCliSession = vi.hoisted(() => vi.fn())
const getTwoFactorStatus = vi.hoisted(() => vi.fn())
const createRecoveryCodes = vi.hoisted(() => vi.fn())
const disableTwoFactor = vi.hoisted(() => vi.fn())
const beginTwoFactorSetup = vi.hoisted(() => vi.fn())
const confirmTwoFactorSetup = vi.hoisted(() => vi.fn())
const applyTwoFactorState = vi.hoisted(() => vi.fn())
const adoptReissuedKey = vi.hoisted(() => vi.fn())
const beginPasskeyRegistration = vi.hoisted(() => vi.fn())
const finishPasskeyRegistration = vi.hoisted(() => vi.fn())
const beginPasskeyProof = vi.hoisted(() => vi.fn())
const renamePasskey = vi.hoisted(() => vi.fn())
const deletePasskey = vi.hoisted(() => vi.fn())
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
const authState = vi.hoisted<{ sessionInfo: TestSessionInfo; error: string | null; emailAddressMasked: string | null }>(() => ({
  emailAddressMasked: null,
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
  authFacade: {
    listCliSessions,
    getMyCliAccess,
    requestCliAccess,
    revokeCliSession,
    getTwoFactorStatus,
    createRecoveryCodes,
    disableTwoFactor,
    beginPasskeyProof,
    renamePasskey,
    deletePasskey,
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
    get emailAddressMasked() { return authState.emailAddressMasked },
    saveRecoveryEmail,
    saveActiveTenant,
    saveUserSettings,
    changeOwnPassword,
    verifyOwnPassword,
    get twoFactorEnabled() { return authState.sessionInfo.twoFactorEnabled === true },
    get twoFactorDueDate() { return authState.sessionInfo.twoFactorDueDate ?? null },
    beginTwoFactorSetup,
    confirmTwoFactorSetup,
    applyTwoFactorState,
    adoptReissuedKey,
    beginPasskeyRegistration,
    finishPasskeyRegistration,
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
import {
  CREATED_JSON,
  CREATION_OPTIONS,
  ASSERTION_JSON,
  REQUEST_OPTIONS,
  installWebAuthnStub,
  notAllowed,
  type WebAuthnStub,
} from '../../../test/webauthn'

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
    listCliSessions.mockReset()
    listCliSessions.mockResolvedValue({ ok: true, messages: [], errors: [], cliSessions: [] })
    getMyCliAccess.mockReset().mockResolvedValue({ ok: true, access: null })
    requestCliAccess.mockReset()
    revokeCliSession.mockReset()
    revokeCliSession.mockResolvedValue({ ok: true, messages: [], errors: [] })
    getTwoFactorStatus.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [], enabled: false, required: false })
    createRecoveryCodes.mockReset()
    disableTwoFactor.mockReset()
    beginTwoFactorSetup.mockReset()
    confirmTwoFactorSetup.mockReset()
    applyTwoFactorState.mockReset()
    adoptReissuedKey.mockReset()
    beginPasskeyRegistration.mockReset()
    finishPasskeyRegistration.mockReset()
    beginPasskeyProof.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [], publicKeyOptions: REQUEST_OPTIONS, expiresInSeconds: 300 })
    renamePasskey.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
    deletePasskey.mockReset()
    saveUserNotificationDefault.mockReset()
    saveUserNotificationDefault.mockResolvedValue({ ok: true, messages: [], errors: [], userNotificationDefault: undefined })
    authState.error = null
    authState.emailAddressMasked = null
    saveRecoveryEmail.mockReset()
    saveRecoveryEmail.mockImplementation(async () => {
      authState.emailAddressMasked = 'm•••@example.com'
      return true
    })
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
      'Two-factor',
      'Tenant Context',
      'Preferences',
      'Activity',
      'CLI sessions',
    ])
    // The two-factor card waits for its status read.
    expect(wrapper.findAll('.static-page-summary-card')).toHaveLength(10)
    expect(wrapper.findAll('.static-page-record-tile').map((node) => node.text())).toEqual(['Krewe', 'Gorjana'])
    expect(wrapper.findAll('.static-page-list-tile')).toHaveLength(0)
    expect(wrapper.find('.static-page-section-head .user-settings-password-trigger').exists()).toBe(false)
    expect(wrapper.find('.user-settings-summary-field .static-page-summary-label').text()).toBe('Display name')
    // Password changes inside its own card, the same way the recovery email does.
    const passwordCard = wrapper.get('[data-testid="password-card"]')
    expect(passwordCard.get('.static-page-summary-label').text()).toBe('Password')
    expect(passwordCard.get('.user-settings-password-trigger').text()).toBe('Change')
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

  // DAR-UI-115: the role is named as the admin app names it, by the widest group held in the active tenant.
  it.each([
    [['DARPAN_COMPANY_EDITOR'], 'Company editor'],
    [['DARPAN_COMPANY_VIEW_ONLY'], 'Company view only'],
    [['DARPAN_COMPANY_VIEW_ONLY', 'DARPAN_TENANT_ADMIN'], 'Tenant admin'],
    [[], 'No membership'],
  ])('names the permission groups %j as %s', (groupIds, label) => {
    authState.sessionInfo = { ...authState.sessionInfo, activeTenantPermissionGroupIds: groupIds }
    const card = mountPage().findAll('.static-page-summary-card')
      .find((node) => node.find('.static-page-summary-label').text() === 'Permissions')
    expect(card?.text()).toBe(`Permissions${label}`)
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
    saveUserNotificationDefault.mockRejectedValue(new ApiCallError('The notification default did not get the memo. Not saved.', 500))
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
    expect(dialog.text()).toContain('The notification default did not get the memo. Not saved.')
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
    expect(wrapper.get('.section-note[role="status"]').text()).toContain('Notification settings never got the notification.')
  })

  it('surfaces a load error when chat spaces fail to load and does not silently offer only the clear option', async () => {
    listTenantChatSpaces.mockRejectedValue(new Error('network down'))
    const wrapper = mountPage()
    await flushPromises()

    await wrapper.get('[data-testid="user-notification-default-card"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="dialog"]').text()).toContain('The chat spaces drifted into outer space.')
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

  it('shows the last visit\'s default chat space at once on a revisit, before the network answers (DAR-UI-051)', async () => {
    getUserNotificationDefault.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      userNotificationDefault: { chatSpaceId: 'CS1', spaceName: 'Ops', isActive: 'Y' },
    })
    mountPage().unmount()
    await flushPromises()

    getUserNotificationDefault.mockReturnValue(new Promise(() => {}))
    const revisit = mountPage()
    await flushPromises()

    expect(revisit.get('[data-testid="user-notification-default-card"]').text()).toContain('Ops')
  })

  // ---- DAR-BE-028: recovery email ----

  async function stepRecovery(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
    await wrapper.get('[data-testid="recovery-email-workflow"] input').setValue(value)
    await wrapper.get('[data-testid="recovery-email-next"]').trigger('click')
    await flushPromises()
  }

  it('shows the recovery email masked, or asks for one', async () => {
    const empty = mountPage()
    await flushPromises()
    expect(empty.get('[data-testid="recovery-email-card"]').text()).toContain('None')
    expect(empty.get('[data-testid="recovery-email-card"]').text()).not.toContain('add one')
    expect(empty.get('[data-testid="recovery-email-change"]').text()).toBe('Add')

    authState.emailAddressMasked = 'a•••@hotwax.co'
    const set = mountPage()
    await flushPromises()
    expect(set.get('[data-testid="recovery-email-card"]').text()).toContain('a•••@hotwax.co')
    expect(set.get('[data-testid="recovery-email-change"]').text()).toBe('Change')
  })

  it('changes the recovery email after the current password', async () => {
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('[data-testid="recovery-email-change"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-testid="recovery-email-workflow"]').text()).toContain('Enter your current password.')
    await stepRecovery(wrapper, 'Old-pass1!')
    expect(verifyOwnPassword).toHaveBeenCalledWith('Old-pass1!')
    expect(wrapper.get('[data-testid="recovery-email-workflow"]').text()).toContain('Where should password reset codes go?')
    expect(wrapper.get('[data-testid="recovery-email-workflow"] input').attributes('type')).toBe('email')

    await stepRecovery(wrapper, 'me@example.com')
    expect(saveRecoveryEmail).toHaveBeenCalledWith('me@example.com', 'Old-pass1!')
    expect(wrapper.find('[data-testid="recovery-email-workflow"]').exists()).toBe(false)
    // The card reads the store; this mock store is not reactive, so read it from a fresh mount.
    const after = mountPage()
    await flushPromises()
    expect(after.get('[data-testid="recovery-email-card"]').text()).toContain('m•••@example.com')
  })

  it('stays on the password step when the current password is wrong', async () => {
    verifyOwnPassword.mockResolvedValue(false)
    authState.error = 'Current password is incorrect.'
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.get('[data-testid="recovery-email-change"]').trigger('click')
    await flushPromises()
    await stepRecovery(wrapper, 'wrong')

    expect(wrapper.get('[data-testid="recovery-email-workflow"]').text()).toContain('Enter your current password.')
    expect(saveRecoveryEmail).not.toHaveBeenCalled()
  })

  describe('CLI sessions', () => {
    // DAR-BE-209: the CLI state in the active tenant sits above the sessions, with the request when it is not on.
    it('shows the CLI access card for the active tenant, with Request access when the CLI is not on', async () => {
      getMyCliAccess.mockResolvedValue({ ok: true, access: { tenantUserGroupId: 'ACME', tenantLabel: 'Acme', state: 'NOT_GRANTED', lifetimeDays: 7, request: null } })
      const wrapper = mountPage()
      await flushPromises()
      expect(getMyCliAccess).toHaveBeenCalledTimes(1)
      expect(wrapper.get('[data-testid="cli-access-request"]').text()).toBe('Request access in Acme')
    })

    it('shows no card when the access cannot be read, and the sessions still list', async () => {
      getMyCliAccess.mockRejectedValue(new Error('down'))
      listCliSessions.mockResolvedValue({ ok: true, messages: [], errors: [], cliSessions: sessions })
      const wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-access-card"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid="cli-session-row"]')).toHaveLength(2)
    })

    const sessions = [
      { cliSessionId: 'C1', hostLabel: 'ada-laptop', createdDate: '2026-11-01T10:00:00Z', expiresDate: '2026-11-07T10:00:00Z' },
      { cliSessionId: 'C2', hostLabel: 'build-box', createdDate: '2026-11-02T10:00:00Z', expiresDate: '2026-11-08T10:00:00Z' },
    ]

    it('lists CLI sessions', async () => {
      listCliSessions.mockResolvedValue({ ok: true, messages: [], errors: [], cliSessions: sessions })
      const wrapper = mountPage()
      await flushPromises()
      const rows = wrapper.findAll('[data-testid="cli-session-row"]')
      expect(rows).toHaveLength(2)
      expect(rows[0]!.text()).toContain('ada-laptop')
    })

    it('Revoke calls revoke#CliSession and removes the row', async () => {
      listCliSessions.mockResolvedValue({ ok: true, messages: [], errors: [], cliSessions: sessions })
      const wrapper = mountPage()
      await flushPromises()
      await wrapper.findAll('[data-testid="cli-session-revoke"]')[0]!.trigger('click')
      await flushPromises()
      expect(revokeCliSession).toHaveBeenCalledWith({ cliSessionId: 'C1' }, expect.anything())
      const rows = wrapper.findAll('[data-testid="cli-session-row"]')
      expect(rows).toHaveLength(1)
      expect(rows[0]!.text()).toContain('build-box')
    })

    it('keeps the row and shows the error when revoke is refused', async () => {
      listCliSessions.mockResolvedValue({ ok: true, messages: [], errors: [], cliSessions: sessions })
      revokeCliSession.mockResolvedValue({ ok: false, messages: [], errors: ['Already ended.'] })
      const wrapper = mountPage()
      await flushPromises()
      await wrapper.findAll('[data-testid="cli-session-revoke"]')[0]!.trigger('click')
      await flushPromises()
      expect(wrapper.findAll('[data-testid="cli-session-row"]')).toHaveLength(2)
      expect(wrapper.text()).toContain('Already ended.')
    })

    it('a failed or refused list shows the error, never the empty state', async () => {
      listCliSessions.mockResolvedValue({ ok: false, messages: [], errors: ['Boom.'] })
      let wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-sessions-empty"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="cli-sessions-error"]').text()).toContain('Boom.')

      listCliSessions.mockRejectedValue(new Error('network'))
      wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-sessions-empty"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="cli-sessions-error"]').text()).toContain('Could not load CLI sessions.')
    })

    it('empty state', async () => {
      const wrapper = mountPage()
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-sessions-empty"]').exists()).toBe(true)
    })
  })

  // DAR-BE-264.
  describe('two-factor', () => {
    const CODES = Array.from({ length: 10 }, (_, i) => `abcd-efgh-jkmn-pq${String(i).padStart(2, '0')}`)
    const onStatus = (extra: Record<string, unknown> = {}) => ({
      ok: true, messages: [], errors: [], enabled: true, appEnabled: true, confirmedDate: '2026-11-13T12:00:00Z',
      recoveryCodesLeft: 4, required: false, codesLocked: false, ...extra,
    })

    async function typeCode(wrapper: ReturnType<typeof mount>, testId: string, code: string): Promise<void> {
      const box = wrapper.get(`[data-testid="${testId}-0"]`)
      ;(box.element as HTMLInputElement).value = code
      await box.trigger('input')
      await flushPromises()
    }

    it('shows on-since, codes left and its actions; no Turn off when a role requires it', async () => {
      getTwoFactorStatus.mockResolvedValue(onStatus({ required: true, requiredFromDate: '2026-11-01T12:00:00Z' }))
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.get('[data-testid="two-factor-state"]').text()).toBe('On since 13 Nov')
      expect(wrapper.get('[data-testid="two-factor-codes-left"]').text()).toBe('4 left')
      expect(wrapper.find('[data-testid="two-factor-replace"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="two-factor-new-codes"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="two-factor-off"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="two-factor-setup"]').exists()).toBe(false)
    })

    it('says when it is due and when codes are locked', async () => {
      getTwoFactorStatus.mockResolvedValue({ ok: true, messages: [], errors: [], enabled: false, required: false, requiredFromDate: '2026-12-01T12:00:00Z', codesLocked: true })
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.get('[data-testid="two-factor-state"]').text()).toBe('Off. Due 1 Dec')
      expect(wrapper.find('[data-testid="two-factor-locked"]').exists()).toBe(true)
    })

    it('sets up from a signed-in tab: password first, then scan, code and the recovery codes', async () => {
      beginTwoFactorSetup.mockResolvedValue({
        outcome: 'begun',
        setup: { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Darpan:john.doe?secret=JBSWY3DPEHPK3PXP', qrDataUri: 'data:image/svg+xml;base64,PHN2Zy8+' },
      })
      confirmTwoFactorSetup.mockResolvedValue({ outcome: 'confirmed', recoveryCodes: CODES })
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.get('[data-testid="two-factor-setup"]').trigger('click')
      expect(wrapper.find('.static-page-frame').classes()).toContain('user-settings-page--popup-open')
      expect(wrapper.text()).toContain('Enter your current password.')
      await wrapper.get('[data-testid="two-factor-password"]').setValue('current-pass')
      await wrapper.get('[data-testid="two-factor-proof-next"]').trigger('click')
      await flushPromises()
      expect(beginTwoFactorSetup).toHaveBeenCalledWith({ currentPassword: 'current-pass' })

      await wrapper.get('[data-testid="two-factor-scan-next"]').trigger('click')
      await flushPromises()
      getTwoFactorStatus.mockResolvedValue(onStatus({ recoveryCodesLeft: 10 }))
      await typeCode(wrapper, 'two-factor-setup-code', '123456')

      // confirmTwoFactorSetup is the store action that swaps this tab to the new key (covered in authTwoFactor.spec).
      expect(confirmTwoFactorSetup).toHaveBeenCalledWith('123456')
      expect(wrapper.findAll('[data-testid="two-factor-recovery-code"]')).toHaveLength(10)
      expect(getTwoFactorStatus).toHaveBeenCalledTimes(2)
      expect(listCliSessions).toHaveBeenCalledTimes(2)
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toContain('Two-factor on.')

      await wrapper.get('[data-testid="two-factor-codes-saved"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="two-factor-state"]').text()).toBe('On since 13 Nov')
    })

    it('a wrong password stays on the password step', async () => {
      beginTwoFactorSetup.mockResolvedValue({ outcome: 'refused', message: 'Password incorrect.' })
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.get('[data-testid="two-factor-setup"]').trigger('click')
      await wrapper.get('[data-testid="two-factor-password"]').setValue('wrong')
      await wrapper.get('[data-testid="two-factor-proof-next"]').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('Password incorrect.')
      expect(wrapper.find('[data-testid="two-factor-password"]').exists()).toBe(true)
    })

    it('replacing the app begins with a code from the current app', async () => {
      getTwoFactorStatus.mockResolvedValue(onStatus())
      beginTwoFactorSetup.mockResolvedValue({ outcome: 'begun', setup: { secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://x', qrDataUri: null } })
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.get('[data-testid="two-factor-replace"]').trigger('click')
      expect(wrapper.text()).toContain('Enter the code from your current app.')
      await typeCode(wrapper, 'two-factor-proof-code', '222333')

      expect(beginTwoFactorSetup).toHaveBeenCalledWith({ code: '222333' })
      expect(wrapper.text()).toContain('Scan this with your authenticator app.')

      // A new app keeps the person's recovery codes: confirm returns none, so there is no codes step to save.
      confirmTwoFactorSetup.mockResolvedValue({ outcome: 'confirmed', recoveryCodes: [] })
      await wrapper.get('[data-testid="two-factor-scan-next"]').trigger('click')
      await flushPromises()
      await typeCode(wrapper, 'two-factor-setup-code', '444555')
      expect(wrapper.find('[data-testid="two-factor-recovery-code"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toContain('Authenticator app on.')
    })

    it('makes new recovery codes with a current code', async () => {
      getTwoFactorStatus.mockResolvedValue(onStatus())
      createRecoveryCodes.mockResolvedValue({ ok: true, messages: [], errors: [], recoveryCodes: CODES })
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.get('[data-testid="two-factor-new-codes"]').trigger('click')
      await typeCode(wrapper, 'two-factor-proof-code', '444555')

      expect(createRecoveryCodes).toHaveBeenCalledWith({ code: '444555' })
      expect(wrapper.findAll('[data-testid="two-factor-recovery-code"]')).toHaveLength(10)
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toContain('New recovery codes made.')
    })

    it('a refused code for new recovery codes shows the refusal and stays', async () => {
      getTwoFactorStatus.mockResolvedValue(onStatus())
      createRecoveryCodes.mockRejectedValue(new ApiCallError("That code didn't work.", 500))
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.get('[data-testid="two-factor-new-codes"]').trigger('click')
      await typeCode(wrapper, 'two-factor-proof-code', '000000')

      expect(wrapper.text()).toContain("That code didn't work.")
      expect(wrapper.find('[data-testid="two-factor-recovery-code"]').exists()).toBe(false)
    })

    it('turns off only on the button (the sixth digit does not act), then updates the session', async () => {
      getTwoFactorStatus.mockResolvedValue(onStatus())
      // Turning it off ends every key, this tab's too: the reply carries the new one.
      const reissued = { ok: true, messages: [], errors: [], authenticated: true, authToken: 'key-after-off', authTokenHeaderName: 'login_key' }
      disableTwoFactor.mockResolvedValue(reissued)
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.get('[data-testid="two-factor-off"]').trigger('click')
      await typeCode(wrapper, 'two-factor-proof-code', '666777')
      expect(disableTwoFactor).not.toHaveBeenCalled()

      getTwoFactorStatus.mockResolvedValue({ ok: true, messages: [], errors: [], enabled: false, required: false, requiredFromDate: '2026-12-01T12:00:00Z' })
      await wrapper.get('[data-testid="two-factor-proof-next"]').trigger('click')
      await flushPromises()

      expect(disableTwoFactor).toHaveBeenCalledWith({ code: '666777' })
      expect(adoptReissuedKey).toHaveBeenCalledWith(reissued)
      expect(applyTwoFactorState).toHaveBeenCalledWith({ enabled: false, dueDate: '2026-12-01T12:00:00Z' })
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="two-factor-state"]').text()).toBe('Off. Due 1 Dec')
    })
  })
  describe('passkeys (DAR-BE-270)', () => {
    const CODES = Array.from({ length: 10 }, (_, i) => `abcd-efgh-jkmn-pq${String(i).padStart(2, '0')}`)
    const MAC = { passkeyId: 'P1', name: 'MacBook', createdDate: '2026-11-13T12:00:00Z', lastUsedDate: null, transports: ['internal'], backedUp: true }
    const KEY = { passkeyId: 'P2', name: 'YubiKey', createdDate: '2026-11-10T12:00:00Z', lastUsedDate: '2026-11-12T12:00:00Z', transports: ['usb'], backedUp: false }
    const status = (extra: Record<string, unknown> = {}) => ({
      ok: true, messages: [], errors: [], enabled: true, appEnabled: false, passkeysAvailable: true, passkeys: [MAC],
      confirmedDate: '2026-11-13T12:00:00Z', recoveryCodesLeft: 10, required: false, codesLocked: false, ...extra,
    })
    let webauthn: WebAuthnStub | null = null

    beforeEach(() => {
      webauthn = installWebAuthnStub()
    })

    afterEach(() => {
      webauthn?.restore()
      webauthn = null
    })

    async function typeCode(wrapper: ReturnType<typeof mount>, testId: string, code: string): Promise<void> {
      const box = wrapper.get(`[data-testid="${testId}-0"]`)
      ;(box.element as HTMLInputElement).value = code
      await box.trigger('input')
      await flushPromises()
    }

    async function click(wrapper: ReturnType<typeof mount>, testId: string): Promise<void> {
      await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
      await flushPromises()
    }

    it('lists each passkey with its name, when it was added and last used; the app reads Off beside them', async () => {
      getTwoFactorStatus.mockResolvedValue(status({ passkeys: [MAC, KEY] }))
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.get('[data-testid="two-factor-state"]').text()).toBe('Off')
      expect(wrapper.find('[data-testid="two-factor-setup"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="passkeys-count"]').text()).toBe('2')
      const rows = wrapper.findAll('[data-testid="passkey-row"]')
      expect(rows.map((row) => row.get('[data-testid="passkey-name"]').text())).toEqual(['MacBook', 'YubiKey'])
      expect(rows.map((row) => row.get('[data-testid="passkey-added"]').text())).toEqual(['13 Nov', '10 Nov'])
      expect(rows.map((row) => row.get('[data-testid="passkey-last-used"]').text())).toEqual(['Never', '12 Nov'])
      expect(wrapper.find('[data-testid="passkey-add"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="two-factor-new-codes"]').exists()).toBe(true)
    })

    it('adds a first passkey after the password: Continue opens the prompt, then the recovery codes once', async () => {
      getTwoFactorStatus.mockResolvedValue({ ...status({ passkeys: [] }), enabled: false })
      beginPasskeyRegistration.mockResolvedValue({ outcome: 'begun', publicKeyOptions: CREATION_OPTIONS })
      finishPasskeyRegistration.mockResolvedValue({ outcome: 'added', recoveryCodes: CODES })
      const wrapper = mountPage()
      await flushPromises()
      expect(wrapper.get('[data-testid="passkeys-count"]').text()).toBe('None')

      await click(wrapper, 'passkey-add')
      expect(wrapper.text()).toContain('Enter your current password.')
      await wrapper.get('[data-testid="two-factor-password"]').setValue('current-pass')
      await click(wrapper, 'two-factor-proof-next')
      expect(beginPasskeyRegistration).toHaveBeenCalledWith({ currentPassword: 'current-pass' })
      expect(wrapper.text()).toContain('Add a passkey.')
      expect(webauthn?.create).not.toHaveBeenCalled()

      getTwoFactorStatus.mockResolvedValue(status())
      await click(wrapper, 'passkey-add-next')

      // finishPasskeyRegistration is the store action that swaps this tab to the new key (authTwoFactor.spec).
      expect(finishPasskeyRegistration).toHaveBeenCalledWith(CREATED_JSON)
      expect(wrapper.findAll('[data-testid="two-factor-recovery-code"]')).toHaveLength(10)
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toContain('Two-factor on.')
      expect(listCliSessions).toHaveBeenCalledTimes(2)

      await click(wrapper, 'two-factor-codes-saved')
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(false)
      expect(wrapper.findAll('[data-testid="passkey-row"]')).toHaveLength(1)
    })

    it('adds another passkey proved by a passkey; a closed prompt stays on the step and says nothing', async () => {
      getTwoFactorStatus.mockResolvedValue(status())
      beginPasskeyRegistration.mockResolvedValue({ outcome: 'begun', publicKeyOptions: CREATION_OPTIONS })
      finishPasskeyRegistration.mockResolvedValue({ outcome: 'added', recoveryCodes: [] })
      webauthn?.get.mockRejectedValueOnce(notAllowed())
      const wrapper = mountPage()
      await flushPromises()

      await click(wrapper, 'passkey-add')
      // Passkey only: no code box, and the proof's options are already fetched.
      expect(wrapper.text()).toContain('Confirm with your passkey.')
      expect(wrapper.find('[data-testid="two-factor-proof-code-0"]').exists()).toBe(false)
      expect(beginPasskeyProof).toHaveBeenCalledTimes(1)

      await click(wrapper, 'two-factor-proof-next')
      expect(beginPasskeyRegistration).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Confirm with your passkey.')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)

      await click(wrapper, 'two-factor-proof-next')
      expect(beginPasskeyProof).toHaveBeenCalledTimes(1)
      expect(beginPasskeyRegistration).toHaveBeenCalledWith({ passkeyAssertion: ASSERTION_JSON })

      await click(wrapper, 'passkey-add-next')
      expect(finishPasskeyRegistration).toHaveBeenCalledWith(CREATED_JSON)
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toBe('Passkey added.')
    })

    it('shows the backend\'s refusal to remove a required person\'s last factor, and keeps the passkey', async () => {
      getTwoFactorStatus.mockResolvedValue(status({ required: true }))
      deletePasskey.mockRejectedValue(new ApiCallError('Two-factor is required for your role, so your last way to sign in cannot be removed.', 500))
      const wrapper = mountPage()
      await flushPromises()

      await click(wrapper, 'passkey-remove')
      expect(wrapper.text()).toContain('Remove passkey')
      await click(wrapper, 'two-factor-proof-next')

      expect(deletePasskey).toHaveBeenCalledWith({ passkeyId: 'P1', passkeyAssertion: ASSERTION_JSON })
      expect(wrapper.text()).toContain('Two-factor is required for your role, so your last way to sign in cannot be removed.')
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(true)
      expect(applyTwoFactorState).not.toHaveBeenCalled()
    })

    it('removes a passkey with an app code on the button only; the last factor going turns two-factor off', async () => {
      getTwoFactorStatus.mockResolvedValue(status({ appEnabled: true, passkeys: [MAC, KEY] }))
      deletePasskey.mockResolvedValue({ ok: true, messages: [], errors: [], twoFactorEnabled: true })
      const wrapper = mountPage()
      await flushPromises()

      await wrapper.findAll('[data-testid="passkey-remove"]')[1]?.trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="two-factor-proof-use-passkey"]').exists()).toBe(true)
      await typeCode(wrapper, 'two-factor-proof-code', '123456')
      expect(deletePasskey).not.toHaveBeenCalled()
      await click(wrapper, 'two-factor-proof-next')

      expect(deletePasskey).toHaveBeenCalledWith({ passkeyId: 'P2', code: '123456' })
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toBe('Passkey removed.')
      expect(applyTwoFactorState).not.toHaveBeenCalled()

      getTwoFactorStatus.mockResolvedValue({ ...status({ appEnabled: false, passkeys: [] }), enabled: false })
      deletePasskey.mockResolvedValue({ ok: true, messages: [], errors: [], twoFactorEnabled: false })
      await click(wrapper, 'passkey-remove')
      await typeCode(wrapper, 'two-factor-proof-code', '654321')
      await click(wrapper, 'two-factor-proof-next')
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toContain('Two-factor off.')
      expect(applyTwoFactorState).toHaveBeenCalledWith({ enabled: false, dueDate: null })
    })

    it('Turn off removes only the app while a passkey remains, also for a required person', async () => {
      getTwoFactorStatus.mockResolvedValue(status({ appEnabled: true, required: true }))
      disableTwoFactor.mockResolvedValue({ ok: true, messages: [], errors: [] })
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.get('[data-testid="two-factor-state"]').text()).toBe('On')
      await click(wrapper, 'two-factor-off')
      expect(wrapper.text()).toContain('Remove authenticator app')
      await typeCode(wrapper, 'two-factor-proof-code', '111222')
      await click(wrapper, 'two-factor-proof-next')

      expect(disableTwoFactor).toHaveBeenCalledWith({ code: '111222', appOnly: true })
      expect(wrapper.get('[data-testid="two-factor-message"]').text()).toBe('Authenticator app removed.')
      expect(applyTwoFactorState).not.toHaveBeenCalled()
    })

    it('renames in place; a refused or empty name goes back to the old one', async () => {
      getTwoFactorStatus.mockResolvedValue(status())
      const wrapper = mountPage()
      await flushPromises()

      const rename = async (typed: string) => {
        const name = wrapper.get('[data-testid="passkey-name"]')
        name.element.textContent = typed
        await name.trigger('input')
        await name.trigger('keydown', { key: 'Enter' })
        await flushPromises()
      }

      await rename('Work laptop')
      expect(renamePasskey).toHaveBeenCalledWith({ passkeyId: 'P1', name: 'Work laptop' }, expect.anything())
      expect(wrapper.get('[data-testid="passkey-name"]').text()).toBe('Work laptop')

      renamePasskey.mockRejectedValueOnce(new ApiCallError('A name is required.', 500))
      await rename('Bad')
      expect(wrapper.get('[data-testid="passkey-error"]').text()).toBe('A name is required.')
      expect(wrapper.get('[data-testid="passkey-name"]').text()).toBe('Work laptop')

      await rename('   ')
      expect(renamePasskey).toHaveBeenCalledTimes(2)
      expect(wrapper.get('[data-testid="passkey-name"]').text()).toBe('Work laptop')
    })

    it('without WebAuthn the list stays but Add does not show', async () => {
      webauthn?.restore()
      webauthn = null
      getTwoFactorStatus.mockResolvedValue(status())
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.findAll('[data-testid="passkey-row"]')).toHaveLength(1)
      expect(wrapper.find('[data-testid="passkey-add"]').exists()).toBe(false)
    })

    it('a passkey-only person on a browser without passkeys is told so, never asked for an app code', async () => {
      webauthn?.restore()
      webauthn = null
      getTwoFactorStatus.mockResolvedValue(status())
      const wrapper = mountPage()
      await flushPromises()

      await click(wrapper, 'two-factor-new-codes')
      expect(wrapper.text()).toContain('This browser cannot use passkeys.')
      expect(wrapper.find('[data-testid="two-factor-proof-code-0"]').exists()).toBe(false)
      expect(beginPasskeyProof).not.toHaveBeenCalled()
      await click(wrapper, 'two-factor-no-proof-ok')
      expect(wrapper.find('[data-testid="two-factor-workflow"]').exists()).toBe(false)
    })

    it('offers no two-factor action when the status did not load', async () => {
      getTwoFactorStatus.mockRejectedValue(new ApiCallError('Darpan stepped out for chai. Try again in a moment.', 503))
      authState.sessionInfo = { ...authState.sessionInfo, twoFactorEnabled: true }
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.get('[data-testid="two-factor-load-error"]').text()).toBe('Could not load two-factor.')
      expect(wrapper.find('[data-testid="two-factor-off"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="two-factor-setup"]').exists()).toBe(false)
      authState.sessionInfo = { ...authState.sessionInfo, twoFactorEnabled: false }
    })

    it('an instance without passkeys shows no passkey card at all', async () => {
      getTwoFactorStatus.mockResolvedValue(status({ passkeysAvailable: false, passkeys: [], appEnabled: true }))
      const wrapper = mountPage()
      await flushPromises()

      expect(wrapper.find('[data-testid="passkeys-card"]').exists()).toBe(false)
    })
  })
})
