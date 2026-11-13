import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// DAR-BE-270: passkeys on the sign-in page, through the real auth store with only the facade, the router and the
// browser's WebAuthn surface stubbed. What could bite: a closed prompt treated as a wrong answer, a refusal that does
// not follow challengeEnded, options reused after the backend used them up, and passkeys offered where the browser
// has none.

const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const route = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
const loginSession = vi.hoisted(() => vi.fn())
const verifySignInCode = vi.hoisted(() => vi.fn())
const beginTwoFactorSetup = vi.hoisted(() => vi.fn())
const confirmTwoFactorSetup = vi.hoisted(() => vi.fn())
const beginPasskeySignIn = vi.hoisted(() => vi.fn())
const beginPasskeyRegistration = vi.hoisted(() => vi.fn())
const finishPasskeyRegistration = vi.hoisted(() => vi.fn())
const getPasswordResetStatus = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('../../lib/api/facade', () => ({
  authFacade: {
    loginSession,
    verifySignInCode,
    beginTwoFactorSetup,
    confirmTwoFactorSetup,
    beginPasskeySignIn,
    beginPasskeyRegistration,
    finishPasskeyRegistration,
    getPasswordResetStatus,
  },
  settingsFacade: {},
  clearApiResponseCache: vi.fn(),
}))
vi.mock('../../stores/referenceData', () => ({ useReferenceDataStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('../../stores/runResults', () => ({ useRunResultsStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))

import LoginPage from '../LoginPage.vue'
import { clearAuthToken, getAuthToken } from '../../lib/api/client'
import { installLocalStorageStub } from '../../test/localStorage'
import {
  ASSERTION_JSON,
  CREATED_JSON,
  CREATION_OPTIONS,
  REQUEST_OPTIONS,
  installWebAuthnStub,
  notAllowed,
  type WebAuthnStub,
} from '../../test/webauthn'

const CHALLENGE = 'challenge-xyz'
const CODES = Array.from({ length: 10 }, (_, i) => `abcd-efgh-jkmn-pq${String(i).padStart(2, '0')}`)
const signedIn = (authToken: string, extra: Record<string, unknown> = {}) => ({
  ok: true, messages: [], errors: [], authenticated: true, authToken, authTokenHeaderName: 'login_key',
  sessionInfo: { userId: 'U1', username: 'ada', twoFactorEnabled: true }, ...extra,
})
const codeChallenge = (methods: string[]) => ({
  ok: true, messages: [], errors: [], authenticated: false, challengeToken: CHALLENGE, challengeExpiresInSeconds: 300,
  twoFactorRequired: true, twoFactorMethods: methods,
})
const setupChallenge = {
  ok: true, messages: [], errors: [], authenticated: false, challengeToken: CHALLENGE, challengeExpiresInSeconds: 300,
  twoFactorSetupRequired: true, twoFactorMethods: [],
}
const refusal = (challengeEnded: boolean, reason = "That passkey didn't work.") => ({
  ok: false, messages: [], errors: [reason], authenticated: false, challengeEnded,
})
const begun = (publicKeyOptions: string) => ({ ok: true, messages: [], errors: [], publicKeyOptions, challengeEnded: false, expiresInSeconds: 300 })
const setupStart = {
  ok: true, messages: [], errors: [], secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Darpan:ada?secret=JBSWY3DPEHPK3PXP',
  qrDataUri: null, expiresInSeconds: 900,
}

async function signIn(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('input[autocomplete="username"]').setValue('ada')
  await wrapper.get('input[autocomplete="current-password"]').setValue('right-password')
  await wrapper.get('form').trigger('submit.prevent')
  await flushPromises()
}

async function click(wrapper: ReturnType<typeof mount>, testId: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await flushPromises()
}

describe('LoginPage passkeys', () => {
  let webauthn: WebAuthnStub | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageStub()
    clearAuthToken()
    route.query = {}
    getPasswordResetStatus.mockResolvedValue({ available: false })
    beginPasskeySignIn.mockResolvedValue(begun(REQUEST_OPTIONS))
    beginPasskeyRegistration.mockResolvedValue(begun(CREATION_OPTIONS))
    webauthn = installWebAuthnStub()
  })

  afterEach(() => {
    webauthn?.restore()
    webauthn = null
  })

  it('offers a passkey beside the app code and signs in with it', async () => {
    loginSession.mockResolvedValue(codeChallenge(['app', 'passkey']))
    verifySignInCode.mockResolvedValue(signedIn('key-1'))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    expect(wrapper.text()).toContain('Enter the code from your app.')
    await click(wrapper, 'login-two-factor-use-passkey')
    // The options are fetched as the step shows, so Continue opens the prompt straight from its click.
    expect(beginPasskeySignIn).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(wrapper.text()).toContain('Confirm with your passkey.')
    expect(webauthn?.get).not.toHaveBeenCalled()

    await click(wrapper, 'login-two-factor-passkey-next')

    expect(webauthn?.get).toHaveBeenCalledTimes(1)
    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, passkeyAssertion: ASSERTION_JSON })
    expect(getAuthToken()).toBe('key-1')
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('passkey only: opens the prompt at once; a closed prompt stays put, says nothing, and Continue reuses the options', async () => {
    loginSession.mockResolvedValue(codeChallenge(['passkey']))
    verifySignInCode.mockResolvedValue(signedIn('key-2'))
    webauthn?.get.mockRejectedValueOnce(notAllowed())
    const wrapper = mount(LoginPage)

    await signIn(wrapper)

    expect(webauthn?.get).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Confirm with your passkey.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain("didn't work")
    expect(verifySignInCode).not.toHaveBeenCalled()
    // No app here: the fallback is a recovery code.
    expect(wrapper.find('[data-testid="login-two-factor-use-app"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="login-two-factor-use-recovery"]').exists()).toBe(true)

    await click(wrapper, 'login-two-factor-passkey-next')

    expect(beginPasskeySignIn).toHaveBeenCalledTimes(1)
    expect(webauthn?.get).toHaveBeenCalledTimes(2)
    expect(getAuthToken()).toBe('key-2')
  })

  it('passkey only: Back from the recovery code returns to the passkey, and Back from there to the password', async () => {
    loginSession.mockResolvedValue(codeChallenge(['passkey']))
    webauthn?.get.mockRejectedValue(notAllowed())
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await click(wrapper, 'login-two-factor-use-recovery')
    expect(wrapper.text()).toContain('Enter a recovery code.')
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Confirm with your passkey.')
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()
    expect(wrapper.find('h1').text()).toBe('Sign In')
  })

  it('a refused passkey stays with the one message and fresh options; challengeEnded goes back to the password', async () => {
    loginSession.mockResolvedValue(codeChallenge(['app', 'passkey']))
    verifySignInCode.mockResolvedValueOnce(refusal(false)).mockResolvedValueOnce(refusal(true))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await click(wrapper, 'login-two-factor-use-passkey')
    await click(wrapper, 'login-two-factor-passkey-next')

    expect(wrapper.text()).toContain("That passkey didn't work.")
    expect(wrapper.text()).toContain('Confirm with your passkey.')
    // The assertion used the challenge up: the next try begins again.
    expect(beginPasskeySignIn).toHaveBeenCalledTimes(2)

    await click(wrapper, 'login-two-factor-passkey-next')

    expect(wrapper.find('h1').text()).toBe('Sign In')
    expect(wrapper.text()).toContain('This sign-in has expired. Enter your password again.')
    expect(getAuthToken()).toBeNull()
  })

  it('a spent challenge at begin goes back to the password without opening a prompt', async () => {
    loginSession.mockResolvedValue(codeChallenge(['passkey']))
    beginPasskeySignIn.mockResolvedValue({ ...refusal(true, 'This sign-in has expired. Enter your password again.'), publicKeyOptions: undefined })
    const wrapper = mount(LoginPage)

    await signIn(wrapper)

    expect(webauthn?.get).not.toHaveBeenCalled()
    expect(wrapper.find('h1').text()).toBe('Sign In')
  })

  it('without WebAuthn a passkey is never offered; passkey-only falls back to a recovery code', async () => {
    webauthn?.restore()
    webauthn = null
    loginSession.mockResolvedValue(codeChallenge(['app', 'passkey']))
    const wrapper = mount(LoginPage)
    await signIn(wrapper)
    expect(wrapper.text()).toContain('Enter the code from your app.')
    expect(wrapper.find('[data-testid="login-two-factor-use-passkey"]').exists()).toBe(false)

    loginSession.mockResolvedValue(codeChallenge(['passkey']))
    const second = mount(LoginPage)
    await signIn(second)
    expect(second.text()).toContain('Enter a recovery code.')
    expect(beginPasskeySignIn).not.toHaveBeenCalled()
  })

  it('a required setup can be a passkey: Continue opens the prompt, the recovery codes show once, then it signs in', async () => {
    loginSession.mockResolvedValue(setupChallenge)
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    finishPasskeyRegistration.mockResolvedValue(signedIn('key-after-passkey', { passkeyId: 'P1', recoveryCodes: CODES, challengeEnded: false }))
    webauthn?.create.mockRejectedValueOnce(notAllowed())
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    expect(wrapper.text()).toContain('Scan this with your authenticator app.')
    await click(wrapper, 'two-factor-use-passkey')
    expect(beginPasskeyRegistration).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(wrapper.text()).toContain('Add a passkey.')

    // Closed prompt: still here, nothing sent, nothing said.
    await click(wrapper, 'passkey-add-next')
    expect(finishPasskeyRegistration).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Add a passkey.')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)

    await click(wrapper, 'passkey-add-next')

    expect(webauthn?.create).toHaveBeenCalledTimes(2)
    expect(finishPasskeyRegistration).toHaveBeenCalledWith({ credential: CREATED_JSON, challengeToken: CHALLENGE })
    expect(getAuthToken()).toBe('key-after-passkey')
    expect(wrapper.findAll('[data-testid="two-factor-recovery-code"]')).toHaveLength(10)
    expect(replace).not.toHaveBeenCalled()

    await click(wrapper, 'two-factor-codes-saved')
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('a refused passkey setup begins again with the same challenge and says why', async () => {
    loginSession.mockResolvedValue(setupChallenge)
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    finishPasskeyRegistration.mockResolvedValue({ ...refusal(false, 'That passkey is already registered.'), passkeyId: undefined })
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await click(wrapper, 'two-factor-use-passkey')
    await click(wrapper, 'passkey-add-next')

    expect(wrapper.text()).toContain('That passkey is already registered.')
    expect(wrapper.text()).toContain('Add a passkey.')
    expect(beginPasskeyRegistration).toHaveBeenCalledTimes(2)
    expect(getAuthToken()).toBeNull()
  })

  it('an instance without passkeys says so once and stops offering them', async () => {
    loginSession.mockResolvedValue(setupChallenge)
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    beginPasskeyRegistration.mockResolvedValue({
      ...refusal(false, 'Passkeys are not available on this Darpan instance.'), publicKeyOptions: undefined,
    })
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await click(wrapper, 'two-factor-use-passkey')

    expect(wrapper.text()).toContain('Passkeys are not available on this Darpan instance.')
    expect(wrapper.text()).toContain('Scan this with your authenticator app.')
    expect(wrapper.find('[data-testid="two-factor-use-passkey"]').exists()).toBe(false)
  })
})
