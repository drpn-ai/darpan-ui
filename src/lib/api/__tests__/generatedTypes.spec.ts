import { describe, expect, expectTypeOf, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import type { Schemas } from '../generated'
import type {
  EnumOption,
  ListEnumOptionsResponse,
  LoginSessionResponse,
  LogoutSessionResponse,
  SessionInfo,
  SessionInfoResponse,
  SessionTenantOption,
} from '../types'

// Type-level compatibility guard (MACH P1, API management) between the hand-written
// response interfaces in ../types.ts and the types generated from the backend
// OpenAPI 3.1 contract (src/lib/api/contract/openapi.json → npm run
// generate-api-types → src/lib/api/generated/schema.d.ts).
//
// Direction of the checks: the hand-written types are STRICTER (required envelope
// fields, literal unions), the generated contract types are LOOSER (the contract
// emits no `required` arrays, so every generated field is optional). Asserting
// hand-written ⊆ generated proves the UI model stays inside the contract's shape.
// The expectTypeOf assertions are enforced at compile time by vue-tsc
// (npm run type-check); at vitest runtime they are no-ops.

type GeneratedLogin = Schemas['LoginSessionResult']
type GeneratedLogout = Schemas['LogoutSessionResult']
type GeneratedListEnumOptions = Schemas['ListEnumOptionsResult']
type GeneratedGetSessionInfo = Schemas['GetSessionInfoResult']
type GeneratedSessionInfo = NonNullable<GeneratedGetSessionInfo['sessionInfo']>

describe('generated contract types vs hand-written API types', () => {
  it('LoginSessionResult: envelope and auth-token contract fields line up', () => {
    expectTypeOf<LoginSessionResponse['ok']>().toMatchTypeOf<GeneratedLogin['ok']>()
    expectTypeOf<LoginSessionResponse['messages']>().toMatchTypeOf<GeneratedLogin['messages']>()
    expectTypeOf<LoginSessionResponse['errors']>().toMatchTypeOf<GeneratedLogin['errors']>()
    expectTypeOf<LoginSessionResponse['authenticated']>().toMatchTypeOf<
      GeneratedLogin['authenticated']
    >()
    expectTypeOf<LoginSessionResponse['authToken']>().toEqualTypeOf<GeneratedLogin['authToken']>()
    expectTypeOf<LoginSessionResponse['authTokenType']>().toEqualTypeOf<
      GeneratedLogin['authTokenType']
    >()
    expectTypeOf<LoginSessionResponse['authTokenHeaderName']>().toEqualTypeOf<
      GeneratedLogin['authTokenHeaderName']
    >()
    expectTypeOf<LoginSessionResponse['authTokenExpiresInSeconds']>().toEqualTypeOf<
      GeneratedLogin['authTokenExpiresInSeconds']
    >()
  })

  it('GetSessionInfoResult: envelope fields line up with SessionInfoResponse', () => {
    expectTypeOf<SessionInfoResponse['ok']>().toMatchTypeOf<GeneratedGetSessionInfo['ok']>()
    expectTypeOf<SessionInfoResponse['authenticated']>().toMatchTypeOf<
      GeneratedGetSessionInfo['authenticated']
    >()
  })

  it('sessionInfo payload: hand-written SessionInfo fields stay inside the generated shape', () => {
    expectTypeOf<SessionInfo['userId']>().toMatchTypeOf<GeneratedSessionInfo['userId']>()
    expectTypeOf<SessionInfo['username']>().toMatchTypeOf<GeneratedSessionInfo['username']>()
    // Array-ness + element shape of availableTenants.
    expectTypeOf<SessionInfo['availableTenants']>().toMatchTypeOf<
      GeneratedSessionInfo['availableTenants']
    >()
    expectTypeOf<SessionTenantOption>().toMatchTypeOf<
      NonNullable<GeneratedSessionInfo['availableTenants']>[number]
    >()
    // Hand-written string[] fits the contract's under-specified unknown[] items.
    expectTypeOf<SessionInfo['activeTenantPermissionGroupIds']>().toMatchTypeOf<
      GeneratedSessionInfo['activeTenantPermissionGroupIds']
    >()
    // Hand-written literal union ('GLOBAL' | 'TENANT' | 'ANONYMOUS') fits plain string.
    expectTypeOf<SessionInfo['scopeType']>().toMatchTypeOf<GeneratedSessionInfo['scopeType']>()
    // Contract timestamps are string | number; hand-written models string only.
    expectTypeOf<SessionInfo['lastLoginDate']>().toMatchTypeOf<
      GeneratedSessionInfo['lastLoginDate']
    >()
    expectTypeOf<SessionInfo['canManageDarpanCore']>().toMatchTypeOf<
      GeneratedSessionInfo['canManageDarpanCore']
    >()
  })

  it('encodes the known contract gap: the generator does not model explicit nulls', () => {
    // The backend serializer can emit explicit `null` values (the hand-written types
    // model `| null` on sessionInfo / customerScopeId / activeTenant*), but the
    // generated contract schemas only model absence (optional, no "null" type).
    // If these assertions start FAILING, the backend contract has started modeling
    // null — fold these fields into the positive checks above and retire the
    // hand-written `| null` unions where the contract now covers them.
    expectTypeOf<SessionInfoResponse['sessionInfo']>().not.toMatchTypeOf<
      GeneratedGetSessionInfo['sessionInfo']
    >()
    expectTypeOf<SessionInfo['customerScopeId']>().not.toMatchTypeOf<
      GeneratedSessionInfo['customerScopeId']
    >()
  })

  it('ListEnumOptionsResult: options array shape lines up', () => {
    expectTypeOf<ListEnumOptionsResponse['options']>().toMatchTypeOf<
      GeneratedListEnumOptions['options']
    >()
    expectTypeOf<EnumOption>().toMatchTypeOf<
      NonNullable<GeneratedListEnumOptions['options']>[number]
    >()
  })

  it('LogoutSessionResponse is the generated LogoutSessionResult and carries the consumed fields', () => {
    // types.ts re-exports the generated type under the legacy name (migration template).
    expectTypeOf<LogoutSessionResponse>().toEqualTypeOf<GeneratedLogout>()
    expectTypeOf<GeneratedLogout['ok']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<GeneratedLogout['authenticated']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<GeneratedLogout['authTokenRevoked']>().toEqualTypeOf<boolean | undefined>()
    expectTypeOf<GeneratedLogout['errors']>().toEqualTypeOf<string[] | undefined>()
  })

  it('committed openapi.json is non-trivial and defines every schema this spec checks', () => {
    const contract = JSON.parse(
      readFileSync(resolve(__dirname, '../contract/openapi.json'), 'utf-8'),
    ) as { components?: { schemas?: Record<string, unknown> } }
    const schemas = contract.components?.schemas ?? {}
    expect(Object.keys(schemas).length).toBeGreaterThanOrEqual(250)
    for (const name of [
      'LoginSessionResult',
      'LogoutSessionResult',
      'ListEnumOptionsResult',
      'GetSessionInfoResult',
      'JsonRpcError',
      'JsonRpcErrorResponse',
    ]) {
      expect(schemas, `schema ${name} missing from committed openapi.json`).toHaveProperty(name)
    }
  })
})
