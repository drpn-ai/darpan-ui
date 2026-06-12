import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../test/localStorage'

const getSessionInfo = vi.hoisted(() => vi.fn())
const loginSession = vi.hoisted(() => vi.fn())
const saveActiveTenantRpc = vi.hoisted(() => vi.fn())
const saveTenantSettingsRpc = vi.hoisted(() => vi.fn())
const saveUserSettingsRpc = vi.hoisted(() => vi.fn())
const verifyOwnPasswordRpc = vi.hoisted(() => vi.fn())
const changeOwnPasswordRpc = vi.hoisted(() => vi.fn())
const logoutSessionRpc = vi.hoisted(() => vi.fn())
const clearApiResponseCache = vi.hoisted(() => vi.fn())

vi.mock('../api/facade', () => ({
  clearApiResponseCache,
  authFacade: {
    getSessionInfo,
    loginSession,
    saveActiveTenant: saveActiveTenantRpc,
    saveUserSettings: saveUserSettingsRpc,
    verifyOwnPassword: verifyOwnPasswordRpc,
    changeOwnPassword: changeOwnPasswordRpc,
    logoutSession: logoutSessionRpc,
  },
  settingsFacade: {
    saveTenantSettings: saveTenantSettingsRpc,
  },
}))

describe('auth state', () => {
  beforeEach(() => {
    vi.resetModules()
    getSessionInfo.mockReset()
    loginSession.mockReset()
    saveActiveTenantRpc.mockReset()
    saveTenantSettingsRpc.mockReset()
    saveUserSettingsRpc.mockReset()
    verifyOwnPasswordRpc.mockReset()
    changeOwnPasswordRpc.mockReset()
    logoutSessionRpc.mockReset()
    clearApiResponseCache.mockReset()
    installLocalStorageStub()
  })

  it('starts unchecked before backend verification runs', async () => {
    const { useAuthState } = await import('../auth')

    expect(useAuthState().checked).toBe(false)
    expect(useAuthState().authenticated).toBe(false)
    expect(useAuthState().userId).toBeNull()
    expect(useAuthState().username).toBeNull()
  })

  it('treats backend session info as the source of truth on the first auth check', async () => {
    getSessionInfo.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })

    const { ensureAuthenticated, useAuthState } = await import('../auth')

    await expect(ensureAuthenticated()).resolves.toBe(true)
    expect(getSessionInfo).toHaveBeenCalledTimes(1)
    expect(useAuthState().authenticated).toBe(true)
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().userId).toBe('backend-user')
    expect(useAuthState().username).toBe('backend')
    expect(useAuthState().sessionInfo?.scopeType).toBe('TENANT')
    expect(useAuthState().sessionInfo?.activeTenantUserGroupId).toBe('KREWE')
  })

  it('stores the explicit auth token contract on login and clears it on logout', async () => {
    loginSession.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      authToken: 'login-token-123',
      authTokenType: 'LOGIN_KEY',
      authTokenHeaderName: 'login_key',
      authTokenExpiresInSeconds: 7200,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })
    logoutSessionRpc.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: false,
      authTokenRevoked: true,
    })

    const { getAuthToken } = await import('../api/client')
    const { loginWithCredentials, logoutSession, useAuthState } = await import('../auth')

    await expect(loginWithCredentials('backend', 'secret')).resolves.toBe(true)
    expect(getAuthToken()).toBe('login-token-123')
    // Audit #10: the bearer token is held in sessionStorage (per-tab, off-disk), never localStorage.
    expect(JSON.parse(window.sessionStorage.getItem('darpan.authToken') ?? '{}')).toMatchObject({
      value: 'login-token-123',
      headerName: 'login_key',
      tokenType: 'LOGIN_KEY',
    })
    expect(window.localStorage.getItem('darpan.authToken')).toBeNull()

    await expect(logoutSession()).resolves.toBe(true)
    expect(logoutSessionRpc).toHaveBeenCalledTimes(1)
    expect(getAuthToken()).toBeNull()
    expect(useAuthState().authenticated).toBe(false)
    expect(useAuthState().status).toBe('unauthenticated')
    expect(useAuthState().error).toBeNull()
    expect(clearApiResponseCache).toHaveBeenCalledTimes(2)
  })

  it('updates the authenticated session when the active tenant changes', async () => {
    saveActiveTenantRpc.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        scopeType: 'TENANT',
        customerScopeId: 'GORJANA',
        activeTenantUserGroupId: 'GORJANA',
        activeTenantLabel: 'Gorjana',
        availableTenants: [
          { userGroupId: 'GORJANA', label: 'Gorjana' },
          { userGroupId: 'KREWE', label: 'Krewe' },
        ],
        isSuperAdmin: false,
      },
    })

    const { saveActiveTenant, useAuthState } = await import('../auth')

    await expect(saveActiveTenant('GORJANA')).resolves.toBe(true)
    expect(saveActiveTenantRpc).toHaveBeenCalledWith('GORJANA')
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().sessionInfo?.activeTenantUserGroupId).toBe('GORJANA')
    expect(useAuthState().sessionInfo?.activeTenantLabel).toBe('Gorjana')
    expect(useAuthState().error).toBeNull()
    expect(clearApiResponseCache).toHaveBeenCalledTimes(1)
  })

  it('updates the authenticated session when user settings change', async () => {
    saveUserSettingsRpc.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        displayName: 'Aditi',
        timeZone: 'America/Los_Angeles',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })

    const { saveUserSettings, useAuthState } = await import('../auth')

    await expect(saveUserSettings({ displayName: 'Aditi' })).resolves.toBe(true)
    expect(saveUserSettingsRpc).toHaveBeenCalledWith({ displayName: 'Aditi' })
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().sessionInfo?.displayName).toBe('Aditi')
    expect(useAuthState().sessionInfo?.timeZone).toBe('America/Los_Angeles')
    expect(useAuthState().error).toBeNull()
  })

  it('updates the authenticated session timezone when tenant settings change', async () => {
    getSessionInfo.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        timeZone: 'America/Los_Angeles',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })
    saveTenantSettingsRpc.mockResolvedValue({
      ok: true,
      messages: ['Saved tenant settings.'],
      errors: [],
      tenantSettings: {
        companyUserGroupId: 'KREWE',
        companyLabel: 'Krewe',
        timeZone: 'Europe/London',
      },
    })

    const { ensureAuthenticated, saveTenantSettings, useAuthState } = await import('../auth')

    await expect(ensureAuthenticated()).resolves.toBe(true)
    await expect(saveTenantSettings({ timeZone: 'Europe/London' })).resolves.toMatchObject({
      ok: true,
      tenantSettings: { timeZone: 'Europe/London' },
    })
    expect(saveTenantSettingsRpc).toHaveBeenCalledWith({ timeZone: 'Europe/London' })
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().sessionInfo?.timeZone).toBe('Europe/London')
  })

  it('changes the current user password through the authenticated auth facade', async () => {
    changeOwnPasswordRpc.mockResolvedValue({
      ok: true,
      messages: ['Password updated for user backend'],
      errors: [],
      authenticated: true,
      passwordUpdated: true,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })

    const { changeOwnPassword, useAuthState } = await import('../auth')

    await expect(changeOwnPassword({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      newPasswordVerify: 'new-password',
    })).resolves.toBe(true)
    expect(changeOwnPasswordRpc).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      newPasswordVerify: 'new-password',
    })
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().error).toBeNull()
  })

  it('verifies the current user password through the authenticated auth facade', async () => {
    verifyOwnPasswordRpc.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      passwordVerified: true,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })

    const { verifyOwnPassword, useAuthState } = await import('../auth')

    await expect(verifyOwnPassword('old-password')).resolves.toBe(true)
    expect(verifyOwnPasswordRpc).toHaveBeenCalledWith({ currentPassword: 'old-password' })
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().error).toBeNull()
  })

  it('keeps the session authenticated when current password verification returns false', async () => {
    verifyOwnPasswordRpc.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      passwordVerified: false,
      sessionInfo: {
        userId: 'backend-user',
        username: 'backend',
        scopeType: 'TENANT',
        customerScopeId: 'KREWE',
        activeTenantUserGroupId: 'KREWE',
        activeTenantLabel: 'Krewe',
        availableTenants: [{ userGroupId: 'KREWE', label: 'Krewe' }],
        isSuperAdmin: false,
      },
    })

    const { verifyOwnPassword, useAuthState } = await import('../auth')

    await expect(verifyOwnPassword('wrong-password')).resolves.toBe(false)
    expect(useAuthState().status).toBe('authenticated')
    expect(useAuthState().error).toBe('Password incorrect.')
  })

  it('derives UI permissions for tenant, super-admin, and Darpan-admin sessions', async () => {
    const { buildUiPermissionPolicy } = await import('../auth')

    expect(buildUiPermissionPolicy({
      userId: 'view-only',
      canViewActiveTenantData: true,
      canRunActiveTenantReconciliation: false,
      canEditActiveTenantData: false,
      isSuperAdmin: false,
    })).toEqual({
      canViewTenantSettings: true,
      canRunActiveTenantReconciliation: false,
      canEditTenantSettings: false,
      canManageGlobalSettings: false,
    })

    expect(buildUiPermissionPolicy({
      userId: 'tenant-user',
      canViewActiveTenantData: true,
      canRunActiveTenantReconciliation: true,
      canEditActiveTenantData: false,
      isSuperAdmin: false,
    })).toEqual({
      canViewTenantSettings: true,
      canRunActiveTenantReconciliation: true,
      canEditTenantSettings: false,
      canManageGlobalSettings: false,
    })

    expect(buildUiPermissionPolicy({
      userId: 'editor',
      canViewActiveTenantData: true,
      canRunActiveTenantReconciliation: true,
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    })).toMatchObject({
      canViewTenantSettings: true,
      canRunActiveTenantReconciliation: true,
      canEditTenantSettings: true,
      canManageGlobalSettings: false,
    })

    expect(buildUiPermissionPolicy({
      userId: 'super-admin',
      canViewActiveTenantData: true,
      canRunActiveTenantReconciliation: true,
      canEditActiveTenantData: false,
      canManageDarpanCore: false,
      isSuperAdmin: true,
    })).toMatchObject({
      canViewTenantSettings: true,
      canRunActiveTenantReconciliation: true,
      canEditTenantSettings: true,
      canManageGlobalSettings: false,
    })

    expect(buildUiPermissionPolicy({
      userId: 'darpan-admin',
      canViewActiveTenantData: false,
      canRunActiveTenantReconciliation: false,
      canEditActiveTenantData: false,
      canManageDarpanCore: true,
      isSuperAdmin: false,
    })).toMatchObject({
      canViewTenantSettings: false,
      canRunActiveTenantReconciliation: false,
      canEditTenantSettings: false,
      canManageGlobalSettings: true,
    })
  })

  it('marks the state as unauthenticated when login key verification returns 401', async () => {
    window.sessionStorage.setItem(
      'darpan.authToken',
      JSON.stringify({
        value: 'expired-token',
        headerName: 'login_key',
        tokenType: 'LOGIN_KEY',
        expiresAt: null,
      }),
    )
    const { ApiCallError, getAuthToken } = await import('../api/client')
    getSessionInfo.mockRejectedValue(new ApiCallError('Login key expired', 401))

    const { ensureAuthenticated, useAuthState } = await import('../auth')

    await expect(ensureAuthenticated(true)).resolves.toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(useAuthState().authenticated).toBe(false)
    expect(useAuthState().status).toBe('unauthenticated')
    expect(useAuthState().error).toBe('Login key expired')
  })

  it('fails closed when a forced session refresh errors', async () => {
    getSessionInfo.mockRejectedValue(new Error('network failure'))

    const { ensureAuthenticated, useAuthState } = await import('../auth')

    await expect(ensureAuthenticated(true)).resolves.toBe(false)
    expect(useAuthState().authenticated).toBe(false)
    expect(useAuthState().status).toBe('verification-failed')
    expect(useAuthState().error).toBe('Unable to verify authentication. network failure')
  })

  it('marks the state as unauthenticated when backend confirms there is no active session', async () => {
    getSessionInfo.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: false,
      sessionInfo: null,
    })

    const { ensureAuthenticated, useAuthState } = await import('../auth')

    await expect(ensureAuthenticated(true)).resolves.toBe(false)
    expect(useAuthState().authenticated).toBe(false)
    expect(useAuthState().status).toBe('unauthenticated')
    expect(useAuthState().error).toBe('No active authenticated session detected.')
  })

  it('fails verification when backend returns an authenticated response without sessionInfo.userId', async () => {
    getSessionInfo.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      sessionInfo: {
        username: 'backend',
      },
    })

    const { ensureAuthenticated, useAuthState } = await import('../auth')

    await expect(ensureAuthenticated(true)).resolves.toBe(false)
    expect(useAuthState().status).toBe('verification-failed')
    expect(useAuthState().error).toContain('Auth contract violation')
  })

  it('builds the login redirect when the last auth check was a verification failure', async () => {
    getSessionInfo.mockRejectedValue(new Error('network failure'))

    const { buildAuthRedirect, ensureAuthenticated } = await import('../auth')

    await expect(ensureAuthenticated(true)).resolves.toBe(false)
    expect(buildAuthRedirect('/connections/llm')).toEqual({
      name: 'login',
      query: { redirect: '/connections/llm' },
    })
  })

  it('does not build login redirects that point back to login', async () => {
    const { buildAuthRedirect } = await import('../auth')

    expect(buildAuthRedirect('/login')).toEqual({ name: 'login' })
    expect(buildAuthRedirect('/login?redirect=/login')).toEqual({ name: 'login' })
    expect(buildAuthRedirect('/')).toEqual({ name: 'login' })
  })
})
