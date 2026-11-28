import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PeakPeriodSummary } from '../api/peakTypes'
import { peakDateRange, peakHoursUntilNotice, peakSettingsValue, peakWhen } from '../peakPeriodWords'
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

// DAR-OPS-029 U10a: "today" is the tenant's day (the display zone), never the browser's. At 20:00 UTC on Nov 26 it is
// already Nov 27 in Kolkata and still Nov 26 in Los Angeles, whatever zone the browser runs in.
describe('the day a period is counted from', () => {
  afterEach(() => {
    vi.useRealTimers()
    setDefaultDisplayTimeZone(undefined)
  })

  it('is the tenant’s day, not the browser’s', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-26T20:00:00Z'))
    setDefaultDisplayTimeZone('Asia/Kolkata')
    expect(peakWhen(upcoming('2026-11-27'))).toBe('Starts today')
    setDefaultDisplayTimeZone('America/Los_Angeles')
    expect(peakWhen(upcoming('2026-11-27'))).toBe('Starts tomorrow')
  })

  it('names the year by the tenant’s year', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-12-31T20:00:00Z'))
    setDefaultDisplayTimeZone('Asia/Kolkata')
    expect(peakDateRange('2027-01-02', '2027-01-02')).toBe('Jan 2')
    setDefaultDisplayTimeZone('America/Los_Angeles')
    expect(peakDateRange('2027-01-02', '2027-01-02')).toBe('Jan 2, 2027')
  })
})

// DAR-UI-159: RAILS 2026-11-27, a one-day period named for its day read "PEAK Nov 27 · Nov 27 – Nov 27".
describe('peakDateRange', () => {
  const today = new Date(2026, 10, 27, 9, 0)

  it('gives a one-day period its one date, and a longer one both ends', () => {
    expect(peakDateRange('2026-11-27', '2026-11-27', today)).toBe('Nov 27')
    expect(peakDateRange('2026-11-24', '2026-12-01', today)).toBe('Nov 24 – Dec 1')
  })

  it('adds the year when the period is not in the current year', () => {
    expect(peakDateRange('2027-11-26', '2027-11-26', today)).toBe('Nov 26, 2027')
    expect(peakDateRange('2026-12-30', '2027-01-02', today)).toBe('Dec 30, 2026 – Jan 2, 2027')
  })
})

describe('peakSettingsValue', () => {
  const today = new Date(2026, 10, 27, 9, 0)
  const on: PeakPeriodSummary = { peakPeriodId: 'PP2', periodName: 'PEAK Nov 27', fromDate: '2026-11-27', thruDate: '2026-11-27',
    isActive: 'Y', state: 'on' }

  it('names the period on now and says so, without repeating its dates', () => {
    expect(peakSettingsValue([upcoming('2026-11-30'), on], today)).toBe('PEAK Nov 27 · on now')
  })

  it('names the soonest coming period and when it starts, else None', () => {
    expect(peakSettingsValue([upcoming('2026-12-24'), upcoming('2026-11-30')], today)).toBe('Black Friday sale · starts in 3 days')
    expect(peakSettingsValue([{ ...on, state: 'ended' }], today)).toBe('None')
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
