import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const saveUserSettingsMock = vi.hoisted(() => vi.fn())
const logoutSessionMock = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
  authFacade: {
    saveUserSettings: saveUserSettingsMock,
    logoutSession: logoutSessionMock,
  },
  settingsFacade: {},
  clearApiResponseCache: vi.fn(),
}))

import { resolveEffectiveTimeZone, useAuthStore } from '../auth'
import { getDefaultDisplayTimeZone, setDefaultDisplayTimeZone } from '../../lib/utils/date'
import { clearAuthToken } from '../../lib/api/client'

describe('resolveEffectiveTimeZone', () => {
  it('prefers userTimeZone, then tenantTimeZone, then undefined', () => {
    expect(resolveEffectiveTimeZone({ userId: 'U', userTimeZone: 'America/New_York', tenantTimeZone: 'Asia/Kolkata' }))
      .toBe('America/New_York')
    expect(resolveEffectiveTimeZone({ userId: 'U', tenantTimeZone: 'Asia/Kolkata' })).toBe('Asia/Kolkata')
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
      sessionInfo: { userId: 'M100000', userTimeZone: 'America/New_York', tenantTimeZone: 'Asia/Kolkata' },
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
