import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../test/localStorage'
import type { SessionInfo } from '../../lib/api/types'
// Static import (unlike the rest of this file's `await import('../auth')` pattern): the new
// canManageConfigSharing cases below are synchronous and only exercise the pure
// buildUiPermissionPolicy function, so they don't need a post-vi.resetModules() fresh instance.
import { buildUiPermissionPolicy } from '../auth'

const getSessionInfo = vi.hoisted(() => vi.fn())
const loginSession = vi.hoisted(() => vi.fn())
const saveActiveTenantRpc = vi.hoisted(() => vi.fn())
const saveTenantSettingsRpc = vi.hoisted(() => vi.fn())
const saveUserSettingsRpc = vi.hoisted(() => vi.fn())
const verifyOwnPasswordRpc = vi.hoisted(() => vi.fn())
const changeOwnPasswordRpc = vi.hoisted(() => vi.fn())
const logoutSessionRpc = vi.hoisted(() => vi.fn())
const clearApiResponseCache = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
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
    const { useAuthStore } = await import('../auth')

    expect(useAuthStore().checked).toBe(false)
    expect(useAuthStore().authenticated).toBe(false)
    expect(useAuthStore().userId).toBeNull()
    expect(useAuthStore().username).toBeNull()
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated()).resolves.toBe(true)
    expect(getSessionInfo).toHaveBeenCalledTimes(1)
    expect(useAuthStore().authenticated).toBe(true)
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().userId).toBe('backend-user')
    expect(useAuthStore().username).toBe('backend')
    expect(useAuthStore().sessionInfo?.scopeType).toBe('TENANT')
    expect(useAuthStore().sessionInfo?.activeTenantUserGroupId).toBe('KREWE')
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

    const { getAuthToken } = await import('../../lib/api/client')
    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().loginWithCredentials('backend', 'secret')).resolves.toBe(true)
    expect(getAuthToken()).toBe('login-token-123')
    // Audit #10: the bearer token is held in sessionStorage (per-tab, off-disk), never localStorage.
    expect(JSON.parse(window.sessionStorage.getItem('darpan.authToken') ?? '{}')).toMatchObject({
      value: 'login-token-123',
      headerName: 'login_key',
      tokenType: 'LOGIN_KEY',
    })
    expect(window.localStorage.getItem('darpan.authToken')).toBeNull()

    await expect(useAuthStore().logoutSession()).resolves.toBe(true)
    expect(logoutSessionRpc).toHaveBeenCalledTimes(1)
    expect(getAuthToken()).toBeNull()
    expect(useAuthStore().authenticated).toBe(false)
    expect(useAuthStore().status).toBe('unauthenticated')
    expect(useAuthStore().error).toBeNull()
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().saveActiveTenant('GORJANA')).resolves.toBe(true)
    expect(saveActiveTenantRpc).toHaveBeenCalledWith('GORJANA')
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().sessionInfo?.activeTenantUserGroupId).toBe('GORJANA')
    expect(useAuthStore().sessionInfo?.activeTenantLabel).toBe('Gorjana')
    expect(useAuthStore().error).toBeNull()
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().saveUserSettings({ displayName: 'Aditi' })).resolves.toBe(true)
    expect(saveUserSettingsRpc).toHaveBeenCalledWith({ displayName: 'Aditi' })
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().sessionInfo?.displayName).toBe('Aditi')
    expect(useAuthStore().sessionInfo?.timeZone).toBe('America/Los_Angeles')
    expect(useAuthStore().error).toBeNull()
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated()).resolves.toBe(true)
    await expect(useAuthStore().saveTenantSettings({ timeZone: 'Europe/London' })).resolves.toMatchObject({
      ok: true,
      tenantSettings: { timeZone: 'Europe/London' },
    })
    expect(saveTenantSettingsRpc).toHaveBeenCalledWith({ timeZone: 'Europe/London' })
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().sessionInfo?.timeZone).toBe('Europe/London')
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().changeOwnPassword({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      newPasswordVerify: 'new-password',
    })).resolves.toBe(true)
    expect(changeOwnPasswordRpc).toHaveBeenCalledWith({
      currentPassword: 'old-password',
      newPassword: 'new-password',
      newPasswordVerify: 'new-password',
    })
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().error).toBeNull()
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().verifyOwnPassword('old-password')).resolves.toBe(true)
    expect(verifyOwnPasswordRpc).toHaveBeenCalledWith({ currentPassword: 'old-password' })
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().error).toBeNull()
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().verifyOwnPassword('wrong-password')).resolves.toBe(false)
    expect(useAuthStore().status).toBe('authenticated')
    expect(useAuthStore().error).toBe('Password incorrect.')
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
      canManageConfigSharing: false,
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
      canManageConfigSharing: false,
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

  it('grants canManageConfigSharing to a tenant admin', () => {
    expect(
      buildUiPermissionPolicy({
        userId: 'aditi',
        activeTenantPermissionGroupIds: ['DARPAN_TENANT_ADMIN'],
      } as SessionInfo).canManageConfigSharing,
    ).toBe(true)
  })

  it('denies canManageConfigSharing to an editor or viewer', () => {
    expect(
      buildUiPermissionPolicy({
        userId: 'aditi',
        activeTenantPermissionGroupIds: ['DARPAN_COMPANY_EDITOR'],
        canEditActiveTenantData: true,
      } as SessionInfo).canManageConfigSharing,
    ).toBe(false)
  })

  it('grants canManageConfigSharing to a super admin', () => {
    expect(
      buildUiPermissionPolicy({ userId: 'root', isSuperAdmin: true } as SessionInfo)
        .canManageConfigSharing,
    ).toBe(true)
  })

  it('denies canManageConfigSharing when unauthenticated', () => {
    expect(buildUiPermissionPolicy(null).canManageConfigSharing).toBe(false)
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
    const { ApiCallError, getAuthToken } = await import('../../lib/api/client')
    getSessionInfo.mockRejectedValue(new ApiCallError('Login key expired', 401))

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated(true)).resolves.toBe(false)
    expect(getAuthToken()).toBeNull()
    expect(useAuthStore().authenticated).toBe(false)
    expect(useAuthStore().status).toBe('unauthenticated')
    expect(useAuthStore().error).toBe('Login key expired')
  })

  it('fails closed when a forced session refresh errors', async () => {
    getSessionInfo.mockRejectedValue(new Error('network failure'))

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated(true)).resolves.toBe(false)
    expect(useAuthStore().authenticated).toBe(false)
    expect(useAuthStore().status).toBe('verification-failed')
    expect(useAuthStore().error).toBe('Unable to verify authentication. network failure')
  })

  it('marks the state as unauthenticated when backend confirms there is no active session', async () => {
    getSessionInfo.mockResolvedValue({
      ok: true,
      messages: [],
      errors: [],
      authenticated: false,
      sessionInfo: null,
    })

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated(true)).resolves.toBe(false)
    expect(useAuthStore().authenticated).toBe(false)
    expect(useAuthStore().status).toBe('unauthenticated')
    expect(useAuthStore().error).toBe('No active authenticated session detected.')
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

    const { useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated(true)).resolves.toBe(false)
    expect(useAuthStore().status).toBe('verification-failed')
    expect(useAuthStore().error).toContain('Auth contract violation')
  })

  it('builds the login redirect when the last auth check was a verification failure', async () => {
    getSessionInfo.mockRejectedValue(new Error('network failure'))

    const { buildAuthRedirect, useAuthStore } = await import('../auth')

    await expect(useAuthStore().ensureAuthenticated(true)).resolves.toBe(false)
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
