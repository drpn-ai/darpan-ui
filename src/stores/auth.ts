import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationRaw } from 'vue-router'
import { ApiCallError, clearAuthToken, getAuthToken, setAuthTokenContract } from '../lib/api/client'
import { authFacade, clearApiResponseCache, settingsFacade } from '../lib/api/facade'
import type { SaveTenantSettingsPayload } from '../lib/api/facadeTypes'
import { setReadCacheScope } from '../lib/api/readCache'
import { useReferenceDataStore } from './referenceData'
import { useRunResultsStore } from './runResults'
import type {
  AuthTokenContract,
  ChangeExpiredPasswordResponse,
  CompletePasswordResetResponse,
  SaveRecoveryEmailResponse,
  VerifyPasswordResetCodeResponse,
  ChangeOwnPasswordResponse,
  LoginSessionResponse,
  PasswordChangeReason,
  PasswordResetRequestOutcome,
  SaveActiveTenantResponse,
  SaveTenantSettingsResponse,
  SaveUserSettingsResponse,
  SessionInfo,
  SessionInfoResponse,
  SessionTenantOption,
  VerifyOwnPasswordResponse,
} from '../lib/api/types'
import { resolveInternalRedirectTarget } from '../lib/navigation'
import { setDefaultDisplayTimeZone } from '../lib/utils/date'
import {
  CHALLENGE_ENDED_TEXT,
  CODE_REFUSAL_TEXT,
  callFailure,
  passkeyOptionsOf,
  refusalOf,
  type PasskeyBeginOutcome,
  type TwoFactorRefusal,
  type TwoFactorReply,
} from '../lib/twoFactor'
import { PASSKEY_REFUSAL_TEXT } from '../lib/passkeys'

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'verification-failed'

/** DAR-BE-264: what login#Session asked for after a right password. 'code' = enter a code; 'setup' = set one up first. */
export type TwoFactorChallengePurpose = 'code' | 'setup'

/** DAR-BE-270: what a 'code' challenge can be answered with here (login#Session's twoFactorMethods). */
export type TwoFactorMethod = 'app' | 'passkey'

export type TwoFactorVerifyOutcome = { outcome: 'signedIn'; recoveryCodesLeft: number | null } | TwoFactorRefusal

export interface TwoFactorSetupStart {
  secret: string
  otpauthUri: string
  qrDataUri: string | null
}

export type TwoFactorBeginOutcome = { outcome: 'begun'; setup: TwoFactorSetupStart } | TwoFactorRefusal

export type TwoFactorConfirmOutcome = { outcome: 'confirmed'; recoveryCodes: string[] } | TwoFactorRefusal

/** recoveryCodes only when the passkey was the person's first factor (two-factor just turned on). */
export type PasskeyAddOutcome = { outcome: 'added'; recoveryCodes: string[] } | TwoFactorRefusal

/** A fresh proof for a signed-in step: the password (no factor yet), a code from the app, or a passkey assertion. */
export type TwoFactorProof = { currentPassword?: string; code?: string; passkeyAssertion?: string }

interface TwoFactorChallenge {
  token: string
  purpose: TwoFactorChallengePurpose
  methods: TwoFactorMethod[]
}

/** A two-factor reply: refused with an envelope, ending its challenge or not; or signed in with a fresh key. */
type TwoFactorCallReply = TwoFactorReply & { challengeEnded?: boolean | null }
type SignInReply = AuthTokenContract & { authenticated?: boolean; sessionInfo?: SessionInfo | null }

const SETUP_NOT_STARTED_TEXT = 'Setup did not start. Try again.'

// A tenant switch has three outcomes, not two. 'refused' is the backend's permission verdict;
// 'failed' means the call never reached one, so callers must not render it as a denial.
export type TenantSwitchOutcome = 'switched' | 'refused' | 'failed'

export interface UiPermissionPolicy {
  canViewTenantSettings: boolean
  canRunActiveTenantReconciliation: boolean
  canEditTenantSettings: boolean
  canManageGlobalSettings: boolean
  canManageConfigSharing: boolean
}

const authBypass = !import.meta.env.PROD
  && (import.meta.env.VITE_DARPAN_AUTH_BYPASS ?? '').toLowerCase() === 'true'

function normalizeUserId(value: unknown): string | null {
  const normalized = value?.toString()?.trim()
  return normalized ? normalized : null
}

function normalizeTenantOption(value: unknown): SessionTenantOption | null {
  if (!value || typeof value !== 'object') return null
  const candidate = value as Record<string, unknown>
  const userGroupId = normalizeUserId(candidate.userGroupId)
  if (!userGroupId) return null
  return {
    userGroupId,
    label: candidate.label?.toString()?.trim() || userGroupId,
  }
}

