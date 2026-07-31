/**
 * registryContract.spec.ts
 *
 * Meta-tests that validate the facade registry constants and wrapper exports
 * in src/lib/api/facade.ts, without modifying any runtime code.
 *
 * Assertions:
 *   (a) Every method string passed to callService by a facade wrapper is a
 *       non-empty string starting with "facade." and containing the
 *       verb#Noun pattern.
 *   (b) No duplicate method strings exist across all four facade wrappers
 *       (authFacade, settingsFacade, jsonSchemaFacade, reconciliationFacade).
 *   (c) The four exported facade wrapper objects are present, are plain
 *       objects, and each exposes a non-empty set of callable methods whose
 *       names match the expected operation set.
 *   (d) Each wrapper method passes its method string as the first argument
 *       to callService — verified by spying on callService at the module level.
 *
 * Strategy for (a)+(b): we vi.mock('../client') to intercept callService calls,
 * then invoke each wrapper method (passing minimal safe payloads) and collect
 * the method strings that would have been sent to the backend.  The mock
 * resolves with a minimal ok envelope so callService does not throw.
 *
 * No runtime code is touched. No new deps added.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { installLocalStorageStub } from '../../../test/localStorage'

// ─── Minimal ok envelope that callService would return ────────────────────────
const MIN_OK = { ok: true, messages: [], errors: [] }

// ─── Mock callService BEFORE importing facade ─────────────────────────────────
// Using vi.hoisted so the mock factory runs before imports are resolved.
const capturedMethods = vi.hoisted(() => {
  const methods: string[] = []
  return methods
})

vi.mock('../client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../client')>()
  return {
    ...original,
    callService: vi.fn(async (method: string) => {
      capturedMethods.push(method)
      return MIN_OK
    }),
  }
})

// Import facade AFTER the mock is set up.
import {
  authFacade,
  settingsFacade,
  jsonSchemaFacade,
  reconciliationFacade,
} from '../facade'

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  capturedMethods.length = 0
  vi.clearAllMocks()
  installLocalStorageStub()
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Invokes each method on a facade object with the minimal safe payload needed
 * to reach callService (strings → '', numbers → 0, arrays → []).  The mock
 * resolves immediately so no network call is made.
 */
async function driveAllMethods(facade: Record<string, unknown>): Promise<void> {
  for (const key of Object.keys(facade)) {
    const fn = facade[key]
    if (typeof fn !== 'function') continue

    try {
      // Call with no arguments — if it needs params, catch the sync throw.
      // The mock resolves before any param validation in the wrapper body runs.
      await (fn as (...args: unknown[]) => Promise<unknown>)()
    } catch {
      // Some wrappers destructure params eagerly before callService; try a
      // minimal object as first arg.
      try {
        await (fn as (...args: unknown[]) => Promise<unknown>)({
          pageIndex: 0,
          pageSize: 20,
          // Common required string fields used across payloads
          savedRunId: 'sr-x',
          automationId: 'auto-x',
          runName: 'test',
          file1SystemEnumId: 'SYS1',
          file2SystemEnumId: 'SYS2',
          fileName: 'f.json',
          format: 'json',
          enumTypeId: 'TEST',
          jsonSchemaId: 'schema-x',
          schemaName: 'test',
          systemEnumId: 'SYS1',
          schemaText: '{}',
          jsonText: '{}',
          endpointUrl: 'https://x',
          httpMethod: 'GET',
          nsAuthConfigId: 'ns-x',
          connectTimeoutSeconds: 10,
          readTimeoutSeconds: 10,
          host: 'host',
          port: 22,
          username: 'u',
          authType: 'BASIC',
          shopifyAuthConfigId: 'sh-x',
          shopApiUrl: 'https://shop.example.com',
          apiVersion: '2024-01',
          timeZone: 'UTC',
          omsRestSourceConfigId: 'oms-x',
          baseUrl: 'https://oms.example.com',
          chatSpaceId: 'cs-x',
          spaceName: 'Ops',
          googleChatWebhookUrl: 'https://chat.googleapis.com/v1/spaces/x/messages?key=k&token=t',
          reconciliationRunResultId: 'rr-x',
          mappingName: 'm',
          reconciliationMappingId: 'map-x',
          reconciliationMappingIds: [],
          pinnedSavedRunIds: [],
          activeTenantUserGroupId: 'tg-x',
          fieldList: [],
          isActive: 'Y',
          fileSide: 'FILE1',
          sourceTypeEnumId: 'ST1',
          nsRestletConfigId: 'nsr-x',
          llmProvider: 'openai',
        })
      } catch {
        // If both attempts fail, the method was never reached — skip.
      }
    }
  }
}

