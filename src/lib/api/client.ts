import type { ApiEnvelope, AuthTokenContract } from './types'
import { isIdempotentReadMethod, retryRead } from './retry'

interface JsonRpcRequest {
  jsonrpc: '2.0'
  id: number
  method: string
  params: object
}

interface JsonRpcResponse<T> {
  jsonrpc: '2.0'
  id: number
  result?: T
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

export class ApiCallError extends Error {
  status?: number
  details?: unknown

  constructor(message: string, status?: number, details?: unknown) {
    super(message)
    this.name = 'ApiCallError'
    this.status = status
    this.details = details
  }
}

/** True for a fetch aborted via AbortController — callers treat these as "no-op", not failure. */
export function isAbortError(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === 'AbortError'
}

export interface AuthRequiredDetail {
  /** Raw backend text, for diagnostics only — never rendered (see AuthRequiredError). */
  message: string
  method: string
  candidateUrl: string
  status?: number
  /**
   * True once the one recovery retry has already been spent on this request. The handler must
   * stop re-probing the session and send the user to sign in: a session that re-verifies as
   * valid but still cannot call a service is not a usable session.
   */
  recoveryExhausted: boolean
}

// AuthRequiredError extends ApiCallError so existing `instanceof ApiCallError`
// catch sites (status === 401 branches) keep working unchanged.
export class AuthRequiredError extends ApiCallError {
  detail: AuthRequiredDetail
  /** True when the handler re-verified the session and reported it usable again. */
  recovered: boolean

  constructor(detail: AuthRequiredDetail, details?: Record<string, unknown>, recovered = false) {
    // Always the friendly text: ~85 call sites render `err.message` directly, and the backend's
    // wording is an internal service name ("User must be logged in to call service facade.X.y#Z").
    // The raw text stays on `detail.message` for diagnostics.
    super(AUTH_REQUIRED_MESSAGE, 401, details)
    this.name = 'AuthRequiredError'
    this.detail = detail
    this.recovered = recovered
  }
}

/** Returns true when the session was re-verified as usable, meaning the caller should retry. */
type AuthRequiredHandler = (detail: AuthRequiredDetail) => boolean | void | Promise<boolean | void>

let authRequiredHandler: AuthRequiredHandler | null = null

export function setAuthRequiredHandler(handler: AuthRequiredHandler | null): void {
  authRequiredHandler = handler
}

const AUTH_REQUIRED_MESSAGE = 'Your session has ended. Sign in again to continue.'
const UNREACHABLE_MESSAGE = 'Unable to connect to Darpan right now. Try again in a moment.'
const UNEXPECTED_RESPONSE_MESSAGE = 'Darpan returned an unexpected response. Try again in a moment.'
const EMPTY_RESULT_MESSAGE = 'Darpan did not return any data.'
const GENERIC_SERVICE_ERROR_MESSAGE = 'Darpan could not complete the request.'
const AUTH_SESSION_INFO_METHOD = 'facade.AuthFacadeServices.get#SessionInfo'
const AUTH_TOKEN_STORAGE_KEY = 'darpan.authToken'
const AUTH_TOKEN_HEADER_NAME = 'login_key'
const CSRF_TOKEN_STORAGE_KEY = 'darpan.csrfToken'
const COOKIE_AUTH = import.meta.env.VITE_DARPAN_COOKIE_AUTH === 'true'

interface StoredAuthToken {
  value: string
  headerName: string
  tokenType: string | null
  expiresAt: number | null
}

const rawApiBase =
  import.meta.env.VITE_DARPAN_API_BASE_URL ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8080')
const apiBase = rawApiBase.replace(/\/$/, '')

function resolveApiOrigin(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    if (typeof window !== 'undefined') {
      return window.location.origin
    }
    return value.replace(/\/$/, '')
  }
}

function resolveRpcUrl(value: string): string {
  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value
  }

  const apiOrigin = resolveApiOrigin(apiBase)
  if (value.startsWith('/')) {
    return `${apiOrigin}${value}`
  }

  return `${apiOrigin}/${value}`
}

function getOriginFromUrl(value: string): string {
  try {
    return new URL(value).origin
  } catch {
    return resolveApiOrigin(apiBase)
  }
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1' || hostname === '[::1]'
}

function isLoopbackUrl(value: string): boolean {
  try {
    return isLoopbackHostname(new URL(value).hostname)
  } catch {
    return false
  }
}

function buildSameOriginProxyCandidates(): string[] {
  if (typeof window === 'undefined') return []
  const origin = window.location.origin.replace(/\/$/, '')
  return [`${origin}/rpc/json`]
}