function normalizeSessionInfo(sessionInfo: SessionInfo | null | undefined): SessionInfo {
  const normalizedUserId = normalizeUserId(sessionInfo?.userId)
  if (!normalizedUserId) {
    throw new Error('Auth contract violation: authenticated response missing sessionInfo.userId')
  }

  const availableTenants = Array.isArray(sessionInfo?.availableTenants)
    ? sessionInfo.availableTenants
        .map((tenant) => normalizeTenantOption(tenant))
        .filter((tenant): tenant is SessionTenantOption => tenant !== null)
    : []
  const activeTenantUserGroupId = normalizeUserId(sessionInfo?.activeTenantUserGroupId)
  const activeTenant = activeTenantUserGroupId
    ? availableTenants.find((tenant) => tenant.userGroupId === activeTenantUserGroupId) ?? null
    : null

  return {
    ...sessionInfo,
    userId: normalizedUserId,
    username: sessionInfo?.username?.toString()?.trim() || normalizedUserId,
    displayName: sessionInfo?.displayName?.toString()?.trim() || sessionInfo?.username?.toString()?.trim() || normalizedUserId,
    timeZone: sessionInfo?.timeZone?.toString()?.trim() || undefined,
    userTimeZone: sessionInfo?.userTimeZone?.toString()?.trim() || undefined,
    tenantTimeZone: sessionInfo?.tenantTimeZone?.toString()?.trim() || undefined,
    customerScopeId: sessionInfo?.customerScopeId?.toString()?.trim() || null,
    activeTenantUserGroupId,
    activeTenantLabel:
      sessionInfo?.activeTenantLabel?.toString()?.trim() ||
      activeTenant?.label ||
      (activeTenantUserGroupId ? activeTenantUserGroupId : null),
    availableTenants,
  }
}

// The backend already answers this: TenantAccessSupport.resolveTenantSettingsTimeZone is
// tenant -> user -> l10n -> default, and it ships that answer as `timeZone`. This used to recompute
// it from the raw parts with the precedence INVERTED (user first), so a tenant's timezone was
// silently ignored for anyone who had set a personal one — two layers disagreeing about the same
// question. Reconciliation timestamps describe the tenant's business day, so the tenant leads.
//
// Reading `timeZone` also fixes a second defect for free: saveTenantSettings writes the saved zone
// into exactly that field, which the old resolver never read, so changing a tenant's timezone
// in-app left every timestamp in the previous zone until a full session refetch.
//
// tenantTimeZone/userTimeZone remain as fallbacks in the same order, for sessions that predate
// `timeZone` and for the auth-bypass path, which does not populate it.
export function resolveEffectiveTimeZone(sessionInfo: SessionInfo | null | undefined): string | undefined {
  return sessionInfo?.timeZone || sessionInfo?.tenantTimeZone || sessionInfo?.userTimeZone || undefined
}

export function buildUiPermissionPolicy(sessionInfo: SessionInfo | null | undefined): UiPermissionPolicy {
  const isAuthenticated = Boolean(sessionInfo?.userId)
  const isSuperAdmin = sessionInfo?.isSuperAdmin === true
  const canViewActiveTenantData = sessionInfo?.canViewActiveTenantData !== false
  const canRunActiveTenantReconciliation = isAuthenticated && (
    sessionInfo?.canRunActiveTenantReconciliation === true ||
    sessionInfo?.canEditActiveTenantData === true ||
    isSuperAdmin
  )
  const canEditActiveTenantData = sessionInfo?.canEditActiveTenantData === true
  const canManageDarpanCore = isAuthenticated && sessionInfo?.canManageDarpanCore === true
  // DAR-BE-005: config sharing is gated on TENANT ADMIN, which is strictly narrower than
  // canEditTenantSettings — a DARPAN_COMPANY_EDITOR may edit a config but must not widen who
  // can reach its credentials. activeTenantPermissionGroupIds is already in the session payload
  // (AuthFacadeServices.xml:79), so this needs no contract change.
  const isTenantAdmin = (sessionInfo?.activeTenantPermissionGroupIds ?? [])
    .includes('DARPAN_TENANT_ADMIN')

  return {
    canViewTenantSettings: isAuthenticated && (canViewActiveTenantData || isSuperAdmin),
    canRunActiveTenantReconciliation,
    canEditTenantSettings: canEditActiveTenantData || isSuperAdmin,
    canManageGlobalSettings: canManageDarpanCore,
    canManageConfigSharing: isAuthenticated && (isTenantAdmin || isSuperAdmin),
  }
}

export function buildAuthRedirect(redirectTarget: unknown): RouteLocationRaw {
  const redirect = resolveInternalRedirectTarget(redirectTarget)
  if (redirect === '/') return { name: 'login' }
  return { name: 'login', query: { redirect } }
}

function buildContractViolationError(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Invalid auth contract'
  return `Unable to verify authentication. ${message}`
}

