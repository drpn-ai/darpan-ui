import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
const getCliLoginRequest = vi.hoisted(() => vi.fn())
const approveCliLogin = vi.hoisted(() => vi.fn())
const denyCliLogin = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../lib/api/facade', () => ({
  authFacade: { getCliLoginRequest, approveCliLogin, denyCliLogin },
}))

import CliLoginPage from '../CliLoginPage.vue'

const pending = {
  ok: true, messages: [], errors: [], hostLabel: 'ada-laptop', status: 'PENDING',
  createdDate: '2026-11-03T12:00:00Z', expiresDate: '2026-11-03T12:10:00Z',
}

async function typeCode(wrapper: ReturnType<typeof mount>, value: string) {
  await wrapper.get('[data-testid="cli-login-code"]').setValue(value)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('CliLoginPage', () => {
  beforeEach(() => {
    route.query = {}
    getCliLoginRequest.mockReset().mockResolvedValue(pending)
    approveCliLogin.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
    denyCliLogin.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
  })

  it('normalises a typed code: lower case and a missing dash are accepted', async () => {
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, ' bcdfgh23 ')
    expect(getCliLoginRequest).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())
  })

  it('ignores ?code= in the URL: no prefill, no lookup until a code is typed', async () => {
    route.query = { code: 'BCDF-GH23' }
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    expect((wrapper.get('[data-testid="cli-login-code"]').element as HTMLInputElement).value).toBe('')
    expect(getCliLoginRequest).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)
  })

  it('shows the host as what the CLI reports, with start and expiry, after a successful lookup', async () => {
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.text()).toContain('Darpan CLI on ada-laptop')
    expect(wrapper.text()).toContain('That is the name the CLI gave. Darpan has not checked it.')
    expect(wrapper.text()).toContain('Approve only a code you just started in your own terminal.')
    expect(wrapper.find('[data-testid="cli-login-started"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-login-expires"]').exists()).toBe(true)
  })

  it('omits the start line when the backend gives no start time', async () => {
    getCliLoginRequest.mockResolvedValue({ ...pending, createdDate: undefined })
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.find('[data-testid="cli-login-started"]').exists()).toBe(false)
  })

  it('a wrong, unknown or expired code gives one not-found answer', async () => {
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'nope')
    expect(getCliLoginRequest).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)

    getCliLoginRequest.mockResolvedValue({ ok: true, messages: [], errors: [], status: 'EXPIRED' })
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.findAll('[data-testid="cli-login-notfound"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)

    getCliLoginRequest.mockResolvedValue({ ok: false, messages: [], errors: ['x'] })
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.findAll('[data-testid="cli-login-notfound"]')).toHaveLength(1)
  })

  it('Approve is offered only after a successful lookup, and sends the looked-up code once', async () => {
    const wrapper = mount(CliLoginPage)
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)
    await typeCode(wrapper, 'BCDF-GH23')

    let resolveApprove: (value: unknown) => void = () => {}
    approveCliLogin.mockReturnValue(new Promise((resolve) => { resolveApprove = resolve }))
    const approve = wrapper.get('[data-testid="cli-login-approve"]')
    await approve.trigger('click')
    await approve.trigger('click')
    await wrapper.get('[data-testid="cli-login-approve"]').trigger('keydown.enter')
    expect(approveCliLogin).toHaveBeenCalledTimes(1)
    expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())

    resolveApprove({ ok: true, messages: [], errors: [] })
    await flushPromises()
    expect(approveCliLogin).toHaveBeenCalledTimes(1)
    expect(wrapper.find('[data-testid="cli-login-done"]').exists()).toBe(true)
  })

  it('Deny calls deny#CliLogin', async () => {
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
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
    expect(getCliLoginRequest).not.toHaveBeenCalled()
    expect(approveCliLogin).not.toHaveBeenCalled()
    expect(denyCliLogin).not.toHaveBeenCalled()
  })

  it('a refused approve returns to the not-found answer', async () => {
    approveCliLogin.mockResolvedValue({ ok: false, messages: [], errors: ['gone'] })
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
  })
})