function shouldPreferSameOriginProxy(targetUrl: string): boolean {
  if (typeof window === 'undefined' || !import.meta.env.DEV) return false
  if (!isLoopbackUrl(targetUrl) || !isLoopbackUrl(window.location.origin)) return false
  return getOriginFromUrl(targetUrl) !== window.location.origin
}

function buildRpcCandidates(): string[] {
  const configured = (import.meta.env.VITE_DARPAN_RPC_URL ?? '').trim()
  const candidates: string[] = []

  if (configured) {
    const configuredRpcUrl = resolveRpcUrl(configured)
    if (shouldPreferSameOriginProxy(configuredRpcUrl)) {
      candidates.push(...buildSameOriginProxyCandidates())
    }
    candidates.push(configuredRpcUrl)
  } else {
    const defaultRpcUrl = `${resolveApiOrigin(apiBase)}/rpc/json`
    if (shouldPreferSameOriginProxy(defaultRpcUrl)) {
      candidates.push(...buildSameOriginProxyCandidates())
    }
    candidates.push(defaultRpcUrl)
  }

  return Array.from(new Set(candidates.map((item) => item.replace(/\/$/, '')))).filter((item) => item.length > 0)
}

function normalizeTokenValue(value: unknown): string | null {
  const normalized = value?.toString()?.trim()
  if (!normalized || normalized.toLowerCase() === 'null' || normalized.toLowerCase() === 'undefined') {
    return null
  }
  return normalized
}

function normalizeHeaderName(value: unknown): string {
  const normalized = value?.toString()?.trim().toLowerCase()
  if (!normalized) return AUTH_TOKEN_HEADER_NAME
  return /^[a-z0-9][a-z0-9_-]{0,63}$/.test(normalized) ? normalized : AUTH_TOKEN_HEADER_NAME
}

function normalizeExpiryTimestamp(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  if (value <= 0) return null
  return Math.round(value)
}

function sanitizeStoredAuthToken(value: Partial<StoredAuthToken> | null | undefined): StoredAuthToken | null {
  const token = normalizeTokenValue(value?.value)
  if (!token) return null

  return {
    value: token,
    headerName: normalizeHeaderName(value?.headerName),
    tokenType: normalizeTokenValue(value?.tokenType),
    expiresAt: normalizeExpiryTimestamp(value?.expiresAt),
  }
}

// Audit #10: the bearer token lives in the in-memory `authTokenState` plus a sessionStorage backing
// (per-tab, cleared on tab close, never written to disk) — NOT localStorage. This removes the
// survives-browser-restart / persistent-on-disk property that let any XSS exfiltrate a durable
// session token. Durable cross-tab/cross-restart login is the job of the backend's httpOnly
// `darpan_login_key` cookie (cookie-migration follow-up), not JS-readable storage.
function getAuthTokenStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

// One-time cleanup: older builds persisted the token to localStorage, where it survived restarts and
// sat on disk. Remove it on load so a previously stored durable token does not linger after upgrade.
function purgeLegacyPersistentAuthToken(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // ignore storage failures
  }
}

function persistAuthTokenState(state: StoredAuthToken | null): void {
  const storage = getAuthTokenStorage()
  if (!storage) return
  try {
    if (state) {
      storage.setItem(AUTH_TOKEN_STORAGE_KEY, JSON.stringify(state))
    } else {
      storage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    }
  } catch {
    // ignore storage failures; the in-memory token state still works for the active session
  }
}

function loadStoredAuthTokenState(): StoredAuthToken | null {
  purgeLegacyPersistentAuthToken()
  const storage = getAuthTokenStorage()
  if (!storage) return null

  let rawValue: string | null = null
  try {
    rawValue = storage.getItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }

  const rawToken = normalizeTokenValue(rawValue)
  if (!rawToken) return null

  try {
    const parsed = JSON.parse(rawToken) as Partial<StoredAuthToken> | null
    const tokenState = sanitizeStoredAuthToken(parsed)
    if (!tokenState) {
      persistAuthTokenState(null)
      return null
    }
    if (tokenState.expiresAt != null && tokenState.expiresAt <= Date.now()) {
      persistAuthTokenState(null)
      return null
    }
    return tokenState
  } catch {
    persistAuthTokenState(null)
    return null
  }
}

