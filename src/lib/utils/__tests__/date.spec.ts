import { afterEach, describe, expect, it } from 'vitest'
import {
  describeTimeZone,
  displayCalendarDayOf,
  timeZoneCode,
  displayDayStart,
  formatDateTime,
  getDefaultDisplayTimeZone,
  setDefaultDisplayTimeZone,
  todayInDisplayTimeZone,
} from '../date'

afterEach(() => setDefaultDisplayTimeZone(undefined))

describe('display timezone default', () => {
  it('formatDateTime uses the module default timezone when no option is given', () => {
    setDefaultDisplayTimeZone('Asia/Kolkata')
    expect(formatDateTime('2026-07-28T18:30:00Z', { locale: 'en-US' })).toContain('Jul 29, 2026')
  })

  it('an explicit timeZone option still wins over the default', () => {
    setDefaultDisplayTimeZone('Asia/Kolkata')
    expect(formatDateTime('2026-07-28T18:30:00Z', { locale: 'en-US', timeZone: 'UTC' })).toContain('Jul 28, 2026')
  })

  it('setter normalizes blank to undefined', () => {
    setDefaultDisplayTimeZone('  ')
    expect(getDefaultDisplayTimeZone()).toBeUndefined()
  })

  it('ignores timezone ids the browser cannot format', () => {
    setDefaultDisplayTimeZone('Not/AZone')
    expect(getDefaultDisplayTimeZone()).toBeUndefined()
    expect(() => formatDateTime('2026-07-28T18:30:00Z', { locale: 'en-US' })).not.toThrow()
  })
})

describe('display day helpers', () => {
  it('displayCalendarDayOf resolves an instant to the display-timezone calendar day', () => {
    const day = displayCalendarDayOf(new Date('2026-07-28T18:30:00Z'), 'Asia/Kolkata')
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 6, 29])
  })

  it('displayCalendarDayOf falls back to the runner-local day without a timezone', () => {
    const instant = new Date(2026, 6, 29, 15, 0, 0)
    const day = displayCalendarDayOf(instant)
    expect([day.getFullYear(), day.getMonth(), day.getDate()]).toEqual([2026, 6, 29])
  })

  it('displayDayStart anchors midnight in the display timezone', () => {
    expect(displayDayStart(new Date(2026, 6, 29), 'Asia/Kolkata').toISOString()).toBe('2026-07-28T18:30:00.000Z')
    expect(displayDayStart(new Date(2026, 6, 29), 'UTC').toISOString()).toBe('2026-07-29T00:00:00.000Z')
  })

  it('displayDayStart is DST-correct around US transitions', () => {
    // 2026-03-08: US spring forward (EST -> EDT at 02:00); midnight is still EST (UTC-5).
    expect(displayDayStart(new Date(2026, 2, 8), 'America/New_York').toISOString()).toBe('2026-03-08T05:00:00.000Z')
    // 2026-11-01: fall back; midnight is still EDT (UTC-4).
    expect(displayDayStart(new Date(2026, 10, 1), 'America/New_York').toISOString()).toBe('2026-11-01T04:00:00.000Z')
  })

  it('displayDayStart round-trips with displayCalendarDayOf', () => {
    const day = new Date(2026, 6, 29)
    const instant = displayDayStart(day, 'America/Los_Angeles')
    const roundTripped = displayCalendarDayOf(instant, 'America/Los_Angeles')
    expect([roundTripped.getFullYear(), roundTripped.getMonth(), roundTripped.getDate()]).toEqual([2026, 6, 29])
  })

  it('todayInDisplayTimeZone uses the module default', () => {
    setDefaultDisplayTimeZone('UTC')
    const now = new Date()
    const day = todayInDisplayTimeZone()
    expect([day.getFullYear(), day.getMonth(), day.getDate()])
      .toEqual([now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()])
  })
})

// Pinned in BOTH DST halves on purpose. A zone whose code is derived from its long name (IST, BST,
// AEST) reads correctly year-round only if the derivation follows the season, and the failure mode
// if CLDR shifts under us is silent: the code quietly becomes an offset like "GMT+5:30" again,
// which is the exact ambiguity this exists to remove.
describe('timeZoneCode', () => {
  const AUGUST = new Date('2026-08-31T06:07:00Z')
  const JANUARY = new Date('2026-01-15T06:07:00Z')

  it.each([
    ['Asia/Kolkata', 'IST', 'IST'],
    ['America/Los_Angeles', 'PDT', 'PST'],
    ['America/New_York', 'EDT', 'EST'],
    ['UTC', 'UTC', 'UTC'],
    ['Europe/London', 'BST', 'GMT'],
    ['Asia/Tokyo', 'JST', 'JST'],
    ['Australia/Sydney', 'AEST', 'AEDT'],
    ['Asia/Dubai', 'GST', 'GST'],
  ])('resolves %s to %s in August and %s in January', (zone, august, january) => {
    expect(timeZoneCode(AUGUST, zone)).toBe(august)
    expect(timeZoneCode(JANUARY, zone)).toBe(january)
  })

  // Initialising "Central European Standard Time" yields CEST, which asserts summer time in the
  // middle of winter — a wrong code is worse than an unfamiliar one, so this pair is overridden.
  it('does not claim summer time in winter for Central Europe', () => {
    expect(timeZoneCode(AUGUST, 'Europe/Paris')).toBe('CEST')
    expect(timeZoneCode(JANUARY, 'Europe/Paris')).toBe('CET')
  })

  // The viewer's locale must not decide this. en-IN renders Kolkata as IST but Los Angeles as
  // GMT-7, and en-US does the reverse, so an unpinned locale means two people reading the same run
  // see different labels on the same instant.
  it('is independent of the ambient locale', () => {
    expect(timeZoneCode(AUGUST, 'Asia/Kolkata')).toBe('IST')
    expect(timeZoneCode(AUGUST, 'America/Los_Angeles')).toBe('PDT')
  })
})

describe('formatDateTime carries the zone', () => {
  it('no longer appends the code — a timestamp is just the time', () => {
    // The code used to be printed after every timestamp. Repeated down hundreds of rows
    // it is noise, and it is only wanted at the moment someone doubts one particular
    // time. That is a question now, answered by describeTimeZone below.
    expect(formatDateTime('2026-05-02T06:00:00.000Z', { locale: 'en-US', timeZone: 'Asia/Kolkata' }))
      .toBe('May 2, 2026, 11:30 AM')
  })

  it('names the zone on demand, with its offset, for the instant given', () => {
    expect(describeTimeZone('2026-05-02T06:00:00.000Z', 'Asia/Kolkata'))
      .toBe('IST (Asia/Kolkata, GMT+05:30)')
  })

  it('resolves the zone against the instant, so DST is not guessed', () => {
    // Los Angeles is PDT in August and PST in January; the same call must answer
    // differently rather than caching one of them.
    expect(describeTimeZone('2026-08-02T06:00:00.000Z', 'America/Los_Angeles')).toContain('PDT')
    expect(describeTimeZone('2026-01-02T06:00:00.000Z', 'America/Los_Angeles')).toContain('PST')
  })

  it('leaves the fallback alone when there is no date to label', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })
})
