import { afterEach, describe, expect, it } from 'vitest'
import {
  displayCalendarDayOf,
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
