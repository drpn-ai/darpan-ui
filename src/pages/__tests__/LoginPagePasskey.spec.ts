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
import { keepAccount, keptAccount } from '../../lib/passkeyHint'
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

/** A few turns of promises and timers: begins, the prompt, finish, and the route change chain on each other. */
async function settle(): Promise<void> {
  for (let turn = 0; turn < 5; turn += 1) {
    await flushPromises()
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

/** DAR-UI-120: the username step and its Next (past Welcome back, when this browser kept an account). */
async function enterUsername(wrapper: ReturnType<typeof mount>, user = 'ada'): Promise<void> {
  if (wrapper.find('[data-testid="login-another-account"]').exists()) {
    await wrapper.get('[data-testid="login-another-account"]').trigger('click')
    await settle()
  }
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
    // DAR-UI-120/132: that passkey can be the whole sign-in on this browser next time, and nothing more is asked.
    expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
    expect(beginPasskeyRegistration).not.toHaveBeenCalled()
  })

  // DAR-UI-132: a note that says a passkey proved ada here makes the passkey the first answer, even after the password.
  it('the second step opens on the passkey where this browser\'s note says one proved them here', async () => {
    keepAccount('ada', 'passkey')
    beginPasskeyFirstSignIn.mockResolvedValue({ ok: true, messages: [], errors: [], challengeToken: 'first-token', publicKeyOptions: REQUEST_OPTIONS, expiresInSeconds: 300 })
    loginSession.mockResolvedValue(codeChallenge(['app', 'passkey']))
    webauthn?.get.mockRejectedValueOnce(notAllowed())
    const wrapper = mount(LoginPage)
    // Welcome back opens the passkey; closing it goes to the password, quietly, and the note flips.
    await click(wrapper, 'login-welcome-row')
    expect(wrapper.text()).toContain('Password for ada?')
    expect(keptAccount()?.method).toBe('password')
    // Say a passkey proved ada here since (a CLI approval in another tab): the second step leads with it.
    keepAccount('ada', 'passkey')
    verifySignInCode.mockResolvedValue(signedIn('key-pk'))
    await wrapper.get('#login-password').setValue('right-password')
    await click(wrapper, 'login-current-password-next')

    // It opened the passkey prompt on its own (no app code box first) and signed in with it.
    expect(beginPasskeySignIn).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, passkeyAssertion: ASSERTION_JSON })
    expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
    expect(beginPasskeyRegistration).not.toHaveBeenCalled()
  })

  /** Signs in by password, then answers the second step with the app's code. */
  async function signInWithAppCode(wrapper: ReturnType<typeof mount>): Promise<void> {
    await signIn(wrapper)
    const box = wrapper.get('[data-testid="login-two-factor-code-0"]')
    ;(box.element as HTMLInputElement).value = '123456'
    await box.trigger('input')
    await settle()
  }

  describe('add a passkey on this device, after a code from the app (DAR-UI-132)', () => {
    const added = { ok: true, messages: [], errors: [], passkeyId: 'P9', challengeEnded: false }

    beforeEach(() => {
      loginSession.mockResolvedValue(codeChallenge(['app', 'passkey']))
      verifySignInCode.mockResolvedValue(signedIn('key-app'))
      finishPasskeyRegistration.mockResolvedValue(added)
    })

    it('asks last, with no proof; Add opens the create sheet from the click and the note flips to passkey', async () => {
      const wrapper = mount(LoginPage)
      await signInWithAppCode(wrapper)

      expect(getAuthToken()).toBe('key-app')
      expect(keptAccount()).toEqual({ username: 'ada', method: 'password' })
      expect(wrapper.text()).toContain('Add a passkey on this device?')
      expect(wrapper.text()).toContain('Next time on this device, Touch ID signs you in.')
      // The sign-in that just finished two-factor is the proof: nothing else is sent.
      expect(beginPasskeyRegistration).toHaveBeenCalledWith({})
      expect(replace).not.toHaveBeenCalled()
      expect(webauthn?.create).not.toHaveBeenCalled()

      // A closed sheet stays on the step and says nothing.
      webauthn?.create.mockRejectedValueOnce(notAllowed())
      await click(wrapper, 'passkey-add-next')
      expect(wrapper.text()).toContain('Add a passkey on this device?')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(finishPasskeyRegistration).not.toHaveBeenCalled()

      await click(wrapper, 'passkey-add-next')
      expect(beginPasskeyRegistration).toHaveBeenCalledTimes(1)
      expect(finishPasskeyRegistration).toHaveBeenCalledWith({ credential: CREATED_JSON })
      expect(wrapper.text()).toContain('Passkey added.')
      expect(wrapper.text()).toContain('Darpan asks for it next time on this device.')
      expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
      // An added passkey changes no session.
      expect(getAuthToken()).toBe('key-app')
      expect(replace).not.toHaveBeenCalled()

      await click(wrapper, 'login-passkey-added-continue')
      expect(replace).toHaveBeenCalledWith('/')
    })

    it('Not now signs in and leaves the note on the password, so the next password sign-in asks again', async () => {
      const wrapper = mount(LoginPage)
      await signInWithAppCode(wrapper)
      await click(wrapper, 'login-passkey-not-now')

      expect(replace).toHaveBeenCalledWith('/')
      expect(keptAccount()).toEqual({ username: 'ada', method: 'password' })
      expect(webauthn?.create).not.toHaveBeenCalled()
    })

    it('a refused begin (the five minutes passed, passkeys off) skips the question silently and signs in', async () => {
      beginPasskeyRegistration.mockResolvedValue({ ...refusal(false, 'Confirm it is you first.'), publicKeyOptions: undefined, reason: 'PROOF_NEEDED' })
      const wrapper = mount(LoginPage)
      await signInWithAppCode(wrapper)

      expect(beginPasskeyRegistration).toHaveBeenCalledTimes(1)
      expect(wrapper.text()).not.toContain('Add a passkey on this device?')
      expect(wrapper.text()).not.toContain('Confirm it is you first.')
      expect(replace).toHaveBeenCalledWith('/')
    })

    it('a recovery code counts as not a passkey too, and its few-left notice comes first', async () => {
      verifySignInCode.mockResolvedValue(signedIn('key-rec', { recoveryCodesLeft: 2 }))
      const wrapper = mount(LoginPage)
      await signIn(wrapper)
      await click(wrapper, 'login-two-factor-use-recovery')
      await wrapper.get('[data-testid="login-two-factor-recovery-input"]').setValue('abcd-efgh-jkmn-pq01')
      await click(wrapper, 'login-two-factor-recovery-next')

      expect(wrapper.text()).toContain('2 recovery codes left.')
      expect(beginPasskeyRegistration).not.toHaveBeenCalled()
      await click(wrapper, 'login-recovery-codes-left-ok')
      expect(wrapper.text()).toContain('Add a passkey on this device?')
    })

    it('waits behind the recovery-email question', async () => {
      verifySignInCode.mockResolvedValue(signedIn('key-app', {
        sessionInfo: { userId: 'U1', username: 'ada', twoFactorEnabled: true, recoveryEmailMissing: true },
      }))
      const wrapper = mount(LoginPage)
      await signInWithAppCode(wrapper)

      expect(wrapper.text()).toContain('Where should password reset codes go?')
      expect(beginPasskeyRegistration).not.toHaveBeenCalled()
      await click(wrapper, 'login-recovery-skip')
      expect(wrapper.text()).toContain('Add a passkey on this device?')
    })

    it('is never asked on a browser that cannot make a passkey', async () => {
      webauthn?.restore()
      webauthn = null
      const wrapper = mount(LoginPage)
      await signInWithAppCode(wrapper)

      expect(beginPasskeyRegistration).not.toHaveBeenCalled()
      expect(replace).toHaveBeenCalledWith('/')
      expect(keptAccount()).toEqual({ username: 'ada', method: 'password' })
    })
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
    expect(wrapper.text()).toContain('Password for ada?')
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

    expect(wrapper.text()).toContain('Password for ada?')
    expect(wrapper.text()).toContain('Sign in again.')
    expect(getAuthToken()).toBeNull()
  })

  it('a spent challenge at begin goes back to the password without opening a prompt', async () => {
    loginSession.mockResolvedValue(codeChallenge(['passkey']))
    beginPasskeySignIn.mockResolvedValue({ ...refusal(true, 'This sign-in has expired. Enter your password again.'), publicKeyOptions: undefined })
    const wrapper = mount(LoginPage)

    await signIn(wrapper)

    expect(webauthn?.get).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Password for ada?')
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

  describe('Welcome back, username first, then a passkey or the password (DAR-UI-120/132)', () => {
    const first = { ok: true, messages: [], errors: [], challengeToken: 'first-token', publicKeyOptions: REQUEST_OPTIONS, expiresInSeconds: 300 }
    const refused = (reason: string, message: string) => ({ ok: false, messages: [], errors: [message], reason, authenticated: false })

    beforeEach(() => {
      beginPasskeyFirstSignIn.mockResolvedValue(first)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('a new device (no note) asks Username?, then the password: no prompt, no server check', async () => {
      const wrapper = mount(LoginPage)
      expect(wrapper.text()).toContain('Username?')
      expect(wrapper.find('[data-testid="login-welcome-row"]').exists()).toBe(false)
      await enterUsername(wrapper)

      expect(wrapper.text()).toContain('Password for ada?')
      expect(beginPasskeyFirstSignIn).not.toHaveBeenCalled()
      expect(webauthn?.get).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="login-use-passkey"]').exists()).toBe(true)
    })

    it('a note that says passkey for another username leaves Next on the password', async () => {
      keepAccount('grace', 'passkey')
      const wrapper = mount(LoginPage)
      await settle()
      await enterUsername(wrapper, 'ada')

      expect(wrapper.text()).toContain('Password for ada?')
      expect(modalCalls(webauthn)).toHaveLength(0)
      expect(beginPasskeyFirstSignIn).not.toHaveBeenCalledWith({ username: 'ada' })
    })

    it('Welcome back, passkey: begun on arrival, so the row opens the prompt with no begin of its own, and signs in', async () => {
      keepAccount('ada', 'passkey')
      finishPasskeyFirstSignIn.mockResolvedValue(signedIn('key-first'))
      const wrapper = mount(LoginPage)
      await settle()

      expect(wrapper.text()).toContain('Welcome back.')
      expect(wrapper.get('[data-testid="login-welcome-method"]').text()).toBe('Passkey')
      expect(wrapper.get('[data-testid="login-welcome-row"]').attributes('aria-label')).toBe('Sign in with your passkey')
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(1)
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledWith({ username: 'ada' })
      expect(webauthn?.get).not.toHaveBeenCalled()

      // Safari's click window: the prompt is asked for in the same turn as the click.
      await wrapper.get('[data-testid="login-welcome-row"]').trigger('click')
      expect(modalCalls(webauthn)).toHaveLength(1)
      await settle()

      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(1)
      expect(finishPasskeyFirstSignIn).toHaveBeenCalledWith({ challengeToken: 'first-token', passkeyAssertion: ASSERTION_JSON })
      expect(loginSession).not.toHaveBeenCalled()
      expect(getAuthToken()).toBe('key-first')
      expect(replace).toHaveBeenCalledWith('/')
      expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
    })

    it('options begun on arrival are begun again before their 300 s run out, and dropped on the password step', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
      keepAccount('ada', 'passkey')
      const wrapper = mount(LoginPage)
      await flushPromises()
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(1)

      vi.advanceTimersByTime(270_000)
      await flushPromises()
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(2)

      await wrapper.get('[data-testid="login-another-account"]').trigger('click')
      await wrapper.get('#login-username').setValue('grace')
      await wrapper.get('[data-testid="login-username-next"]').trigger('click')
      await flushPromises()
      expect(wrapper.text()).toContain('Password for grace?')
      vi.advanceTimersByTime(600_000)
      await flushPromises()
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(2)
    })

    it('Welcome back, password: the row goes to the password step; nothing is begun', async () => {
      keepAccount('ada', 'password')
      const wrapper = mount(LoginPage)
      await settle()

      expect(wrapper.get('[data-testid="login-welcome-method"]').text()).toBe('Password')
      await click(wrapper, 'login-welcome-row')
      expect(wrapper.text()).toContain('Password for ada?')
      expect(beginPasskeyFirstSignIn).not.toHaveBeenCalled()
      expect(modalCalls(webauthn)).toHaveLength(0)
    })

    it('Username? with the note\'s name (any case) opens the passkey at Next, using options begun as the field was left', async () => {
      keepAccount('Ada', 'passkey')
      finishPasskeyFirstSignIn.mockResolvedValue(signedIn('key-first'))
      // The begin on arrival was refused (rate limit), so nothing is held when Username? shows.
      beginPasskeyFirstSignIn.mockResolvedValueOnce(refused('TOO_MANY_ATTEMPTS', 'Too many tries. Wait a minute.'))
      const wrapper = mount(LoginPage)
      await settle()
      await click(wrapper, 'login-another-account')
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(1)

      await wrapper.get('#login-username').setValue('ada ')
      await wrapper.get('#login-username').trigger('blur')
      await settle()
      expect(beginPasskeyFirstSignIn).toHaveBeenLastCalledWith({ username: 'ada' })
      // Left again with the same name: already held, not begun twice.
      await wrapper.get('#login-username').trigger('blur')
      await click(wrapper, 'login-username-next')

      expect(beginPasskeyFirstSignIn).toHaveBeenCalledTimes(2)
      expect(modalCalls(webauthn)).toHaveLength(1)
      expect(webauthn?.get.mock.calls[0]?.[0]).not.toHaveProperty('mediation')
      expect(getAuthToken()).toBe('key-first')
    })

    it.each([
      ['an empty or closed sheet', () => webauthn?.get.mockRejectedValueOnce(notAllowed())],
      ['a sheet that fails', () => webauthn?.get.mockRejectedValueOnce(new DOMException('x', 'UnknownError'))],
      ['a passkey the server refuses', () => finishPasskeyFirstSignIn.mockResolvedValue(refused('PASSKEY_REFUSED', "That passkey didn't work."))],
    ])('%s goes straight to the password with nothing said, and the note flips to password', async (_case, arrange) => {
      keepAccount('ada', 'passkey')
      arrange()
      loginSession.mockResolvedValue(signedIn('key-pw'))
      const wrapper = mount(LoginPage)
      await settle()
      await click(wrapper, 'login-welcome-row')

      expect(wrapper.text()).toContain('Password for ada?')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      expect(wrapper.text()).not.toContain("didn't work")
      expect(keptAccount()).toEqual({ username: 'ada', method: 'password' })
      expect(getAuthToken()).toBeNull()
      // The link under the password still tries the passkey again.
      expect(wrapper.find('[data-testid="login-use-passkey"]').exists()).toBe(true)

      // And Next from Username? now asks for the password.
      await wrapper.get('.wizard-back').trigger('click')
      await settle()
      await enterUsername(wrapper)
      expect(wrapper.text()).toContain('Password for ada?')
    })

    it('a refused begin on the passkey step goes to the password quietly and keeps the note', async () => {
      keepAccount('ada', 'passkey')
      beginPasskeyFirstSignIn.mockResolvedValue(refused('TOO_MANY_ATTEMPTS', 'Too many tries. Wait a minute.'))
      const wrapper = mount(LoginPage)
      await settle()
      await click(wrapper, 'login-welcome-row')

      expect(wrapper.text()).toContain('Password for ada?')
      expect(wrapper.text()).not.toContain('Too many tries.')
      expect(webauthn?.get).not.toHaveBeenCalled()
      expect(keptAccount()?.method).toBe('passkey')
    })

    it('while the prompt is open: Use password instead closes it; Back returns to the username with the name kept', async () => {
      keepAccount('ada', 'passkey')
      let signal: AbortSignal | undefined
      webauthn?.get.mockImplementation((options: CredentialRequestOptions) => {
        signal = options.signal ?? undefined
        return new Promise(() => {})
      })
      const wrapper = mount(LoginPage)
      await settle()
      await click(wrapper, 'login-welcome-row')
      expect(wrapper.text()).toContain('Use your passkey.')
      expect(wrapper.get('[data-testid="login-passkey-username"]').text()).toBe('ada')

      await click(wrapper, 'login-use-password')
      expect(signal?.aborted).toBe(true)
      expect(wrapper.text()).toContain('Password for ada?')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)

      await wrapper.get('.wizard-back').trigger('click')
      await settle()
      expect(wrapper.text()).toContain('Username?')
      expect((wrapper.get('#login-username').element as HTMLInputElement).value).toBe('ada')
    })

    it('a password change required goes to the password step with its message, focused, and keeps the note', async () => {
      keepAccount('ada', 'passkey')
      finishPasskeyFirstSignIn.mockResolvedValue(refused('PASSWORD_CHANGE_REQUIRED', 'Sign in with your password once to set a new one.'))
      const wrapper = mount(LoginPage, { attachTo: document.body })
      await settle()
      await click(wrapper, 'login-welcome-row')

      expect(wrapper.text()).toContain('Sign in with your password once to set a new one.')
      expect(wrapper.text()).toContain('Password for ada?')
      expect(document.activeElement).toBe(wrapper.get('#login-password').element)
      expect(keptAccount()?.method).toBe('passkey')
      wrapper.unmount()
    })

    it('the password step\'s link runs the prompt for that username; a close says nothing, a failure says why', async () => {
      finishPasskeyFirstSignIn.mockResolvedValue(signedIn('key-link'))
      webauthn?.get.mockRejectedValueOnce(notAllowed()).mockRejectedValueOnce(new DOMException('x', 'SecurityError'))
      const wrapper = mount(LoginPage)
      await enterUsername(wrapper)

      await click(wrapper, 'login-use-passkey')
      expect(wrapper.text()).toContain('Password for ada?')
      expect(wrapper.find('[role="alert"]').exists()).toBe(false)
      await click(wrapper, 'login-use-passkey')
      expect(wrapper.text()).toContain("Passkeys don't work on this address.")

      await click(wrapper, 'login-use-passkey')
      expect(beginPasskeyFirstSignIn).toHaveBeenCalledWith({ username: 'ada' })
      expect(loginSession).not.toHaveBeenCalled()
      expect(getAuthToken()).toBe('key-link')
      expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
    })

    it('autofill: a passkey picked in the username field signs in, and the account is kept as passkey', async () => {
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
      expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
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
    })

    it('autofill runs only on Username?, is aborted before the modal prompt opens, and comes back with the username step', async () => {
      keepAccount('ada', 'passkey')
      webauthn?.restore()
      webauthn = installWebAuthnStub({ conditional: true })
      const signals = withAutofill(webauthn)
      const wrapper = mount(LoginPage)
      await settle()
      // Welcome back is not the username step.
      expect(signals).toHaveLength(0)
      await click(wrapper, 'login-another-account')
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
      expect(wrapper.text()).toContain('Password for ada?')

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
  })
})
