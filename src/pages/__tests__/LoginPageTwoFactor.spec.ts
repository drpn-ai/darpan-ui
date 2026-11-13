import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'

// DAR-BE-264: the sign-in page's two-factor steps, driven through the real auth store with only the facade and the
// router mocked, so the challenge token's handling (memory only) and the token swap are exercised end to end.

const replace = vi.hoisted(() => vi.fn().mockResolvedValue(undefined))
const route = vi.hoisted(() => ({ query: {} as Record<string, unknown> }))
const loginSession = vi.hoisted(() => vi.fn())
const verifySignInCode = vi.hoisted(() => vi.fn())
const beginTwoFactorSetup = vi.hoisted(() => vi.fn())
const confirmTwoFactorSetup = vi.hoisted(() => vi.fn())
const getPasswordResetStatus = vi.hoisted(() => vi.fn())

vi.mock('vue-router', () => ({ useRoute: () => route, useRouter: () => ({ replace }) }))
vi.mock('../../lib/api/facade', () => ({
  authFacade: { loginSession, verifySignInCode, beginTwoFactorSetup, confirmTwoFactorSetup, getPasswordResetStatus },
  settingsFacade: {},
  clearApiResponseCache: vi.fn(),
}))
vi.mock('../../stores/referenceData', () => ({ useReferenceDataStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))
vi.mock('../../stores/runResults', () => ({ useRunResultsStore: () => ({ hydrate: vi.fn().mockResolvedValue(undefined) }) }))

import LoginPage from '../LoginPage.vue'
import { ApiCallError, clearAuthToken, getAuthToken } from '../../lib/api/client'
import { installLocalStorageStub } from '../../test/localStorage'

const CHALLENGE = 'challenge-xyz'
const CODES = Array.from({ length: 10 }, (_, i) => `abcd-efgh-jkmn-pq${String(i).padStart(2, '0')}`)
const session = (extra: Record<string, unknown> = {}) => ({ userId: 'U1', username: 'ada', ...extra })
const signedIn = (authToken: string, extra: Record<string, unknown> = {}) => ({
  ok: true, messages: [], errors: [], authenticated: true, authToken, authTokenHeaderName: 'login_key',
  sessionInfo: session({ twoFactorEnabled: true }), ...extra,
})
const challengeReply = (purpose: 'code' | 'setup') => ({
  ok: true, messages: [], errors: [], authenticated: false, challengeToken: CHALLENGE, challengeExpiresInSeconds: 300,
  ...(purpose === 'code' ? { twoFactorRequired: true } : { twoFactorSetupRequired: true }),
})
// As the backend answers since darpan d4d13e26: a completed call carrying challengeEnded.
const refusal = (challengeEnded = false) => ({
  ok: false, messages: [], errors: ["That code didn't work."], authenticated: false, challengeEnded,
})
const setupStart = {
  ok: true, messages: [], errors: [],
  secret: 'JBSWY3DPEHPK3PXPJBSWY3DP',
  otpauthUri: 'otpauth://totp/Darpan:ada?secret=JBSWY3DPEHPK3PXPJBSWY3DP&issuer=Darpan',
  qrDataUri: 'data:image/svg+xml;base64,PHN2Zy8+',
  expiresInSeconds: 900,
}

async function signIn(wrapper: ReturnType<typeof mount>): Promise<void> {
  await wrapper.get('input[autocomplete="username"]').setValue('ada')
  await wrapper.get('input[autocomplete="current-password"]').setValue('right-password')
  await wrapper.get('form').trigger('submit.prevent')
  await flushPromises()
}

/** Paste into the first box: WorkflowCodeInput spreads it and fires complete on the sixth digit. */
async function typeCode(wrapper: ReturnType<typeof mount>, testId: string, code: string): Promise<void> {
  const box = wrapper.get(`[data-testid="${testId}-0"]`)
  ;(box.element as HTMLInputElement).value = code
  await box.trigger('input')
  await flushPromises()
}

describe('LoginPage two-factor', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageStub()
    clearAuthToken()
    route.query = {}
    getPasswordResetStatus.mockResolvedValue({ available: false })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('asks for the app code, submits on the sixth digit, and signs in', async () => {
    loginSession.mockResolvedValue(challengeReply('code'))
    verifySignInCode.mockResolvedValue(signedIn('key-1'))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    expect(wrapper.text()).toContain('Enter the code from your app.')
    expect(wrapper.find('h1').exists()).toBe(false)

    await typeCode(wrapper, 'login-two-factor-code', '123456')

    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, code: '123456' })
    expect(getAuthToken()).toBe('key-1')
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('a wrong code stays on the code step with the one refusal message', async () => {
    loginSession.mockResolvedValue(challengeReply('code'))
    verifySignInCode.mockResolvedValue(refusal(false))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await typeCode(wrapper, 'login-two-factor-code', '000000')

    expect(wrapper.text()).toContain("That code didn't work.")
    expect(wrapper.text()).toContain('Enter the code from your app.')
    expect((wrapper.get('[data-testid="login-two-factor-code-0"]').element as HTMLInputElement).value).toBe('')
    expect(replace).not.toHaveBeenCalled()
  })

  it('a refusal with challengeEnded goes back to the password step and clears the password', async () => {
    loginSession.mockResolvedValue(challengeReply('code'))
    verifySignInCode.mockResolvedValue(refusal(true))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await typeCode(wrapper, 'login-two-factor-code', '000000')

    expect(wrapper.find('h1').text()).toBe('Sign In')
    expect(wrapper.text()).toContain('This sign-in has expired. Enter your password again.')
    expect((wrapper.get('input[autocomplete="current-password"]').element as HTMLInputElement).value).toBe('')
  })

  it('stays on the code step for as many refusals as the backend allows, and leaves when it says challengeEnded', async () => {
    loginSession.mockResolvedValue(challengeReply('code'))
    verifySignInCode.mockResolvedValue(refusal(false))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    for (let attempt = 0; attempt < 4; attempt += 1) await typeCode(wrapper, 'login-two-factor-code', '000000')
    expect(wrapper.text()).toContain('Enter the code from your app.')

    verifySignInCode.mockResolvedValue(refusal(true))
    await typeCode(wrapper, 'login-two-factor-code', '000000')

    expect(verifySignInCode).toHaveBeenCalledTimes(5)
    expect(wrapper.find('h1').text()).toBe('Sign In')
    expect(wrapper.text()).toContain('This sign-in has expired. Enter your password again.')
  })

  it('a network failure past the 300 s goes back to the password; one inside them stays', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-13T10:00:00Z'))
    loginSession.mockResolvedValue(challengeReply('code'))
    verifySignInCode.mockRejectedValue(new ApiCallError('Darpan stepped out for chai. Try again in a moment.'))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await typeCode(wrapper, 'login-two-factor-code', '123456')
    expect(wrapper.text()).toContain('Enter the code from your app.')
    expect(wrapper.text()).toContain('Darpan stepped out for chai.')

    vi.setSystemTime(new Date('2026-11-13T10:05:01Z'))
    await typeCode(wrapper, 'login-two-factor-code', '123456')

    expect(wrapper.find('h1').text()).toBe('Sign In')
    expect(wrapper.text()).toContain('This sign-in has expired. Enter your password again.')
  })

  it('takes a recovery code instead, and says when few are left before going on', async () => {
    loginSession.mockResolvedValue(challengeReply('code'))
    verifySignInCode.mockResolvedValue(signedIn('key-2', { recoveryCodesLeft: 2 }))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await wrapper.get('[data-testid="login-two-factor-use-recovery"]').trigger('click')
    expect(wrapper.text()).toContain('Enter a recovery code.')
    await wrapper.get('[data-testid="login-two-factor-recovery-input"]').setValue(' ABCD-EFGH-JKMN-PQRS ')
    await wrapper.get('[data-testid="login-two-factor-recovery-next"]').trigger('click')
    await flushPromises()

    expect(verifySignInCode).toHaveBeenCalledWith({ challengeToken: CHALLENGE, recoveryCode: 'ABCD-EFGH-JKMN-PQRS' })
    expect(wrapper.text()).toContain('2 recovery codes left.')
    expect(replace).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="login-recovery-codes-left-ok"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('Back from the code step returns to the password form', async () => {
    loginSession.mockResolvedValue(challengeReply('code'))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()

    expect(wrapper.find('h1').text()).toBe('Sign In')
  })

  it('walks a required setup: QR and key, the first code, the recovery codes once, then signs in', async () => {
    loginSession.mockResolvedValue(challengeReply('setup'))
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    confirmTwoFactorSetup.mockResolvedValue(signedIn('key-after-setup', { recoveryCodes: CODES }))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)

    expect(beginTwoFactorSetup).toHaveBeenCalledWith({ challengeToken: CHALLENGE })
    expect(wrapper.find('[data-testid="two-factor-required-notice"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Scan this with your authenticator app.')
    expect(wrapper.get('[data-testid="two-factor-qr"]').attributes('src')).toBe(setupStart.qrDataUri)
    expect(wrapper.get('[data-testid="two-factor-key"]').text()).toBe('JBSW Y3DP EHPK 3PXP JBSW Y3DP')
    expect(wrapper.get('[data-testid="two-factor-otpauth"]').attributes('href')).toBe(setupStart.otpauthUri)

    await wrapper.get('[data-testid="two-factor-scan-next"]').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Enter the code it shows.')
    await typeCode(wrapper, 'two-factor-setup-code', '654321')

    expect(confirmTwoFactorSetup).toHaveBeenCalledWith({ code: '654321', challengeToken: CHALLENGE })
    expect(getAuthToken()).toBe('key-after-setup')
    expect(wrapper.text()).toContain('Save your recovery codes.')
    expect(wrapper.findAll('[data-testid="two-factor-recovery-code"]')).toHaveLength(10)
    expect(replace).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="two-factor-codes-saved"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/')
  })

  it('a setup confirm refused with challengeEnded goes back to the password step', async () => {
    loginSession.mockResolvedValue(challengeReply('setup'))
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    confirmTwoFactorSetup.mockResolvedValue(refusal(true))
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    await wrapper.get('[data-testid="two-factor-scan-next"]').trigger('click')
    await flushPromises()
    await typeCode(wrapper, 'two-factor-setup-code', '654321')

    expect(wrapper.find('h1').text()).toBe('Sign In')
    expect(wrapper.text()).toContain('This sign-in has expired. Enter your password again.')
    expect(getAuthToken()).toBeNull()
  })

  it('in the grace period asks after sign-in; Not now goes on, Set up begins with the password just typed', async () => {
    loginSession.mockResolvedValue(signedIn('key-3', { sessionInfo: session({ twoFactorEnabled: false, twoFactorDueDate: '2026-12-01T12:00:00Z' }) }))
    beginTwoFactorSetup.mockResolvedValue(setupStart)
    const wrapper = mount(LoginPage)

    await signIn(wrapper)
    expect(wrapper.text()).toContain('Set up two-factor by 1 Dec.')
    expect(replace).not.toHaveBeenCalled()

    await wrapper.get('[data-testid="login-two-factor-due-setup"]').trigger('click')
    await flushPromises()
    expect(beginTwoFactorSetup).toHaveBeenCalledWith({ currentPassword: 'right-password' })
    expect(wrapper.text()).toContain('Scan this with your authenticator app.')

    // Back from the scan step returns to the prompt; Not now leaves.
    await wrapper.get('.wizard-back').trigger('click')
    await flushPromises()
    await wrapper.get('[data-testid="login-two-factor-due-skip"]').trigger('click')
    await flushPromises()
    expect(replace).toHaveBeenCalledWith('/')
  })
})
