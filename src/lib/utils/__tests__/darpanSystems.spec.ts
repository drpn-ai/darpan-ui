import { describe, expect, it } from 'vitest'
import { canonicalDarpanSystemEnumId, darpanSystemDisplayLabel } from '../darpanSystems'

describe('transfer-order system canonicalization', () => {
  it('resolves every transfer-order alias to the canonical id', () => {
    expect(canonicalDarpanSystemEnumId('OMS_TRANSFER_ORDERS')).toBe('OMS_TRANSFER_ORDERS')
    expect(canonicalDarpanSystemEnumId('HOTWAX_TRANSFER_ORDERS')).toBe('OMS_TRANSFER_ORDERS')
    expect(canonicalDarpanSystemEnumId('DAR_SYS_OMS_TO')).toBe('OMS_TRANSFER_ORDERS')
  })

  it('does not collapse transfer orders into plain OMS', () => {
    expect(canonicalDarpanSystemEnumId('OMS_TRANSFER_ORDERS')).not.toBe('OMS')
    expect(canonicalDarpanSystemEnumId('OMS')).toBe('OMS')
  })

  it('has a display label', () => {
    expect(darpanSystemDisplayLabel('OMS_TRANSFER_ORDERS')).toBe('HotWax Transfer Orders')
  })
})
