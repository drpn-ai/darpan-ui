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

const authState = vi.hoisted(() => ({ twoFactorEnabled: false, username: 'ada', sessionInfo: { isSuperAdmin: true } as { isSuperAdmin: boolean } }))

vi.mock('vue-router', () => ({ useRoute: () => route }))
vi.mock('../../stores/auth', () => ({ useAuthStore: () => authState }))
vi.mock('../../lib/api/facade', () => ({
  authFacade: { getCliLoginRequest, approveCliLogin, denyCliLogin, getMyCliAccess, requestCliAccess, getTwoFactorStatus, beginPasskeyProof },
}))

import CliLoginPage from '../CliLoginPage.vue'
import { ApiCallError } from '../../lib/api/client'
import { ASSERTION_JSON, REQUEST_OPTIONS, installWebAuthnStub, notAllowed, type WebAuthnStub } from '../../test/webauthn'
import { installLocalStorageStub } from '../../test/localStorage'
import { keptAccount } from '../../lib/passkeyHint'

const access = { tenantUserGroupId: 'ACME', tenantLabel: 'Acme', state: 'NOT_GRANTED', lifetimeDays: 7, canUseCli: false, request: null }
// approve#CliLogin refuses as a JSON-RPC error with no reason code: the page reads what the backend still holds.
const refusal = (error: string) => new ApiCallError(error, 200)

const pending = {
  ok: true, messages: [], errors: [], hostLabel: 'ada-laptop', status: 'PENDING',
  createdDate: '2026-11-03T12:00:00Z', expiresDate: '2026-11-03T12:10:00Z',
}

/** The request is gone by the time the refusal is looked into (expired, or answered elsewhere). */
function requestGoneAfterLookup() {
  getCliLoginRequest.mockResolvedValueOnce(pending).mockResolvedValue({ ...pending, status: 'EXPIRED' })
}

async function typeCode(wrapper: ReturnType<typeof mount>, value: string) {
  await wrapper.get('[data-testid="cli-login-code"]').setValue(value)
  await wrapper.get('form').trigger('submit')
  await flushPromises()
}

