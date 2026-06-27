import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../../test/localStorage'

describe('callService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
    window.history.replaceState({}, '', '/login')
    installLocalStorageStub()
  })

  it('sends the configured auth header and omits credentialed fetches', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            ok: true,
            messages: [],
            errors: [],
            authenticated: true,
            sessionInfo: {
              userId: 'john.doe',
              username: 'john.doe',
            },
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    const { callService, setAuthTokenContract } = await import('../client')
    setAuthTokenContract({
      authToken: 'token-123',
      authTokenHeaderName: 'login_key',
      authTokenType: 'LOGIN_KEY',
      authTokenExpiresInSeconds: 3600,
    })

    const result = await callService<{
      authenticated: boolean
      sessionInfo?: { userId: string }
    }>('facade.AuthFacadeServices.get#SessionInfo')

    expect(result.authenticated).toBe(true)
    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> }
    expect(requestInit.credentials).toBe('omit')
    expect(requestInit.headers.login_key).toBe('token-123')
  })

  it('drops expired auth tokens before sending a request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            ok: true,
            messages: [],
            errors: [],
            authenticated: false,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    window.sessionStorage.setItem(
      'darpan.authToken',
      JSON.stringify({
        value: 'expired-token',
        headerName: 'login_key',
        tokenType: 'LOGIN_KEY',
        expiresAt: Date.now() - 1000,
      }),
    )

    vi.resetModules()
    const { callService: callWithExpiredToken, getAuthToken } = await import('../client')
    await callWithExpiredToken('facade.AuthFacadeServices.get#SessionInfo')

    const requestInit = fetchMock.mock.calls[0]?.[1] as RequestInit & { headers: Record<string, string> }
    expect(requestInit.headers.login_key).toBeUndefined()
    expect(getAuthToken()).toBeNull()
    expect(window.sessionStorage.getItem('darpan.authToken')).toBeNull()
  })

  it('clears the stored auth token when the backend rejects it', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          result: {
            ok: false,
            messages: [],
            errors: ['Login key expired'],
            authenticated: false,
          },
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
          },
        },
      ),
    )

    vi.stubGlobal('fetch', fetchMock)

    const { callService, getAuthToken, setAuthToken } = await import('../client')
    setAuthToken('expired-token')

    await expect(callService('facade.AuthFacadeServices.get#SessionInfo')).rejects.toMatchObject({
      name: 'ApiCallError',
      message: 'Login key expired',
      status: 401,
    })
    expect(getAuthToken()).toBeNull()
    expect(window.sessionStorage.getItem('darpan.authToken')).toBeNull()
  })

  it('persists the bearer token to sessionStorage and never localStorage (audit #10)', async () => {
    const { setAuthToken, getAuthToken } = await import('../client')
    setAuthToken('token-xyz')

    expect(getAuthToken()).toBe('token-xyz')
    // Survives a same-tab refresh (sessionStorage) but is never written to disk (localStorage).
    expect(JSON.parse(window.sessionStorage.getItem('darpan.authToken') ?? 'null')).toMatchObject({
      value: 'token-xyz',
    })
    expect(window.localStorage.getItem('darpan.authToken')).toBeNull()
  })

  it('purges a legacy localStorage bearer token on load (audit #10)', async () => {
    window.localStorage.setItem(
      'darpan.authToken',
      JSON.stringify({ value: 'legacy-token', headerName: 'login_key', tokenType: 'LOGIN_KEY', expiresAt: null }),
    )

    vi.resetModules()
    const { getAuthToken } = await import('../client')

    // The persistent on-disk token from an older build is removed; it is not adopted as the session.
    expect(window.localStorage.getItem('darpan.authToken')).toBeNull()
    expect(getAuthToken()).toBeNull()
  })

  it('returns a friendly unreachable message for a configured rpc endpoint', async () => {
    vi.stubEnv('VITE_DARPAN_API_BASE_URL', 'https://customer.example.com')
    vi.stubEnv('VITE_DARPAN_RPC_URL', 'https://customer.example.com/rpc/json')

    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const { callService } = await import('../client')

    await expect(callService('facade.AuthFacadeServices.get#SessionInfo')).rejects.toMatchObject({
      name: 'ApiCallError',
      message: 'Unable to connect to Darpan right now. Try again in a moment.',
      status: 503,
    })
    expect(fetchMock).toHaveBeenCalled()
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://customer.example.com/rpc/json')
  })

  it('prefers the same-origin Vite proxy for configured loopback rpc targets in local dev', async () => {
    vi.stubEnv('VITE_DARPAN_API_BASE_URL', 'http://localhost:8080')
    vi.stubEnv('VITE_DARPAN_RPC_URL', 'http://localhost:8080/rpc/json')
    window.history.replaceState({}, '', '/login')

    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const { callService, getRpcUrl } = await import('../client')

    let error: unknown
    try {
      await callService('facade.AuthFacadeServices.get#SessionInfo')
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).toMatchObject({
      name: 'ApiCallError',
      message: 'Unable to connect to Darpan right now. Try again in a moment.',
    })
    const expectedProxyUrl = `${window.location.origin}/rpc/json`
    expect(getRpcUrl()).toBe(expectedProxyUrl)
    expect(fetchMock.mock.calls[0]?.[0]).toBe(expectedProxyUrl)
    expect(fetchMock.mock.calls[1]?.[0]).toBe('http://localhost:8080/rpc/json')
  })

  it('does not probe unrelated remote rpc urls when VITE_DARPAN_RPC_URL is explicitly configured', async () => {
    vi.stubEnv('VITE_DARPAN_API_BASE_URL', 'https://customer.example.com')
    vi.stubEnv('VITE_DARPAN_RPC_URL', 'https://customer.example.com/rpc/json')

    const fetchMock = vi.fn().mockRejectedValue(new Error('connect ECONNREFUSED'))
    vi.stubGlobal('fetch', fetchMock)

    const { callService } = await import('../client')

    let error: unknown
    try {
      await callService('facade.AuthFacadeServices.get#SessionInfo')
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).toMatchObject({
      name: 'ApiCallError',
      message: 'Unable to connect to Darpan right now. Try again in a moment.',
    })
    expect((error as { message: string }).message).not.toContain('facade.AuthFacadeServices')
    expect((error as { details?: unknown }).details).toMatchObject({
      method: 'facade.AuthFacadeServices.get#SessionInfo',
    })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://customer.example.com/rpc/json')
  })

  it('does not retry an aborted read — dispatches fn exactly once and propagates AbortError', async () => {
    vi.stubEnv('VITE_DARPAN_API_BASE_URL', 'https://customer.example.com')
    vi.stubEnv('VITE_DARPAN_RPC_URL', 'https://customer.example.com/rpc/json')

    const abortError = new DOMException('The operation was aborted.', 'AbortError')
    const fetchMock = vi.fn().mockRejectedValue(abortError)
    vi.stubGlobal('fetch', fetchMock)

    const { callService } = await import('../client')

    await expect(callService('facade.AuthFacadeServices.get#SessionInfo')).rejects.toThrow('The operation was aborted.')
    // fetch is called exactly once — no retry
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('does not invoke the auth-required handler for get#SessionInfo failures', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('<html><title>Login</title></html>', {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      }),
    )

    vi.stubGlobal('fetch', fetchMock)

    const { callService, setAuthRequiredHandler } = await import('../client')
    const authRequiredHandler = vi.fn()
    setAuthRequiredHandler(authRequiredHandler)

    let error: unknown
    try {
      await callService('facade.AuthFacadeServices.get#SessionInfo')
    } catch (caughtError) {
      error = caughtError
    }

    expect(error).toMatchObject({
      name: 'ApiCallError',
      message: 'Your session has ended. Sign in again to continue.',
    })
    expect((error as { details?: unknown }).details).toMatchObject({
      method: 'facade.AuthFacadeServices.get#SessionInfo',
    })
    expect(authRequiredHandler).not.toHaveBeenCalled()
    setAuthRequiredHandler(null)
  })
})
