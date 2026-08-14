import { describe, expect, it } from 'vitest'
import { sharedTileSuffix, SHARED_CONFIG_TYPES } from '../sharedConfig'

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
