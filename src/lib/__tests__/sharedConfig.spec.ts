import { describe, expect, it } from 'vitest'
import { sharedEditWarning, sharedTileSuffix, SHARED_CONFIG_TYPES } from '../sharedConfig'

describe('sharedEditWarning', () => {
  it('returns null when the config has no peer tenants (memberCount 1)', () => {
    expect(sharedEditWarning(1)).toBeNull()
  })

  it('returns null for a degenerate zero memberCount', () => {
    expect(sharedEditWarning(0)).toBeNull()
  })

  it('returns the two-tenant sentence when memberCount is 2', () => {
    expect(sharedEditWarning(2)).toBe(
      'This configuration is used by 2 tenants. Changes apply to all of them.',
    )
  })
})

describe('sharedTileSuffix', () => {
  it('returns an empty string when the config is not shared', () => {
    expect(sharedTileSuffix(false, 'X')).toBe('')
  })

  it('includes the owner label when the config is shared in from another tenant', () => {
    expect(sharedTileSuffix(true, 'Steve Madden')).toContain('Steve Madden')
  })

  it('falls back to a plain "shared" suffix when no owner label is available', () => {
    expect(sharedTileSuffix(true, null)).toBe(' — shared')
  })
})

describe('SHARED_CONFIG_TYPES', () => {
  it('mirrors the backend CONFIG_TYPE_REGISTRY enum ids', () => {
    expect(SHARED_CONFIG_TYPES).toEqual({
      hotwaxOms: 'SCFG_HOTWAX_OMS',
      shopifyAuth: 'SCFG_SHOPIFY_AUTH',
      netSuiteAuth: 'SCFG_NS_AUTH',
      netSuiteRestlet: 'SCFG_NS_RESTLET',
    })
  })
})
