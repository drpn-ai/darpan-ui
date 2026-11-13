import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// DAR-BE-264: the auth store's two-factor paths against the real client token storage (per-tab sessionStorage),
// with only the facade mocked.

const loginSession = vi.hoisted(() => vi.fn())
const verifySignInCode = vi.hoisted(() => vi.fn())
const beginTwoFactorSetup = vi.hoisted(() => vi.fn())
const confirmTwoFactorSetup = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
  authFacade: { loginSession, verifySignInCode, beginTwoFactorSetup, confirmTwoFactorSetup },
  settingsFacade: {},
  clearApiResponseCache: vi.fn(),
}))
// Signing in fans out reference-data reads; they are not under test here.
vi.mock('../referenceData', () => ({ useReferenceDataStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('../runResults', () => ({ useRunResultsStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))

import { useAuthStore } from '../auth'
import { installLocalStorageStub } from '../../test/localStorage'
import { ApiCallError, clearAuthToken, getAuthToken, setAuthTokenContract } from '../../lib/api/client'

const CHALLENGE = 'challenge-token-abc'
const signedIn = (authToken: string, extra: Record<string, unknown> = {}) => ({
  ok: true,
  messages: [],
  errors: [],
  authenticated: true,
  authToken,
  authTokenType: 'LOGIN_KEY',
  authTokenHeaderName: 'login_key',
  authTokenExpiresInSeconds: 3600,
  sessionInfo: { userId: 'U1', username: 'ada', twoFactorEnabled: true },
  ...extra,
})
const refusal = () => new ApiCallError("That code didn't work.", 500)

function storageHolds(value: string): boolean {
  const all = [window.sessionStorage, window.localStorage]
  return all.some((storage) => Array.from({ length: storage.length }, (_, i) => storage.getItem(storage.key(i) ?? '') ?? '')
    .some((stored) => stored.includes(value)))
}

async function signInToChallenge(purpose: 'code' | 'setup' = 'code') {
  loginSession.mockResolvedValue({
    ok: true,
    messages: [],
    errors: [],
    authenticated: false,
    ...(purpose === 'code' ? { twoFactorRequired: true } : { twoFactorSetupRequired: true }),
    challengeToken: CHALLENGE,
    challengeExpiresInSeconds: 300,
  })
  const store = useAuthStore()
  const authenticated = await store.loginWithCredentials('ada', 'right-password')
  return { store, authenticated }
}

describe('auth store two-factor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageStub()
    clearAuthToken()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('holds a code challenge in memory only: no session, no token, nothing in storage', async () => {
    const { store, authenticated } = await signInToChallenge('code')

    expect(authenticated).toBe(false)
    expect(store.authenticated).toBe(false)
    expect(store.twoFactorChallengePurpose).toBe('code')
    expect(getAuthToken()).toBeNull()
    expect(storageHolds(CHALLENGE)).toBe(false)
  })

  it('a right code signs the tab in with the returned key and drops the challenge', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockResolvedValue(signedIn('key-after-code'))

    const result = await store.verifySignInCode({ code: '123456' })

    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, code: '123456' })
    expect(result).toEqual({ outcome: 'signedIn', recoveryCodesLeft: null })
    expect(store.authenticated).toBe(true)
    expect(store.twoFactorChallengePurpose).toBeNull()
    expect(getAuthToken()).toBe('key-after-code')
    expect(JSON.parse(window.sessionStorage.getItem('darpan.authToken') ?? '{}')).toMatchObject({ value: 'key-after-code' })
  })

  it('a recovery code is sent as recoveryCode and reports how many are left', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockResolvedValue(signedIn('key-after-recovery', { recoveryCodesLeft: 2 }))

    const result = await store.verifySignInCode({ recoveryCode: 'abcd-efgh-jkmn-pqrs' })

    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, recoveryCode: 'abcd-efgh-jkmn-pqrs' })
    expect(result).toEqual({ outcome: 'signedIn', recoveryCodesLeft: 2 })
  })

  it('a wrong code keeps the challenge; the fifth ends it (the refusal JSON-RPC error carries no challengeEnded)', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockRejectedValue(refusal())

    for (let attempt = 1; attempt <= 4; attempt += 1) {
      expect(await store.verifySignInCode({ code: '000000' })).toEqual({ outcome: 'refused', message: "That code didn't work." })
      expect(store.twoFactorChallengePurpose).toBe('code')
    }
    const fifth = await store.verifySignInCode({ code: '000000' })

    expect(fifth.outcome).toBe('ended')
    expect(store.twoFactorChallengePurpose).toBeNull()
  })

  it('a network failure is not counted as a guess', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockRejectedValue(new ApiCallError('Darpan stepped out for chai. Try again in a moment.'))

    for (let attempt = 1; attempt <= 6; attempt += 1) await store.verifySignInCode({ code: '000000' })

    expect(store.twoFactorChallengePurpose).toBe('code')
  })

  it('ends at once on the expired-sign-in refusal, and on a success reply that says challengeEnded', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockRejectedValueOnce(new ApiCallError('This sign-in has expired. Enter your password again.', 500))

    expect((await store.verifySignInCode({ code: '111111' })).outcome).toBe('ended')

    await signInToChallenge('code')
    verifySignInCode.mockResolvedValueOnce({ ok: true, messages: [], errors: [], authenticated: false, challengeEnded: true })
    expect((await store.verifySignInCode({ code: '111111' })).outcome).toBe('ended')
  })

  it('past its 300 s the challenge ends without asking the backend', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'))
    const { store } = await signInToChallenge('code')

    vi.setSystemTime(new Date('2026-11-13T10:05:01Z'))
    const result = await store.verifySignInCode({ code: '123456' })

    expect(result.outcome).toBe('ended')
    expect(verifySignInCode).not.toHaveBeenCalled()
  })

  it('a required setup uses the challenge token alone, and confirm signs in with the recovery codes', async () => {
    const { store } = await signInToChallenge('setup')
    expect(store.twoFactorChallengePurpose).toBe('setup')
    beginTwoFactorSetup.mockResolvedValue({
      ok: true, messages: [], errors: [],
      secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP',
      otpauthUri: 'otpauth://totp/Darpan:ada?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Darpan',
      qrDataUri: 'data:image/svg+xml;base64,PHN2Zy8+',
      expiresInSeconds: 900,
    })
    confirmTwoFactorSetup.mockResolvedValue(signedIn('key-after-setup', { recoveryCodes: ['aaaa-bbbb-cccc-dddd'] }))

    const begun = await store.beginTwoFactorSetup({ currentPassword: 'ignored-with-a-challenge' })
    const confirmed = await store.confirmTwoFactorSetup('654321')

    expect(beginTwoFactorSetup).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(begun).toMatchObject({ outcome: 'begun', setup: { secret: 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP' } })
    expect(confirmTwoFactorSetup).toHaveBeenCalledWith({ code: '654321', challengeToken: CHALLENGE })
    expect(confirmed).toEqual({ outcome: 'confirmed', recoveryCodes: ['aaaa-bbbb-cccc-dddd'] })
    expect(store.authenticated).toBe(true)
    expect(getAuthToken()).toBe('key-after-setup')
    expect(store.twoFactorChallengePurpose).toBeNull()
  })

  it('a signed-in setup swaps the tab to the key confirm returns (the old key predates the factor)', async () => {
    setAuthTokenContract({ authToken: 'old-key', authTokenHeaderName: 'login_key' })
    const store = useAuthStore()
    beginTwoFactorSetup.mockResolvedValue({
      ok: true, messages: [], errors: [],
      secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Darpan:ada?secret=JBSWY3DPEHPK3PXP', qrDataUri: null,
    })
    confirmTwoFactorSetup.mockResolvedValue(signedIn('new-key', { recoveryCodes: ['x'] }))

    await store.beginTwoFactorSetup({ currentPassword: 'pw' })
    const confirmed = await store.confirmTwoFactorSetup('123456')

    expect(beginTwoFactorSetup).toHaveBeenCalledWith({ currentPassword: 'pw' })
    expect(confirmTwoFactorSetup).toHaveBeenCalledWith({ code: '123456' })
    expect(confirmed.outcome).toBe('confirmed')
    expect(getAuthToken()).toBe('new-key')
    expect(JSON.parse(window.sessionStorage.getItem('darpan.authToken') ?? '{}')).toMatchObject({ value: 'new-key' })
    expect(store.twoFactorEnabled).toBe(true)
  })

  it('a signed-in confirm refused keeps the old key; an expired setup says start again', async () => {
    setAuthTokenContract({ authToken: 'old-key', authTokenHeaderName: 'login_key' })
    const store = useAuthStore()
    confirmTwoFactorSetup.mockRejectedValueOnce(refusal())
    confirmTwoFactorSetup.mockRejectedValueOnce(new ApiCallError('Setup has expired. Start again.', 500))

    expect(await store.confirmTwoFactorSetup('000000')).toEqual({ outcome: 'refused', message: "That code didn't work." })
    expect(getAuthToken()).toBe('old-key')
    expect(await store.confirmTwoFactorSetup('000000')).toEqual({ outcome: 'ended', message: 'Setup has expired. Start again.' })
  })
})
