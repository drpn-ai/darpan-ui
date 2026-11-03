import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({ query: { code: 'BCDF-GH23' } as Record<string, unknown> }))
const getCliLoginRequest = vi.hoisted(() => vi.fn())
const approveCliLogin = vi.hoisted(() => vi.fn())
const denyCliLogin = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../lib/api/facade', () => ({
  authFacade: { getCliLoginRequest, approveCliLogin, denyCliLogin },
}))

import CliLoginPage from '../CliLoginPage.vue'

const pending = { ok: true, messages: [], errors: [], hostLabel: 'ada-laptop', status: 'PENDING', expiresDate: '2026-11-03T12:10:00Z' }

describe('CliLoginPage', () => {
  beforeEach(() => {
    route.query = { code: 'BCDF-GH23' }
    getCliLoginRequest.mockReset().mockResolvedValue(pending)
    approveCliLogin.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
    denyCliLogin.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
  })

  it('shows the host label from get#CliLoginRequest as what the CLI reports', async () => {
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    expect(getCliLoginRequest).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())
    expect(wrapper.text()).toContain('Darpan CLI on ada-laptop')
    expect(wrapper.text()).toContain('name the CLI gave')
  })

  it('Approve calls approve#CliLogin once and shows the done state', async () => {
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    const approve = wrapper.get('[data-testid="cli-login-approve"]')
    await approve.trigger('click')
    await approve.trigger('click')
    await flushPromises()
    expect(approveCliLogin).toHaveBeenCalledTimes(1)
    expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())
    expect(wrapper.find('[data-testid="cli-login-done"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)
  })

  it('Deny calls deny#CliLogin', async () => {
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    await wrapper.get('[data-testid="cli-login-deny"]').trigger('click')
    await flushPromises()
    expect(denyCliLogin).toHaveBeenCalledTimes(1)
    expect(approveCliLogin).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cli-login-done"]').exists()).toBe(true)
  })

  it('nothing is sent on mount or on remount', async () => {
    mount(CliLoginPage)
    await flushPromises()
    mount(CliLoginPage)
    await flushPromises()
    expect(approveCliLogin).not.toHaveBeenCalled()
    expect(denyCliLogin).not.toHaveBeenCalled()
  })

  it('an expired or unknown code shows the expired state', async () => {
    getCliLoginRequest.mockResolvedValue({ ok: true, messages: [], errors: [], status: 'EXPIRED' })
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-expired"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)
  })

  it('a refused lookup or a missing code shows the expired state', async () => {
    getCliLoginRequest.mockResolvedValue({ ok: false, messages: [], errors: ['nope'] })
    let wrapper = mount(CliLoginPage)
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-expired"]').exists()).toBe(true)

    route.query = {}
    getCliLoginRequest.mockClear()
    wrapper = mount(CliLoginPage)
    await flushPromises()
    expect(getCliLoginRequest).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cli-login-expired"]').exists()).toBe(true)
  })

  it('a refused approve shows the expired state', async () => {
    approveCliLogin.mockResolvedValue({ ok: false, messages: [], errors: ['gone'] })
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-expired"]').exists()).toBe(true)
  })
})