function createAuthTokenState(token: string | null, contract: Partial<AuthTokenContract> = {}): StoredAuthToken | null {
  const normalizedToken = normalizeTokenValue(token)
  if (!normalizedToken) return null

  const expiresInSeconds =
    typeof contract.authTokenExpiresInSeconds === 'number' && Number.isFinite(contract.authTokenExpiresInSeconds)
      ? Math.max(0, Math.round(contract.authTokenExpiresInSeconds))
      : null

  return sanitizeStoredAuthToken({
    value: normalizedToken,
    headerName: contract.authTokenHeaderName,
    tokenType: contract.authTokenType,
    expiresAt: expiresInSeconds != null ? Date.now() + expiresInSeconds * 1000 : null,
  })
}

function getActiveAuthTokenState(): StoredAuthToken | null {
  if (authTokenState?.expiresAt != null && authTokenState.expiresAt <= Date.now()) {
    clearAuthToken()
  }
  return authTokenState
}

let authTokenState: StoredAuthToken | null = loadStoredAuthTokenState()

export function setAuthTokenContract(contract: Partial<AuthTokenContract> | null): void {
  if (COOKIE_AUTH) return // no-op: the HttpOnly darpan_login_key cookie is the credential
  authTokenState = createAuthTokenState(contract?.authToken ?? null, contract ?? {})
  persistAuthTokenState(authTokenState)
}

export function clearAuthToken(): void {
  authTokenState = null
  persistAuthTokenState(null)
  if (COOKIE_AUTH) clearCsrfToken()
}

export function getAuthToken(): string | null {
  return getActiveAuthTokenState()?.value ?? null
}

// ---- CSRF token (cookie-auth mode) ----
// Non-secret anti-CSRF token. Kept in memory + sessionStorage (per-tab, cleared on tab close).
// The actual session credential is the HttpOnly darpan_login_key cookie, which is not JS-readable.
function loadStoredCsrfToken(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(CSRF_TOKEN_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

let csrfTokenValue: string | null = loadStoredCsrfToken()

function getCsrfToken(): string | null {
  return csrfTokenValue
}

function setCsrfToken(value: string): void {
  csrfTokenValue = value
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(CSRF_TOKEN_STORAGE_KEY, value)
    }
  } catch {
    // ignore storage failures; the in-memory token still works for the active session
  }
}

function clearCsrfToken(): void {
  csrfTokenValue = null
  try {
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CSRF_TOKEN_STORAGE_KEY)
    }
  } catch {
    // ignore storage failures
  }
}

const rpcCandidates = buildRpcCandidates()
const rpcUrl = rpcCandidates[0] ?? `${resolveApiOrigin(apiBase)}/rpc/json`

function buildCsrfTokenUrl(): string {
  const apiOrigin = resolveApiOrigin(apiBase)
  const absoluteUrl = `${apiOrigin}/apps/darpan/csrfToken`
  if (shouldPreferSameOriginProxy(absoluteUrl) && typeof window !== 'undefined') {
    return `${window.location.origin.replace(/\/$/, '')}/apps/darpan/csrfToken`
  }
  return absoluteUrl
}

const csrfTokenUrl = buildCsrfTokenUrl()

let csrfBootstrapInProgress = false

// Fetches and caches the CSRF token from the backend's bootstrap endpoint.
// Only used in cookie-auth mode; guards against concurrent bootstrap attempts and recursion.
async function ensureCsrfToken(): Promise<void> {
  if (csrfTokenValue != null || csrfBootstrapInProgress) return
  csrfBootstrapInProgress = true
  try {
    const response = await fetch(csrfTokenUrl, {
      method: 'GET',
      credentials: 'include',
    })
    // Prefer the response header; fall back to parsing the JSON body.
    const headerToken = response.headers.get('X-CSRF-Token') ?? response.headers.get('moquiSessionToken')
    if (headerToken) {
      setCsrfToken(headerToken)
    } else if (response.ok) {
      try {
        const data = (await response.json()) as { moquiSessionToken?: string }
        if (data.moquiSessionToken) {
          setCsrfToken(data.moquiSessionToken)
        }
      } catch {
        // ignore JSON parse failures
      }
    }
  } catch {
    // ignore network failures; the request proceeds without a CSRF token and will fail
    // with a 401 if the backend requires it, which is handled by the auth-required path
  } finally {
    csrfBootstrapInProgress = false
  }
}

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  if (COOKIE_AUTH) {
    // In cookie-auth mode: send the non-secret CSRF token; the HttpOnly cookie is the credential.
    const csrf = getCsrfToken()
    if (csrf) {
      headers['X-CSRF-Token'] = csrf
    }
  } else {
    const tokenState = getActiveAuthTokenState()
    if (tokenState) {
      headers[tokenState.headerName] = tokenState.value
    }
  }

  return headers
}

