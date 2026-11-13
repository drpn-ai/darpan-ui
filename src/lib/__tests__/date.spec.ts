import { describe, expect, it } from 'vitest'
import { formatDateTime, formatSavedResultDateTime, formatShortDate, setDefaultDisplayTimeZone } from '../utils/date'

describe('date utilities', () => {
  it('uses the configured fallback when the value is missing', () => {
    expect(formatDateTime(null)).toBe('-')
    expect(formatSavedResultDateTime('')).toBe('Saved result')
  })

  it('returns the original value when the date is invalid', () => {
    expect(formatDateTime('not-a-date')).toBe('not-a-date')
  })

  it('formats valid timestamps consistently with the requested locale', () => {
    expect(formatDateTime('2026-04-25T10:30:00.000Z', { locale: 'en-US' })).toContain('2026')
  })

  it('formats epoch millisecond timestamps from facade responses', () => {
    expect(formatDateTime(1777740540000, { locale: 'en-US' })).toContain('2026')
  })

  it('formats timestamps in the requested timezone', () => {
    // The zone is no longer appended — it is asked for by resting on the timestamp.
    expect(formatDateTime('2026-05-02T06:00:00.000Z', { locale: 'en-US', timeZone: 'America/Los_Angeles' })).toBe('May 1, 2026, 11:00 PM')
  })

  it('a short date is the day in the app\'s display time zone, not the browser\'s', () => {
    // 03:00 UTC on 1 Dec is still 30 Nov in Los Angeles: a due date read in the wrong zone is a day early.
    setDefaultDisplayTimeZone('America/Los_Angeles')
    expect(formatShortDate('2026-12-01T03:00:00Z')).toBe('30 Nov')
    setDefaultDisplayTimeZone('Asia/Kolkata')
    expect(formatShortDate('2026-12-01T03:00:00Z')).toBe('1 Dec')
    setDefaultDisplayTimeZone(undefined)
    expect(formatShortDate(null)).toBe('')
    expect(formatShortDate('not-a-date')).toBe('')
  })
})
