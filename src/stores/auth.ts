import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import type { RouteLocationRaw } from 'vue-router'
import { ApiCallError, clearAuthToken, setAuthTokenContract } from '../lib/api/client'
import { authFacade, clearApiResponseCache, settingsFacade } from '../lib/api/facade'
import { useReferenceDataStore } from './referenceData'
import { useRunResultsStore } from './runResults'
import type {
  ChangeOwnPasswordResponse,
  LoginSessionResponse,
  SaveActiveTenantResponse,
  SaveTenantSettingsResponse,
  SaveUserSettingsResponse,
  SessionInfo,
  SessionInfoResponse,
  SessionTenantOption,
  VerifyOwnPasswordResponse,
} from '../lib/api/types'
import { resolveInternalRedirectTarget } from '../lib/navigation'

export type AuthStatus = 'authenticated' | 'unauthenticated' | 'verification-failed'

export interface UiPermissionPolicy {
  canViewTenantSettings: boolean
  canRunActiveTenantReconciliation: boolean
  canEditTenantSettings: boolean
  canManageGlobalSettings: boolean
}

const authBypass = !import.meta.env.PROD
  && (import.meta.env.VITE_DARPAN_AUTH_BYPASS ?? '').toLowerCase() === 'true'

function formatApiError(error: ApiCallError): string {
  const details = (error.details ?? {}) as {
    attemptedUrls?: string[]
    failures?: Array<{ status?: number; raw?: string }>
  }

  if (Array.isArray(details.attemptedUrls) && details.attemptedUrls.length > 0) {
    const preview = details.attemptedUrls.slice(0, 3).join(', ')
    const firstFailure = Array.isArray(details.failures) ? details.failures[0] : undefined
    const statusHint = firstFailure?.status ? ` First status: ${firstFailure.status}.` : ''
    const rawHint = firstFailure?.raw ? ` First body: ${firstFailure.raw.slice(0, 120)}.` : ''
    return `${error.message}. Tried: ${preview}${details.attemptedUrls.length > 3 ? ', ...' : ''}.${statusHint}${rawHint}`
  }

  return error.message
}

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
    customerScopeId: sessionInfo?.customerScopeId?.toString()?.trim() || null,
    activeTenantUserGroupId,
    activeTenantLabel:
      sessionInfo?.activeTenantLabel?.toString()?.trim() ||
      activeTenant?.label ||
      (activeTenantUserGroupId ? activeTenantUserGroupId : null),
    availableTenants,
  }
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

  return {
    canViewTenantSettings: isAuthenticated && (canViewActiveTenantData || isSuperAdmin),
    canRunActiveTenantReconciliation,
    canEditTenantSettings: canEditActiveTenantData || isSuperAdmin,
    canManageGlobalSettings: canManageDarpanCore,
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
  // Single in-flight ensureAuthenticated promise. Without this, concurrent 401 callbacks (e.g.
  // every page-init API call fans out and all 401 at once) each schedule their own getSessionInfo
  // call, stampeding the auth endpoint and producing flicker in the UI status. Mirror the
  // _hydrationPromise pattern in referenceData store.
  let _ensureAuthInFlight: Promise<boolean> | null = null

  const checked = computed(() => _checked.value)
  const error = computed(() => _error.value)
  const status = computed(() => _status.value)
  const sessionInfo = computed(() => _sessionInfo.value)
  const authenticated = computed(() => _status.value === 'authenticated')
  const userId = computed(() => _sessionInfo.value?.userId ?? null)
  const username = computed(() => _sessionInfo.value?.username ?? _sessionInfo.value?.userId ?? null)

  function _applyAuthState(nextState: {
    status: AuthStatus
    error?: string | null
    sessionInfo?: SessionInfo | null
  }): void {
    _checked.value = true
    _status.value = nextState.status
    _error.value = nextState.error ?? null
    _sessionInfo.value = nextState.sessionInfo ?? null
  }

  function _applyAuthenticatedSession(sessionInfoArg: SessionInfo | null | undefined, errorMsg: string | null = null): void {
    _applyAuthState({
      status: 'authenticated',
      error: errorMsg,
      sessionInfo: normalizeSessionInfo(sessionInfoArg),
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

        const formattedError = err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err)
        _applyAuthState({ status: 'verification-failed', error: formattedError })
        return false
      } finally {
        _ensureAuthInFlight = null
      }
    })()
    _ensureAuthInFlight = inFlight
    return inFlight
  }

  // Called by App.vue when another tab mutates the auth-token localStorage key. If the token is
  // gone we treat it as a peer-initiated logout (clear local state + caches, no server call —
  // the other tab already called logoutSession). If the token rotated we force-revalidate so we
  // pick up the new user's sessionInfo rather than continuing to render the previous user's UI.
  function handleExternalAuthChange(): void {
    let storedToken: string | null = null
    try {
      storedToken = window.localStorage.getItem('darpan.authToken')
    } catch {
      storedToken = null
    }
    if (!storedToken) {
      clearApiResponseCache()
      _checked.value = true
      _status.value = 'unauthenticated'
      _sessionInfo.value = null
      _error.value = null
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

    try {
      const response = await authFacade.loginSession(usernameArg, password)
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
        error: err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err),
      })
      return false
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
        error: err instanceof ApiCallError ? formatApiError(err) : 'Logout failed',
      })
      return false
    }
  }

  async function saveActiveTenant(activeTenantUserGroupId: string): Promise<boolean> {
    if (authBypass) {
      clearApiResponseCache()
      _hydrateReferenceData()
      return true
    }

    try {
      const response: SaveActiveTenantResponse = await authFacade.saveActiveTenant(activeTenantUserGroupId)
      if (response.authenticated) {
        const errorMessage = response.ok ? null : response.errors?.[0] ?? 'Unable to switch tenant.'
        if (response.ok) clearApiResponseCache()
        _applyAuthenticatedSession(response.sessionInfo, errorMessage)
        if (response.ok) _hydrateReferenceData()
        return response.ok
      }

      clearAuthToken()
      clearApiResponseCache()
      _applyAuthState({
        status: 'unauthenticated',
        error: response.errors?.[0] ?? 'Authentication required to change the active tenant.',
      })
      return false
    } catch (err) {
      if (err instanceof ApiCallError && err.status === 401) {
        clearAuthToken()
        clearApiResponseCache()
        _applyAuthState({ status: 'unauthenticated', error: err.message })
        return false
      }

      _applyAuthState({
        status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
        error: err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err),
        sessionInfo: _sessionInfo.value,
      })
      return false
    }
  }

  async function saveUserSettings(payload: { displayName?: string }): Promise<boolean> {
    if (authBypass) {
      _applyAuthState({
        status: 'authenticated',
        sessionInfo: {
          ..._sessionInfo.value,
          userId: _sessionInfo.value?.userId ?? 'local-dev',
          username: _sessionInfo.value?.username ?? 'local-dev',
          displayName: payload.displayName?.toString()?.trim() || _sessionInfo.value?.username || 'local-dev',
        },
      })
      return true
    }

    try {
      const response: SaveUserSettingsResponse = await authFacade.saveUserSettings(payload)
      if (response.authenticated) {
        const errorMessage = response.ok ? null : response.errors?.[0] ?? 'Unable to save user settings.'
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
      if (err instanceof ApiCallError && err.status === 401) {
        clearAuthToken()
        _applyAuthState({ status: 'unauthenticated', error: err.message })
        return false
      }

      _applyAuthState({
        status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
        error: err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err),
        sessionInfo: _sessionInfo.value,
      })
      return false
    }
  }

  async function saveTenantSettings(payload: { timeZone?: string }): Promise<SaveTenantSettingsResponse | null> {
    if (authBypass) {
      const timeZone = payload.timeZone?.toString()?.trim() || _sessionInfo.value?.timeZone || 'UTC'
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
        },
      }
    }

    try {
      const response = await settingsFacade.saveTenantSettings(payload)
      if (response.ok && response.tenantSettings?.timeZone && _sessionInfo.value) {
        _applyAuthenticatedSession({
          ..._sessionInfo.value,
          timeZone: response.tenantSettings.timeZone,
        })
        try {
          useReferenceDataStore().setTenantSettings(response.tenantSettings)
        } catch {
          // ignore — store optional in some test contexts
        }
      } else if (!response.ok) {
        _applyAuthState({
          status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
          error: response.errors?.[0] ?? 'Unable to save tenant settings.',
          sessionInfo: _sessionInfo.value,
        })
      }
      return response
    } catch (err) {
      if (err instanceof ApiCallError && err.status === 401) {
        clearAuthToken()
        _applyAuthState({ status: 'unauthenticated', error: err.message })
        return null
      }

      _applyAuthState({
        status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
        error: err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err),
        sessionInfo: _sessionInfo.value,
      })
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
      if (err instanceof ApiCallError && err.status === 401) {
        clearAuthToken()
        _applyAuthState({ status: 'unauthenticated', error: err.message })
        return false
      }

      _applyAuthState({
        status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
        error: err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err),
        sessionInfo: _sessionInfo.value,
      })
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
      if (err instanceof ApiCallError && err.status === 401) {
        clearAuthToken()
        _applyAuthState({ status: 'unauthenticated', error: err.message })
        return false
      }

      _applyAuthState({
        status: _status.value === 'authenticated' ? 'authenticated' : 'verification-failed',
        error: err instanceof ApiCallError ? formatApiError(err) : buildContractViolationError(err),
        sessionInfo: _sessionInfo.value,
      })
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
    ensureAuthenticated,
    handleExternalAuthChange,
    loginWithCredentials,
    logoutSession,
    saveActiveTenant,
    saveUserSettings,
    saveTenantSettings,
    changeOwnPassword,
    verifyOwnPassword,
  }
})
