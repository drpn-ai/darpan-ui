import { describe, expect, it } from 'vitest'
import { countLabel } from '../strings'

describe('countLabel', () => {
  it('uses the singular only for exactly one', () => {
    expect(countLabel(1, 'space')).toBe('1 space')
    expect(countLabel(0, 'space')).toBe('0 spaces')
    expect(countLabel(2, 'entry', 'entries')).toBe('2 entries')
  })
})
