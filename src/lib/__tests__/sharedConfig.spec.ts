import { describe, expect, it } from 'vitest'
import { SHARED_CONFIG_TYPES } from '../sharedConfig'

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
