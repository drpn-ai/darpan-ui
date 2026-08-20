import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const ensureAuthenticated = vi.hoisted(() => vi.fn())
const switchActiveTenant = vi.hoisted(() => vi.fn())
const noteDeepLinkTenantSwitch = vi.hoisted(() => vi.fn())
const authState = vi.hoisted(() => ({
  checked: true,
  error: null as string | null,
  status: 'unauthenticated' as 'authenticated' | 'unauthenticated' | 'verification-failed',
  sessionInfo: null as {
    userId: string
    username?: string
    activeTenantUserGroupId?: string
    activeTenantLabel?: string
    canRunActiveTenantReconciliation?: boolean
    canEditActiveTenantData?: boolean
    canManageDarpanCore?: boolean
    isSuperAdmin?: boolean
  } | null,
  get authenticated() {
    return this.status === 'authenticated'
  },
  get userId() {
    return this.sessionInfo?.userId ?? null
  },
  get username() {
    return this.sessionInfo?.username ?? this.sessionInfo?.userId ?? null
  },
}))

Object.defineProperty(window, 'scrollTo', {
  value: vi.fn(),
  writable: true,
})

const permissionsShape = {
  get canRunActiveTenantReconciliation() {
    return authState.sessionInfo?.canRunActiveTenantReconciliation === true ||
      authState.sessionInfo?.canEditActiveTenantData === true ||
      authState.sessionInfo?.isSuperAdmin === true
  },
  get canEditTenantSettings() {
    return authState.sessionInfo?.canEditActiveTenantData === true || authState.sessionInfo?.isSuperAdmin === true
  },
  get canManageGlobalSettings() {
    return authState.sessionInfo?.canManageDarpanCore === true
  },
  get canViewTenantSettings() {
    return Boolean(authState.sessionInfo?.userId)
  },
}

vi.mock('../../stores/auth', () => ({
  buildAuthRedirect: (redirect: string) => ({ name: 'login', query: { redirect } }),
  useAuthStore: () => ({
    ...authState,
    ensureAuthenticated,
    switchActiveTenant,
    noteDeepLinkTenantSwitch,
  }),
}))

vi.mock('../../stores/permissions', () => ({
  usePermissionsStore: () => permissionsShape,
}))

const scheduleRoutePrefetch = vi.hoisted(() => vi.fn())

vi.mock('../prefetchRoutes', () => ({
  scheduleRoutePrefetch,
}))

import router from '../index'

