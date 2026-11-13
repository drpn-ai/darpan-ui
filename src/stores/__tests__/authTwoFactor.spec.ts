import { beforeEach, describe, expect, it, vi } from 'vitest'

// DAR-BE-264: the auth store's two-factor paths against the real client token storage (per-tab sessionStorage),
// with only the facade mocked.

const loginSession = vi.hoisted(() => vi.fn())
const verifySignInCode = vi.hoisted(() => vi.fn())
const beginTwoFactorSetup = vi.hoisted(() => vi.fn())
const confirmTwoFactorSetup = vi.hoisted(() => vi.fn())
const beginPasskeySignIn = vi.hoisted(() => vi.fn())
const beginPasskeyRegistration = vi.hoisted(() => vi.fn())
const finishPasskeyRegistration = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
  authFacade: {
    loginSession,
    verifySignInCode,
    beginTwoFactorSetup,
    confirmTwoFactorSetup,
    beginPasskeySignIn,
    beginPasskeyRegistration,
    finishPasskeyRegistration,
  },
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
// As the backend answers since darpan d4d13e26: a completed call, never a JSON-RPC error.
const refusal = (challengeEnded = false, reason = "That code didn't work.") => ({
  ok: false, messages: [], errors: [reason], authenticated: false, challengeEnded,
})

function storageHolds(value: string): boolean {
  const all = [window.sessionStorage, window.localStorage]
  return all.some((storage) => Array.from({ length: storage.length }, (_, i) => storage.getItem(storage.key(i) ?? '') ?? '')
    .some((stored) => stored.includes(value)))
}