export const useAuthStore = defineStore('auth', () => {
  const _checked = ref(false)
  const _error = ref<string | null>(null)
  const _status = ref<AuthStatus>('unauthenticated')
  const _sessionInfo = ref<SessionInfo | null>(null)
  // Set only by a login whose credentials were correct but whose account cannot sign in until its password
  // changes. LoginPage reads it to offer the change inline instead of a dead-end error.
  const _passwordChangeReason = ref<PasswordChangeReason | null>(null)
  // The tenant a deep link switched into, held for the shell to announce once. One-shot by design:
  // the guard sets it mid-navigation, before the shell can show anything, and the shell consumes it
  // on the confirmed route. It is a handoff between two points in one arrival, not standing state.
  const _deepLinkTenantSwitch = ref<string | null>(null)
  // Single in-flight ensureAuthenticated promise. Without this, concurrent 401 callbacks (e.g.
  // every page-init API call fans out and all 401 at once) each schedule their own getSessionInfo
  // call, stampeding the auth endpoint and producing flicker in the UI status. Mirror the
  // _hydrationPromise pattern in referenceData store.
  let _ensureAuthInFlight: Promise<boolean> | null = null
  // DAR-BE-264. The sign-in challenge lives in this store's memory only: never sessionStorage, localStorage or a
  // cookie. A refresh during the code step loses it and goes back to the password, which is the intent.
  let _twoFactorChallenge: TwoFactorChallenge | null = null
  const _twoFactorChallengePurpose = ref<TwoFactorChallengePurpose | null>(null)
  const _twoFactorMethods = ref<TwoFactorMethod[]>([])
  // The due-date notice is said once per page load: by the sign-in grace step, or by the shell's pill for a tab
  // that arrived signed in.
  const _twoFactorDueAnnounced = ref(false)

  const checked = computed(() => _checked.value)
  const error = computed(() => _error.value)
  const status = computed(() => _status.value)
  const sessionInfo = computed(() => _sessionInfo.value)
  const passwordChangeReason = computed(() => _passwordChangeReason.value)
  const deepLinkTenantSwitch = computed(() => _deepLinkTenantSwitch.value)
  const authenticated = computed(() => _status.value === 'authenticated')
  const userId = computed(() => _sessionInfo.value?.userId ?? null)
  const username = computed(() => _sessionInfo.value?.username ?? _sessionInfo.value?.userId ?? null)
  const recoveryEmailMissing = computed(() => _sessionInfo.value?.recoveryEmailMissing === true)
  const emailAddressMasked = computed(() => _sessionInfo.value?.emailAddressMasked ?? null)
  const twoFactorChallengePurpose = computed(() => _twoFactorChallengePurpose.value)
  const twoFactorMethods = computed(() => _twoFactorMethods.value)
  const twoFactorEnabled = computed(() => _sessionInfo.value?.twoFactorEnabled === true)
  const twoFactorDueDate = computed(() => (twoFactorEnabled.value ? null : _sessionInfo.value?.twoFactorDueDate || null))
  const twoFactorDueAnnounced = computed(() => _twoFactorDueAnnounced.value)

  function _setTwoFactorChallenge(challenge: TwoFactorChallenge | null): void {
    _twoFactorChallenge = challenge
    _twoFactorChallengePurpose.value = challenge?.purpose ?? null
    _twoFactorMethods.value = challenge?.methods ?? []
  }

  function _challengeFor(purpose: TwoFactorChallengePurpose): TwoFactorChallenge | null {
    return _twoFactorChallenge?.purpose === purpose ? _twoFactorChallenge : null
  }

  /** The challenge is spent: drop it. The person enters the password again. */
  function _endTwoFactorChallenge(): TwoFactorRefusal {
    _setTwoFactorChallenge(null)
    return { outcome: 'ended', message: CHALLENGE_ENDED_TEXT }
  }

  /**
   * One two-factor call. `accept` turns a reply that went through into the step's outcome, or answers null for a
   * refusal. Through a challenge the refusal's challengeEnded says whether the challenge is spent; signed in there is
   * none, and a setup left past its 15 minutes has to start again. A call that threw carries no reply, so nothing is
   * known to have ended and the person stays on the step. Refusals are the step's to show: none reaches the store's
   * error, which the sign-in form shows after Back.
   */
  async function _twoFactorCall<R extends TwoFactorCallReply, O>(
    challenge: TwoFactorChallenge | null,
    call: () => Promise<R>,
    accept: (reply: R) => O | null,
    fallback: string,
  ): Promise<O | TwoFactorRefusal> {
    try {
      const reply = await call()
      const accepted = accept(reply)
      if (accepted) return accepted
      if (challenge && reply.challengeEnded === true) return _endTwoFactorChallenge()
      const refusal = refusalOf(reply, fallback)
      if (!challenge && refusal.reason === 'setupExpired') return { outcome: 'ended', message: refusal.message }
      return refusal
    } catch (err) {
      return callFailure(err)
    }
  }

  function _holdsSignIn(reply: SignInReply): boolean {
    return reply.authenticated === true && Boolean(reply.authToken?.toString()?.trim())
  }

  /**
   * A reply that signed in. Through a challenge it IS the sign-in: fresh caches and reference data. From a signed-in
   * tab (a first factor confirmed) the old key predates the factor and has stopped working, so the tab swaps to the
   * new key; same person, same tenant, so the read cache and reference data stay.
   */
  function _adoptSignIn(reply: SignInReply, challenge: TwoFactorChallenge | null): void {
    _setTwoFactorChallenge(null)
    if (challenge) {
      _applySignInReply(reply)
      return
    }
    setAuthTokenContract(reply)
    _applyAuthenticatedSession(reply.sessionInfo)
  }

  function abandonTwoFactorChallenge(): void {
    _setTwoFactorChallenge(null)
  }

  function noteTwoFactorDueAnnounced(): void {
    _twoFactorDueAnnounced.value = true
  }

  function noteDeepLinkTenantSwitch(tenantLabel: string): void {
    _deepLinkTenantSwitch.value = tenantLabel?.toString()?.trim() || null
  }

  function clearDeepLinkTenantSwitch(): void {
    _deepLinkTenantSwitch.value = null
  }

  function _applyAuthState(nextState: {
    status: AuthStatus
    error?: string | null
    sessionInfo?: SessionInfo | null
  }): void {
    _checked.value = true
    _status.value = nextState.status
    _error.value = nextState.error ?? null
    _sessionInfo.value = nextState.sessionInfo ?? null
    setDefaultDisplayTimeZone(resolveEffectiveTimeZone(_sessionInfo.value))
    // DAR-UI-057: stored reads belong to one user in one tenant. A failed check is not a sign-out, so it
    // leaves the scope as it was.
    if (nextState.status === 'authenticated' && _sessionInfo.value?.userId) {
      setReadCacheScope(`${_sessionInfo.value.userId}|${_sessionInfo.value.activeTenantUserGroupId ?? ''}`)
    } else if (nextState.status === 'unauthenticated') {
      setReadCacheScope(null)
    }
  }

  function _applyAuthenticatedSession(sessionInfoArg: SessionInfo | null | undefined, errorMsg: string | null = null): void {
    _applyAuthState({
      status: 'authenticated',
      error: errorMsg,
      sessionInfo: normalizeSessionInfo(sessionInfoArg),
    })
  }

  /** A signed-in account call that threw: a 401 ends the session; anything else keeps the current
   *  session and surfaces the error. Unlike a tenant switch, this leaves the response cache alone. */
  function _applyAccountCallFailure(err: unknown): void {
    if (err instanceof ApiCallError && err.status === 401) {
      clearAuthToken()
      _applyAuthState({ status: 'unauthenticated', error: err.message })
      return
    }

    _applyAuthState({
      status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
      error: err instanceof ApiCallError ? err.message : buildContractViolationError(err),
      sessionInfo: _sessionInfo.value,
    })
  }

  function _hydrateReferenceData(): void {
    // Fire-and-forget — pages await ensureLoaded() if they arrive before the
    // fan-out resolves, so we don't block the post-login redirect here.
    try {
      void useReferenceDataStore().hydrate()
      void useRunResultsStore().hydrate()
    } catch {
      // Pinia not active (e.g. some test setups); data will be lazy-loaded
      // on first page access instead.
    }
  }

  function _applyAuthResponse(response: SessionInfoResponse | LoginSessionResponse, unauthenticatedMessage: string): boolean {
    if (response.authenticated) {
      _applyAuthenticatedSession(response.sessionInfo)
      return true
    }

    clearAuthToken()
    clearApiResponseCache()
    _applyAuthState({
      status: 'unauthenticated',
      error: response.errors?.[0] ?? unauthenticatedMessage,
    })
    return false
  }

  async function ensureAuthenticated(force = false): Promise<boolean> {
    if (authBypass) {
      _applyAuthState({
        status: 'authenticated',
        sessionInfo: { userId: 'local-dev', username: 'local-dev' },
      })
      _hydrateReferenceData()
      return true
    }

    if (_checked.value && !force) return _status.value === 'authenticated'

    // Dedupe concurrent calls: while a getSessionInfo is in flight, return the same promise.
    if (_ensureAuthInFlight) return _ensureAuthInFlight

    const inFlight = (async () => {
      try {
        const response = await authFacade.getSessionInfo()
        const isAuthenticated = _applyAuthResponse(response, 'No active authenticated session detected.')
        if (isAuthenticated) _hydrateReferenceData()
        return isAuthenticated
      } catch (err) {
        if (err instanceof ApiCallError && err.status === 401) {
          clearAuthToken()
          clearApiResponseCache()
          _applyAuthState({ status: 'unauthenticated', error: err.message })
          return false
        }

        const formattedError = err instanceof ApiCallError ? err.message : buildContractViolationError(err)
        _applyAuthState({ status: 'verification-failed', error: formattedError })
        return false
      } finally {
        _ensureAuthInFlight = null
      }
    })()
    _ensureAuthInFlight = inFlight
    return inFlight
  }

  // Called by App.vue on a storage event. The bearer token now lives in this tab's sessionStorage
  // (audit #10), so cross-tab token sync no longer applies — sessions are per-tab. We still react
  // defensively: if this tab's own token is gone we treat it as a logout (clear local state +
  // caches, no server call); if a token is present we force-revalidate so a rotated user is picked
  // up rather than rendering the previous user's UI.
  function handleExternalAuthChange(): void {
    const storedToken = getAuthToken()
    if (!storedToken) {
      clearApiResponseCache()
      _applyAuthState({ status: 'unauthenticated' })
      return
    }
    // Token present but may belong to a different user — force a fresh server check.
    void ensureAuthenticated(true)
  }

  async function loginWithCredentials(usernameArg: string, password: string): Promise<boolean> {
    if (authBypass) {
      _applyAuthState({
        status: 'authenticated',
        sessionInfo: { userId: 'local-dev', username: 'local-dev' },
      })
      _hydrateReferenceData()
      return true
    }

    _passwordChangeReason.value = null
    _setTwoFactorChallenge(null)

    try {
      const response = await authFacade.loginSession(usernameArg, password)
      if (response.twoFactorRequired === true || response.twoFactorSetupRequired === true) {
        // DAR-BE-264: the password was right; the session waits for a code (or for a first setup).
        const token = response.challengeToken?.toString()?.trim()
        if (!token) throw new Error('Two-factor login response missing challengeToken')
        clearAuthToken()
        const purpose: TwoFactorChallengePurpose = response.twoFactorSetupRequired === true ? 'setup' : 'code'
        const methods = purpose === 'code' ? response.twoFactorMethods ?? [] : []
        _setTwoFactorChallenge({
          token,
          purpose,
          methods: methods.filter((method): method is TwoFactorMethod => method === 'app' || method === 'passkey'),
        })
        _applyAuthState({ status: 'unauthenticated' })
        return false
      }
      if (response.passwordChangeRequired === true) {
        // Credentials were accepted; only the session is withheld. The backend reports this as a completed
        // call with the explanation in `messages`, so _applyAuthResponse's errors-based text does not apply.
        _passwordChangeReason.value = response.passwordChangeReason ?? 'PWDCHG'
        clearAuthToken()
        _applyAuthState({
          status: 'unauthenticated',
          error: response.messages?.[0] ?? 'Your password must be changed before you can sign in.',
        })
        return false
      }
      if (response.authenticated) {
        const authToken = response.authToken?.toString()?.trim()
        if (!authToken) throw new Error('Authenticated login response missing authToken')
        setAuthTokenContract(response)
        // Clear any stale tenant cache before fan-out so the new session
        // starts from a clean slate.
        clearApiResponseCache()
      }

      const isAuthenticated = _applyAuthResponse(response, 'Login failed')
      if (isAuthenticated) _hydrateReferenceData()
      return isAuthenticated
    } catch (err) {
      clearAuthToken()
      _applyAuthState({
        status: 'unauthenticated',
        error: err instanceof ApiCallError ? err.message : buildContractViolationError(err),
      })
      return false
    }
  }

  /** Signs a fresh sign-in reply into this tab: its key into sessionStorage (header auth), its session into state. */
  function _applySignInReply(response: SignInReply): void {
    setAuthTokenContract(response)
    clearApiResponseCache()
    _applyAuthenticatedSession(response.sessionInfo)
    _hydrateReferenceData()
  }

  /** verify#SignInCode: the challenge from login#Session with a code from the app, a recovery code or (DAR-BE-270) a
   *  passkey assertion over begin#PasskeySignIn's options. */
  async function verifySignInCode(
    input: { code: string } | { recoveryCode: string } | { passkeyAssertion: string },
  ): Promise<TwoFactorVerifyOutcome> {
    const challenge = _challengeFor('code')
    if (!challenge) return _endTwoFactorChallenge()
    return _twoFactorCall(challenge, () => authFacade.verifySignInCode({ challengeToken: challenge.token, ...input }), (reply) => {
      if (!_holdsSignIn(reply)) return null
      _adoptSignIn(reply, challenge)
      return { outcome: 'signedIn', recoveryCodesLeft: reply.recoveryCodesLeft ?? null } as const
    }, CODE_REFUSAL_TEXT)
  }

  /**
   * begin#TwoFactorSetup. With a setup challenge (forced setup at sign-in) the token is the whole proof. Signed in, a
   * first setup needs the current password and replacing an app that is on a code from it or a passkey.
   */
  async function beginTwoFactorSetup(proof: TwoFactorProof = {}): Promise<TwoFactorBeginOutcome> {
    const challenge = _challengeFor('setup')
    return _twoFactorCall(challenge, () => authFacade.beginTwoFactorSetup(challenge ? { challengeToken: challenge.token } : proof), (reply) => {
      const secret = reply.secret?.toString()?.trim()
      if (!secret || !reply.otpauthUri) return null
      return { outcome: 'begun', setup: { secret, otpauthUri: reply.otpauthUri, qrDataUri: reply.qrDataUri?.toString() || null } } as const
    }, SETUP_NOT_STARTED_TEXT)
  }

  /** confirm#TwoFactorSetup. Always answers with a fresh sign-in (see _adoptSignIn) and the recovery codes. */
  async function confirmTwoFactorSetup(code: string): Promise<TwoFactorConfirmOutcome> {
    const challenge = _challengeFor('setup')
    return _twoFactorCall(challenge, () => authFacade.confirmTwoFactorSetup(challenge ? { code, challengeToken: challenge.token } : { code }), (reply) => {
      if (!_holdsSignIn(reply)) return null
      _adoptSignIn(reply, challenge)
      return { outcome: 'confirmed', recoveryCodes: reply.recoveryCodes ?? [] } as const
    }, CODE_REFUSAL_TEXT)
  }

  /** begin#PasskeySignIn: request options for the person a 'code' challenge belongs to. Each call replaces the last. */
  async function beginPasskeySignIn(): Promise<PasskeyBeginOutcome> {
    const challenge = _challengeFor('code')
    if (!challenge) return _endTwoFactorChallenge()
    return _twoFactorCall(challenge, () => authFacade.beginPasskeySignIn({ challengeToken: challenge.token }), passkeyOptionsOf, PASSKEY_REFUSAL_TEXT)
  }

  /**
   * begin#PasskeyRegistration: creation options for a new passkey. With a setup challenge (forced setup at sign-in) the
   * token is the whole proof; signed in, the same proof begin#TwoFactorSetup takes.
   */
  async function beginPasskeyRegistration(proof: TwoFactorProof = {}): Promise<PasskeyBeginOutcome> {
    const challenge = _challengeFor('setup')
    return _twoFactorCall(
      challenge,
      () => authFacade.beginPasskeyRegistration(challenge ? { challengeToken: challenge.token } : proof),
      passkeyOptionsOf,
      SETUP_NOT_STARTED_TEXT,
    )
  }

  /**
   * finish#PasskeyRegistration with the browser's new credential. A first factor answers with a fresh sign-in, as
   * confirm#TwoFactorSetup does; an added passkey changes no session. A refusal uses up the registration options.
   */
  async function finishPasskeyRegistration(credential: string): Promise<PasskeyAddOutcome> {
    const challenge = _challengeFor('setup')
    return _twoFactorCall(
      challenge,
      () => authFacade.finishPasskeyRegistration(challenge ? { credential, challengeToken: challenge.token } : { credential }),
      (reply) => {
        if (reply.ok === false || !reply.passkeyId) return null
        if (_holdsSignIn(reply)) _adoptSignIn(reply, challenge)
        return { outcome: 'added', recoveryCodes: reply.recoveryCodes ?? [] } as const
      },
      PASSKEY_REFUSAL_TEXT,
    )
  }

  /** After a settings change that did not reissue the session (turning it off), keep the session's view in step. */
  function applyTwoFactorState(next: { enabled: boolean; dueDate?: SessionInfo['twoFactorDueDate'] }): void {
    if (!_sessionInfo.value) return
    _sessionInfo.value = {
      ..._sessionInfo.value,
      twoFactorEnabled: next.enabled,
      twoFactorDueDate: next.enabled ? null : next.dueDate ?? null,
    }
  }

  async function logoutSession(): Promise<boolean> {
    if (authBypass) {
      clearApiResponseCache()
      _applyAuthState({ status: 'unauthenticated' })
      return true
    }

    try {
      const response = await authFacade.logoutSession()
      clearAuthToken()
      clearApiResponseCache()
      if (!response.authenticated) {
        _applyAuthState({ status: 'unauthenticated' })
        return true
      }

      _applyAuthState({
        status: 'unauthenticated',
        error: response.errors?.[0] ?? 'Logout failed',
      })
      return false
    } catch (err) {
      clearAuthToken()
      clearApiResponseCache()
      _applyAuthState({
        status: 'unauthenticated',
        error: err instanceof ApiCallError ? err.message : 'Logout failed',
      })
      return false
    }
  }

  async function switchActiveTenant(activeTenantUserGroupId: string): Promise<TenantSwitchOutcome> {
    if (authBypass) {
      _deepLinkTenantSwitch.value = null
      clearApiResponseCache()
      _hydrateReferenceData()
      return 'switched'
    }

    try {
      const response: SaveActiveTenantResponse = await authFacade.saveActiveTenant(activeTenantUserGroupId)
      if (response.authenticated) {
        const errorMessage = response.ok ? null : response.errors?.[0] ?? 'The tenant door is stuck. Still on the old one.'
        if (response.ok) {
          // Any successful switch drops an unconsumed deep-link announcement: it named a tenant
          // this switch just left. The guard re-raises it right after when the switch came from a
          // link.
          _deepLinkTenantSwitch.value = null
          clearApiResponseCache()
        }
        _applyAuthenticatedSession(response.sessionInfo, errorMessage)
        if (response.ok) _hydrateReferenceData()
        // The backend answered and said no. That is a permission verdict.
        return response.ok ? 'switched' : 'refused'
      }

      clearAuthToken()
      clearApiResponseCache()
      _applyAuthState({
        status: 'unauthenticated',
        error: response.errors?.[0] ?? 'Authentication required to change the active tenant.',
      })
      return 'failed'
    } catch (err) {
      if (err instanceof ApiCallError && err.status === 401) {
        clearAuthToken()
        clearApiResponseCache()
        _applyAuthState({ status: 'unauthenticated', error: err.message })
        return 'failed'
      }

      _applyAuthState({
        status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
        error: err instanceof ApiCallError ? err.message : buildContractViolationError(err),
        sessionInfo: _sessionInfo.value,
      })
      // The call never reached a verdict. Never render this as access-denied.
      return 'failed'
    }
  }

  async function saveActiveTenant(activeTenantUserGroupId: string): Promise<boolean> {
    return (await switchActiveTenant(activeTenantUserGroupId)) === 'switched'
  }

  async function saveUserSettings(payload: { displayName?: string; timeZone?: string }): Promise<boolean> {
    if (authBypass) {
      const bypassSession: SessionInfo = {
        ..._sessionInfo.value,
        userId: _sessionInfo.value?.userId ?? 'local-dev',
        username: _sessionInfo.value?.username ?? 'local-dev',
      }
      if (payload.displayName !== undefined) {
        bypassSession.displayName = payload.displayName?.toString()?.trim() || bypassSession.username
      }
      if (payload.timeZone !== undefined) {
        bypassSession.userTimeZone = payload.timeZone?.toString()?.trim() || undefined
      }
      _applyAuthState({ status: 'authenticated', sessionInfo: bypassSession })
      return true
    }

    try {
      const response: SaveUserSettingsResponse = await authFacade.saveUserSettings(payload)
      if (response.authenticated) {
        const errorMessage = response.ok ? null : response.errors?.[0] ?? 'Your settings had second thoughts. Not saved.'
        _applyAuthenticatedSession(response.sessionInfo, errorMessage)
        return response.ok
      }

      clearAuthToken()
      _applyAuthState({
        status: 'unauthenticated',
        error: response.errors?.[0] ?? 'Authentication required to save user settings.',
      })
      return false
    } catch (err) {
      _applyAccountCallFailure(err)
      return false
    }
  }

  async function saveTenantSettings(payload: SaveTenantSettingsPayload): Promise<SaveTenantSettingsResponse | null> {
    if (authBypass) {
      const timeZone = payload.timeZone?.toString()?.trim() || _sessionInfo.value?.timeZone || 'UTC'
      // Absent leaves the stored space alone, '' clears it — the same contract the service keeps.
      let streaksChatSpaceId: string | null = null
      if (payload.streaksChatSpaceId !== undefined) {
        streaksChatSpaceId = payload.streaksChatSpaceId.trim() || null
      } else {
        try {
          streaksChatSpaceId = useReferenceDataStore().tenantSettings?.streaksChatSpaceId ?? null
        } catch {
          // ignore — store optional in some test contexts
        }
      }
      _applyAuthState({
        status: 'authenticated',
        sessionInfo: {
          ..._sessionInfo.value,
          userId: _sessionInfo.value?.userId ?? 'local-dev',
          username: _sessionInfo.value?.username ?? 'local-dev',
          timeZone,
        },
      })
      return {
        ok: true,
        messages: ['Saved tenant settings.'],
        errors: [],
        tenantSettings: {
          companyUserGroupId: _sessionInfo.value?.activeTenantUserGroupId,
          companyLabel: _sessionInfo.value?.activeTenantLabel,
          timeZone,
          streaksChatSpaceId,
        },
      }
    }

    try {
      const response = await settingsFacade.saveTenantSettings(payload)
      if (response.ok && response.tenantSettings) {
        // A streaks-only save still answers with the whole settings map, so the store takes it
        // as-is; only a returned zone moves the session's timezone.
        if (response.tenantSettings.timeZone && _sessionInfo.value) {
          _applyAuthenticatedSession({
            ..._sessionInfo.value,
            timeZone: response.tenantSettings.timeZone,
          })
        }
        try {
          useReferenceDataStore().setTenantSettings(response.tenantSettings)
        } catch {
          // ignore — store optional in some test contexts
        }
      } else if (!response.ok) {
        _applyAuthState({
          status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
          error: response.errors?.[0] ?? 'Tenant settings got stuck in traffic. Not saved.',
          sessionInfo: _sessionInfo.value,
        })
      }
      return response
    } catch (err) {
      _applyAccountCallFailure(err)
      return null
    }
  }

  async function changeOwnPassword(payload: {
    currentPassword: string
    newPassword: string
    newPasswordVerify: string
  }): Promise<boolean> {
    if (authBypass) return true

    try {
      const response: ChangeOwnPasswordResponse = await authFacade.changeOwnPassword(payload)
      if (response.authenticated) {
        const errorMessage = response.ok ? null : response.errors?.[0] ?? 'Unable to change password.'
        _applyAuthenticatedSession(response.sessionInfo, errorMessage)
        return response.ok && response.passwordUpdated === true
      }

      clearAuthToken()
      _applyAuthState({
        status: 'unauthenticated',
        error: response.errors?.[0] ?? 'Authentication required to change password.',
      })
      return false
    } catch (err) {
      _applyAccountCallFailure(err)
      return false
    }
  }

  /** Change the password of an account that cannot sign in yet, so it can. Deliberately does not touch
   *  session state: the backend issues no token here, and the caller signs in normally afterwards. */
  async function changeExpiredPassword(payload: {
    username: string
    currentPassword: string
    newPassword: string
    newPasswordVerify: string
  }): Promise<boolean> {
    if (authBypass) return true

    try {
      const response: ChangeExpiredPasswordResponse = await authFacade.changeExpiredPassword(payload)
      const changed = response.ok && response.passwordUpdated === true
      if (changed) _passwordChangeReason.value = null
      _error.value = changed ? null : response.errors?.[0] ?? 'Unable to change password.'
      return changed
    } catch (err) {
      // The backend reports a rejected new password as a service error rather than an envelope, so the
      // policy text ("shorter than 12 characters", "was used in last 5 passwords") arrives here.
      _error.value = err instanceof ApiCallError ? err.message : buildContractViolationError(err)
      return false
    }
  }

  // DAR-UI-084. The reply says what happened. Null when the call itself failed, which sets the error. A backend
  // from before DAR-UI-084 sends no outcome; it only ever answered after queueing the code, so that reads as sent.
  async function requestPasswordReset(
    usernameOrEmail: string,
  ): Promise<{ outcome: PasswordResetRequestOutcome; emailAddressMasked: string | null } | null> {
    try {
      const response = await authFacade.requestPasswordReset({ usernameOrEmail })
      _error.value = null
      return { outcome: response.outcome ?? 'sent', emailAddressMasked: response.emailAddressMasked ?? null }
    } catch (err) {
      _error.value = err instanceof ApiCallError ? err.message : buildContractViolationError(err)
      return null
    }
  }

  async function verifyPasswordResetCode(usernameOrEmail: string, code: string): Promise<boolean> {
    try {
      const response: VerifyPasswordResetCodeResponse = await authFacade.verifyPasswordResetCode({ usernameOrEmail, code })
      const verified = response.verified === true
      _error.value = verified ? null : response.errors?.[0] ?? "That code didn't work. Request a new one."
      return verified
    } catch (err) {
      _error.value = err instanceof ApiCallError ? err.message : buildContractViolationError(err)
      return false
    }
  }

  async function completePasswordReset(payload: {
    usernameOrEmail: string
    code: string
    newPassword: string
    newPasswordVerify: string
  }): Promise<boolean> {
    try {
      const response: CompletePasswordResetResponse = await authFacade.completePasswordReset(payload)
      const updated = response.ok && response.passwordUpdated === true
      _error.value = updated ? null : response.errors?.[0] ?? 'Unable to reset the password.'
      return updated
    } catch (err) {
      // A refused new password arrives as a service error, as in changeExpiredPassword.
      _error.value = err instanceof ApiCallError ? err.message : buildContractViolationError(err)
      return false
    }
  }

  async function saveRecoveryEmail(emailAddress: string, currentPassword: string): Promise<boolean> {
    if (authBypass) return true

    try {
      const response: SaveRecoveryEmailResponse = await authFacade.saveRecoveryEmail({ emailAddress, currentPassword })
      if (!response.ok) {
        _error.value = response.errors?.[0] ?? 'Unable to save the recovery email.'
        return false
      }
      _error.value = null
      if (_sessionInfo.value) {
        _sessionInfo.value = {
          ..._sessionInfo.value,
          recoveryEmailMissing: false,
          emailAddressMasked: response.emailAddressMasked ?? null,
        }
      }
      return true
    } catch (err) {
      _error.value = err instanceof ApiCallError ? err.message : buildContractViolationError(err)
      return false
    }
  }

  async function getPasswordResetAvailable(): Promise<boolean> {
    try {
      const response = await authFacade.getPasswordResetStatus()
      return response.available === true
    } catch {
      return false
    }
  }

  async function verifyOwnPassword(currentPassword: string): Promise<boolean> {
    if (authBypass) return true

    try {
      const response: VerifyOwnPasswordResponse = await authFacade.verifyOwnPassword({ currentPassword })
      if (response.authenticated) {
        const errorMessage = response.ok && response.passwordVerified === true ? null : response.errors?.[0] ?? 'Password incorrect.'
        _applyAuthenticatedSession(response.sessionInfo, errorMessage)
        return response.ok && response.passwordVerified === true
      }

      clearAuthToken()
      _applyAuthState({
        status: 'unauthenticated',
        error: response.errors?.[0] ?? 'Authentication required to verify password.',
      })
      return false
    } catch (err) {
      _applyAccountCallFailure(err)
      return false
    }
  }

  return {
    checked,
    error,
    status,
    sessionInfo,
    authenticated,
    userId,
    username,
    passwordChangeReason,
    deepLinkTenantSwitch,
    ensureAuthenticated,
    handleExternalAuthChange,
    loginWithCredentials,
    logoutSession,
    switchActiveTenant,
    noteDeepLinkTenantSwitch,
    clearDeepLinkTenantSwitch,
    saveActiveTenant,
    saveUserSettings,
    saveTenantSettings,
    changeOwnPassword,
    changeExpiredPassword,
    verifyOwnPassword,
    recoveryEmailMissing,
    emailAddressMasked,
    twoFactorChallengePurpose,
    twoFactorMethods,
    twoFactorEnabled,
    twoFactorDueDate,
    twoFactorDueAnnounced,
    noteTwoFactorDueAnnounced,
    abandonTwoFactorChallenge,
    verifySignInCode,
    beginTwoFactorSetup,
    confirmTwoFactorSetup,
    beginPasskeySignIn,
    beginPasskeyRegistration,
    finishPasskeyRegistration,
    applyTwoFactorState,
    requestPasswordReset,
    verifyPasswordResetCode,
    completePasswordReset,
    saveRecoveryEmail,
    getPasswordResetAvailable,
  }
})
