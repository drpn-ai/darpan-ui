import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const saveUserSettingsMock = vi.hoisted(() => vi.fn())
const saveTenantSettingsMock = vi.hoisted(() => vi.fn())
const logoutSessionMock = vi.hoisted(() => vi.fn())
const loginSessionMock = vi.hoisted(() => vi.fn())
const changeExpiredPasswordMock = vi.hoisted(() => vi.fn())
const requestPasswordResetMock = vi.hoisted(() => vi.fn())
const verifyPasswordResetCodeMock = vi.hoisted(() => vi.fn())
const completePasswordResetMock = vi.hoisted(() => vi.fn())
const saveRecoveryEmailMock = vi.hoisted(() => vi.fn())
const getPasswordResetStatusMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
  authFacade: {
    saveUserSettings: saveUserSettingsMock,
    logoutSession: logoutSessionMock,
    loginSession: loginSessionMock,
    changeExpiredPassword: changeExpiredPasswordMock,
    requestPasswordReset: requestPasswordResetMock,
    verifyPasswordResetCode: verifyPasswordResetCodeMock,
    completePasswordReset: completePasswordResetMock,
    saveRecoveryEmail: saveRecoveryEmailMock,
    getPasswordResetStatus: getPasswordResetStatusMock,
  },
  settingsFacade: {
    saveTenantSettings: saveTenantSettingsMock,
  },
  clearApiResponseCache: vi.fn(),
}))

import { resolveEffectiveTimeZone, useAuthStore } from '../auth'
import { getDefaultDisplayTimeZone, setDefaultDisplayTimeZone } from '../../lib/utils/date'
import { clearAuthToken } from '../../lib/api/client'
import { useReferenceDataStore } from '../referenceData'

describe('resolveEffectiveTimeZone', () => {
  /**
   * The backend already answers this question. TenantAccessSupport.resolveTenantSettingsTimeZone is
   * tenant -> user -> l10n -> default and ships the result as `timeZone`; this recomputed it from
   * the raw parts with the precedence INVERTED (user first), so a tenant timezone was silently
   * ignored for anyone who had set a personal one. Reconciliation timestamps belong to the tenant's
   * business day, so the tenant leads.
   */
  it('honours the backend-resolved timeZone, which puts the tenant ahead of the user', () => {
    expect(resolveEffectiveTimeZone({
      userId: 'U',
      timeZone: 'America/Los_Angeles',
      userTimeZone: 'America/New_York',
      tenantTimeZone: 'America/Los_Angeles',
    })).toBe('America/Los_Angeles')
  })

  it('still leads with the tenant when the backend-resolved field is absent', () => {
    // Older sessions and the auth-bypass path do not carry `timeZone`; the fallback keeps the same
    // ordering rather than reverting to the inverted one.
    expect(resolveEffectiveTimeZone({ userId: 'U', userTimeZone: 'America/New_York', tenantTimeZone: 'Asia/Kolkata' }))
      .toBe('Asia/Kolkata')
  })

  it('uses a personal timezone only when the tenant has none', () => {
    expect(resolveEffectiveTimeZone({ userId: 'U', userTimeZone: 'America/New_York' })).toBe('America/New_York')
    expect(resolveEffectiveTimeZone({ userId: 'U' })).toBeUndefined()
    expect(resolveEffectiveTimeZone(null)).toBeUndefined()
  })
})

