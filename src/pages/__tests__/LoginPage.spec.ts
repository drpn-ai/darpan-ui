import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const loginWithCredentials = vi.hoisted(() => vi.fn())
const changeExpiredPassword = vi.hoisted(() => vi.fn())
const getPasswordResetAvailable = vi.hoisted(() => vi.fn())
const requestPasswordReset = vi.hoisted(() => vi.fn())
const verifyPasswordResetCode = vi.hoisted(() => vi.fn())
const completePasswordReset = vi.hoisted(() => vi.fn())
const saveRecoveryEmail = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
}))
const authState = vi.hoisted(() => ({
  checked: false,
  error: null as string | null,
  status: 'unauthenticated' as 'authenticated' | 'unauthenticated' | 'verification-failed',
  passwordChangeReason: null as 'PWDCHG' | 'PWDTIM' | null,
  recoveryEmailMissing: false,
  sessionInfo: null as { userId: string; username?: string } | null,
  get authenticated() {
    return this.status === 'authenticated'
  },
  get userId() {
    return this.sessionInfo?.userId ?? null
  },
  get username() {
    return this.sessionInfo?.username ?? this.sessionInfo?.userId ?? null
  },
}))

vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({
    replace,
  }),
}))

vi.mock('../../stores/auth', async (importOriginal) => ({
  PASSWORD_CHANGED_SIGN_IN_AGAIN: (await importOriginal<typeof import('../../stores/auth')>()).PASSWORD_CHANGED_SIGN_IN_AGAIN,
  buildAuthRedirect: (redirect: string) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    get error() {
      return authState.error
    },
    get status() {
      return authState.status
    },
    get passwordChangeReason() {
      return authState.passwordChangeReason
    },
    get authenticated() {
      return authState.authenticated
    },
    get recoveryEmailMissing() {
      return authState.recoveryEmailMissing
    },
    checked: authState.checked,
    sessionInfo: authState.sessionInfo,
    loginWithCredentials,
    changeExpiredPassword,
    getPasswordResetAvailable,
    requestPasswordReset,
    verifyPasswordResetCode,
    completePasswordReset,
    saveRecoveryEmail,
  }),
}))

import LoginPage from '../LoginPage.vue'
import { installLocalStorageStub } from '../../test/localStorage'
import { keepAccount, keptAccount } from '../../lib/passkeyHint'

/** DAR-UI-120: the username step, Next, then the password step and its Next. */
async function enterUsername(wrapper: ReturnType<typeof mount>, user: string): Promise<void> {
  await wrapper.get('#login-username').setValue(user)
  await wrapper.get('[data-testid="login-username-next"]').trigger('click')
  await flushPromises()
}

async function signInWith(wrapper: ReturnType<typeof mount>, user: string, pass: string): Promise<void> {
  await enterUsername(wrapper, user)
  await wrapper.get('#login-password').setValue(pass)
  await wrapper.get('[data-testid="login-current-password-next"]').trigger('click')
  await flushPromises()
}

/** Drive the change-password panel: fill the current step and press its primary action. */
async function completePasswordStep(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
  await wrapper.get('input[autocomplete="new-password"]').setValue(value)
  await wrapper.get('[data-testid="login-password-next"]').trigger('click')
  await flushPromises()
}

