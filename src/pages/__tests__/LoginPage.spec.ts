import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const loginWithCredentials = vi.hoisted(() => vi.fn())
const route = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
}))
const authState = vi.hoisted(() => ({
  checked: false,
  error: null as string | null,
  status: 'unauthenticated' as 'authenticated' | 'unauthenticated' | 'verification-failed',
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
    ...authState,
    loginWithCredentials,
  }),
}))

import LoginPage from '../LoginPage.vue'

describe('LoginPage', () => {
  beforeEach(() => {
    replace.mockClear()
    loginWithCredentials.mockReset()
    loginWithCredentials.mockResolvedValue(true)
    authState.error = null
    authState.status = 'unauthenticated'
    authState.sessionInfo = null
    route.query = {}
  })

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