describe('auth store display-timezone sync', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    setDefaultDisplayTimeZone(undefined)
    vi.clearAllMocks()
  })

  it('applies the effective timezone after a user-settings save', async () => {
    saveUserSettingsMock.mockResolvedValue({
      ok: true,
      authenticated: true,
      messages: [],
      errors: [],
      // No tenant timezone: a personal preference applies only where the tenant has not set one.
      sessionInfo: { userId: 'M100000', userTimeZone: 'America/New_York' },
    })

    const store = useAuthStore()
    const saved = await store.saveUserSettings({ timeZone: 'America/New_York' })

    expect(saved).toBe(true)
    expect(saveUserSettingsMock).toHaveBeenCalledWith({ timeZone: 'America/New_York' })
    expect(getDefaultDisplayTimeZone()).toBe('America/New_York')
  })

  it('falls back to the tenant timezone when the user preference is unset', async () => {
    saveUserSettingsMock.mockResolvedValue({
      ok: true,
      authenticated: true,
      messages: [],
      errors: [],
      sessionInfo: { userId: 'M100000', tenantTimeZone: 'Asia/Kolkata' },
    })

    const store = useAuthStore()
    await store.saveUserSettings({ timeZone: '' })

    expect(getDefaultDisplayTimeZone()).toBe('Asia/Kolkata')
  })

  /**
   * saveTenantSettings writes the saved zone into sessionInfo.timeZone — which is precisely the
   * field the old resolver never read, so changing a tenant's timezone in-app left every timestamp
   * rendering in the previous zone until a full session refetch. Reading the backend-resolved field
   * closes that as a side effect of fixing the precedence.
   */
  it('applies the new zone as soon as tenant settings are saved', async () => {
    saveTenantSettingsMock.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      tenantSettings: { companyUserGroupId: 'RAILS', companyLabel: 'Rails', timeZone: 'America/Los_Angeles' },
    })

    const store = useAuthStore()
    // saveTenantSettings only re-applies onto an existing session (you must be signed in to save
    // tenant settings at all), so seed one first. It starts in a DIFFERENT zone so a pass cannot be
    // the seed value leaking through.
    saveUserSettingsMock.mockResolvedValue({
      ok: true,
      authenticated: true,
      messages: [],
      errors: [],
      sessionInfo: { userId: 'M100000', timeZone: 'Asia/Kolkata', tenantTimeZone: 'Asia/Kolkata' },
    })
    await store.saveUserSettings({})
    expect(getDefaultDisplayTimeZone()).toBe('Asia/Kolkata')

    await store.saveTenantSettings({ timeZone: 'America/Los_Angeles' })

    expect(getDefaultDisplayTimeZone()).toBe('America/Los_Angeles')
    expect(useReferenceDataStore().tenantSettings?.timeZone).toBe('America/Los_Angeles')
  })

  it('stores a streaks-only save without touching the session timezone', async () => {
    saveUserSettingsMock.mockResolvedValue({
      ok: true,
      authenticated: true,
      messages: [],
      errors: [],
      sessionInfo: { userId: 'M100000', timeZone: 'Asia/Kolkata', tenantTimeZone: 'Asia/Kolkata' },
    })
    const store = useAuthStore()
    await store.saveUserSettings({})

    // The service answers with the whole settings map even when only the space was sent.
    saveTenantSettingsMock.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      tenantSettings: { companyUserGroupId: 'RAILS', timeZone: 'Asia/Kolkata', streaksChatSpaceId: 'CS1' },
    })
    await store.saveTenantSettings({ streaksChatSpaceId: 'CS1' })

    expect(saveTenantSettingsMock).toHaveBeenLastCalledWith({ streaksChatSpaceId: 'CS1' })
    expect(useReferenceDataStore().tenantSettings?.streaksChatSpaceId).toBe('CS1')
    expect(getDefaultDisplayTimeZone()).toBe('Asia/Kolkata')
  })

  it('clears the display timezone when the session ends', async () => {
    saveUserSettingsMock.mockResolvedValue({
      ok: true,
      authenticated: true,
      messages: [],
      errors: [],
      sessionInfo: { userId: 'M100000', userTimeZone: 'America/New_York' },
    })
    logoutSessionMock.mockResolvedValue({ ok: true, authenticated: false, messages: [], errors: [] })

    const store = useAuthStore()
    await store.saveUserSettings({ timeZone: 'America/New_York' })
    expect(getDefaultDisplayTimeZone()).toBe('America/New_York')

    await store.logoutSession()
    expect(getDefaultDisplayTimeZone()).toBeUndefined()
  })

  it('clears the display timezone when an external auth change detects no token', async () => {
    saveUserSettingsMock.mockResolvedValue({
      ok: true,
      authenticated: true,
      messages: [],
      errors: [],
      sessionInfo: { userId: 'M100000', userTimeZone: 'America/New_York' },
    })

    const store = useAuthStore()
    await store.saveUserSettings({ timeZone: 'America/New_York' })
    expect(getDefaultDisplayTimeZone()).toBe('America/New_York')

    // No bearer token present (e.g. another tab logged out) — drive the same
    // no-token branch handleExternalAuthChange takes on a storage event.
    clearAuthToken()
    store.handleExternalAuthChange()

    expect(store.status).toBe('unauthenticated')
    expect(getDefaultDisplayTimeZone()).toBeUndefined()
  })
})

