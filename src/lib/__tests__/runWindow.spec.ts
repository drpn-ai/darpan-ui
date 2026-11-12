import { describe, expect, it } from 'vitest'
import { presetWindowRange, runWindowPresetOptions } from '../runWindow'

// DAR-UI-112: the third card is the month so far, through yesterday.
describe('runWindow month to date', () => {
  it('runs the 1st of the month through yesterday, the end exclusive today', () => {
    const range = presetWindowRange('month-to-date', new Date(2026, 10, 12))
    expect(range.startDate).toEqual(new Date(2026, 10, 1))
    expect(range.endExclusiveDate).toEqual(new Date(2026, 10, 12))
    expect(runWindowPresetOptions(new Date(2026, 10, 12))[2]?.label).toBe('Month to Date, Nov 1, 2026 to Nov 11, 2026')
  })

  it('on the 1st runs the whole month just ended, not zero days', () => {
    const range = presetWindowRange('month-to-date', new Date(2026, 11, 1))
    expect(range.startDate).toEqual(new Date(2026, 10, 1))
    expect(range.endExclusiveDate).toEqual(new Date(2026, 11, 1))
    expect(range.summary).toBe('Nov 1, 2026 to Nov 30, 2026')
  })

  it('on the 2nd names the one day', () => {
    expect(presetWindowRange('month-to-date', new Date(2027, 0, 2)).summary).toBe('Jan 1, 2027')
  })
})