async function signInToChallenge(purpose: 'code' | 'setup' = 'code', extra: Record<string, unknown> = {}) {
  loginSession.mockResolvedValue({
    ...extra,
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

  it('a refusal keeps the challenge while challengeEnded is false, however many there are', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockResolvedValue(refusal(false))

    for (let attempt = 1; attempt <= 6; attempt += 1) {
      expect(await store.verifySignInCode({ code: '000000' })).toMatchObject({ outcome: 'refused', message: "That code didn't work." })
    }
    expect(store.twoFactorChallengePurpose).toBe('code')
  })

  it('challengeEnded on a refusal ends the challenge at once', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockResolvedValue(refusal(true))

    const result = await store.verifySignInCode({ code: '000000' })

    expect(result).toEqual({ outcome: 'ended', message: 'Sign in again.' })
    expect(store.twoFactorChallengePurpose).toBeNull()
    expect(getAuthToken()).toBeNull()
  })

  it('a failed call (no reply) keeps the challenge: nothing says it ended, so the person can try again', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockRejectedValue(new ApiCallError('Darpan stepped out for chai. Try again in a moment.'))

    expect(await store.verifySignInCode({ code: '123456' })).toMatchObject({ outcome: 'refused', message: 'Darpan stepped out for chai. Try again in a moment.' })
    expect(store.twoFactorChallengePurpose).toBe('code')
  })

  // The sign-in form shows the store's error. A refusal belongs to the step that showed it: after Back, the fresh form
  // must not open on "That code didn't work."
  it('refusals and endings never become the store\'s error', async () => {
    const { store } = await signInToChallenge('code')
    verifySignInCode.mockResolvedValueOnce(refusal(false)).mockResolvedValueOnce(refusal(true))

    await store.verifySignInCode({ code: '000000' })
    expect(store.error).toBeNull()
    await store.verifySignInCode({ code: '000000' })
    expect(store.error).toBeNull()
  })

  it('setup: begin or confirm refused with challengeEnded ends the setup challenge', async () => {
    const { store } = await signInToChallenge('setup')
    beginTwoFactorSetup.mockResolvedValueOnce(refusal(true, 'This sign-in has expired. Enter your password again.'))
    expect((await store.beginTwoFactorSetup()).outcome).toBe('ended')

    await signInToChallenge('setup')
    confirmTwoFactorSetup.mockResolvedValueOnce(refusal(false))
    expect(await store.confirmTwoFactorSetup('000000')).toMatchObject({ outcome: 'refused', message: "That code didn't work." })
    expect(store.twoFactorChallengePurpose).toBe('setup')
    confirmTwoFactorSetup.mockResolvedValueOnce(refusal(true))
    expect((await store.confirmTwoFactorSetup('000000')).outcome).toBe('ended')
    expect(store.twoFactorChallengePurpose).toBeNull()
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

  it('a signed-in confirm refused keeps the old key; SETUP_EXPIRED says start again', async () => {
    setAuthTokenContract({ authToken: 'old-key', authTokenHeaderName: 'login_key' })
    const store = useAuthStore()
    confirmTwoFactorSetup.mockResolvedValueOnce(refusal(false))
    // The reason code says so, never the wording.
    confirmTwoFactorSetup.mockResolvedValueOnce({ ...refusal(false, 'Setup has expired. Start again.'), reason: 'SETUP_EXPIRED' })

    expect(await store.confirmTwoFactorSetup('000000')).toMatchObject({ outcome: 'refused', message: "That code didn't work." })
    expect(getAuthToken()).toBe('old-key')
    expect(await store.confirmTwoFactorSetup('000000')).toEqual({ outcome: 'ended', message: 'Setup has expired. Start again.' })
  })
  it('keeps login#Session\'s passkeysAvailable with the challenge, for a forced setup', async () => {
    expect((await signInToChallenge('setup', { passkeysAvailable: true })).store.twoFactorPasskeysAvailable).toBe(true)
    expect((await signInToChallenge('setup')).store.twoFactorPasskeysAvailable).toBe(false)
  })

  // ─── DAR-BE-270 passkeys ─────────────────────────────────────────────────────

  it('keeps what login#Session says the person can answer with, and only the ways this page knows', async () => {
    const { store } = await signInToChallenge('code', { twoFactorMethods: ['passkey', 'sms'] })
    expect(store.twoFactorMethods).toEqual(['passkey'])
  })

  it('begins a passkey sign-in with the challenge token and verifies the assertion against it', async () => {
    const { store } = await signInToChallenge('code', { twoFactorMethods: ['passkey'] })
    beginPasskeySignIn.mockResolvedValue({ ok: true, messages: [], errors: [], publicKeyOptions: '{"challenge":"AQID"}', challengeEnded: false })
    verifySignInCode.mockResolvedValue(signedIn('passkey-key'))

    expect(await store.beginPasskeySignIn()).toEqual({ outcome: 'begun', publicKeyOptions: '{"challenge":"AQID"}' })
    expect(beginPasskeySignIn).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    const result = await store.verifySignInCode({ passkeyAssertion: '{"id":"cred-1"}' })

    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, passkeyAssertion: '{"id":"cred-1"}' })
    expect(result.outcome).toBe('signedIn')
    expect(getAuthToken()).toBe('passkey-key')
    expect(storageHolds(CHALLENGE)).toBe(false)
  })

  it('a passkey begin refused with challengeEnded ends the challenge', async () => {
    const { store } = await signInToChallenge('code', { twoFactorMethods: ['passkey'] })
    beginPasskeySignIn.mockResolvedValue({ ...refusal(true, 'This sign-in has expired. Enter your password again.') })

    expect((await store.beginPasskeySignIn()).outcome).toBe('ended')
    expect(store.twoFactorChallengePurpose).toBeNull()
  })

  it('a required setup by passkey uses the token alone, and finish signs the tab in with the recovery codes', async () => {
    const { store } = await signInToChallenge('setup')
    beginPasskeyRegistration.mockResolvedValue({ ok: true, messages: [], errors: [], publicKeyOptions: '{"challenge":"AQID"}', challengeEnded: false })
    finishPasskeyRegistration.mockResolvedValue(signedIn('setup-key', { passkeyId: 'P1', recoveryCodes: ['a', 'b'] }))

    expect((await store.beginPasskeyRegistration({ currentPassword: 'ignored' })).outcome).toBe('begun')
    expect(beginPasskeyRegistration).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    const added = await store.finishPasskeyRegistration('{"id":"cred-1"}')

    expect(finishPasskeyRegistration).toHaveBeenCalledWith({ credential: '{"id":"cred-1"}', challengeToken: CHALLENGE })
    expect(added).toEqual({ outcome: 'added', recoveryCodes: ['a', 'b'] })
    expect(store.authenticated).toBe(true)
    expect(getAuthToken()).toBe('setup-key')
    expect(store.twoFactorChallengePurpose).toBeNull()
  })

  it('a refused finish through a setup challenge follows challengeEnded', async () => {
    const { store } = await signInToChallenge('setup')
    finishPasskeyRegistration.mockResolvedValueOnce(refusal(false, "That passkey didn't work."))
    finishPasskeyRegistration.mockResolvedValueOnce(refusal(true, "That passkey didn't work."))

    expect(await store.finishPasskeyRegistration('{}')).toMatchObject({ outcome: 'refused', message: "That passkey didn't work." })
    expect(store.twoFactorChallengePurpose).toBe('setup')
    expect((await store.finishPasskeyRegistration('{}')).outcome).toBe('ended')
    expect(store.twoFactorChallengePurpose).toBeNull()
  })

  it('signed in, a first passkey swaps the tab to the returned key; another passkey keeps the key it has', async () => {
    setAuthTokenContract({ authToken: 'old-key', authTokenHeaderName: 'login_key' })
    const store = useAuthStore()
    finishPasskeyRegistration.mockResolvedValueOnce(signedIn('first-factor-key', { passkeyId: 'P1', recoveryCodes: ['a'] }))
    finishPasskeyRegistration.mockResolvedValueOnce({ ok: true, messages: [], errors: [], passkeyId: 'P2', challengeEnded: false })

    expect(await store.finishPasskeyRegistration('{"id":"one"}')).toEqual({ outcome: 'added', recoveryCodes: ['a'] })
    expect(finishPasskeyRegistration).toHaveBeenCalledWith({ credential: '{"id":"one"}' })
    expect(getAuthToken()).toBe('first-factor-key')
    expect(store.twoFactorEnabled).toBe(true)

    expect(await store.finishPasskeyRegistration('{"id":"two"}')).toEqual({ outcome: 'added', recoveryCodes: [] })
    expect(getAuthToken()).toBe('first-factor-key')
  })
})
