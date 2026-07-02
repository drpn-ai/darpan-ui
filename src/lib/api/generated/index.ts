// GENERATED-TYPES ENTRY POINT (MACH P1, API management).
//
// `schema.d.ts` in this directory is GENERATED from the backend OpenAPI 3.1 contract
// (src/lib/api/contract/openapi.json, itself produced by the darpan-backend
// generateApiContract task). NEVER hand-edit schema.d.ts. To refresh:
//
//   npm run sync-contract        # copy methods.txt + openapi.json from darpan-backend
//   npm run generate-api-types   # regenerate schema.d.ts via openapi-typescript
//
// Naming note: the contract's per-method `<Verb><Noun>Result` schemas are the facade
// envelope payloads (ok/messages/errors + data) that `callService` resolves with —
// i.e. what the hand-written `<Verb><Noun>Response` interfaces in ../types.ts model.
// The contract's `<Verb><Noun>Response` schemas are the outer JSON-RPC envelopes
// ({ jsonrpc, id, result }), which the client unwraps.
//
// Hand-written interfaces in ../types.ts are being progressively retired in favor of
// aliases into `Schemas` (see LogoutSessionResponse there for the template).

import type { components } from './schema'

/** All 262 contract schemas keyed by name (e.g. Schemas['LoginSessionResult']). */
export type Schemas = components['schemas']

/**
 * Facade result payload for a contract schema name — sugar for Schemas[K] that
 * documents intent at call sites (use with the `...Result` schema names).
 */
export type FacadeResult<K extends keyof Schemas & string> = Schemas[K]

export type { components, paths, operations } from './schema'