describe('auth store forced password change', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('records why a correct credential was still refused', async () => {
    // ok:true with authenticated:false — the credentials were accepted, only the session is withheld.
    // The client layer throws away the payload of any ok:false envelope, so the reason code has to ride
    // on a completed call.
    loginSessionMock.mockResolvedValue({
      ok: true,
      authenticated: false,
      passwordChangeRequired: true,
      passwordChangeReason: 'PWDCHG',
      messages: ['Your password must be changed before you can sign in.'],
      errors: [],
    })

    const store = useAuthStore()
    const authenticated = await store.loginWithCredentials('avnindra.sharma', 'temp-pass')

    expect(authenticated).toBe(false)
    expect(store.passwordChangeReason).toBe('PWDCHG')
    expect(store.error).toBe('Your password must be changed before you can sign in.')
  })

  it('leaves the reason unset for an ordinary bad password', async () => {
    loginSessionMock.mockResolvedValue({
      ok: false,
      authenticated: false,
      messages: [],
      errors: ['Invalid username or password'],
    })

    const store = useAuthStore()
    await store.loginWithCredentials('avnindra.sharma', 'wrong')

    expect(store.passwordChangeReason).toBeNull()
  })

  it('clears the reason once the password has been changed', async () => {
    loginSessionMock.mockResolvedValue({
      ok: true,
      authenticated: false,
      passwordChangeRequired: true,
      passwordChangeReason: 'PWDTIM',
      messages: ['Your password has expired and must be changed before you can sign in.'],
      errors: [],
    })
    changeExpiredPasswordMock.mockResolvedValue({
      ok: true,
      passwordUpdated: true,
      messages: [],
      errors: [],
    })

    const store = useAuthStore()
    await store.loginWithCredentials('avnindra.sharma', 'stale-pass')
    expect(store.passwordChangeReason).toBe('PWDTIM')

    const changed = await store.changeExpiredPassword({
      username: 'avnindra.sharma',
      currentPassword: 'stale-pass',
      newPassword: 'N3w-password!',
      newPasswordVerify: 'N3w-password!',
    })

    expect(changed).toBe(true)
    expect(store.passwordChangeReason).toBeNull()
    expect(store.error).toBeNull()
  })

  it('reports a refused change without claiming success', async () => {
    changeExpiredPasswordMock.mockResolvedValue({
      ok: false,
      passwordUpdated: false,
      messages: [],
      errors: ['Unable to change the password. Check the username and current password.'],
    })

    const store = useAuthStore()
    const changed = await store.changeExpiredPassword({
      username: 'avnindra.sharma',
      currentPassword: 'wrong',
      newPassword: 'N3w-password!',
      newPasswordVerify: 'N3w-password!',
    })

    expect(changed).toBe(false)
    expect(store.error).toBe('Unable to change the password. Check the username and current password.')
  })
})

