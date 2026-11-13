import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

const route = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
const getCliLoginRequest = vi.hoisted(() => vi.fn())
const approveCliLogin = vi.hoisted(() => vi.fn())
const denyCliLogin = vi.hoisted(() => vi.fn())
const getMyCliAccess = vi.hoisted(() => vi.fn())
const requestCliAccess = vi.hoisted(() => vi.fn())
const getTwoFactorStatus = vi.hoisted(() => vi.fn())
const beginPasskeyProof = vi.hoisted(() => vi.fn())

const authState = vi.hoisted(() => ({ twoFactorEnabled: false }))

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('../../lib/api/facade', () => ({
  authFacade: { getCliLoginRequest, approveCliLogin, denyCliLogin, getMyCliAccess, requestCliAccess, getTwoFactorStatus, beginPasskeyProof },
}))

import CliLoginPage from '../CliLoginPage.vue'
import { ApiCallError } from '../../lib/api/client'
import { ASSERTION_JSON, REQUEST_OPTIONS, installWebAuthnStub, notAllowed, type WebAuthnStub } from '../../test/webauthn'

const access = { tenantUserGroupId: 'ACME', tenantLabel: 'Acme', state: 'NOT_GRANTED', lifetimeDays: 7, canUseCli: false, request: null }
// approve#CliLogin answers a refusal as a reply (ok false, errors), never as a thrown error.
const refusal = (error: string) => ({ ok: false, messages: [], errors: [error] })

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
    authState.twoFactorEnabled = false
    getCliLoginRequest.mockReset().mockResolvedValue(pending)
    approveCliLogin.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
    denyCliLogin.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [] })
    getMyCliAccess.mockReset().mockResolvedValue({ ok: true, access: { ...access, state: 'LIVE', canUseCli: true } })
    getTwoFactorStatus.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [], enabled: true, appEnabled: true, passkeys: [] })
    beginPasskeyProof.mockReset().mockResolvedValue({ ok: true, messages: [], errors: [], publicKeyOptions: REQUEST_OPTIONS, expiresInSeconds: 300 })
    requestCliAccess.mockReset().mockResolvedValue({ ok: true, request: { requestId: 'R1', statusId: 'PENDING', requestedDate: '2026-11-10T09:30:00Z' } })
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
    approveCliLogin.mockResolvedValue(refusal('gone'))
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
  })

  // DAR-BE-209: an approve refused because the CLI is not on for this person offers the request, not "code not found".
  async function approveRefused(wrapper: ReturnType<typeof mount>) {
    approveCliLogin.mockResolvedValue(refusal('The Darpan CLI is not turned on for this account. A Darpan admin turns it on.'))
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
    await flushPromises()
  }

  it('a refusal for want of access offers the request, not "code not found"', async () => {
    getMyCliAccess.mockResolvedValue({ ok: true, access })
    const wrapper = mount(CliLoginPage)
    await approveRefused(wrapper)
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="cli-access-request"]').text()).toBe('Request access in Acme')
    expect(wrapper.text()).toContain('The Darpan CLI is not turned on for you in Acme.')
  })

  it('an expired code still says not found when the person has the CLI', async () => {
    const wrapper = mount(CliLoginPage)
    await approveRefused(wrapper)
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-access-card"]').exists()).toBe(false)
  })

  it('says not found when the access check itself fails', async () => {
    getMyCliAccess.mockRejectedValue(new ApiCallError('down', 503))
    const wrapper = mount(CliLoginPage)
    await approveRefused(wrapper)
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
  })

  it('sends the request with its reason and says a Darpan admin will turn it on', async () => {
    getMyCliAccess.mockResolvedValue({ ok: true, access })
    const wrapper = mount(CliLoginPage)
    await approveRefused(wrapper)
    await wrapper.get('[data-testid="cli-access-reason"]').setValue('nightly audits')
    await wrapper.get('[data-testid="cli-access-request"]').trigger('click')
    await flushPromises()
    expect(requestCliAccess).toHaveBeenCalledWith('nightly audits')
    expect(wrapper.get('[data-testid="cli-access-pending"]').text()).toContain('A Darpan admin will turn it on.')
  })

  // Review I2: approve#CliLogin allows anyone with the CLI on in ANY tenant, so the active tenant's state alone cannot
  // say why an approve failed; and deny never checks access.
  it('an expired code says not found for a person with the CLI on in another tenant', async () => {
    getMyCliAccess.mockResolvedValue({ ok: true, access: { ...access, canUseCli: true } })
    const wrapper = mount(CliLoginPage)
    await approveRefused(wrapper)
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-access-card"]').exists()).toBe(false)
  })

  it('a failed deny says not found and never reads access', async () => {
    getMyCliAccess.mockResolvedValue({ ok: true, access })
    denyCliLogin.mockRejectedValue(new ApiCallError('This sign-in request has expired or was already answered. Run darpan login again.', 400))
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('[data-testid="cli-login-deny"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
    expect(getMyCliAccess).not.toHaveBeenCalled()
  })

  // DAR-BE-264: approval mints a 7-day key, so a two-factor account adds a current code.
  describe('two-factor approver', () => {
    beforeEach(() => {
      authState.twoFactorEnabled = true
    })

    it('asks for a current code and holds Approve until it has six digits', async () => {
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.text()).toContain('Current code from your app')
      const approve = wrapper.get('[data-testid="cli-login-approve"]')
      expect(approve.attributes('disabled')).toBeDefined()
      await wrapper.get('[data-testid="cli-login-two-factor-code"]').setValue('12345')
      expect(approve.attributes('disabled')).toBeDefined()
      await wrapper.get('[data-testid="cli-login-two-factor-code"]').setValue('123456')
      expect(approve.attributes('disabled')).toBeUndefined()

      await approve.trigger('click')
      await flushPromises()
      expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23', code: '123456' }, expect.anything())
      expect(wrapper.find('[data-testid="cli-login-done"]').text()).toContain('CLI approved.')
    })

    it('a refused code keeps the request on screen with the refusal, and clears the code', async () => {
      approveCliLogin.mockResolvedValue(refusal("That code didn't work."))
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')
      await wrapper.get('[data-testid="cli-login-two-factor-code"]').setValue('000000')
      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="cli-login-code-error"]').text()).toBe("That code didn't work.")
      expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
      expect((wrapper.get('[data-testid="cli-login-two-factor-code"]').element as HTMLInputElement).value).toBe('')
      expect(getMyCliAccess).not.toHaveBeenCalled()
    })

    it('Deny needs no code', async () => {
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')
      await wrapper.get('[data-testid="cli-login-deny"]').trigger('click')
      await flushPromises()

      expect(denyCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())
    })

    it('shows the code field when the backend asks for one the session did not know about', async () => {
      authState.twoFactorEnabled = false
      approveCliLogin.mockResolvedValueOnce(refusal('Enter the code from your authenticator app.'))
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')
      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(true)
      expect(wrapper.get('[data-testid="cli-login-code-error"]').text()).toBe('Enter the code from your authenticator app.')
    })

    it('without two-factor there is no code field and the payload has no code', async () => {
      authState.twoFactorEnabled = false
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()
      expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())
    })
  })
  // DAR-BE-270: a passkey is a fresh proof too; its prompt opens from Approve.
  describe('passkey approver', () => {
    const PASSKEY = { passkeyId: 'P1', name: 'MacBook' }
    let webauthn: WebAuthnStub | null = null

    beforeEach(() => {
      authState.twoFactorEnabled = true
      webauthn = installWebAuthnStub()
    })

    afterEach(() => {
      webauthn?.restore()
      webauthn = null
    })

    it('passkey only: no code field; Approve opens the prompt and sends the assertion', async () => {
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: false, passkeys: [PASSKEY] })
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="cli-login-passkey-note"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="cli-login-use-app"]').exists()).toBe(false)
      expect(beginPasskeyProof).toHaveBeenCalledTimes(1)
      expect(wrapper.get('[data-testid="cli-login-approve"]').attributes('disabled')).toBeUndefined()

      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(webauthn?.get).toHaveBeenCalledTimes(1)
      expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23', passkeyAssertion: ASSERTION_JSON }, expect.anything())
      expect(wrapper.get('[data-testid="cli-login-done"]').text()).toContain('CLI approved.')
    })

    it('a closed prompt sends nothing, says nothing, and keeps the request on screen', async () => {
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: false, passkeys: [PASSKEY] })
      webauthn?.get.mockRejectedValueOnce(notAllowed())
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(approveCliLogin).not.toHaveBeenCalled()
      expect(wrapper.find('[data-testid="cli-login-code-error"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
    })

    it('with the app as well, the code stays first; Use a passkey switches, and a refused passkey stays with the message', async () => {
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: true, passkeys: [PASSKEY] })
      approveCliLogin.mockResolvedValue(refusal("That passkey didn't work."))
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(true)
      await wrapper.get('[data-testid="cli-login-use-passkey"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
      expect(wrapper.find('[data-testid="cli-login-use-app"]').exists()).toBe(true)

      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="cli-login-code-error"]').text()).toBe("That passkey didn't work.")
      expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(false)
    })

    it('passkey only, on a browser without passkeys: no code field, and it says what would work', async () => {
      webauthn?.restore()
      webauthn = null
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: false, passkeys: [PASSKEY] })
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
      expect(wrapper.get('[data-testid="cli-login-no-proof"]').text()).toContain('This browser cannot use passkeys.')
      expect(wrapper.get('[data-testid="cli-login-approve"]').attributes('disabled')).toBeDefined()
      expect(wrapper.get('[data-testid="cli-login-deny"]').attributes('disabled')).toBeUndefined()
    })

    it('without WebAuthn only the code is offered', async () => {
      webauthn?.restore()
      webauthn = null
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: true, passkeys: [PASSKEY] })
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="cli-login-use-passkey"]').exists()).toBe(false)
      expect(beginPasskeyProof).not.toHaveBeenCalled()
    })
  })
})
