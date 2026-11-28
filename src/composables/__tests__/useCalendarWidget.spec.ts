import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useCalendarWidget } from '../useCalendarWidget'
import { buildCalendarMonth, formatDateInputValue, parseDateInput, setDefaultDisplayTimeZone } from '../../lib/utils/date'

describe('useCalendarWidget', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 4, 11))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders two months by default with the prior month visible first', () => {
    const calendar = useCalendarWidget()
    expect(calendar.calendarMonths.value).toHaveLength(2)
    expect(calendar.calendarMonths.value[0]!.label).toBe('April 2026')
    expect(calendar.calendarMonths.value[1]!.label).toBe('May 2026')
  })

  it('starts a selection on the start side then moves to end side', () => {
    const calendar = useCalendarWidget()
    const aprilMonth = calendar.calendarMonths.value[0]!
    const tenth = aprilMonth.cells.find((cell) => cell.isCurrentMonth && cell.day === 10)!
    const twelfth = aprilMonth.cells.find((cell) => cell.isCurrentMonth && cell.day === 12)!

    calendar.selectCell(tenth)
    expect(calendar.startDate.value).toBe('2026-04-10')
    expect(calendar.endDate.value).toBe('')
    expect(calendar.selecting.value).toBe('end')

    calendar.selectCell(twelfth)
    expect(calendar.endDate.value).toBe('2026-04-12')
    expect(calendar.range.value).not.toBeNull()
    expect(calendar.range.value?.startDate.getDate()).toBe(10)
    expect(calendar.range.value?.endExclusiveDate.getDate()).toBe(13)
  })

  // DAR-UI-162 (Aditi 2026-11-27: "the UI is off here"): a day standing alone, a start with no end yet or a one-day
  // range, is a circle only; the band between days belongs to a range of two days or more.
  it('marks a day standing alone as solo, so no band reaches out of its circle', () => {
    const calendar = useCalendarWidget()
    const april = calendar.calendarMonths.value[0]!
    const day = (n: number) => april.cells.find((cell) => cell.isCurrentMonth && cell.day === n)!
    const solo = 'wizard-api-calendar-day--range-solo'

    calendar.selectCell(day(17))
    expect(calendar.cellClasses(day(17))).toMatchObject({ 'wizard-api-calendar-day--range-start': true, [solo]: true })

    calendar.selectCell(day(17))
    expect(calendar.endDate.value).toBe('2026-04-17')
    expect(calendar.cellClasses(day(17))[solo]).toBe(true)

    calendar.selectCell(day(10))
    calendar.selectCell(day(12))
    expect(calendar.cellClasses(day(10))[solo]).toBe(false)
    expect(calendar.cellClasses(day(12))[solo]).toBe(false)
  })

  it('disables future dates and the cell-disabled helper agrees', () => {
    const calendar = useCalendarWidget()
    const mayMonth = calendar.calendarMonths.value[1]!
    const future = mayMonth.cells.find((cell) => cell.isCurrentMonth && cell.day === 31)!
    expect(calendar.isCellDisabled(future)).toBe(true)

    calendar.selectCell(future)
    expect(calendar.startDate.value).toBe('')
  })

  it('refuses to shift past the most recent allowed month', () => {
    const calendar = useCalendarWidget()
    expect(calendar.canShiftMonth(1)).toBe(false)
    calendar.shiftMonth(1)
    expect(calendar.calendarMonths.value[0]!.label).toBe('April 2026')
  })

  it('walks forward to the month of a latest pickable day in the future, and no further', () => {
    // A peak period is picked ahead of time: today May 11, picks allowed through July 20.
    const calendar = useCalendarWidget({ lastPickableDate: () => new Date(2026, 6, 20) })
    expect(calendar.canShiftMonth(1)).toBe(true)
    calendar.shiftMonth(1)
    calendar.shiftMonth(1)
    expect(calendar.calendarMonths.value.map((month) => month.label)).toEqual(['June 2026', 'July 2026'])
    expect(calendar.canShiftMonth(1)).toBe(false)

    calendar.startDate.value = '2026-09-01'
    calendar.focusVisibleMonthAroundStart()
    expect(calendar.calendarMonths.value[0]!.label).toBe('June 2026')

    const july = calendar.calendarMonths.value[1]!
    expect(calendar.isCellDisabled(july.cells.find((cell) => cell.isCurrentMonth && cell.day === 20)!)).toBe(false)
    expect(calendar.isCellDisabled(july.cells.find((cell) => cell.isCurrentMonth && cell.day === 21)!)).toBe(true)
  })

  it('keeps the usual view when the latest pickable day is in the past', () => {
    const calendar = useCalendarWidget({ lastPickableDate: () => new Date(2026, 2, 3) })
    expect(calendar.canShiftMonth(1)).toBe(false)
    calendar.startDate.value = '2026-05-02'
    calendar.focusVisibleMonthAroundStart()
    expect(calendar.calendarMonths.value[0]!.label).toBe('April 2026')
  })

  // Today is the tenant's day, never the browser's. 10:30Z on May 11 is already May 12 in Kiritimati
  // (UTC+14) while it is still May 11 in any browser zone a test runs in.
  it('takes today in the display (tenant) timezone, not the browser clock', () => {
    vi.setSystemTime(new Date(Date.UTC(2026, 4, 11, 10, 30)))
    setDefaultDisplayTimeZone('Pacific/Kiritimati')
    try {
      const calendar = useCalendarWidget()
      const may = calendar.calendarMonths.value[1]!
      const day = (n: number) => may.cells.find((cell) => cell.isCurrentMonth && cell.day === n)!
      expect(calendar.isCellDisabled(day(12))).toBe(false)
      expect(calendar.isCellDisabled(day(13))).toBe(true)
    } finally {
      setDefaultDisplayTimeZone(undefined)
    }
  })

  it('emits onRangeConfirmed when both dates land', () => {
    const confirmed = vi.fn()
    const calendar = useCalendarWidget({ onRangeConfirmed: confirmed })
    const aprilMonth = calendar.calendarMonths.value[0]!
    const first = aprilMonth.cells.find((cell) => cell.isCurrentMonth && cell.day === 5)!
    const second = aprilMonth.cells.find((cell) => cell.isCurrentMonth && cell.day === 9)!
    calendar.selectCell(first)
    calendar.selectCell(second)
    expect(confirmed).toHaveBeenCalledTimes(1)
  })
})

describe('date utility helpers', () => {
  it('parseDateInput round-trips with formatDateInputValue', () => {
    const date = parseDateInput('2026-04-15')
    expect(date).not.toBeNull()
    expect(formatDateInputValue(date!)).toBe('2026-04-15')
  })

  it('buildCalendarMonth produces 42 cells for any month', () => {
    const month = buildCalendarMonth(new Date(2026, 4, 1))
    expect(month.cells).toHaveLength(42)
    expect(month.label).toBe('May 2026')
  })

  it('rejects invalid date strings', () => {
    expect(parseDateInput('not-a-date')).toBeNull()
    expect(parseDateInput('2026-02-30')).toBeNull()
  })
})
