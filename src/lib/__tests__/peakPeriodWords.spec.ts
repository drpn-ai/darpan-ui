import { afterEach, describe, expect, it } from 'vitest'
import type { PeakPeriodSummary } from '../api/peakTypes'
import { peakHoursUntilNotice, peakWhen } from '../peakPeriodWords'
import { setDefaultDisplayTimeZone } from '../utils/date'

const upcoming = (fromDate: string): PeakPeriodSummary => ({
  peakPeriodId: 'PP1', periodName: 'Black Friday sale', fromDate, thruDate: '2026-12-31', isActive: 'Y', state: 'upcoming',
})

describe('peakWhen', () => {
  const today = new Date(2026, 10, 24, 9, 0)

  it('reads Starts today when the browser is already on the start day, or past it, while the server says upcoming', () => {
    expect(peakWhen(upcoming('2026-11-24'), today)).toBe('Starts today')
    expect(peakWhen(upcoming('2026-11-23'), today)).toBe('Starts today')
  })

  it('counts the days ahead up to 30, then names the date', () => {
    expect(peakWhen(upcoming('2026-11-25'), today)).toBe('Starts tomorrow')
    expect(peakWhen(upcoming('2026-11-29'), today)).toBe('Starts in 5 days')
    expect(peakWhen(upcoming('2026-12-24'), today)).toBe('Starts in 30 days')
    expect(peakWhen(upcoming('2026-12-25'), today)).toBe('Starts Dec 25')
  })
})

describe('peakHoursUntilNotice', () => {
  afterEach(() => setDefaultDisplayTimeZone(undefined))

  it('reads the time on the tenant clock, whatever zone the viewer is in', () => {
    setDefaultDisplayTimeZone('Asia/Kolkata')
    expect(peakHoursUntilNotice('2026-11-28T07:00:00Z', 'America/Los_Angeles')).toBe('Peak hours until 23:00.')
  })

  it('names the viewer zone when there is no usable tenant zone', () => {
    setDefaultDisplayTimeZone('America/New_York')
    expect(peakHoursUntilNotice('2026-11-28T07:00:00Z', undefined)).toBe('Peak hours until 02:00 EST.')
    expect(peakHoursUntilNotice('2026-11-28T07:00:00Z', 'Not/AZone')).toBe('Peak hours until 02:00 EST.')
  })

  it('says nothing without a time', () => {
    expect(peakHoursUntilNotice(null, 'America/Los_Angeles')).toBe('')
    expect(peakHoursUntilNotice('not a time', 'America/Los_Angeles')).toBe('')
  })
})
