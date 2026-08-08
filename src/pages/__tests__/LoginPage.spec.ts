import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const loginWithCredentials = vi.hoisted(() => vi.fn())
const changeExpiredPassword = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
}))
const authState = vi.hoisted(() => ({
  checked: false,
  error: null as string | null,
  status: 'unauthenticated' as 'authenticated' | 'unauthenticated' | 'verification-failed',
  passwordChangeReason: null as 'PWDCHG' | 'PWDTIM' | null,
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
    checked: authState.checked,
    sessionInfo: authState.sessionInfo,
    loginWithCredentials,
    changeExpiredPassword,
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
})
