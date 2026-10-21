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

vi.mock('../../stores/auth', () => ({
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

/** Drive the change-password panel: fill the current step and press its primary action. */
async function completePasswordStep(wrapper: ReturnType<typeof mount>, value: string): Promise<void> {
  await wrapper.get('input[autocomplete="new-password"]').setValue(value)
  await wrapper.get('[data-testid="login-password-next"]').trigger('click')
  await flushPromises()
}

describe('LoginPage', () => {
  beforeEach(() => {
    replace.mockClear()
    loginWithCredentials.mockReset()
    loginWithCredentials.mockResolvedValue(true)
    changeExpiredPassword.mockReset()
    changeExpiredPassword.mockResolvedValue(true)
    getPasswordResetAvailable.mockReset()
    getPasswordResetAvailable.mockResolvedValue(true)
    requestPasswordReset.mockReset()
    requestPasswordReset.mockResolvedValue(undefined)
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
    await wrapper.get('input[autocomplete="username"]').setValue('avnindra.sharma')
    await wrapper.get('input[autocomplete="current-password"]').setValue('temp-pass')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
    return wrapper
  }

  it('hides the passive no-session message on first unauthenticated entry', () => {
    authState.error = 'No active authenticated session detected.'

    const wrapper = mount(LoginPage)

    expect(wrapper.text()).not.toContain('No active authenticated session detected.')
  })

  it('submits on Enter from the credential form', async () => {
    const wrapper = mount(LoginPage)

    expect(wrapper.text()).not.toContain('Sign in to access Darpan. Backend screens are admin-only.')

    await wrapper.get('input[autocomplete="username"]').setValue('john.doe')
    await wrapper.get('input[autocomplete="current-password"]').setValue('moqui')
    await wrapper.get('input[autocomplete="current-password"]').trigger('keydown.enter')
    await flushPromises()

    expect(loginWithCredentials).toHaveBeenCalledWith('john.doe', 'moqui')
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('shows actual login errors after a failed submit', async () => {
    loginWithCredentials.mockResolvedValue(false)
    authState.error = 'Login failed'

    const wrapper = mount(LoginPage)

    await wrapper.get('input[autocomplete="username"]').setValue('john.doe')
    await wrapper.get('input[autocomplete="current-password"]').setValue('wrong-password')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

    expect(wrapper.text()).toContain('Login failed')
    expect(replace).not.toHaveBeenCalled()
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

  // Backend policy is MoquiDefaultConf <password min-length="8" min-digits="1" min-others="1">.
  // Without these stated up front the only way to discover them was to be rejected by the server.
  it('states the password rules and marks each one live as it is satisfied', async () => {
    const wrapper = await signInIntoPasswordChange()
    const ruleState = () => ({
      length: wrapper.get('[data-testid="password-rule-length"]').attributes('data-met'),
      digit: wrapper.get('[data-testid="password-rule-digit"]').attributes('data-met'),
      other: wrapper.get('[data-testid="password-rule-other"]').attributes('data-met'),
    })

    expect(ruleState()).toEqual({ length: 'false', digit: 'false', other: 'false' })

    await wrapper.get('input[autocomplete="new-password"]').setValue('abcdefgh')
    expect(ruleState()).toEqual({ length: 'true', digit: 'false', other: 'false' })

    await wrapper.get('input[autocomplete="new-password"]').setValue('abcdefg1')
    expect(ruleState()).toEqual({ length: 'true', digit: 'true', other: 'false' })

    await wrapper.get('input[autocomplete="new-password"]').setValue('abcdef1!')
    expect(ruleState()).toEqual({ length: 'true', digit: 'true', other: 'true' })
  })

  it('blocks the change step until the new password satisfies every rule', async () => {
    const wrapper = await signInIntoPasswordChange()
    const primary = () => wrapper.get('[data-testid="login-password-next"]')

    await wrapper.get('input[autocomplete="new-password"]').setValue('short1!')
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
  it('returns to the sign-in form from the first change step', async () => {
    const wrapper = await signInIntoPasswordChange()

    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Sign In')
    expect(wrapper.find('input[autocomplete="username"]').exists()).toBe(true)
  })

  it('does not route back to login when the redirect query points at login', async () => {
    route.query = { redirect: '/login?redirect=/login' }

    const wrapper = mount(LoginPage)

    await wrapper.get('input[autocomplete="username"]').setValue('john.doe')
    await wrapper.get('input[autocomplete="current-password"]').setValue('moqui')
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()

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

  async function openReset(typedUsername = ''): Promise<ReturnType<typeof mount>> {
    const wrapper = mount(LoginPage)
    await flushPromises()
    if (typedUsername) await wrapper.get('input[autocomplete="username"]').setValue(typedUsername)
    await wrapper.get('[data-testid="login-forgot-password"]').trigger('click')
    await flushPromises()
    return wrapper
  }

  it('hides Forgot password? when this environment cannot send reset email', async () => {
    getPasswordResetAvailable.mockResolvedValue(false)
    const wrapper = mount(LoginPage)
    await flushPromises()

    expect(wrapper.find('[data-testid="login-forgot-password"]').exists()).toBe(false)
  })

  it('opens the reset on the username, prefilled from the sign-in form', async () => {
    const wrapper = await openReset('pwr.user')

    expect(wrapper.text()).toContain('Username or email?')
    expect((wrapper.get('[data-testid="login-reset-input"]').element as HTMLInputElement).value).toBe('pwr.user')
  })

  it('requests a code and shows the same note whatever happened', async () => {
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')

    expect(requestPasswordReset).toHaveBeenCalledWith('pwr.user')
    expect(wrapper.get('[data-testid="login-reset-note"]').text()).toContain(
      'If that account has an email on file, a code is on its way. It expires in 15 minutes.',
    )
    expect(wrapper.get('[data-testid="login-reset-note"]').text()).toContain('No email on file? Ask your Darpan administrator.')
    expect(wrapper.text()).toContain('Enter the code we emailed.')
  })

  it('takes the code as a one-time code and can send a new one', async () => {
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')

    const input = wrapper.get('[data-testid="login-reset-input"]')
    expect(input.attributes('autocomplete')).toBe('one-time-code')
    expect(input.attributes('inputmode')).toBe('numeric')
    await wrapper.get('[data-testid="login-reset-resend"]').trigger('click')
    await flushPromises()
    expect(requestPasswordReset).toHaveBeenCalledTimes(2)
  })

  it('sends a pasted code unchanged and stays on the code step when it is wrong', async () => {
    verifyPasswordResetCode.mockResolvedValue(false)
    authState.error = "That code didn't work. Request a new one."
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await completeResetStep(wrapper, '123 456')

    expect(verifyPasswordResetCode).toHaveBeenCalledWith('pwr.user', '123 456')
    expect(wrapper.text()).toContain("That code didn't work. Request a new one.")
    expect(wrapper.text()).toContain('Enter the code we emailed.')
  })

  it('sets the new password, signs in with it and lands on the requested route', async () => {
    route.query = { redirect: '/settings' }
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await completeResetStep(wrapper, '123456')
    expect(wrapper.text()).toContain('Enter your new password.')
    await completeResetStep(wrapper, 'N3w-pass!')
    expect(wrapper.text()).toContain('Enter it again.')
    await completeResetStep(wrapper, 'N3w-pass!')

    expect(completePasswordReset).toHaveBeenCalledWith({
      usernameOrEmail: 'pwr.user', code: '123456', newPassword: 'N3w-pass!', newPasswordVerify: 'N3w-pass!',
    })
    expect(loginWithCredentials).toHaveBeenCalledWith('pwr.user', 'N3w-pass!')
    expect(replace).toHaveBeenCalledWith('/settings')
  })

  it('keeps the user on the new password when the backend refuses it', async () => {
    completePasswordReset.mockResolvedValue(false)
    authState.error = 'Password was used in last 5 passwords'
    const wrapper = await openReset()
    await completeResetStep(wrapper, 'pwr.user')
    await completeResetStep(wrapper, '123456')
    await completeResetStep(wrapper, 'N3w-pass!')
    await completeResetStep(wrapper, 'N3w-pass!')

    expect(wrapper.text()).toContain('Password was used in last 5 passwords')
    expect(wrapper.text()).toContain('Enter your new password.')
    expect(loginWithCredentials).not.toHaveBeenCalled()
  })

  it('returns to sign-in from the first reset step', async () => {
    const wrapper = await openReset()
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()

    expect(wrapper.find('form').exists()).toBe(true)
    expect(wrapper.text()).toContain('Sign In')
  })

  // ---- DAR-BE-028: recovery email at sign-in ----

  async function signIn(wrapper: ReturnType<typeof mount>, user = 'pwr.user', pass = 'Old-pass1!'): Promise<void> {
    await wrapper.get('input[autocomplete="username"]').setValue(user)
    await wrapper.get('input[autocomplete="current-password"]').setValue(pass)
    await wrapper.get('form').trigger('submit.prevent')
    await flushPromises()
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
    await completeResetStep(wrapper, '123456')
    await completeResetStep(wrapper, 'N3w-pass!')
    await completeResetStep(wrapper, 'N3w-pass!')

    expect(wrapper.text()).toContain('Where should password reset codes go?')
    await wrapper.get('[data-testid="login-recovery-input"]').setValue('me@example.com')
    await wrapper.get('[data-testid="login-recovery-save"]').trigger('click')
    await flushPromises()
    expect(saveRecoveryEmail).toHaveBeenCalledWith('me@example.com', 'N3w-pass!')
  })
})