describe('LoginPage', () => {
  beforeEach(() => {
    // DAR-UI-132: each test starts as a new device (no device note).
    installLocalStorageStub()
    replace.mockClear()
    loginWithCredentials.mockReset()
    loginWithCredentials.mockResolvedValue(true)
    changeExpiredPassword.mockReset()
    changeExpiredPassword.mockResolvedValue(true)
    getPasswordResetAvailable.mockReset()
    getPasswordResetAvailable.mockResolvedValue(true)
    requestPasswordReset.mockReset()
    requestPasswordReset.mockResolvedValue({ outcome: 'sent', emailAddressMasked: 'p•••@example.com' })
    verifyPasswordResetCode.mockReset()
    verifyPasswordResetCode.mockResolvedValue(true)
    completePasswordReset.mockReset()
    completePasswordReset.mockResolvedValue(true)
    saveRecoveryEmail.mockReset()
    saveRecoveryEmail.mockResolvedValue(true)
    authState.recoveryEmailMissing = false
    authState.error = null
    authState.status = 'unauthenticated'
    authState.passwordChangeReason = null
    authState.sessionInfo = null
    route.query = {}
  })

  /** Sign in with credentials the backend accepts but whose account is flagged to change its password. */
  async function signInIntoPasswordChange(): Promise<ReturnType<typeof mount>> {
    loginWithCredentials.mockResolvedValue(false)
    authState.passwordChangeReason = 'PWDCHG'
    authState.error = 'Your password must be changed before you can sign in.'

    const wrapper = mount(LoginPage)
    await signInWith(wrapper, 'avnindra.sharma', 'temp-pass')
    return wrapper
  }

  it('hides the passive no-session message on first unauthenticated entry', () => {
    authState.error = 'No active authenticated session detected.'

    const wrapper = mount(LoginPage)

    expect(wrapper.text()).not.toContain('No active authenticated session detected.')
  })

  it('asks the username, then the password for it, each step advancing on Enter', async () => {
    const wrapper = mount(LoginPage)

    expect(wrapper.text()).not.toContain('Sign in to access Darpan. Backend screens are admin-only.')
    expect(wrapper.text()).toContain('Username?')
    expect(wrapper.find('#login-password').exists()).toBe(false)

    await wrapper.get('#login-username').setValue(' john.doe ')
    await wrapper.get('#login-username').trigger('keydown.enter')
    await flushPromises()
    expect(wrapper.text()).toContain('Password for john.doe?')
    expect(loginWithCredentials).not.toHaveBeenCalled()

    await wrapper.get('#login-password').setValue('moqui')
    await wrapper.get('#login-password').trigger('keydown.enter')
    await flushPromises()

    expect(loginWithCredentials).toHaveBeenCalledWith('john.doe', 'moqui')
    expect(replace).toHaveBeenCalledWith('/')
  })

  // DAR-UI-132: the question is the heading; the eyebrow is the only branding.
  it('has no Sign In heading on any sign-in step', async () => {
    const wrapper = mount(LoginPage)
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.get('.eyebrow').text()).toBe('Darpan')
    await enterUsername(wrapper, 'john.doe')
    expect(wrapper.find('h1').exists()).toBe(false)
  })

  it('a password sign-in keeps this browser\'s account as password; the next visit opens on Welcome back with it', async () => {
    const first = mount(LoginPage)
    await signInWith(first, 'john.doe', 'moqui')
    expect(keptAccount()).toEqual({ username: 'john.doe', method: 'password' })
    first.unmount()

    const wrapper = mount(LoginPage)
    expect(wrapper.text()).toContain('Welcome back.')
    expect(wrapper.find('#login-username').exists()).toBe(false)
    const row = wrapper.get('[data-testid="login-welcome-row"]')
    expect(row.attributes('aria-label')).toBe('Sign in with your password')
    expect(wrapper.get('[data-testid="login-welcome-username"]').text()).toBe('john.doe')
    expect(wrapper.get('[data-testid="login-welcome-method"]').text()).toBe('Password')
    // The whole row is the one control: no Continue, no forget.
    expect(wrapper.find('.wizard-next').exists()).toBe(false)
    expect(wrapper.findAll('button')).toHaveLength(2)

    await row.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Password for john.doe?')
  })

  it('Another account leaves the kept one for an empty Username?', async () => {
    keepAccount('john.doe', 'password')
    const wrapper = mount(LoginPage)
    await wrapper.get('[data-testid="login-another-account"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Username?')
    expect((wrapper.get('#login-username').element as HTMLInputElement).value).toBe('')
    await enterUsername(wrapper, 'jane.roe')
    expect(wrapper.text()).toContain('Password for jane.roe?')
  })

  it('a passkey note on a browser without WebAuthn reads as the password', async () => {
    keepAccount('john.doe', 'passkey')
    const wrapper = mount(LoginPage)
    expect(wrapper.get('[data-testid="login-welcome-method"]').text()).toBe('Password')
    await wrapper.get('[data-testid="login-welcome-row"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Password for john.doe?')
  })

  it('stays on a step left empty and says what it needs', async () => {
    const wrapper = mount(LoginPage)

    await wrapper.get('[data-testid="login-username-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter your username.')
    expect(wrapper.text()).toContain('Username?')

    await enterUsername(wrapper, 'john.doe')
    expect(wrapper.text()).not.toContain('Enter your username.')
    await wrapper.get('[data-testid="login-current-password-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter your password.')
    expect(loginWithCredentials).not.toHaveBeenCalled()
  })

  it('Back from the password keeps the username typed and drops the password', async () => {
    const wrapper = mount(LoginPage)
    await enterUsername(wrapper, 'john.doe')
    await wrapper.get('#login-password').setValue('half-typed')

    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Username?')
    expect((wrapper.get('#login-username').element as HTMLInputElement).value).toBe('john.doe')
    await enterUsername(wrapper, 'john.doe')
    expect((wrapper.get('#login-password').element as HTMLInputElement).value).toBe('')
  })

  it('names the fields the way browsers and password managers read them', async () => {
    const wrapper = mount(LoginPage)
    const user = wrapper.get('#login-username')
    expect(user.attributes('name')).toBe('username')
    expect(user.attributes('autocomplete')).toBe('username webauthn')

    await enterUsername(wrapper, 'john.doe')
    // The pair a password manager saves: the name rides unseen beside the password, out of the tab order.
    const carried = wrapper.get('input[autocomplete="username"]')
    expect((carried.element as HTMLInputElement).value).toBe('john.doe')
    expect(carried.attributes('readonly')).toBeDefined()
    expect(carried.attributes('tabindex')).toBe('-1')
    expect(wrapper.get('#login-password').attributes('autocomplete')).toBe('current-password')
  })

  it('without WebAuthn offers no passkey anywhere', async () => {
    const wrapper = mount(LoginPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="login-use-passkey"]').exists()).toBe(false)
    await enterUsername(wrapper, 'john.doe')
    expect(wrapper.find('[data-testid="login-use-passkey"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="login-passkey-try-again"]').exists()).toBe(false)
  })

  it('shows actual login errors after a failed submit', async () => {
    loginWithCredentials.mockResolvedValue(false)
    authState.error = 'Login failed'

    const wrapper = mount(LoginPage)

    await signInWith(wrapper, 'john.doe', 'wrong-password')

    expect(wrapper.text()).toContain('Login failed')
    expect(wrapper.get('.login-panel .inline-validation:not(.sr-only)').classes()).toContain('error')
    expect(wrapper.text()).toContain('Password for john.doe?')
    expect(replace).not.toHaveBeenCalled()
  })

  // D17 (OC90): a session ended on purpose (a changed password, an ended session) is said as a notice, not a refusal.
  it.each([
    ['Password changed. Sign in with your new password.'],
    ['Your session has ended. Sign in again to continue.'],
  ])('a deliberate sign-out line reads as a neutral notice: %s', (line) => {
    authState.error = line

    const wrapper = mount(LoginPage)

    const notice = wrapper.get('.login-panel .inline-validation:not(.sr-only)')
    expect(notice.text()).toBe(line)
    expect(notice.classes()).toContain('info')
    expect(notice.classes()).not.toContain('error')
  })

  it('cleans up login self-redirects on entry', async () => {
    route.query = { redirect: '/login?redirect=/login' }

    mount(LoginPage)
    await flushPromises()

    expect(replace).toHaveBeenCalledWith({ name: 'login' })
  })

  it('offers the password change instead of a dead-end error when the account must change it', async () => {
    const wrapper = await signInIntoPasswordChange()

    expect(wrapper.text()).toContain('Your password must be changed before you can sign in.')
    expect(wrapper.text()).toContain('Enter your new password.')
    expect(replace).not.toHaveBeenCalled()
  })

  // The step's own question ("Enter your new password.") already says what to do, so a
  // "Change Password" title above it only repeated the instruction in bigger type.
  it('drops the redundant Change Password heading in change mode', async () => {
    const wrapper = await signInIntoPasswordChange()

    expect(wrapper.find('h1').exists()).toBe(false)
  })

  // The refusal is a standing condition the user has to act on, not body copy — it reads as a
  // banner so it is not mistaken for part of the question.
  it('renders the must-change refusal as a warning banner rather than plain body text', async () => {
    const wrapper = await signInIntoPasswordChange()

    const banner = wrapper.get('[data-testid="password-change-notice"]')
    expect(banner.classes()).toContain('inline-validation')
    expect(banner.classes()).toContain('warning')
    expect(banner.text()).toBe('Your password must be changed before you can sign in.')
  })

  // The refusal applies to the whole sign-in attempt, not to one field, so it sits at page level
  // above the panel rather than inside it.
  it('places the refusal banner outside the login panel', async () => {
    const wrapper = await signInIntoPasswordChange()

    expect(wrapper.find('.login-panel [data-testid="password-change-notice"]').exists()).toBe(false)
    expect(wrapper.find('.login-page > [data-testid="password-change-notice"]').exists()).toBe(true)
  })

  // Backend policy: darpan MoquiConf <password min-length="12"/> (DAR-BE-268) + MoquiDefaultConf min-digits="1" min-others="1".
  // Without these stated up front the only way to discover them was to be rejected by the server.
  it('states the password rules and marks each one live as it is satisfied', async () => {
    const wrapper = await signInIntoPasswordChange()
    const ruleState = () => ({
      length: wrapper.get('[data-testid="password-rule-length"]').attributes('data-met'),
      digit: wrapper.get('[data-testid="password-rule-digit"]').attributes('data-met'),
      other: wrapper.get('[data-testid="password-rule-other"]').attributes('data-met'),
    })

    expect(ruleState()).toEqual({ length: 'false', digit: 'false', other: 'false' })

    await wrapper.get('input[autocomplete="new-password"]').setValue('abcdefghijkl')
    expect(ruleState()).toEqual({ length: 'true', digit: 'false', other: 'false' })

    await wrapper.get('input[autocomplete="new-password"]').setValue('abcdefghijk1')
    expect(ruleState()).toEqual({ length: 'true', digit: 'true', other: 'false' })

    await wrapper.get('input[autocomplete="new-password"]').setValue('abcdefghij1!')
    expect(ruleState()).toEqual({ length: 'true', digit: 'true', other: 'true' })
  })

  it('blocks the change step until the new password satisfies every rule', async () => {
    const wrapper = await signInIntoPasswordChange()
    const primary = () => wrapper.get('[data-testid="login-password-next"]')

    await wrapper.get('input[autocomplete="new-password"]').setValue('elevenchr1!')
    expect(primary().attributes('disabled')).toBeDefined()

    await wrapper.get('input[autocomplete="new-password"]').setValue('longenoughbutnodigit!')
    expect(primary().attributes('disabled')).toBeDefined()

    await wrapper.get('input[autocomplete="new-password"]').setValue('N3w-password!')
    expect(primary().attributes('disabled')).toBeUndefined()
  })

  it('does not ask again for the password login already accepted', async () => {
    const wrapper = await signInIntoPasswordChange()

    await completePasswordStep(wrapper, 'N3w-password!')
    await completePasswordStep(wrapper, 'N3w-password!')

    expect(changeExpiredPassword).toHaveBeenCalledWith({
      username: 'avnindra.sharma',
      currentPassword: 'temp-pass',
      newPassword: 'N3w-password!',
      newPasswordVerify: 'N3w-password!',
    })
  })

  it('signs in with the new password and lands on the requested route', async () => {
    route.query = { redirect: '/reconciliation/automations' }
    const wrapper = await signInIntoPasswordChange()

    loginWithCredentials.mockResolvedValue(true)
    await completePasswordStep(wrapper, 'N3w-password!')
    await completePasswordStep(wrapper, 'N3w-password!')

    expect(loginWithCredentials).toHaveBeenLastCalledWith('avnindra.sharma', 'N3w-password!')
    expect(replace).toHaveBeenCalledWith('/reconciliation/automations')
  })

  it('catches a mistyped confirmation before calling the backend', async () => {
    const wrapper = await signInIntoPasswordChange()

    await completePasswordStep(wrapper, 'N3w-password!')
    await completePasswordStep(wrapper, 'N3w-passw0rd!')

    expect(changeExpiredPassword).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('New passwords do not match.')
  })

  // Uses a password that satisfies every client-side rule, because the ones the client can check
  // (length, digit, symbol) no longer reach the backend at all. What remains server-only is
  // history-limit="5" — reuse of a previous password, which the browser cannot know about.
  it('keeps the user in the change panel when the backend refuses the new password', async () => {
    const wrapper = await signInIntoPasswordChange()

    changeExpiredPassword.mockImplementation(async () => {
      authState.error = 'Password was used too recently'
      return false
    })
    await completePasswordStep(wrapper, 'N3w-password!')
    await completePasswordStep(wrapper, 'N3w-password!')

    expect(wrapper.text()).toContain('Password was used too recently')
    expect(wrapper.text()).toContain('Enter your new password')
    expect(replace).not.toHaveBeenCalled()
  })

  /** A user who signed in as the wrong account must not be trapped in a change flow for it. */
  it('returns to the password step from the first change step', async () => {
    const wrapper = await signInIntoPasswordChange()

    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Password for avnindra.sharma?')
  })

  it('does not route back to login when the redirect query points at login', async () => {
    route.query = { redirect: '/login?redirect=/login' }

    const wrapper = mount(LoginPage)

    await signInWith(wrapper, 'john.doe', 'moqui')

    expect(loginWithCredentials).toHaveBeenCalledWith('john.doe', 'moqui')
    expect(replace).toHaveBeenCalledWith('/')
  })

  // ---- DAR-BE-028: forgot password ----

  /** Fill the current reset step and press its primary action. */
  async function completeResetStep(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
    await wrapper.get('[data-testid="login-reset-input"]').setValue(value)
    await wrapper.get('[data-testid="login-reset-next"]').trigger('click')
    await flushPromises()
  }

  // Autofill and paste land the whole code in the first box; the sixth digit verifies it.
  async function enterCode(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
    await wrapper.get('[data-testid="login-reset-code-0"]').setValue(value)
    await flushPromises()
  }

  /** Forgot password? sits on the password step (DAR-UI-120), so a username is typed to reach it. */
  async function openReset(typedUsername = 'someone'): Promise<ReturnType<typeof mount>> {
    const wrapper = mount(LoginPage)
    await flushPromises()
    await enterUsername(wrapper, typedUsername)
    await wrapper.get('[data-testid="login-forgot-password"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('hides Forgot password? when this environment cannot send reset email', async () => {
    getPasswordResetAvailable.mockResolvedValue(false)
    const wrapper = mount(LoginPage)
    await flushPromises()
    await enterUsername(wrapper, 'john.doe')

    expect(wrapper.find('[data-testid="login-forgot-password"]').exists()).toBe(false)
  })

  it('shows Forgot password? on the password step as a text link, not a second button beside Next', async () => {
    const wrapper = mount(LoginPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="login-forgot-password"]').exists()).toBe(false)
    await enterUsername(wrapper, 'john.doe')

    const link = wrapper.get('[data-testid="login-forgot-password"]')
    expect(link.classes()).toContain('login-text-link')
    expect(wrapper.get('.wizard-actions').find('[data-testid="login-forgot-password"]').exists()).toBe(false)
  })

  it('opens the reset on the username, prefilled from the sign-in form', async () => {
    const wrapper = await openReset('pwr.user')

    expect(wrapper.text()).toContain('Username or email?')
    expect((wrapper.get('[data-testid="login-reset-input"]').element as HTMLInputElement).value).toBe('pwr.user')
  })

  it('requests a code and says where it went', async () => {
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')

    expect(requestPasswordReset).toHaveBeenCalledWith('pwr.user')
    expect(wrapper.get('[data-testid="login-reset-note"]').text()).toBe('Sent to p•••@example.com. It expires in 15 minutes.')
    expect(wrapper.text()).toContain('Enter the code we emailed.')
  })

  it.each([
    ['noAccount', 'No account with that username or email.'],
    ['locked', 'That account is locked. Ask your Darpan administrator.'],
    ['noEmail', 'That account has no email on file. Ask your Darpan administrator to add one.'],
    ['sendFailed', "The email didn't send. Try again in a few minutes."],
  ])('says %s plainly and stays on the username step', async (outcome, text) => {
    requestPasswordReset.mockResolvedValue({ outcome, emailAddressMasked: null })
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')

    expect(wrapper.text()).toContain(text)
    expect(wrapper.text()).toContain('Username or email?')
  })

  it('at the hourly limit, says so and still goes to the code step for the newest code', async () => {
    requestPasswordReset.mockResolvedValue({ outcome: 'overLimit', emailAddressMasked: null })
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')

    expect(wrapper.text()).toContain("That's 3 codes this hour.")
    expect(wrapper.text()).toContain('Enter the code we emailed.')
  })

  it('says so when Send a new code fails', async () => {
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    requestPasswordReset.mockResolvedValue({ outcome: 'sendFailed', emailAddressMasked: null })
    await wrapper.get('[data-testid="login-reset-resend"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain("The email didn't send. Try again in a few minutes.")
  })

  it('takes the code in six one-digit boxes, autofill on the first, and can send a new one', async () => {
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')

    const boxes = wrapper.get('[data-testid="login-reset-code"]').findAll('input')
    expect(boxes).toHaveLength(6)
    expect(boxes[0]!.attributes('autocomplete')).toBe('one-time-code')
    expect(boxes.every((box) => box.attributes('inputmode') === 'numeric')).toBe(true)
    expect(wrapper.find('[data-testid="login-reset-input"]').exists()).toBe(false)
    await wrapper.get('[data-testid="login-reset-resend"]').trigger('click')
    await flushPromises()
    expect(requestPasswordReset).toHaveBeenCalledTimes(2)
  })

  it('verifies a pasted code as its digits and stays on the code step when it is wrong', async () => {
    verifyPasswordResetCode.mockResolvedValue(false)
    authState.error = "That code didn't work. Request a new one."
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await enterCode(wrapper, '123 456')

    expect(verifyPasswordResetCode).toHaveBeenCalledWith('pwr.user', '123456')
    expect(wrapper.text()).toContain("That code didn't work. Request a new one.")
    expect(wrapper.text()).toContain('Enter the code we emailed.')
  })

  it('sets the new password, signs in with it and lands on the requested route', async () => {
    route.query = { redirect: '/settings' }
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await enterCode(wrapper, '123456')
    expect(wrapper.text()).toContain('Enter your new password.')
    // The same live rules as the forced change.
    expect(wrapper.get('[data-testid="password-rule-length"]').attributes('data-met')).toBe('false')
    await completeResetStep(wrapper, 'N3w-password!')
    expect(wrapper.text()).toContain('Enter it again.')
    await completeResetStep(wrapper, 'N3w-password!')

    expect(completePasswordReset).toHaveBeenCalledWith({
      usernameOrEmail: 'pwr.user', code: '123456', newPassword: 'N3w-password!', newPasswordVerify: 'N3w-password!',
    })
    expect(loginWithCredentials).toHaveBeenCalledWith('pwr.user', 'N3w-password!')
    expect(replace).toHaveBeenCalledWith('/settings')
  })

  it('keeps the user on the new password when the backend refuses it', async () => {
    completePasswordReset.mockResolvedValue(false)
    authState.error = 'Password was used in last 5 passwords'
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await enterCode(wrapper, '123456')
    await completeResetStep(wrapper, 'N3w-password!')
    await completeResetStep(wrapper, 'N3w-password!')

    expect(wrapper.text()).toContain('Password was used in last 5 passwords')
    expect(wrapper.text()).toContain('Enter your new password.')
    expect(loginWithCredentials).not.toHaveBeenCalled()
  })

  it('returns to the password step from the first reset step', async () => {
    const wrapper = await openReset('pwr.user')
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Password for pwr.user?')
  })

  // ---- DAR-BE-028: recovery email at sign-in ----

  async function signIn(wrapper: ReturnType<typeof mount>, user = 'pwr.user', pass = 'Old-pass1!'): Promise<void> {
    await signInWith(wrapper, user, pass)
  }

  it('asks for a recovery email after sign-in when the account has none', async () => {
    authState.recoveryEmailMissing = true
    const wrapper = mount(LoginPage)
    await signIn(wrapper)

    expect(wrapper.text()).toContain('Where should password reset codes go?')
    const input = wrapper.get('[data-testid="login-recovery-input"]')
    expect(input.attributes('type')).toBe('email')
    expect(input.attributes('autocomplete')).toBe('email')
    expect(replace).not.toHaveBeenCalled()
  })

  it('saves the recovery email with the password just used, then continues', async () => {
    authState.recoveryEmailMissing = true
    route.query = { redirect: '/settings' }
    const wrapper = mount(LoginPage)
    await signIn(wrapper)
    await wrapper.get('[data-testid="login-recovery-input"]').setValue('me@example.com')
    await wrapper.get('[data-testid="login-recovery-save"]').trigger('click')
    await flushPromises()

    expect(saveRecoveryEmail).toHaveBeenCalledWith('me@example.com', 'Old-pass1!')
    expect(replace).toHaveBeenCalledWith('/settings')
  })

  it('continues without saving on Not now', async () => {
    authState.recoveryEmailMissing = true
    const wrapper = mount(LoginPage)
    await signIn(wrapper)
    await wrapper.get('[data-testid="login-recovery-skip"]').trigger('click')
    await flushPromises()

    expect(saveRecoveryEmail).not.toHaveBeenCalled()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('shows a save error inline and still lets the user go on', async () => {
    authState.recoveryEmailMissing = true
    saveRecoveryEmail.mockResolvedValue(false)
    authState.error = 'Enter a valid email address.'
    const wrapper = mount(LoginPage)
    await signIn(wrapper)
    await wrapper.get('[data-testid="login-recovery-input"]').setValue('nope')
    await wrapper.get('[data-testid="login-recovery-save"]').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Enter a valid email address.')
    expect(replace).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="login-recovery-skip"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('goes straight on when the account already has an email', async () => {
    const wrapper = mount(LoginPage)
    await signIn(wrapper)

    expect(wrapper.text()).not.toContain('Where should password reset codes go?')
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('asks for the email after a forced password change, with the new password', async () => {
    const wrapper = await signInIntoPasswordChange()
    authState.recoveryEmailMissing = true
    loginWithCredentials.mockResolvedValue(true)
    await completePasswordStep(wrapper, 'N3w-password!')
    await completePasswordStep(wrapper, 'N3w-password!')
    expect(wrapper.text()).toContain('Where should password reset codes go?')

    await wrapper.get('[data-testid="login-recovery-input"]').setValue('me@example.com')
    await wrapper.get('[data-testid="login-recovery-save"]').trigger('click')
    await flushPromises()
    expect(saveRecoveryEmail).toHaveBeenCalledWith('me@example.com', 'N3w-password!')
  })

  it('asks for the email after a completed reset, with the new password', async () => {
    authState.recoveryEmailMissing = true
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await enterCode(wrapper, '123456')
    await completeResetStep(wrapper, 'N3w-password!')
    await completeResetStep(wrapper, 'N3w-password!')

    expect(wrapper.text()).toContain('Where should password reset codes go?')
    await wrapper.get('[data-testid="login-recovery-input"]').setValue('me@example.com')
    await wrapper.get('[data-testid="login-recovery-save"]').trigger('click')
    await flushPromises()
    expect(saveRecoveryEmail).toHaveBeenCalledWith('me@example.com', 'N3w-password!')
  })

  // ---- final review fixes ----

  it('ignores a second submit while a reset step is in flight', async () => {
    let finish: () => void = () => {}
    requestPasswordReset.mockImplementation(() => new Promise((resolve) => { finish = () => resolve({ outcome: 'sent', emailAddressMasked: 'p•••@example.com' }) }))
    const wrapper = await openReset()
    await wrapper.get('[data-testid="login-reset-input"]').setValue('pwr.user')
    await wrapper.get('[data-testid="login-reset-next"]').trigger('click')
    await wrapper.get('[data-testid="login-reset-next"]').trigger('click')
    finish()
    await flushPromises()

    expect(requestPasswordReset).toHaveBeenCalledTimes(1)
    expect(wrapper.text()).toContain('Enter the code we emailed.')
  })

  it('sends the user back to the code, with Send a new code, when the code died before the last step', async () => {
    completePasswordReset.mockResolvedValue(false)
    authState.error = "That code didn't work. Request a new one."
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await enterCode(wrapper, '123456')
    await completeResetStep(wrapper, 'N3w-password!')
    await completeResetStep(wrapper, 'N3w-password!')

    expect(wrapper.text()).toContain('Enter the code we emailed.')
    expect(wrapper.find('[data-testid="login-reset-resend"]').exists()).toBe(true)
    expect(wrapper.text()).toContain("That code didn't work. Request a new one.")
  })
})