function normalizeEnvelope(result: unknown): ApiEnvelope {
  const payload = result as Partial<ApiEnvelope>
  return {
    ok: payload.ok !== false,
    messages: Array.isArray(payload.messages) ? payload.messages.map((item) => String(item)) : [],
    errors: Array.isArray(payload.errors) ? payload.errors.map((item) => String(item)) : [],
  }
}

function isAuthRequiredMessage(message: string | null | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return (
    normalized.includes('user must be logged in') ||
    normalized.includes('no active authenticated session') ||
    normalized.includes('authentication required') ||
    normalized.includes('login key not valid') ||
    normalized.includes('login key expired') ||
    normalized.includes('session token required') ||
    normalized.includes('session token does not match')
  )
}

function looksLikeLoginHtml(body: string | null | undefined): boolean {
  if (!body) return false
  const normalized = body.toLowerCase()
  return (
    normalized.includes('<title>login') ||
    normalized.includes('name="username"') ||
    normalized.includes('name="password"') ||
    normalized.includes('moquisessiontoken') ||
    normalized.includes('sign in')
  )
}

function shouldNotifyAuthRequired(method: string): boolean {
  return method !== AUTH_SESSION_INFO_METHOD
}

async function notifyAuthRequired(detail: AuthRequiredDetail): Promise<boolean> {
  if (!authRequiredHandler) return false
  try {
    return (await authRequiredHandler(detail)) === true
  } catch {
    // A handler that blows up must not mask the auth failure it was told about.
    return false
  }
}

function withMethodDetails(method: string, details: Record<string, unknown>): Record<string, unknown> {
  return {
    method,
    ...details,
  }
}