describe('CliLoginPage', () => {
  beforeEach(() => {
    installLocalStorageStub()
    route.query = {}
    authState.twoFactorEnabled = false
    authState.sessionInfo = { isSuperAdmin: true }
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

  // DAR-UI-132: the sign-in card, one question per step.
  it('asks for the code on the sign-in card, then asks to approve the CLI on the host, with start and expiry', async () => {
    const wrapper = mount(CliLoginPage)
    expect(wrapper.find('.login-panel').exists()).toBe(true)
    expect(wrapper.get('.eyebrow').text()).toBe('Darpan')
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.text()).toContain('Code from your terminal?')

    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.get('.wizard-question').text()).toBe('Approve Darpan CLI on ada-laptop?')
    expect(wrapper.find('[data-testid="cli-login-started"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="cli-login-expires"]').exists()).toBe(true)
    // The device-code phishing guard: someone else's code, sent to you, would sign their terminal in as you.
    expect(wrapper.get('[data-testid="cli-login-own-code"]').text()).toBe('Approve only a code you just started in your own terminal.')
    // Deny is a quiet link under the one answer.
    expect(wrapper.get('[data-testid="cli-login-deny"]').classes()).toContain('login-text-link')
  })

  it('Back returns to the code, answering nothing', async () => {
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Code from your terminal?')
    expect(approveCliLogin).not.toHaveBeenCalled()
    expect(denyCliLogin).not.toHaveBeenCalled()
  })

  it('names an ADMIN sign-in and warns before the approve control', async () => {
    getCliLoginRequest.mockResolvedValue({ ...pending, scope: 'ADMIN' })
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.get('[data-testid="cli-login-host"]').text()).toBe('darpan-admin on ada-laptop')
    const warning = wrapper.get('[data-testid="cli-login-admin-warning"]')
    expect(warning.text()).toBe("This sign-in can use the admin app's powers for 12 hours.")
    const html = wrapper.html()
    expect(html.indexOf('cli-login-admin-warning')).toBeLessThan(html.indexOf('cli-login-approve'))
    expect(wrapper.get('[data-testid="cli-login-approve"]').attributes('disabled')).toBeUndefined()
  })

  it('hides the proof and Approve on an ADMIN sign-in for a session that is not a super admin, keeping Deny', async () => {
    authState.sessionInfo = { isSuperAdmin: false }
    authState.twoFactorEnabled = true
    getCliLoginRequest.mockResolvedValue({ ...pending, scope: 'ADMIN' })
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.get('[data-testid="cli-login-super-admin-only"]').text()).toBe('Only a super admin can approve a darpan-admin sign-in.')
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cli-login-own-code"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cli-login-deny"]').exists()).toBe(true)
  })

  it('a TENANT sign-in still offers Approve to a session that is not a super admin', async () => {
    authState.sessionInfo = { isSuperAdmin: false }
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.find('[data-testid="cli-login-super-admin-only"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
  })

  it.each([['TENANT'], [undefined]])('a %s sign-in reads as the Darpan CLI with no admin line', async (scope) => {
    getCliLoginRequest.mockResolvedValue({ ...pending, scope })
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.get('[data-testid="cli-login-host"]').text()).toBe('Darpan CLI on ada-laptop')
    expect(wrapper.find('[data-testid="cli-login-admin-warning"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
  })

  it('an unrecognised scope says so and offers no approve control', async () => {
    authState.twoFactorEnabled = true
    getCliLoginRequest.mockResolvedValue({ ...pending, scope: 'ROOT' })
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    expect(wrapper.get('[data-testid="cli-login-unknown-scope"]').text())
      .toBe('This sign-in asks for access Darpan does not recognise. Do not approve it.')
    expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
    // Enter on the card approves nothing either.
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(approveCliLogin).not.toHaveBeenCalled()
    await wrapper.get('[data-testid="cli-login-deny"]').trigger('click')
    await flushPromises()
    expect(denyCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23' }, expect.anything())
    expect(approveCliLogin).not.toHaveBeenCalled()
  })

  it.each([['?code=ABCD-EFGH', ''], ['', '#ABCD-EFGH']])('never reads a code from the route (%s%s)', async (search, hash) => {
    window.history.replaceState(null, '', `/cli-login${search}${hash}`)
    route.query = search ? { code: 'ABCD-EFGH' } : {}
    const wrapper = mount(CliLoginPage)
    await flushPromises()
    expect((wrapper.get('[data-testid="cli-login-code"]').element as HTMLInputElement).value).toBe('')
    expect(getCliLoginRequest).not.toHaveBeenCalled()
    window.history.replaceState(null, '', '/')
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
    expect(wrapper.get('.wizard-question').text()).toBe('Approved.')
    expect(wrapper.get('[data-testid="cli-login-done"]').text()).toBe('Return to your terminal.')
    // No passkey proved anyone here: the device note is untouched.
    expect(keptAccount()).toBeNull()
  })

  it('Deny calls deny#CliLogin', async () => {
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('[data-testid="cli-login-deny"]').trigger('click')
    await flushPromises()
    expect(denyCliLogin).toHaveBeenCalledTimes(1)
    expect(approveCliLogin).not.toHaveBeenCalled()
    expect(wrapper.get('.wizard-question').text()).toBe('Denied.')
    expect(wrapper.get('[data-testid="cli-login-done"]').text()).toBe('The CLI was not signed in.')
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

  it('a refused approve returns to the not-found answer once the request is gone', async () => {
    requestGoneAfterLookup()
    approveCliLogin.mockRejectedValue(refusal('This sign-in request has expired or was already answered. Run darpan login again.'))
    const wrapper = mount(CliLoginPage)
    await typeCode(wrapper, 'BCDF-GH23')
    await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(true)
  })

  // DAR-BE-209: an approve refused because the CLI is not on for this person offers the request, not "code not found".
  async function approveRefused(wrapper: ReturnType<typeof mount>) {
    approveCliLogin.mockRejectedValue(refusal('The Darpan CLI is not turned on for this account. A Darpan admin turns it on.'))
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
    requestGoneAfterLookup()
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
    requestGoneAfterLookup()
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

      expect(wrapper.text()).toContain('Current code from your app.')
      const approve = wrapper.get('[data-testid="cli-login-approve"]')
      expect(approve.attributes('disabled')).toBeDefined()
      await wrapper.get('[data-testid="cli-login-two-factor-code"]').setValue('12345')
      expect(approve.attributes('disabled')).toBeDefined()
      await wrapper.get('[data-testid="cli-login-two-factor-code"]').setValue('123456')
      expect(approve.attributes('disabled')).toBeUndefined()

      await approve.trigger('click')
      await flushPromises()
      expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23', code: '123456' }, expect.anything())
      expect(wrapper.get('.wizard-question').text()).toBe('Approved.')
      expect(keptAccount()).toBeNull()
    })

    it('a refused code keeps the request on screen with the refusal, and clears the code', async () => {
      approveCliLogin.mockRejectedValue(refusal("That code didn't work."))
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')
      await wrapper.get('[data-testid="cli-login-two-factor-code"]').setValue('000000')
      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(wrapper.get('[data-testid="cli-login-code-error"]').text()).toBe("That code didn't work.")
      expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
      expect((wrapper.get('[data-testid="cli-login-two-factor-code"]').element as HTMLInputElement).value).toBe('')
      // No reason code on approve#CliLogin: the request still waiting is what says the proof was refused.
      expect(getCliLoginRequest).toHaveBeenCalledTimes(2)
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
      approveCliLogin.mockRejectedValueOnce(refusal('Enter the code from your authenticator app.'))
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
      expect(wrapper.find('[data-testid="cli-login-use-app"]').exists()).toBe(false)
      expect(beginPasskeyProof).toHaveBeenCalledTimes(1)
      expect(wrapper.get('[data-testid="cli-login-approve"]').attributes('disabled')).toBeUndefined()

      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(webauthn?.get).toHaveBeenCalledTimes(1)
      expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23', passkeyAssertion: ASSERTION_JSON }, expect.anything())
      expect(wrapper.get('.wizard-question').text()).toBe('Approved.')
      // DAR-UI-132: a passkey proved them on this browser, so sign-in here leads with it next time.
      expect(keptAccount()).toEqual({ username: 'ada', method: 'passkey' })
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
      expect(keptAccount()).toBeNull()
    })

    // DAR-UI-132: the passkey by default; the app code is a link.
    it('with the app as well, the passkey is first; Use the app code switches and back, and a refused passkey stays with the message', async () => {
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: true, passkeys: [PASSKEY] })
      approveCliLogin.mockRejectedValue(refusal("That passkey didn't work."))
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)
      expect(beginPasskeyProof).toHaveBeenCalledTimes(1)
      await wrapper.get('[data-testid="cli-login-use-app"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(true)
      expect(wrapper.text()).toContain('Current code from your app.')
      expect(wrapper.find('[data-testid="cli-login-use-app"]').exists()).toBe(false)
      await wrapper.get('[data-testid="cli-login-use-passkey"]').trigger('click')
      await flushPromises()
      expect(wrapper.find('[data-testid="cli-login-two-factor-code"]').exists()).toBe(false)

      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()

      expect(webauthn?.get).toHaveBeenCalledTimes(1)
      expect(wrapper.get('[data-testid="cli-login-code-error"]').text()).toBe("That passkey didn't work.")
      expect(wrapper.find('[data-testid="cli-login-approve"]').exists()).toBe(true)
      expect(wrapper.find('[data-testid="cli-login-notfound"]').exists()).toBe(false)
    })

    it('an ADMIN request for a super admin with both: the warning, then Approve opens the passkey', async () => {
      getTwoFactorStatus.mockResolvedValue({ ok: true, enabled: true, appEnabled: true, passkeys: [PASSKEY] })
      getCliLoginRequest.mockResolvedValue({ ...pending, scope: 'ADMIN' })
      const wrapper = mount(CliLoginPage)
      await typeCode(wrapper, 'BCDF-GH23')

      expect(wrapper.get('.wizard-question').text()).toBe('Approve darpan-admin on ada-laptop?')
      expect(wrapper.find('[data-testid="cli-login-admin-warning"]').exists()).toBe(true)
      await wrapper.get('[data-testid="cli-login-approve"]').trigger('click')
      await flushPromises()
      expect(approveCliLogin).toHaveBeenCalledWith({ userCode: 'BCDF-GH23', passkeyAssertion: ASSERTION_JSON }, expect.anything())
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
