import { describe, expect, it } from 'vitest'
import { enumOptionLabel, toEnumSelectOption } from '../enumOptions'

// DAR-OPS-029 S99-123. One label rule for an enum option (label, else description, else code, else id), which six
// dropdown builders spelled out by hand.
describe('enum options', () => {
  it('labels an option by its label, description, code, then id', () => {
    expect(enumOptionLabel({ enumId: 'E', label: 'Label', description: 'Desc', enumCode: 'CODE' })).toBe('Label')
    expect(enumOptionLabel({ enumId: 'E', label: '', description: 'Desc', enumCode: 'CODE' })).toBe('Desc')
    expect(enumOptionLabel({ enumId: 'E', enumCode: 'CODE' })).toBe('CODE')
    expect(enumOptionLabel({ enumId: 'E' })).toBe('E')
  })

  it('makes a select option keyed by the enum id', () => {
    expect(toEnumSelectOption({ enumId: 'SHOPIFY', description: 'Shopify' })).toEqual({ value: 'SHOPIFY', label: 'Shopify' })
  })
})
