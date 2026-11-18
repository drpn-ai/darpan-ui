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
const getTwoFactorStatus = vi.hoisted(() => vi.fn())
const beginPasskeyFirstSignIn = vi.hoisted(() => vi.fn())
const finishPasskeyFirstSignIn = vi.hoisted(() => vi.fn())

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
    getTwoFactorStatus,
    beginPasskeyFirstSignIn,
    finishPasskeyFirstSignIn,
  },
  settingsFacade: {},
  clearApiResponseCache: vi.fn(),
}))
vi.mock('../../stores/referenceData', () => ({ useReferenceDataStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('../../stores/runResults', () => ({ useRunResultsStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))

import LoginPage from '../LoginPage.vue'
import { clearAuthToken, getAuthToken } from '../../lib/api/client'
import { installLocalStorageStub } from '../../test/localStorage'
import { hasRememberedPasskey, rememberPasskey } from '../../lib/passkeyHint'
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
  twoFactorSetupRequired: true, twoFactorMethods: [], passkeysAvailable: true,
}
const refusal = (challengeEnded: boolean, reason = "That passkey didn't work.") => ({
  ok: false, messages: [], errors: [reason], authenticated: false, challengeEnded,
})
const begun = (publicKeyOptions: string) => ({ ok: true, messages: [], errors: [], publicKeyOptions, challengeEnded: false, expiresInSeconds: 300 })
const setupStart = {
  ok: true, messages: [], errors: [], secret: 'JBSWY3DPEHPK3PXP', otpauthUri: 'otpauth://totp/Darpan:ada?secret=JBSWY3DPEHPK3PXP',
  qrDataUri: null, expiresInSeconds: 900,
}

/** The remembered-passkey hint is a SHA-256 through crypto.subtle, which settles a few turns after a promise flush. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** DAR-UI-120: the username step and its Next. */
async function enterUsername(wrapper: ReturnType<typeof mount>, user = 'ada'): Promise<void> {
  await wrapper.get('#login-username').setValue(user)
  await wrapper.get('[data-testid="login-username-next"]').trigger('click')
  await settle()
}

async function signIn(wrapper: ReturnType<typeof mount>): Promise<void> {
  await enterUsername(wrapper)
  await wrapper.get('#login-password').setValue('right-password')
  await wrapper.get('[data-testid="login-current-password-next"]').trigger('click')
  await settle()
}

/** A browser that offers passkeys in the username autofill: the conditional request waits until the page aborts it,
 *  unless `pick` says the person chose a passkey there. A modal request answers as the stub does. */
function withAutofill(stub: WebAuthnStub, pick = false): AbortSignal[] {
  const signals: AbortSignal[] = []
  const modal = stub.get.getMockImplementation()
  stub.get.mockImplementation((options: CredentialRequestOptions) => {
    if (options.mediation !== 'conditional') return modal?.(options)
    if (options.signal) signals.push(options.signal)
    if (pick) return modal?.(options)
    return new Promise((_, reject) => {
      options.signal?.addEventListener('abort', () => reject(new DOMException('The operation was aborted.', 'AbortError')))
    })
  })
  return signals
}

const modalCalls = (stub: WebAuthnStub | null) => (stub?.get.mock.calls ?? []).filter(([options]) => options.mediation !== 'conditional')

async function click(wrapper: ReturnType<typeof mount>, testId: string): Promise<void> {
  await wrapper.get(`[data-testid="${testId}"]`).trigger('click')
  await settle()
}

describe('LoginPage passkeys', () => {
  let webauthn: WebAuthnStub | null = null

  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageStub()
    clearAuthToken()
    route.query = {}
    getPasswordResetStatus.mockResolvedValue({ available: false })
    getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: false, passkeysAvailable: true })
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
    // DAR-UI-120: that passkey can be the whole sign-in next time.
    expect(await hasRememberedPasskey('ada')).toBe(true)
  })

  it('an app code as the second step remembers no passkey', async () => {
    loginSession.mockResolvedValue(codeChallenge(['app', 'passkey']))
    verifySignInCode.mockResolvedValue(signedIn('key-app'))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    const box = wrapper.get('[data-testid="login-two-factor-code-0"]')
    ;(box.element as HTMLInputElement).value = '123456'
    await box.trigger('input')
    await flushPromises()

    expect(getAuthToken()).toBe('key-app')
    expect(await hasRememberedPasskey('ada')).toBe(false)
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
    expect(wrapper.text()).toContain('Sign in again.')
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

  it('a required setup asks app or passkey first; a passkey begins no app setup and signs in after the codes', async () => {
    loginSession.mockResolvedValue(setupChallenge)
    finishPasskeyRegistration.mockResolvedValue(signedIn('key-after-passkey', { passkeyId: 'P1', recoveryCodes: CODES, challengeEnded: false }))
    webauthn?.create.mockRejectedValueOnce(notAllowed())
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    expect(wrapper.text()).toContain('Authenticator app or passkey?')
    await click(wrapper, 'two-factor-enrol-passkey')
    await click(wrapper, 'two-factor-enrol-next')
    // No pending app row is made for someone who chose a passkey.
    expect(beginTwoFactorSetup).not.toHaveBeenCalled()
    expect(beginPasskeyRegistration).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(wrapper.text()).toContain('Add a passkey.')

    // Closed prompt: still here, nothing sent, nothing said.
    await click(wrapper, 'passkey-add-next')
    expect(finishPasskeyRegistration).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Add a passkey.')
    expect(wrapper.text()).not.toContain("didn't work")

    await click(wrapper, 'passkey-add-next')

    expect(webauthn?.create).toHaveBeenCalledTimes(2)
    expect(finishPasskeyRegistration).toHaveBeenCalledWith({ credential: CREATED_JSON, challengeToken: CHALLENGE })
    expect(getAuthToken()).toBe('key-after-passkey')
    expect(wrapper.findAll('[data-testid="two-factor-recovery-code"]')).toHaveLength(10)
    expect(replace).not.toHaveBeenCalled()

    await click(wrapper, 'two-factor-codes-saved')
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('the app is the default answer, and Back from its scan step returns to the choice', async () => {
    loginSession.mockResolvedValue(setupChallenge)
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await click(wrapper, 'two-factor-enrol-next')
    expect(beginTwoFactorSetup).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(wrapper.text()).toContain('Scan this with your authenticator app.')

    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Authenticator app or passkey?')
  })

  it('a refused passkey setup begins again with the same challenge and says why', async () => {
    loginSession.mockResolvedValue(setupChallenge)
    finishPasskeyRegistration.mockResolvedValue({ ...refusal(false, 'That passkey is already registered.'), passkeyId: undefined })
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await click(wrapper, 'two-factor-enrol-passkey')
    await click(wrapper, 'two-factor-enrol-next')
    await click(wrapper, 'passkey-add-next')

    expect(wrapper.text()).toContain('That passkey is already registered.')
    expect(wrapper.text()).toContain('Add a passkey.')
    expect(beginPasskeyRegistration).toHaveBeenCalledTimes(2)
    expect(getAuthToken()).toBeNull()
  })

  it('an instance without passkeys (login#Session says so) offers only the app, and begins it at once', async () => {
    loginSession.mockResolvedValue({ ...setupChallenge, passkeysAvailable: false })
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    const wrapper = mount(LoginPage)

    await signIn(wrapper)

    expect(wrapper.find('[data-testid="two-factor-enrol-passkey"]').exists()).toBe(false)
    expect(beginPasskeyRegistration).not.toHaveBeenCalled()
    expect(beginTwoFactorSetup).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(wrapper.text()).toContain('Scan this with your authenticator app.')
  })

  it('in the grace period a passkey is set up with the password just used, then the codes, then on', async () => {
    loginSession.mockResolvedValue(signedIn('grace-key', {
      sessionInfo: { userId: 'U1', username: 'ada', twoFactorEnabled: false, twoFactorDueDate: '2026-12-01T12:00:00Z' },
    }))
    finishPasskeyRegistration.mockResolvedValue(signedIn('key-after-first-passkey', { passkeyId: 'P1', recoveryCodes: CODES }))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    expect(wrapper.text()).toContain('Set up two-factor by 1 Dec.')
    await click(wrapper, 'login-two-factor-due-setup')
    // A sign-in without a challenge does not say whether passkeys are offered: the status read does.
    expect(getTwoFactorStatus).toHaveBeenCalledTimes(1)
    await click(wrapper, 'two-factor-enrol-passkey')
    await click(wrapper, 'two-factor-enrol-next')
    expect(beginPasskeyRegistration).toHaveBeenCalledWith({ currentPassword: 'right-password' })

    await click(wrapper, 'passkey-add-next')
    // Signed in, a first factor swaps this tab to the key the backend reissued.
    expect(finishPasskeyRegistration).toHaveBeenCalledWith({ credential: CREATED_JSON })
    expect(getAuthToken()).toBe('key-after-first-passkey')
    await click(wrapper, 'two-factor-codes-saved')
    expect(replace).toHaveBeenCalledWith('/')
  })

  describe('username first, then a passkey or the password (DAR-UI-120)', () => {
    const first = { ok: true, messages: [], errors: [], challengeToken: 'first-token', publicKeyOptions: REQUEST_OPTIONS, expiresInSeconds: 300 }
    const refused = (reason: string, message: string) => ({ ok: false, messages: [], errors: [message], reason, authenticated: false })

    beforeEach(() => {
      beginPasskeyFirstSignIn.mockResolvedValue(first)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('a username this browser has not seen sign in with a passkey goes to the password; no prompt, no server check', async () => {
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)

      expect(wrapper.text()).toContain('Password for ada?')
      expect(beginPasskeyFirstSignIn).not.toHaveBeenCalled()
      expect(webauthn?.get).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="login-use-passkey"]').exists()).toBe(true)
    })

    it('a remembered username opens the passkey prompt at Next and signs in with no password and no code', async () => {
      await rememberPasskey('ada')
      finishPasskeyFirstSignIn.mockResolvedValue(signedIn('key-first'))
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper, 'Ada')

      expect(beginPasskeyFirstSignIn).toHaveBeenCalledWith({ username: 'Ada' })
      expect(modalCalls(webauthn)).toHaveLength(1)
      expect(webauthn?.get.mock.calls[0]?.[0]).not.toHaveProperty('mediation')
      expect(finishPasskeyFirstSignIn).toHaveBeenCalledWith({ challengeToken: 'first-token', passkeyAssertion: ASSERTION_JSON })
      expect(loginSession).not.toHaveBeenCalled()
      expect(verifySignInCode).not.toHaveBeenCalled()
      expect(getAuthToken()).toBe('key-first')
      expect(replace).toHaveBeenCalledWith('/')
    })

    it('a closed prompt says so and stays; Try again opens it again; Use password instead goes to the password', async () => {
      await rememberPasskey('ada')
      webauthn?.get.mockRejectedValueOnce(notAllowed()).mockRejectedValueOnce(notAllowed())
      loginSession.mockResolvedValue(signedIn('key-pw'))
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)

      expect(wrapper.text()).toContain('Use your passkey.')
      expect(wrapper.get('[data-testid="login-passkey-username"]').text()).toBe('ada')
      expect(wrapper.text()).toContain('Passkey sign-in was cancelled.')
      expect(finishPasskeyFirstSignIn).not.toHaveBeenCalled()

      await click(wrapper, 'login-passkey-try-again')
      expect(modalCalls(webauthn)).toHaveLength(2)
      expect(wrapper.text()).toContain('Use your passkey.')

      await click(wrapper, 'login-use-password')
      expect(wrapper.text()).toContain('Password for ada?')
      expect(wrapper.text()).not.toContain('cancelled')
      await wrapper.get('#login-password').setValue('right-password')
      await click(wrapper, 'login-current-password-next')
      expect(getAuthToken()).toBe('key-pw')
      // A cancel is not a refusal: the hint stays.
      expect(await hasRememberedPasskey('ada')).toBe(true)
    })

    it('Back from the passkey step returns to the username with the name kept', async () => {
      await rememberPasskey('ada')
      webauthn?.get.mockRejectedValueOnce(notAllowed())
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)

      await wrapper.get('.wizard-back').trigger('click')
      await settle()

      expect(wrapper.text()).toContain('Username?')
      expect(wrapper.text()).not.toContain('cancelled')
      expect((wrapper.get('#login-username').element as HTMLInputElement).value).toBe('ada')
    })

    it('a refused passkey shows the message and forgets the hint, so the next Next asks for the password', async () => {
      await rememberPasskey('ada')
      finishPasskeyFirstSignIn.mockResolvedValue(refused('PASSKEY_REFUSED', "That passkey didn't work."))
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)

      expect(wrapper.text()).toContain("That passkey didn't work.")
      expect(wrapper.text()).toContain('Use your passkey.')
      expect(getAuthToken()).toBeNull()
      expect(await hasRememberedPasskey('ada')).toBe(false)

      await wrapper.get('.wizard-back').trigger('click')
      await settle()
      await enterUsername(wrapper)
      expect(wrapper.text()).toContain('Password for ada?')
    })

    it('a password change required goes to the password step with its message, focused', async () => {
      await rememberPasskey('ada')
      finishPasskeyFirstSignIn.mockResolvedValue(refused('PASSWORD_CHANGE_REQUIRED', 'Sign in with your password once to set a new one.'))
      const wrapper = mount(LoginPage, { attachTo: document.body })
      await enterUsername(wrapper)

      expect(wrapper.text()).toContain('Sign in with your password once to set a new one.')
      expect(wrapper.text()).toContain('Password for ada?')
      expect(document.activeElement).toBe(wrapper.get('#login-password').element)
      // Not a refused passkey: it still opens first next time.
      expect(await hasRememberedPasskey('ada')).toBe(true)
      wrapper.unmount()
    })

    it('a refused begin shows its message and opens no prompt', async () => {
      await rememberPasskey('ada')
      beginPasskeyFirstSignIn.mockResolvedValue(refused('TOO_MANY_ATTEMPTS', 'Too many tries. Wait a minute.'))
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)

      expect(wrapper.text()).toContain('Too many tries. Wait a minute.')
      expect(webauthn?.get).not.toHaveBeenCalled()
    })

    it('the password step\'s link runs the prompt for that username, and remembers it once signed in', async () => {
      finishPasskeyFirstSignIn.mockResolvedValue(signedIn('key-link'))
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)
      await click(wrapper, 'login-use-passkey')

      expect(beginPasskeyFirstSignIn).toHaveBeenCalledWith({ username: 'ada' })
      expect(modalCalls(webauthn)).toHaveLength(1)
      expect(loginSession).not.toHaveBeenCalled()
      expect(getAuthToken()).toBe('key-link')
      expect(await hasRememberedPasskey('ada')).toBe(true)
    })

    it('autofill: a passkey picked in the username field signs in, and the account\'s name is remembered', async () => {
      webauthn?.restore()
      webauthn = installWebAuthnStub({ conditional: true })
      withAutofill(webauthn, true)
      finishPasskeyFirstSignIn.mockResolvedValue(signedIn('key-autofill'))
      mount(LoginPage)
      await settle()

      expect(beginPasskeyFirstSignIn).toHaveBeenCalledWith({})
      expect(webauthn.get.mock.calls[0]?.[0]).toMatchObject({ mediation: 'conditional' })
      expect(finishPasskeyFirstSignIn).toHaveBeenCalledWith({ challengeToken: 'first-token', passkeyAssertion: ASSERTION_JSON })
      expect(getAuthToken()).toBe('key-autofill')
      expect(replace).toHaveBeenCalledWith('/')
      expect(await hasRememberedPasskey('ada')).toBe(true)
    })

    it('autofill waits while the username step shows, and Next aborts it', async () => {
      webauthn?.restore()
      webauthn = installWebAuthnStub({ conditional: true })
      const signals = withAutofill(webauthn)
      const wrapper = mount(LoginPage)
      await settle()
      expect(signals).toHaveLength(1)
      expect(signals[0]?.aborted).toBe(false)

      await enterUsername(wrapper)

      expect(signals[0]?.aborted).toBe(true)
      expect(wrapper.text()).toContain('Password for ada?')
      expect(finishPasskeyFirstSignIn).not.toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('cancelled')
    })

    it('autofill is aborted before the modal prompt opens, and comes back with the username step', async () => {
      await rememberPasskey('ada')
      webauthn?.restore()
      webauthn = installWebAuthnStub({ conditional: true })
      const signals = withAutofill(webauthn)
      const wrapper = mount(LoginPage)
      await settle()
      expect(signals).toHaveLength(1)

      // Browsers take one WebAuthn request at a time: the waiting autofill must be gone when the prompt is asked for.
      let autofillAbortedFirst = false
      const autofillOrModal = webauthn.get.getMockImplementation()
      webauthn.get.mockImplementation(async (options: CredentialRequestOptions) => {
        if (options.mediation === 'conditional') return autofillOrModal?.(options)
        autofillAbortedFirst = signals[0]?.aborted === true
        throw notAllowed()
      })

      await enterUsername(wrapper)
      expect(autofillAbortedFirst).toBe(true)
      expect(wrapper.text()).toContain('Use your passkey.')

      await wrapper.get('.wizard-back').trigger('click')
      await settle()
      expect(signals).toHaveLength(2)
      expect(signals[1]?.aborted).toBe(false)
      wrapper.unmount()
      expect(signals[1]?.aborted).toBe(true)
    })

    it('autofill begins a fresh challenge before the old one expires', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      webauthn?.restore()
      webauthn = installWebAuthnStub({ conditional: true })
      const signals = withAutofill(webauthn)
      mount(LoginPage)
      await flushPromises()
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(270_000)
      await flushPromises()

      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(2)
      expect(signals[0]?.aborted).toBe(true)
      expect(signals[1]?.aborted).toBe(false)
    })

    it('autofill that cannot begin says nothing and leaves the steps working', async () => {
      webauthn?.restore()
      webauthn = installWebAuthnStub({ conditional: true })
      beginPasskeyFirstSignIn.mockResolvedValue(refused('TOO_MANY_ATTEMPTS', 'Too many tries. Wait a minute.'))
      const wrapper = mount(LoginPage)
      await settle()

      expect(webauthn.get).not.toHaveBeenCalled()
      expect(wrapper.text()).not.toContain('Too many tries.')
      await enterUsername(wrapper)
      expect(wrapper.text()).toContain('Password for ada?')
    })

    it('without WebAuthn: username then password, with no autofill and no passkey control even for a remembered name', async () => {
      await rememberPasskey('ada')
      webauthn?.restore()
      webauthn = null
      const wrapper = mount(LoginPage)
      await settle()
      await enterUsername(wrapper)

      expect(beginPasskeyFirstSignIn).not.toHaveBeenCalled()
      expect(wrapper.text()).toContain('Password for ada?')
      expect(wrapper.find('[data-testid="login-use-passkey"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="login-passkey-try-again"]').exists()).toBe(false)
    })
  })
})
