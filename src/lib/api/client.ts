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

export interface AuthRequiredDetail {
  message: string
  method: string
  candidateUrl: string
  status?: number
}

// AuthRequiredError extends ApiCallError so existing `instanceof ApiCallError`
// catch sites (status === 401 branches) keep working unchanged.
export class AuthRequiredError extends ApiCallError {
  detail: AuthRequiredDetail

  constructor(detail: AuthRequiredDetail, details?: Record<string, unknown>) {
    super(detail.message, 401, details)
    this.name = 'AuthRequiredError'
    this.detail = detail
  }
}

type AuthRequiredHandler = (detail: AuthRequiredDetail) => void

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

export function setAuthToken(token: string | null): void {
  authTokenState = createAuthTokenState(token)
  persistAuthTokenState(authTokenState)
}

export function setAuthTokenContract(contract: Partial<AuthTokenContract> | null): void {
  authTokenState = createAuthTokenState(contract?.authToken ?? null, contract ?? {})
  persistAuthTokenState(authTokenState)
}

export function clearAuthToken(): void {
  authTokenState = null
  persistAuthTokenState(null)
}

export function getAuthToken(): string | null {
  return getActiveAuthTokenState()?.value ?? null
}

const rpcCandidates = buildRpcCandidates()
const rpcUrl = rpcCandidates[0] ?? `${resolveApiOrigin(apiBase)}/rpc/json`

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const tokenState = getActiveAuthTokenState()
  if (tokenState) {
    headers[tokenState.headerName] = tokenState.value
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
    normalized.includes('login key expired')
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

function notifyAuthRequired(detail: AuthRequiredDetail): void {
  authRequiredHandler?.(detail)
}

function withMethodDetails(method: string, details: Record<string, unknown>): Record<string, unknown> {
  return {
    method,
    ...details,
  }
}

async function dispatchService<T>(method: string, params: object, signal?: AbortSignal): Promise<T> {
  const request: JsonRpcRequest = {
    jsonrpc: '2.0',
    id: Date.now(),
    method,
    params,
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
        credentials: 'omit',
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
          const detail: AuthRequiredDetail = { message, method, candidateUrl, status: 401 }
          notifyAuthRequired(detail)
          throw new AuthRequiredError(detail, details)
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
          const detail: AuthRequiredDetail = { message: parsed.error.message, method, candidateUrl, status: 401 }
          notifyAuthRequired(detail)
          throw new AuthRequiredError(detail, details)
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
          const detail: AuthRequiredDetail = { message, method, candidateUrl, status: 401 }
          notifyAuthRequired(detail)
          throw new AuthRequiredError(detail, details)
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
      }
      notifyAuthRequired(detail)
      throw new AuthRequiredError({ ...detail, message: AUTH_REQUIRED_MESSAGE }, details)
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
function isTransientNetworkError(err: unknown): boolean {
  if (err instanceof ApiCallError) return false
  return true
}

export async function callService<T>(method: string, params: object = {}, signal?: AbortSignal): Promise<T> {
  const doRequest = () => dispatchService<T>(method, params, signal)
  return isIdempotentReadMethod(method)
    ? retryRead(doRequest, { shouldRetry: isTransientNetworkError }) // reads: retry transient network errors only
    : doRequest()                                                      // writes: exactly once, never retried
}

export function getRpcUrl(): string {
  return rpcUrl
}