// DAR-BE-028 — forgot password and the recovery email.
describe('password reset and recovery email', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  async function signInWith(sessionInfo: Record<string, unknown>) {
    loginSessionMock.mockResolvedValue({ ok: true, authenticated: true, authToken: 'tok', sessionInfo, messages: [], errors: [] })
    const store = useAuthStore()
    await store.loginWithCredentials('pwr.user', 'Old-pass1!')
    return store
  }

  it('requests a code and returns what happened', async () => {
    requestPasswordResetMock.mockResolvedValueOnce({
      ok: true, messages: [], errors: [], outcome: 'sent', emailAddressMasked: 'p•••@example.com',
    })
    requestPasswordResetMock.mockResolvedValueOnce({ ok: true, messages: [], errors: [], outcome: 'noEmail' })
    const store = useAuthStore()

    expect(await store.requestPasswordReset('pwr.user')).toEqual({ outcome: 'sent', emailAddressMasked: 'p•••@example.com' })
    expect(await store.requestPasswordReset('pwr.user')).toEqual({ outcome: 'noEmail', emailAddressMasked: null })
    expect(requestPasswordResetMock).toHaveBeenCalledWith({ usernameOrEmail: 'pwr.user' })
    expect(store.error).toBeNull()
  })

  it('verifies a code and reports the backend message when it fails', async () => {
    verifyPasswordResetCodeMock.mockResolvedValueOnce({ ok: true, verified: true, messages: [], errors: [] })
    verifyPasswordResetCodeMock.mockResolvedValueOnce({
      ok: false, verified: false, messages: [], errors: ["That code didn't work. Request a new one."],
    })
    const store = useAuthStore()

    expect(await store.verifyPasswordResetCode('pwr.user', '123 456')).toBe(true)
    expect(verifyPasswordResetCodeMock).toHaveBeenCalledWith({ usernameOrEmail: 'pwr.user', code: '123 456' })
    expect(await store.verifyPasswordResetCode('pwr.user', '000000')).toBe(false)
    expect(store.error).toBe("That code didn't work. Request a new one.")
  })

  it('completes a reset and surfaces a refused password', async () => {
    completePasswordResetMock.mockResolvedValueOnce({ ok: true, passwordUpdated: true, messages: [], errors: [] })
    completePasswordResetMock.mockResolvedValueOnce({
      ok: false, passwordUpdated: false, messages: [], errors: ['Password shorter than 8 characters'],
    })
    const store = useAuthStore()
    const payload = { usernameOrEmail: 'pwr.user', code: '123456', newPassword: 'N3w-pass!', newPasswordVerify: 'N3w-pass!' }

    expect(await store.completePasswordReset(payload)).toBe(true)
    expect(completePasswordResetMock).toHaveBeenCalledWith(payload)
    expect(await store.completePasswordReset({ ...payload, newPassword: 'a', newPasswordVerify: 'a' })).toBe(false)
    expect(store.error).toBe('Password shorter than 8 characters')
  })

  it('reads the recovery email flags from the session', async () => {
    const store = await signInWith({ userId: 'U1', recoveryEmailMissing: true, emailAddressMasked: null })

    expect(store.recoveryEmailMissing).toBe(true)
    expect(store.emailAddressMasked).toBeNull()
  })

  it('saves a recovery email with the current password and updates the session flags', async () => {
    const store = await signInWith({ userId: 'U1', recoveryEmailMissing: true, emailAddressMasked: null })
    saveRecoveryEmailMock.mockResolvedValue({ ok: true, emailAddressMasked: 'n•••@example.com', messages: [], errors: [] })

    expect(await store.saveRecoveryEmail('new@example.com', 'Old-pass1!')).toBe(true)

    expect(saveRecoveryEmailMock).toHaveBeenCalledWith({ emailAddress: 'new@example.com', currentPassword: 'Old-pass1!' })
    expect(store.recoveryEmailMissing).toBe(false)
    expect(store.emailAddressMasked).toBe('n•••@example.com')
  })

  it('keeps the flags when the recovery email is refused', async () => {
    const store = await signInWith({ userId: 'U1', recoveryEmailMissing: true, emailAddressMasked: null })
    saveRecoveryEmailMock.mockResolvedValue({ ok: false, messages: [], errors: ['Current password is incorrect.'] })

    expect(await store.saveRecoveryEmail('new@example.com', 'wrong')).toBe(false)

    expect(store.error).toBe('Current password is incorrect.')
    expect(store.recoveryEmailMissing).toBe(true)
  })

  it('treats an unreachable reset status as unavailable', async () => {
    getPasswordResetStatusMock.mockResolvedValueOnce({ available: true })
    getPasswordResetStatusMock.mockRejectedValueOnce(new Error('offline'))
    const store = useAuthStore()

    expect(await store.getPasswordResetAvailable()).toBe(true)
    expect(await store.getPasswordResetAvailable()).toBe(false)
  })
})
