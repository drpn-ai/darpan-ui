import { describe, expect, it } from 'vitest'
import { formatDateTime, formatSavedResultDateTime } from '../utils/date'

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
})