describe('router auth guard', () => {
  beforeEach(async () => {
    ensureAuthenticated.mockReset()
    ensureAuthenticated.mockResolvedValue(true)
    switchActiveTenant.mockReset()
    noteDeepLinkTenantSwitch.mockReset()
    scheduleRoutePrefetch.mockReset()
    authState.checked = true
    authState.error = null
    authState.status = 'unauthenticated'
    authState.sessionInfo = null
    await router.push('/login')
  })

  describe('tenant-scoped deep links', () => {
    function authenticateAs(tenantId: string | undefined) {
      ensureAuthenticated.mockResolvedValue(true)
      authState.status = 'authenticated'
      authState.sessionInfo = {
        userId: '100000',
        username: 'test.customer',
        activeTenantUserGroupId: tenantId,
        activeTenantLabel: tenantId ? `Tenant ${tenantId}` : undefined,
      }
    }

    it('does not touch the tenant when a link carries no tenantId', async () => {
      authenticateAs('TENANT_A')
      await router.push('/reconciliation/run-result/SR1/result.json')

      expect(switchActiveTenant).not.toHaveBeenCalled()
      expect(router.currentRoute.value.name).toBe('reconciliation-run-result')
    })

    it('does not switch when the link names the tenant already active', async () => {
      authenticateAs('TENANT_A')
      await router.push('/reconciliation/run-result/SR1/result.json?tenantId=TENANT_A')

      // A banner here would fire on every same-tenant alert, which is most of them.
      expect(switchActiveTenant).not.toHaveBeenCalled()
      expect(noteDeepLinkTenantSwitch).not.toHaveBeenCalled()
    })

    it('switches and announces when the link names a different tenant', async () => {
      authenticateAs('TENANT_A')
      switchActiveTenant.mockResolvedValue('switched')
      await router.push('/reconciliation/run-result/SR1/result.json?tenantId=TENANT_B')

      expect(switchActiveTenant).toHaveBeenCalledWith('TENANT_B')
      expect(noteDeepLinkTenantSwitch).toHaveBeenCalled()
      expect(router.currentRoute.value.name).toBe('reconciliation-run-result')
    })

    it('sends a refused switch to access-denied', async () => {
      authenticateAs('TENANT_A')
      switchActiveTenant.mockResolvedValue('refused')
      await router.push('/reconciliation/run-result/SR1/result.json?tenantId=TENANT_B')

      expect(router.currentRoute.value.name).toBe('access-denied')
    })

    it('does NOT send a failed switch to access-denied', async () => {
      authenticateAs('TENANT_A')
      switchActiveTenant.mockResolvedValue('failed')
      await router.push('/reconciliation/run-result/SR1/result.json?tenantId=TENANT_B')

      // A dropped connection is not a permission verdict. The page surfaces its own error.
      expect(router.currentRoute.value.name).not.toBe('access-denied')
    })

    it('applies to every tenant-scoped deep link, not just run-result', async () => {
      authenticateAs('TENANT_A')
      switchActiveTenant.mockResolvedValue('switched')
      await router.push('/reconciliation/run-live/SR1/100511?tenantId=TENANT_B')

      expect(switchActiveTenant).toHaveBeenCalledWith('TENANT_B')
    })

    it('switches the tenant before the permission gates read the permissions store', async () => {
      ensureAuthenticated.mockResolvedValue(true)
      authState.status = 'authenticated'
      authState.sessionInfo = {
        userId: '100000',
        username: 'view.customer',
        activeTenantUserGroupId: 'TENANT_A',
        canEditActiveTenantData: false,
        isSuperAdmin: false,
      }
      switchActiveTenant.mockImplementation(async () => {
        // The destination tenant is one this user may edit; the origin tenant is not.
        authState.sessionInfo = {
          userId: '100000',
          username: 'view.customer',
          activeTenantUserGroupId: 'TENANT_B',
          canEditActiveTenantData: true,
          isSuperAdmin: false,
        }
        return 'switched'
      })

      await router.push('/settings/sftp/create?tenantId=TENANT_B')

      // Run the switch after the requiresTenantEdit gate and this lands on settings-sftp instead.
      expect(router.currentRoute.value.name).toBe('settings-sftp-create')
    })

    it('preserves tenantId through the login redirect', async () => {
      ensureAuthenticated.mockResolvedValue(false)
      authState.status = 'unauthenticated'
      authState.sessionInfo = null
      await router.push('/reconciliation/run-result/SR1/result.json?tenantId=TENANT_B')

      expect(router.currentRoute.value.name).toBe('login')
      expect(String(router.currentRoute.value.query.redirect)).toContain('tenantId=TENANT_B')
    })
  })

  it('schedules route chunk prefetching once authenticated, not before', async () => {
    ensureAuthenticated.mockResolvedValue(false)
    await router.push('/settings/sftp')
    expect(scheduleRoutePrefetch).not.toHaveBeenCalled()

    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = { userId: '100000', username: 'test.customer' }
    await router.push('/settings/sftp')
    expect(scheduleRoutePrefetch).toHaveBeenCalledWith(router)
  })

  it('redirects unauthenticated users to login for protected routes', async () => {
    ensureAuthenticated.mockResolvedValue(false)
    authState.error = 'No active authenticated session detected.'
    authState.status = 'unauthenticated'
    await router.push('/settings/sftp')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/settings/sftp')
  })

  it('routes auth bootstrap failures to login', async () => {
    ensureAuthenticated.mockResolvedValue(false)
    authState.error = 'Unable to verify authentication'
    authState.status = 'verification-failed'

    await router.push('/settings/sftp')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/settings/sftp')
  })

  it('allows authenticated users to open the standalone SFTP dashboard', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = { userId: '100000', username: 'test.customer' }
    await router.push('/settings/sftp')

    expect(router.currentRoute.value.name).toBe('settings-sftp')
  })

  it('redirects the legacy SFTP route to the standalone dashboard for authenticated users', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = { userId: '100000', username: 'test.customer' }
    await router.push('/connections/sftp')

    expect(router.currentRoute.value.name).toBe('settings-sftp')
  })

  it('redirects view-only tenant users away from tenant mutation workflows', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'view.customer',
      canEditActiveTenantData: false,
      isSuperAdmin: false,
    }

    await router.push('/settings/sftp/create')

    expect(router.currentRoute.value.name).toBe('settings-sftp')
  })

  it('allows view-only tenant users to view automations but not create or edit them', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'view.customer',
      canEditActiveTenantData: false,
      isSuperAdmin: false,
    }

    await router.push('/reconciliation/automations')
    expect(router.currentRoute.value.name).toBe('reconciliation-automations')

    await router.push('/reconciliation/automations/AUT_ORDER_SYNC')
    expect(router.currentRoute.value.name).toBe('reconciliation-automation-dashboard')

    await router.push('/reconciliation/automations/create')
    expect(router.currentRoute.value.name).toBe('reconciliation-automations')

    await router.push('/reconciliation/automations/edit/AUT_ORDER_SYNC')
    expect(router.currentRoute.value.name).toBe('reconciliation-automations')
  })

  it('allows editor tenant users to open tenant mutation workflows', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'editor.customer',
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }

    await router.push('/settings/sftp/create')

    expect(router.currentRoute.value.name).toBe('settings-sftp-create')
  })

  it('allows tenant users with run permission to open reconciliation run workflows', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'tenant.user',
      canRunActiveTenantReconciliation: true,
      canEditActiveTenantData: false,
      isSuperAdmin: false,
    }

    await router.push('/reconciliation/diff')

    expect(router.currentRoute.value.name).toBe('reconciliation-diff')
  })

  it('redirects tenant users without run permission away from reconciliation run workflows', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'view.customer',
      canRunActiveTenantReconciliation: false,
      canEditActiveTenantData: false,
      isSuperAdmin: false,
    }

    await router.push('/reconciliation/diff')

    expect(router.currentRoute.value.name).toBe('settings-runs')
  })

  it('redirects unauthenticated users to login when visiting an unknown path', async () => {
    ensureAuthenticated.mockResolvedValue(false)
    authState.status = 'unauthenticated'
    authState.sessionInfo = null
    await router.push('/totally/unknown/path')

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/totally/unknown/path')
  })

  it('allows authenticated users to reach the not-found route for unknown paths', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = { userId: '100000', username: 'test.customer' }
    await router.push('/totally/unknown/path')

    expect(router.currentRoute.value.name).toBe('not-found')
  })

  describe('background session revalidation', () => {
    // Each test jumps the (Date-only) fake clock a full day ahead of the previous one so the
    // module-level revalidation timestamp inside the router is always stale at test start,
    // regardless of what earlier tests did.
    let dayOffset = 1

    function jumpClockToStale(): number {
      const base = Date.now() + dayOffset * 24 * 60 * 60 * 1000
      dayOffset += 1
      vi.setSystemTime(base)
      return base
    }

    function flushBackgroundWork(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 0))
    }

    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] })
      authState.status = 'authenticated'
      authState.sessionInfo = { userId: '100000', username: 'test.customer' }
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('does not block a stale navigation on the server session check', async () => {
      let resolveForce: (value: boolean) => void = () => {}
      ensureAuthenticated.mockImplementation((force?: boolean) => {
        if (force) return new Promise<boolean>((resolve) => { resolveForce = resolve })
        return Promise.resolve(true)
      })

      jumpClockToStale()
      const navigation = router.push('/settings/sftp')
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('settings-sftp'))
      expect(ensureAuthenticated).toHaveBeenCalledWith(true)

      resolveForce(true)
      await navigation
    })

    it('redirects to login when the background revalidation reports an expired session', async () => {
      ensureAuthenticated.mockImplementation((force?: boolean) => Promise.resolve(force !== true))

      jumpClockToStale()
      await router.push('/settings/sftp')
      expect(router.currentRoute.value.name).toBe('settings-sftp')

      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('login'))
      expect(router.currentRoute.value.query.redirect).toBe('/settings/sftp')
    })

    it('coalesces concurrent background revalidations into one server check', async () => {
      let forceCalls = 0
      const resolvers: Array<(value: boolean) => void> = []
      ensureAuthenticated.mockImplementation((force?: boolean) => {
        if (force) {
          forceCalls += 1
          return new Promise<boolean>((resolve) => { resolvers.push(resolve) })
        }
        return Promise.resolve(true)
      })

      const base = jumpClockToStale()
      const first = router.push('/settings/sftp')
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('settings-sftp'))

      vi.setSystemTime(base + 2 * 60 * 1000)
      const second = router.push('/reconciliation/automations')
      await vi.waitFor(() => expect(router.currentRoute.value.name).toBe('reconciliation-automations'))

      expect(forceCalls).toBe(1)
      resolvers.forEach((resolve) => resolve(true))
      await Promise.all([first, second])
    })

    it('advances the revalidation clock only after a successful background check', async () => {
      let forceCalls = 0
      ensureAuthenticated.mockImplementation((force?: boolean) => {
        if (force) forceCalls += 1
        return Promise.resolve(true)
      })

      const base = jumpClockToStale()
      await router.push('/settings/sftp')
      await flushBackgroundWork()
      expect(forceCalls).toBe(1)

      vi.setSystemTime(base + 30 * 1000)
      await router.push('/reconciliation/automations')
      await flushBackgroundWork()
      expect(forceCalls).toBe(1)

      vi.setSystemTime(base + 95 * 1000)
      await router.push('/settings/sftp')
      await flushBackgroundWork()
      expect(forceCalls).toBe(2)
    })

    it('still blocks the first navigation until the initial session check resolves', async () => {
      authState.checked = false
      let resolveInitial: (value: boolean) => void = () => {}
      ensureAuthenticated.mockImplementation(() => new Promise<boolean>((resolve) => { resolveInitial = resolve }))

      jumpClockToStale()
      const navigation = router.push('/settings/sftp')
      await flushBackgroundWork()
      expect(router.currentRoute.value.name).toBe('login')

      resolveInitial(true)
      await navigation
      expect(router.currentRoute.value.name).toBe('settings-sftp')
      expect(ensureAuthenticated).not.toHaveBeenCalledWith(true)
    })
  })

  it('redirects old AI settings routes into tenant settings for authenticated users', async () => {
    ensureAuthenticated.mockResolvedValue(true)
    authState.status = 'authenticated'
    authState.sessionInfo = {
      userId: '100000',
      username: 'editor.customer',
      canEditActiveTenantData: true,
      isSuperAdmin: false,
    }

    await router.push('/settings/ai')

    expect(router.currentRoute.value.name).toBe('settings-tenant')

    authState.sessionInfo = {
      userId: '100000',
      username: 'admin.customer',
      canEditActiveTenantData: false,
      isSuperAdmin: true,
    }
    await router.push('/settings/ai')

    expect(router.currentRoute.value.name).toBe('settings-tenant')
  })
})