async function dispatchService<T>(
  method: string,
  params: object,
  signal?: AbortSignal,
  recoveryExhausted = false,
): Promise<T> {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
  }

  // In cookie-auth mode, ensure we have a CSRF token before posting.
  if (COOKIE_AUTH && !getCsrfToken()) {
    await ensureCsrfToken()
  }

  const parseFailures: Array<{ url: string; status?: number; raw?: string; error?: unknown }> = []

  for (const candidateUrl of rpcCandidates) {
    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError')
    }

    let response: Response
    try {
      response = await fetch(candidateUrl, {
        method: 'POST',
        headers: buildHeaders(),
        credentials: COOKIE_AUTH ? 'include' : 'omit',
        body: JSON.stringify(request),
        signal,
      })
    } catch (error) {
      if ((error as { name?: string })?.name === 'AbortError') {
        throw error
      }
      parseFailures.push({
        url: candidateUrl,
        error,
      })
      continue
    }

    // Capture and refresh the CSRF token from the response header when in cookie-auth mode.
    if (COOKIE_AUTH) {
      const freshCsrf = response.headers.get('X-CSRF-Token') ?? response.headers.get('moquiSessionToken')
      if (freshCsrf) setCsrfToken(freshCsrf)
    }

    const bodyText = await response.text()

    let parsed: JsonRpcResponse<T>
    try {
      parsed = JSON.parse(bodyText) as JsonRpcResponse<T>
    } catch (error) {
      parseFailures.push({
        url: candidateUrl,
        status: response.status,
        raw: bodyText.slice(0, 400),
        error,
      })
      continue
    }

    if (!response.ok) {
      const message = parsed.error?.message ?? `Request failed with status ${response.status}`
      const authRequired = response.status === 401 || isAuthRequiredMessage(message)
      if (authRequired) {
        clearAuthToken()
        const details = withMethodDetails(method, { candidateUrl, data: parsed.error?.data })
        if (shouldNotifyAuthRequired(method)) {
          const detail: AuthRequiredDetail = { message, method, candidateUrl, status: 401, recoveryExhausted }
          const recovered = await notifyAuthRequired(detail)
          throw new AuthRequiredError(detail, details, recovered)
        }
        throw new ApiCallError(message, 401, details)
      }

      throw new ApiCallError(
        message,
        response.status,
        withMethodDetails(method, { candidateUrl, data: parsed.error?.data }),
      )
    }

    if (parsed.error) {
      const authRequired = response.status === 401 || isAuthRequiredMessage(parsed.error.message)
      if (authRequired) {
        clearAuthToken()
        const details = withMethodDetails(method, { candidateUrl, data: parsed.error.data })
        if (shouldNotifyAuthRequired(method)) {
          const detail: AuthRequiredDetail = { message: parsed.error.message, method, candidateUrl, status: 401, recoveryExhausted }
          const recovered = await notifyAuthRequired(detail)
          throw new AuthRequiredError(detail, details, recovered)
        }
        throw new ApiCallError(parsed.error.message, 401, details)
      }

      throw new ApiCallError(
        parsed.error.message,
        response.status,
        withMethodDetails(method, { candidateUrl, data: parsed.error.data }),
      )
    }

    const result = parsed.result
    if (!result) {
      throw new ApiCallError(EMPTY_RESULT_MESSAGE, response.status, withMethodDetails(method, { candidateUrl }))
    }

    const envelope = normalizeEnvelope(result)
    if (!envelope.ok || envelope.errors.length > 0) {
      const message = envelope.errors[0] ?? GENERIC_SERVICE_ERROR_MESSAGE
      const authRequired = isAuthRequiredMessage(message)
      if (authRequired) {
        clearAuthToken()
        const details = withMethodDetails(method, { candidateUrl, result })
        if (shouldNotifyAuthRequired(method)) {
          const detail: AuthRequiredDetail = { message, method, candidateUrl, status: 401, recoveryExhausted }
          const recovered = await notifyAuthRequired(detail)
          throw new AuthRequiredError(detail, details, recovered)
        }
        throw new ApiCallError(message, 401, details)
      }

      throw new ApiCallError(
        message,
        response.status,
        withMethodDetails(method, { candidateUrl, result }),
      )
    }

    return result
  }

  const attemptedUrls = rpcCandidates
  const allUnreachable = parseFailures.length > 0 && parseFailures.every((failure) => failure.status == null)
  const authLikeFailure = parseFailures.find((failure) => {
    const raw = failure.raw?.toLowerCase() ?? ''
    return (
      failure.status === 401 ||
      raw.includes('authentication required') ||
      raw.includes('user must be logged in') ||
      raw.includes('login key not valid') ||
      raw.includes('login key expired') ||
      looksLikeLoginHtml(raw)
    )
  })

  if (authLikeFailure) {
    clearAuthToken()
    const details = withMethodDetails(method, {
      attemptedUrls,
      failures: parseFailures,
    })
    if (shouldNotifyAuthRequired(method)) {
      const detail: AuthRequiredDetail = {
        message: AUTH_REQUIRED_MESSAGE,
        method,
        candidateUrl: authLikeFailure.url,
        status: authLikeFailure.status ?? 401,
        recoveryExhausted,
      }
      const recovered = await notifyAuthRequired(detail)
      throw new AuthRequiredError(detail, details, recovered)
    }

    throw new ApiCallError(AUTH_REQUIRED_MESSAGE, 401, details)
  }

  if (allUnreachable) {
    throw new ApiCallError(
      UNREACHABLE_MESSAGE,
      503,
      withMethodDetails(method, {
        attemptedUrls,
        failures: parseFailures,
      }),
    )
  }

  throw new ApiCallError(
    UNEXPECTED_RESPONSE_MESSAGE,
    502,
    withMethodDetails(method, {
      attemptedUrls,
      failures: parseFailures,
    }),
  )
}

// Only retry on raw network/transport errors (TypeError, DOMException).
// ApiCallError (including AuthRequiredError) means the server replied — no point retrying.
// AbortError means the caller cancelled the request — propagate immediately, never retry.
function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof ApiCallError) return false
  if (err instanceof DOMException && err.name === 'AbortError') return false
  return true
}

// Moqui gates `authenticate="true"` in ServiceCallSyncImpl BEFORE the service body runs, so a
// call rejected with "User must be logged in" had no side effects. Replaying it is therefore safe
// for writes too, which is why this sits outside the reads-only retryRead below.
async function dispatchWithAuthRecovery<T>(method: string, params: object, signal?: AbortSignal): Promise<T> {
  try {
    return await dispatchService<T>(method, params, signal)
  } catch (error) {
    if (!(error instanceof AuthRequiredError) || !error.recovered) throw error
    // Exactly one replay: an error from this call escapes the catch it was thrown in.
    return dispatchService<T>(method, params, signal, true)
  }
}

export async function callService<T>(method: string, params: object = {}, signal?: AbortSignal): Promise<T> {
  const doRequest = () => dispatchWithAuthRecovery<T>(method, params, signal)
  return isIdempotentReadMethod(method)
    ? retryRead(doRequest, { shouldRetry: isTransientNetworkError }) // reads: retry transient network errors only
    : doRequest()                                                      // writes: exactly once, apart from the auth replay above
}

export function getRpcUrl(): string {
  return rpcUrl
}