// ─── (a) + (b) Method string shape and uniqueness ─────────────────────────────

describe('registry contract — method string shape', () => {
  it('every method string starts with "facade." and matches verb#Noun pattern', async () => {
    const wrappers = [
      authFacade as Record<string, unknown>,
      settingsFacade as Record<string, unknown>,
      jsonSchemaFacade as Record<string, unknown>,
      reconciliationFacade as Record<string, unknown>,
    ]

    for (const wrapper of wrappers) {
      await driveAllMethods(wrapper)
    }

    // We must have captured at least one method string.
    expect(capturedMethods.length).toBeGreaterThan(0)

    for (const method of capturedMethods) {
      expect(method, `Method string "${method}" must start with "facade."`).toMatch(/^facade\./)
      expect(method, `Method string "${method}" must be non-empty`).toBeTruthy()
      // Must contain the verb#Noun segment (e.g. login#Session, list#SavedRuns)
      expect(method, `Method string "${method}" must contain verb#Noun`).toMatch(/[a-z]+#[A-Z][A-Za-z]+/)
    }
  })
})

describe('registry contract — no duplicate method strings', () => {
  it('no two facade wrapper methods call the same backend method string', async () => {
    const wrappers = [
      authFacade as Record<string, unknown>,
      settingsFacade as Record<string, unknown>,
      jsonSchemaFacade as Record<string, unknown>,
      reconciliationFacade as Record<string, unknown>,
    ]

    for (const wrapper of wrappers) {
      await driveAllMethods(wrapper)
    }

    const freq = new Map<string, number>()
    for (const method of capturedMethods) {
      freq.set(method, (freq.get(method) ?? 0) + 1)
    }

    const duplicates = [...freq.entries()]
      .filter(([, count]) => count > 1)
      .map(([str, count]) => `${str} (x${count})`)

    expect(duplicates, `Duplicate method strings: ${duplicates.join(', ')}`).toHaveLength(0)
  })
})

// ─── (c) Exported facade wrapper presence and method coverage ─────────────────

describe('registry contract — exported wrapper presence', () => {
  it.each([
    ['authFacade', authFacade],
    ['settingsFacade', settingsFacade],
    ['jsonSchemaFacade', jsonSchemaFacade],
    ['reconciliationFacade', reconciliationFacade],
  ] as const)('%s is exported as a plain object with callable methods', (_name, facade) => {
    expect(typeof facade).toBe('object')
    expect(facade).not.toBeNull()

    const methodCount = Object.keys(facade).filter(
      (k) => typeof (facade as Record<string, unknown>)[k] === 'function',
    ).length
    expect(methodCount, `${_name} must expose at least one method`).toBeGreaterThan(0)
  })

  it('authFacade covers the required auth operations', () => {
    const af = authFacade as Record<string, unknown>
    expect(typeof af.loginSession).toBe('function')
    expect(typeof af.getSessionInfo).toBe('function')
    expect(typeof af.logoutSession).toBe('function')
    expect(typeof af.saveActiveTenant).toBe('function')
    expect(typeof af.saveUserSettings).toBe('function')
    expect(typeof af.verifyOwnPassword).toBe('function')
    expect(typeof af.changeOwnPassword).toBe('function')
  })

  it('reconciliationFacade covers the core run lifecycle operations', () => {
    const rf = reconciliationFacade as Record<string, unknown>
    expect(typeof rf.createRuleSetRun).toBe('function')
    expect(typeof rf.saveRuleSetRun).toBe('function')
    expect(typeof rf.listSavedRuns).toBe('function')
    expect(typeof rf.runSavedRunDiff).toBe('function')
    expect(typeof rf.deleteSavedRun).toBe('function')
    expect(typeof rf.listGeneratedOutputs).toBe('function')
    expect(typeof rf.getGeneratedOutput).toBe('function')
    expect(typeof rf.getGeneratedOutputDifferences).toBe('function')
    expect(typeof rf.getReconciliationRunStatus).toBe('function')
    // Automation operations
    expect(typeof rf.listAutomations).toBe('function')
    expect(typeof rf.getAutomation).toBe('function')
    expect(typeof rf.saveAutomation).toBe('function')
    expect(typeof rf.deleteAutomation).toBe('function')
    expect(typeof rf.runAutomationNow).toBe('function')
    expect(typeof rf.listAutomationExecutions).toBe('function')
    expect(typeof rf.listAutomationSourceOptions).toBe('function')
    expect(typeof rf.subscribeRunNotification).toBe('function')
    expect(typeof rf.unsubscribeRunNotification).toBe('function')
  })

  it('settingsFacade covers the tenant and LLM settings operations', () => {
    const sf = settingsFacade as Record<string, unknown>
    expect(typeof sf.getTenantSettings).toBe('function')
    expect(typeof sf.saveTenantSettings).toBe('function')
    expect(typeof sf.listTenantChatSpaces).toBe('function')
    expect(typeof sf.saveTenantChatSpace).toBe('function')
    expect(typeof sf.deleteTenantChatSpace).toBe('function')
    expect(typeof sf.getUserNotificationDefault).toBe('function')
    expect(typeof sf.saveUserNotificationDefault).toBe('function')
    expect(typeof sf.getLlmSettings).toBe('function')
    expect(typeof sf.saveLlmSettings).toBe('function')
    expect(typeof sf.listEnumOptions).toBe('function')
    expect(typeof sf.listSftpServers).toBe('function')
    expect(typeof sf.saveSftpServer).toBe('function')
    expect(typeof sf.listNsAuthConfigs).toBe('function')
    expect(typeof sf.saveNsAuthConfig).toBe('function')
    expect(typeof sf.listNsRestletConfigs).toBe('function')
    expect(typeof sf.saveNsRestletConfig).toBe('function')
    expect(typeof sf.listShopifyAuthConfigs).toBe('function')
    expect(typeof sf.getShopifyAuthConfig).toBe('function')
    expect(typeof sf.saveShopifyAuthConfig).toBe('function')
    expect(typeof sf.deleteShopifyAuthConfig).toBe('function')
    expect(typeof sf.listOmsRestSourceConfigs).toBe('function')
    expect(typeof sf.saveOmsRestSourceConfig).toBe('function')
    expect(typeof sf.deleteOmsRestSourceConfig).toBe('function')
  })

  it('jsonSchemaFacade covers the full schema CRUD lifecycle', () => {
    const jf = jsonSchemaFacade as Record<string, unknown>
    expect(typeof jf.list).toBe('function')
    expect(typeof jf.get).toBe('function')
    expect(typeof jf.saveText).toBe('function')
    expect(typeof jf.inferFromText).toBe('function')
    expect(typeof jf.validateText).toBe('function')
    expect(typeof jf.flatten).toBe('function')
    expect(typeof jf.saveRefined).toBe('function')
    expect(typeof jf.delete).toBe('function')
  })
})

// ─── (d) Method string count matches wrapper method count ──────────────────────

describe('registry contract — method string coverage completeness', () => {
  it('each facade wrapper method produces exactly one callService call', async () => {
    // AUTH facade
    const authMethodCount = Object.keys(authFacade).filter(
      (k) => typeof (authFacade as Record<string, unknown>)[k] === 'function',
    ).length

    const beforeAuth = capturedMethods.length
    await driveAllMethods(authFacade as Record<string, unknown>)
    const authCaptured = capturedMethods.length - beforeAuth

    expect(authCaptured).toBe(authMethodCount)
  })

  it('every captured method string from settingsFacade is distinct', async () => {
    const before = capturedMethods.length
    await driveAllMethods(settingsFacade as Record<string, unknown>)
    const captured = capturedMethods.slice(before)

    const unique = new Set(captured)
    expect(unique.size).toBe(captured.length)
  })

  it('every captured method string from reconciliationFacade is distinct', async () => {
    const before = capturedMethods.length
    await driveAllMethods(reconciliationFacade as Record<string, unknown>)
    const captured = capturedMethods.slice(before)

    const unique = new Set(captured)
    expect(unique.size).toBe(captured.length)
  })

  it('every captured method string from jsonSchemaFacade is distinct', async () => {
    const before = capturedMethods.length
    await driveAllMethods(jsonSchemaFacade as Record<string, unknown>)
    const captured = capturedMethods.slice(before)

    const unique = new Set(captured)
    expect(unique.size).toBe(captured.length)
  })
})

// ─── (e) Key method strings are exactly what the TS types document ─────────────

describe('registry contract — known method string values', () => {
  it('authFacade wires the documented AUTH method strings', async () => {
    await driveAllMethods(authFacade as Record<string, unknown>)

    // These literals come directly from the AUTH registry in facade.ts.
    // If any of these strings change, this test fails and surfaces the drift.
    expect(capturedMethods).toContain('facade.AuthFacadeServices.login#Session')
    expect(capturedMethods).toContain('facade.AuthFacadeServices.get#SessionInfo')
    expect(capturedMethods).toContain('facade.AuthFacadeServices.logout#Session')
    expect(capturedMethods).toContain('facade.AuthFacadeServices.save#ActiveTenant')
    expect(capturedMethods).toContain('facade.AuthFacadeServices.save#UserSettings')
    expect(capturedMethods).toContain('facade.AuthFacadeServices.verify#OwnPassword')
    expect(capturedMethods).toContain('facade.AuthFacadeServices.change#OwnPassword')
  })

  it('settingsFacade wires the documented SETTINGS method strings', async () => {
    await driveAllMethods(settingsFacade as Record<string, unknown>)

    expect(capturedMethods).toContain('facade.SettingsFacadeServices.list#EnumOptions')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.get#LlmSettings')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#LlmSettings')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.get#TenantSettings')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#TenantSettings')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.list#TenantChatSpaces')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#TenantChatSpace')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.delete#TenantChatSpace')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.get#UserNotificationDefault')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#UserNotificationDefault')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.list#SftpServers')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#SftpServer')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.list#NsAuthConfigs')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#NsAuthConfig')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.list#NsRestletConfigs')
    expect(capturedMethods).toContain('facade.SettingsFacadeServices.save#NsRestletConfig')
    // Shopify uses a different service class
    expect(capturedMethods).toContain('facade.ShopifyFacadeServices.list#ShopifyAuthConfigs')
    expect(capturedMethods).toContain('facade.ShopifyFacadeServices.get#ShopifyAuthConfig')
    expect(capturedMethods).toContain('facade.ShopifyFacadeServices.save#ShopifyAuthConfig')
    expect(capturedMethods).toContain('facade.ShopifyFacadeServices.delete#ShopifyAuthConfig')
    // HotWax OMS
    expect(capturedMethods).toContain('facade.HotWaxOmsFacadeServices.list#HotWaxOmsRestSourceConfigs')
    expect(capturedMethods).toContain('facade.HotWaxOmsFacadeServices.save#HotWaxOmsRestSourceConfig')
    expect(capturedMethods).toContain('facade.HotWaxOmsFacadeServices.delete#HotWaxOmsRestSourceConfig')
  })

  it('reconciliationFacade wires the documented RECONCILIATION method strings', async () => {
    await driveAllMethods(reconciliationFacade as Record<string, unknown>)

    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.create#RuleSetRun')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.save#RuleSetRun')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.list#SavedRuns')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.get#Mapping')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.save#Mapping')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.save#DashboardPinnedSavedRuns')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.save#SavedRunName')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.delete#SavedRun')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.run#SavedRunDiff')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.list#GeneratedOutputs')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.get#GeneratedOutput')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.get#GeneratedOutputDifferences')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.list#Automations')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.get#Automation')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.save#Automation')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.delete#Automation')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.run#AutomationNow')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.list#AutomationExecutions')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.list#AutomationSourceOptions')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.subscribe#RunNotification')
    expect(capturedMethods).toContain('facade.ReconciliationFacadeServices.unsubscribe#RunNotification')
  })

  it('jsonSchemaFacade wires the documented JSON_SCHEMA method strings', async () => {
    await driveAllMethods(jsonSchemaFacade as Record<string, unknown>)

    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.list#JsonSchemas')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.get#JsonSchema')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.save#JsonSchemaText')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.infer#JsonSchemaFromText')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.validate#JsonTextAgainstSchema')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.flatten#JsonSchema')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.save#RefinedSchema')
    expect(capturedMethods).toContain('facade.JsonSchemaFacadeServices.delete#JsonSchema')
  })
})
