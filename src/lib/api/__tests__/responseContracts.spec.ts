/**
 * responseContracts.spec.ts
 *
 * Pins the SPA's view of the wire contract for 6 critical endpoints.
 *
 * Strategy: for each endpoint, construct a realistic canonical JSON-RPC
 * success body that conforms to the documented Response type (derived from
 * types.ts interfaces), mock the transport the same way client.spec.ts does
 * (vi.stubGlobal + vi.resetModules), invoke the real facade wrapper from
 * facade.ts, and assert that every field documented in the TS interface is
 * present with the correct type.
 *
 * If the wire shape diverges from the type (e.g. a backend field rename), the
 * fixture assertion fails — that is the entire point.
 *
 * No runtime code is touched. No new deps added.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../../test/localStorage'

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

/** Wraps a result payload in a well-formed JSON-RPC 2.0 success envelope. */
function rpcSuccess(result: unknown): string {
  return JSON.stringify({ jsonrpc: '2.0', id: 1, result })
}

/** Returns a minimal fetch mock that resolves once with the given body. */
function mockFetchOnce(body: string): ReturnType<typeof vi.fn> {
  return vi.fn().mockResolvedValue(
    new Response(body, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

// ────────────────────────────────────────────────────────────────────────────
// shared setup
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  window.history.replaceState({}, '', '/login')
  installLocalStorageStub()
})

// ────────────────────────────────────────────────────────────────────────────
// 1. login#Session → LoginSessionResponse
// ────────────────────────────────────────────────────────────────────────────

describe('login#Session → LoginSessionResponse', () => {
  it('exposes all documented top-level fields with correct types', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: ['Login successful'],
      errors: [],
      authenticated: true,
      // AuthTokenContract fields (LoginSessionResponse extends ApiEnvelope + AuthTokenContract)
      authToken: 'tok-abc123',
      authTokenType: 'LOGIN_KEY',
      authTokenHeaderName: 'login_key',
      authTokenExpiresInSeconds: 3600,
      // SessionInfo (required: userId)
      sessionInfo: {
        userId: 'aditi.patel',
        username: 'aditi.patel',
        displayName: 'Aditi Patel',
        locale: 'en',
        timeZone: 'Asia/Kolkata',
        lastLoginDate: '2026-06-29T09:00:00Z',
        scopeType: 'TENANT',
        customerScopeId: null,
        activeTenantUserGroupId: 'DARPAN_TENANT_A',
        activeTenantLabel: 'Tenant A',
        availableTenants: [{ userGroupId: 'DARPAN_TENANT_A', label: 'Tenant A' }],
        activeTenantPermissionGroupIds: ['RECON_RUN'],
        canViewActiveTenantData: true,
        canRunActiveTenantReconciliation: true,
        canEditActiveTenantData: false,
        canManageDarpanCore: false,
        isSuperAdmin: false,
      },
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { authFacade } = await import('../facade')
    const result = await authFacade.loginSession('aditi.patel', 'hunter2')

    // ApiEnvelope
    expect(typeof result.ok).toBe('boolean')
    expect(Array.isArray(result.messages)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)

    // LoginSessionResponse own fields
    expect(result.authenticated).toBe(true)
    expect(typeof result.authToken).toBe('string')
    expect(result.authToken).toBe('tok-abc123')
    expect(typeof result.authTokenType).toBe('string')
    expect(typeof result.authTokenHeaderName).toBe('string')
    expect(typeof result.authTokenExpiresInSeconds).toBe('number')

    // SessionInfo
    const si = result.sessionInfo
    expect(si).toBeDefined()
    expect(typeof si!.userId).toBe('string')
    expect(si!.userId).toBe('aditi.patel')
    expect(typeof si!.username).toBe('string')
    expect(typeof si!.displayName).toBe('string')
    expect(typeof si!.locale).toBe('string')
    expect(typeof si!.timeZone).toBe('string')
    expect(typeof si!.lastLoginDate).toBe('string')
    expect(si!.scopeType).toBe('TENANT')
    expect(si!.customerScopeId).toBeNull()
    expect(typeof si!.activeTenantUserGroupId).toBe('string')
    expect(typeof si!.activeTenantLabel).toBe('string')
    expect(Array.isArray(si!.availableTenants)).toBe(true)
    expect(si!.availableTenants![0]!.userGroupId).toBe('DARPAN_TENANT_A')
    expect(Array.isArray(si!.activeTenantPermissionGroupIds)).toBe(true)
    expect(typeof si!.canViewActiveTenantData).toBe('boolean')
    expect(typeof si!.canRunActiveTenantReconciliation).toBe('boolean')
    expect(typeof si!.canEditActiveTenantData).toBe('boolean')
    expect(typeof si!.canManageDarpanCore).toBe('boolean')
    expect(typeof si!.isSuperAdmin).toBe('boolean')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 2. get#SessionInfo → SessionInfoResponse
// ────────────────────────────────────────────────────────────────────────────

describe('get#SessionInfo → SessionInfoResponse', () => {
  it('exposes all documented fields with correct types', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      authenticated: true,
      sessionInfo: {
        userId: 'aditi.patel',
        username: 'aditi.patel',
        displayName: 'Aditi Patel',
        locale: 'en',
        timeZone: 'America/Los_Angeles',
        lastLoginDate: '2026-06-29T00:00:00Z',
        lastRun: {
          reconciliationRunResultId: 'rrr-001',
          savedRunId: 'sr-001',
          savedRunType: 'RULE_SET',
          reconciliationRunId: 'rr-001',
          createdDate: '2026-06-29T01:00:00Z',
        },
        scopeType: 'GLOBAL',
        customerScopeId: null,
        activeTenantUserGroupId: null,
        activeTenantLabel: null,
        availableTenants: [],
        activeTenantPermissionGroupIds: [],
        canViewActiveTenantData: true,
        canRunActiveTenantReconciliation: false,
        canEditActiveTenantData: false,
        canManageDarpanCore: true,
        isSuperAdmin: true,
      },
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { authFacade } = await import('../facade')
    const result = await authFacade.getSessionInfo()

    // SessionInfoResponse: ApiEnvelope + authenticated + sessionInfo?
    expect(typeof result.ok).toBe('boolean')
    expect(Array.isArray(result.messages)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)
    expect(result.authenticated).toBe(true)

    const si = result.sessionInfo
    expect(si).toBeDefined()
    expect(si).not.toBeNull()

    // Required field on SessionInfo
    expect(typeof si!.userId).toBe('string')

    // Optional fields that are present in this fixture
    expect(typeof si!.username).toBe('string')
    expect(typeof si!.displayName).toBe('string')
    expect(si!.scopeType).toBe('GLOBAL')
    expect(si!.customerScopeId).toBeNull()
    expect(si!.activeTenantUserGroupId).toBeNull()
    expect(si!.activeTenantLabel).toBeNull()
    expect(Array.isArray(si!.availableTenants)).toBe(true)
    expect(typeof si!.canManageDarpanCore).toBe('boolean')
    expect(si!.isSuperAdmin).toBe(true)

    // SessionLastRun sub-object
    const lr = si!.lastRun
    expect(lr).toBeDefined()
    expect(lr).not.toBeNull()
    expect(typeof lr!.reconciliationRunResultId).toBe('string')
    expect(typeof lr!.savedRunId).toBe('string')
    expect(typeof lr!.savedRunType).toBe('string')
    expect(typeof lr!.reconciliationRunId).toBe('string')
    expect(typeof lr!.createdDate).toBe('string')
  })

  it('handles authenticated=false with null sessionInfo', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      authenticated: false,
      sessionInfo: null,
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { authFacade } = await import('../facade')
    const result = await authFacade.getSessionInfo()

    expect(result.authenticated).toBe(false)
    expect(result.sessionInfo).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 3. list#SavedRuns → ListSavedRunsResponse
// ────────────────────────────────────────────────────────────────────────────

describe('list#SavedRuns → ListSavedRunsResponse', () => {
  it('exposes pagination + savedRuns array with documented SavedRunSummary fields', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      // PaginationMeta (from PaginatedResponse)
      pagination: {
        pageIndex: 0,
        pageSize: 20,
        totalCount: 2,
        pageCount: 1,
      },
      // ListSavedRunsResponse own fields
      pinnedSavedRunIds: ['sr-001'],
      savedRuns: [
        {
          savedRunId: 'sr-001',
          runName: 'Orders vs NetSuite',
          description: 'Daily orders reconciliation',
          companyUserGroupId: 'DARPAN_TENANT_A',
          companyLabel: 'Tenant A',
          runType: 'RULE_SET',
          reconciliationMappingId: 'mapping-001',
          ruleSetId: 'rs-001',
          compareScopeId: null,
          requiresSystemSelection: false,
          defaultFile1SystemEnumId: 'NS',
          defaultFile2SystemEnumId: 'OMS',
          systemOptions: [
            {
              enumId: 'NS',
              enumCode: 'NS',
              description: 'NetSuite',
              fileSide: 'FILE1',
              label: 'NetSuite',
            },
          ],
          rules: [
            {
              ruleId: 'rule-001',
              sequenceNum: 1,
              ruleText: 'Order ID must match',
              ruleLogic: 'FIELD_COMPARISON',
              ruleType: 'REQUIRED',
              expression: 'orderId',
              enabled: 'Y',
              severity: 'HIGH',
              file1FieldPath: 'orderId',
              file2FieldPath: 'orderId',
              operator: 'EQ',
              preActions: [],
            },
          ],
        },
        {
          savedRunId: 'sr-002',
          runName: 'CSV Quick Run',
          requiresSystemSelection: true,
          systemOptions: [],
        },
      ],
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { reconciliationFacade } = await import('../facade')
    const result = await reconciliationFacade.listSavedRuns({ pageIndex: 0, pageSize: 20 })

    // ApiEnvelope
    expect(typeof result.ok).toBe('boolean')
    expect(Array.isArray(result.messages)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)

    // PaginationMeta
    const p = result.pagination
    expect(typeof p.pageIndex).toBe('number')
    expect(p.pageIndex).toBe(0)
    expect(typeof p.pageSize).toBe('number')
    expect(typeof p.totalCount).toBe('number')
    expect(p.totalCount).toBe(2)
    expect(typeof p.pageCount).toBe('number')

    // ListSavedRunsResponse own fields
    expect(Array.isArray(result.pinnedSavedRunIds)).toBe(true)
    expect(result.pinnedSavedRunIds).toContain('sr-001')
    expect(Array.isArray(result.savedRuns)).toBe(true)
    expect(result.savedRuns).toHaveLength(2)

    // SavedRunSummary (first item — fully populated)
    const run = result.savedRuns[0]!
    expect(typeof run.savedRunId).toBe('string')
    expect(run.savedRunId).toBe('sr-001')
    expect(typeof run.runName).toBe('string')
    expect(run.runName).toBe('Orders vs NetSuite')
    expect(typeof run.description).toBe('string')
    expect(typeof run.companyUserGroupId).toBe('string')
    expect(typeof run.companyLabel).toBe('string')
    expect(typeof run.runType).toBe('string')
    expect(typeof run.reconciliationMappingId).toBe('string')
    expect(typeof run.ruleSetId).toBe('string')
    expect(typeof run.requiresSystemSelection).toBe('boolean')
    expect(run.requiresSystemSelection).toBe(false)
    expect(typeof run.defaultFile1SystemEnumId).toBe('string')
    expect(typeof run.defaultFile2SystemEnumId).toBe('string')
    expect(Array.isArray(run.systemOptions)).toBe(true)

    // SavedRunSystemOption sub-object
    const opt = run.systemOptions[0]!
    expect(typeof opt.enumId).toBe('string')
    expect(opt.fileSide).toBe('FILE1')

    // SavedRunRule sub-object
    expect(Array.isArray(run.rules)).toBe(true)
    const rule = run.rules![0]!
    expect(typeof rule.ruleId).toBe('string')
    expect(typeof rule.sequenceNum).toBe('number')
    expect(typeof rule.ruleText).toBe('string')
    expect(typeof rule.ruleLogic).toBe('string')
    expect(typeof rule.ruleType).toBe('string')
    expect(typeof rule.expression).toBe('string')
    expect(typeof rule.enabled).toBe('string')
    expect(typeof rule.severity).toBe('string')
    expect(typeof rule.file1FieldPath).toBe('string')
    expect(typeof rule.file2FieldPath).toBe('string')
    expect(typeof rule.operator).toBe('string')
    expect(Array.isArray(rule.preActions)).toBe(true)

    // Second run (minimal — requiresSystemSelection: true, no rules)
    const run2 = result.savedRuns[1]!
    expect(run2.savedRunId).toBe('sr-002')
    expect(run2.requiresSystemSelection).toBe(true)
    expect(Array.isArray(run2.systemOptions)).toBe(true)
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 4. create#RuleSetRun → CreateRuleSetRunResponse
// ────────────────────────────────────────────────────────────────────────────

describe('create#RuleSetRun → CreateRuleSetRunResponse', () => {
  it('exposes savedRun with all documented SavedRunSummary fields', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: ['Rule set run created.'],
      errors: [],
      savedRun: {
        savedRunId: 'sr-new-001',
        runName: 'New Rule Set Run',
        description: 'Created via API',
        companyUserGroupId: 'DARPAN_TENANT_A',
        companyLabel: 'Tenant A',
        runType: 'RULE_SET',
        reconciliationMappingId: null,
        ruleSetId: 'rs-new-001',
        compareScopeId: null,
        requiresSystemSelection: false,
        defaultFile1SystemEnumId: 'NS',
        defaultFile2SystemEnumId: 'OMS',
        systemOptions: [],
        rules: [],
      },
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { reconciliationFacade } = await import('../facade')
    const result = await reconciliationFacade.createRuleSetRun({
      runName: 'New Rule Set Run',
      file1SystemEnumId: 'NS',
      file2SystemEnumId: 'OMS',
    })

    // ApiEnvelope
    expect(result.ok).toBe(true)
    expect(Array.isArray(result.messages)).toBe(true)
    expect(result.messages[0]).toBe('Rule set run created.')
    expect(Array.isArray(result.errors)).toBe(true)

    // CreateRuleSetRunResponse.savedRun?: SavedRunSummary
    expect(result.savedRun).toBeDefined()
    const sr = result.savedRun!
    expect(typeof sr.savedRunId).toBe('string')
    expect(sr.savedRunId).toBe('sr-new-001')
    expect(typeof sr.runName).toBe('string')
    expect(sr.runName).toBe('New Rule Set Run')
    expect(typeof sr.description).toBe('string')
    expect(typeof sr.companyUserGroupId).toBe('string')
    expect(typeof sr.companyLabel).toBe('string')
    expect(typeof sr.runType).toBe('string')
    expect(sr.runType).toBe('RULE_SET')
    expect(typeof sr.ruleSetId).toBe('string')
    expect(typeof sr.requiresSystemSelection).toBe('boolean')
    expect(sr.requiresSystemSelection).toBe(false)
    expect(typeof sr.defaultFile1SystemEnumId).toBe('string')
    expect(typeof sr.defaultFile2SystemEnumId).toBe('string')
    expect(Array.isArray(sr.systemOptions)).toBe(true)
    expect(Array.isArray(sr.rules)).toBe(true)
  })

  it('throws ApiCallError when ok=false (client error-throw contract)', async () => {
    // The client throws ApiCallError when ok=false or errors.length > 0.
    // This test documents and pins that behavior: a backend-side validation
    // failure surfaces as a thrown error, not a resolved value.
    const wireBody = rpcSuccess({
      ok: false,
      messages: [],
      errors: ['runName is required'],
      savedRun: null,
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { reconciliationFacade } = await import('../facade')
    await expect(
      reconciliationFacade.createRuleSetRun({
        runName: '',
        file1SystemEnumId: 'NS',
        file2SystemEnumId: 'OMS',
      }),
    ).rejects.toMatchObject({
      name: 'ApiCallError',
      message: 'runName is required',
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 5. run#SavedRunDiff → RunSavedRunDiffResponse
// ────────────────────────────────────────────────────────────────────────────

describe('run#SavedRunDiff → RunSavedRunDiffResponse', () => {
  it('exposes runResult with all documented RunSavedRunDiffResult and GeneratedOutput fields', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      validationErrors: [],
      processingWarnings: ['File2 has 0 extra rows'],
      runResult: {
        savedRunId: 'sr-001',
        runName: 'Orders vs NetSuite',
        runType: 'RULE_SET',
        reconciliationMappingId: 'mapping-001',
        ruleSetId: 'rs-001',
        compareScopeId: null,
        file1Name: 'orders_2026-06-29.csv',
        file2Name: 'netsuite_2026-06-29.csv',
        file1SystemEnumId: 'OMS',
        file1SystemLabel: 'OMS Orders',
        file2SystemEnumId: 'NS',
        file2SystemLabel: 'NetSuite',
        validationErrors: [],
        processingWarnings: ['File2 has 0 extra rows'],
        generatedOutput: {
          fileName: 'diff_sr-001_20260629.json',
          reconciliationRunResultId: 'rrr-001',
          sourceFormat: 'json',
          availableFormats: ['json', 'csv'],
          preferredDownloadFormat: 'csv',
          savedRunId: 'sr-001',
          savedRunName: 'Orders vs NetSuite',
          savedRunType: 'RULE_SET',
          reconciliationMappingId: 'mapping-001',
          mappingName: 'Orders Mapping',
          ruleSetId: 'rs-001',
          compareScopeId: null,
          reconciliationType: 'RULE_SET',
          file1Label: 'OMS Orders',
          file2Label: 'NetSuite',
          totalDifferences: 3,
          onlyInFile1Count: 1,
          onlyInFile2Count: 2,
          createdDate: '2026-06-29T10:00:00Z',
          sizeBytes: 12345,
          statusEnumId: 'COMPLETED',
          statusLabel: 'Completed',
          resultAvailable: true,
          startedDate: '2026-06-29T09:55:00Z',
          completedDate: '2026-06-29T09:58:00Z',
          lastUpdatedDate: '2026-06-29T10:00:00Z',
        },
      },
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { reconciliationFacade } = await import('../facade')
    const result = await reconciliationFacade.runSavedRunDiff({ savedRunId: 'sr-001' })

    // ApiEnvelope
    expect(result.ok).toBe(true)
    expect(Array.isArray(result.messages)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)

    // RunSavedRunDiffResponse own fields
    expect(Array.isArray(result.validationErrors)).toBe(true)
    expect(Array.isArray(result.processingWarnings)).toBe(true)
    expect(result.processingWarnings).toContain('File2 has 0 extra rows')

    // runResult: RunSavedRunDiffResult
    expect(result.runResult).toBeDefined()
    const rr = result.runResult!
    expect(typeof rr.savedRunId).toBe('string')
    expect(rr.savedRunId).toBe('sr-001')
    expect(typeof rr.runName).toBe('string')
    expect(typeof rr.runType).toBe('string')
    expect(typeof rr.reconciliationMappingId).toBe('string')
    expect(typeof rr.ruleSetId).toBe('string')
    expect(rr.compareScopeId).toBeNull()
    expect(typeof rr.file1Name).toBe('string')
    expect(typeof rr.file2Name).toBe('string')
    expect(typeof rr.file1SystemEnumId).toBe('string')
    expect(typeof rr.file1SystemLabel).toBe('string')
    expect(typeof rr.file2SystemEnumId).toBe('string')
    expect(typeof rr.file2SystemLabel).toBe('string')
    expect(Array.isArray(rr.validationErrors)).toBe(true)
    expect(Array.isArray(rr.processingWarnings)).toBe(true)

    // generatedOutput: GeneratedOutput
    expect(rr.generatedOutput).toBeDefined()
    const go = rr.generatedOutput!
    expect(typeof go.fileName).toBe('string')
    expect(go.fileName).toBe('diff_sr-001_20260629.json')
    expect(typeof go.reconciliationRunResultId).toBe('string')
    expect(typeof go.sourceFormat).toBe('string')
    expect(Array.isArray(go.availableFormats)).toBe(true)
    expect(go.availableFormats).toContain('json')
    expect(go.availableFormats).toContain('csv')
    expect(typeof go.preferredDownloadFormat).toBe('string')
    expect(typeof go.savedRunId).toBe('string')
    expect(typeof go.savedRunName).toBe('string')
    expect(typeof go.savedRunType).toBe('string')
    expect(typeof go.reconciliationMappingId).toBe('string')
    expect(typeof go.mappingName).toBe('string')
    expect(typeof go.ruleSetId).toBe('string')
    expect(typeof go.reconciliationType).toBe('string')
    expect(typeof go.file1Label).toBe('string')
    expect(typeof go.file2Label).toBe('string')
    expect(typeof go.totalDifferences).toBe('number')
    expect(go.totalDifferences).toBe(3)
    expect(typeof go.onlyInFile1Count).toBe('number')
    expect(typeof go.onlyInFile2Count).toBe('number')
    expect(typeof go.createdDate).toBe('string')
    expect(typeof go.sizeBytes).toBe('number')
    expect(typeof go.statusEnumId).toBe('string')
    expect(typeof go.statusLabel).toBe('string')
    expect(typeof go.resultAvailable).toBe('boolean')
    expect(go.resultAvailable).toBe(true)
    expect(typeof go.startedDate).toBe('string')
    expect(typeof go.completedDate).toBe('string')
    expect(typeof go.lastUpdatedDate).toBe('string')
  })

  it('throws ApiCallError when ok=false (client error-throw contract — validation failed path)', async () => {
    // When the backend returns ok=false with a non-empty errors array, the
    // client throws ApiCallError with the first error message. Application code
    // catches this — it is the correct production behavior. This test pins it.
    const wireBody = rpcSuccess({
      ok: false,
      messages: [],
      errors: ['file1SystemEnumId is required'],
      validationErrors: ['file1SystemEnumId is required'],
      processingWarnings: [],
      runResult: null,
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { reconciliationFacade } = await import('../facade')
    await expect(
      reconciliationFacade.runSavedRunDiff({ savedRunId: 'sr-bad' }),
    ).rejects.toMatchObject({
      name: 'ApiCallError',
      message: 'file1SystemEnumId is required',
    })
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 6. get#TenantSettings → GetTenantSettingsResponse
// ────────────────────────────────────────────────────────────────────────────

describe('get#TenantSettings → GetTenantSettingsResponse', () => {
  it('exposes tenantSettings with all documented TenantSettings fields', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      tenantSettings: {
        companyUserGroupId: 'DARPAN_TENANT_A',
        companyLabel: 'Tenant A',
        timeZone: 'Asia/Kolkata',
        createdByUserId: 'admin',
        createdDate: '2026-01-01T00:00:00Z',
        lastUpdatedDate: '2026-06-29T00:00:00Z',
      },
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { settingsFacade } = await import('../facade')
    const result = await settingsFacade.getTenantSettings()

    // ApiEnvelope
    expect(result.ok).toBe(true)
    expect(Array.isArray(result.messages)).toBe(true)
    expect(Array.isArray(result.errors)).toBe(true)

    // GetTenantSettingsResponse.tenantSettings?: TenantSettings
    expect(result.tenantSettings).toBeDefined()
    const ts = result.tenantSettings!

    // TenantSettings documented fields
    // companyUserGroupId?: string | null
    expect(typeof ts.companyUserGroupId).toBe('string')
    expect(ts.companyUserGroupId).toBe('DARPAN_TENANT_A')

    // companyLabel?: string | null
    expect(typeof ts.companyLabel).toBe('string')
    expect(ts.companyLabel).toBe('Tenant A')

    // timeZone: string  (REQUIRED — no ? in the interface)
    expect(typeof ts.timeZone).toBe('string')
    expect(ts.timeZone).toBe('Asia/Kolkata')

    // createdByUserId?: string
    expect(typeof ts.createdByUserId).toBe('string')
    expect(ts.createdByUserId).toBe('admin')

    // createdDate?: string
    expect(typeof ts.createdDate).toBe('string')

    // lastUpdatedDate?: string
    expect(typeof ts.lastUpdatedDate).toBe('string')
  })

  it('handles missing optional fields (only timeZone present)', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      tenantSettings: {
        timeZone: 'UTC',
      },
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { settingsFacade } = await import('../facade')
    const result = await settingsFacade.getTenantSettings()

    expect(result.ok).toBe(true)
    expect(result.tenantSettings).toBeDefined()
    // timeZone is the only required field on TenantSettings
    expect(result.tenantSettings!.timeZone).toBe('UTC')
    // Optional fields absent — undefined, not throw
    expect(result.tenantSettings!.companyUserGroupId).toBeUndefined()
    expect(result.tenantSettings!.companyLabel).toBeUndefined()
    expect(result.tenantSettings!.createdByUserId).toBeUndefined()
  })

  it('handles null tenantSettings (unauthenticated or no tenant)', async () => {
    const wireBody = rpcSuccess({
      ok: true,
      messages: [],
      errors: [],
      tenantSettings: null,
    })

    vi.stubGlobal('fetch', mockFetchOnce(wireBody))

    const { settingsFacade } = await import('../facade')
    const result = await settingsFacade.getTenantSettings()

    expect(result.ok).toBe(true)
    expect(result.tenantSettings == null).toBe(true)
  })
})
