import { computed, ref, type ComputedRef, type Ref } from 'vue'
import {
  addDays,
  addMonths,
  buildCalendarMonth,
  formatDateInputValue,
  parseDateInput,
  startOfLocalDay,
  startOfMonth,
  type CalendarCell,
  type CalendarMonth,
} from '../lib/utils/date'

export type CalendarSelectionSide = 'start' | 'end'

export interface CalendarRange {
  startDate: Date
  endExclusiveDate: Date
}

export interface UseCalendarWidgetOptions {
  monthsVisible?: number
  onRangeConfirmed?: (range: CalendarRange) => void
  // The latest day a range may include; today when left out. A lifecycle built from stages stops short of it.
  lastPickableDate?: () => Date
}

export interface UseCalendarWidget {
  startDate: Ref<string>
  endDate: Ref<string>
  selecting: Ref<CalendarSelectionSide>
  visibleMonth: Ref<Date>
  startDateValue: ComputedRef<Date | null>
  endDateValue: ComputedRef<Date | null>
  calendarMonths: ComputedRef<CalendarMonth[]>
  range: ComputedRef<CalendarRange | null>
  setSelectionSide: (side: CalendarSelectionSide) => void
  shiftMonth: (monthCount: number) => void
  canShiftMonth: (monthCount: number) => boolean
  isCellDisabled: (cell: CalendarCell) => boolean
  selectCell: (cell: CalendarCell) => void
  cellClasses: (cell: CalendarCell) => Record<string, boolean>
  reset: () => void
  focusVisibleMonthAroundStart: () => void
}

function getDefaultVisibleMonth(): Date {
  return addMonths(startOfMonth(new Date()), -1)
}

function clampVisibleMonth(date: Date): Date {
  const monthStart = startOfMonth(date)
  const latestMonthStart = getDefaultVisibleMonth()
  if (monthStart.getTime() > latestMonthStart.getTime()) return latestMonthStart
  return monthStart
}

export function useCalendarWidget(options: UseCalendarWidgetOptions = {}): UseCalendarWidget {
  const monthsVisible = Math.max(1, options.monthsVisible ?? 2)
  const startDate = ref('')
  const endDate = ref('')
  const selecting = ref<CalendarSelectionSide>('start')
  const visibleMonth = ref<Date>(getDefaultVisibleMonth())
  const lastPickableTime = () => startOfLocalDay(options.lastPickableDate?.() ?? new Date()).getTime()

  const startDateValue = computed(() => parseDateInput(startDate.value))
  const endDateValue = computed(() => parseDateInput(endDate.value))

  const calendarMonths = computed<CalendarMonth[]>(() =>
    Array.from({ length: monthsVisible }, (_, index) => buildCalendarMonth(addMonths(visibleMonth.value, index))),
  )

  const range = computed<CalendarRange | null>(() => {
    const start = startDateValue.value
    const end = endDateValue.value
    if (!start || !end) return null
    if (start.getTime() > end.getTime()) return null
    if (start.getTime() > lastPickableTime() || end.getTime() > lastPickableTime()) return null

    return {
      startDate: start,
      endExclusiveDate: addDays(end, 1),
    }
  })

  function setSelectionSide(side: CalendarSelectionSide): void {
    selecting.value = side
  }

  function canShiftMonth(monthCount: number): boolean {
    const nextMonth = addMonths(visibleMonth.value, monthCount)
    return nextMonth.getTime() <= getDefaultVisibleMonth().getTime()
  }

  function shiftMonth(monthCount: number): void {
    if (!canShiftMonth(monthCount)) return
    visibleMonth.value = addMonths(visibleMonth.value, monthCount)
  }

  function isDateDisabled(date: Date): boolean {
    return startOfLocalDay(date).getTime() > lastPickableTime()
  }

  function isCellDisabled(cell: CalendarCell): boolean {
    return !cell.isCurrentMonth || isDateDisabled(cell.date)
  }

  function selectCell(cell: CalendarCell): void {
    if (isCellDisabled(cell)) return

    const selectedDate = startOfLocalDay(cell.date)
    const selectedDateValue = formatDateInputValue(selectedDate)
    const currentStart = startDateValue.value
    const currentEnd = endDateValue.value

    if (selecting.value === 'start' || (currentStart && currentEnd)) {
      startDate.value = selectedDateValue
      endDate.value = ''
      selecting.value = 'end'
      return
    }

    if (currentStart && selectedDate.getTime() < currentStart.getTime()) {
      startDate.value = selectedDateValue
      endDate.value = ''
      selecting.value = 'end'
      return
    }

    endDate.value = selectedDateValue
    selecting.value = 'start'

    if (options.onRangeConfirmed && range.value) {
      options.onRangeConfirmed(range.value)
    }
  }

  function cellClasses(cell: CalendarCell): Record<string, boolean> {
    const disabled = isCellDisabled(cell)
    const start = startDateValue.value
    const end = endDateValue.value
    const cellTime = startOfLocalDay(cell.date).getTime()
    const startTime = start?.getTime()
    const endTime = end?.getTime()
    const isRangeStart = !disabled && startTime === cellTime
    const isRangeEnd = !disabled && endTime === cellTime
    const isInRange =
      !disabled && startTime !== undefined && endTime !== undefined && startTime < cellTime && cellTime < endTime

    return {
      'wizard-api-calendar-day--outside': !cell.isCurrentMonth,
      'wizard-api-calendar-day--disabled': disabled,
      'wizard-api-calendar-day--range-start': isRangeStart,
      'wizard-api-calendar-day--range-end': isRangeEnd,
      'wizard-api-calendar-day--in-range': isInRange,
    }
  }

  function reset(): void {
    startDate.value = ''
    endDate.value = ''
    selecting.value = 'start'
    visibleMonth.value = getDefaultVisibleMonth()
  }

  function focusVisibleMonthAroundStart(): void {
    visibleMonth.value = clampVisibleMonth(startDateValue.value ?? getDefaultVisibleMonth())
  }

  return {
    startDate,
    endDate,
    selecting,
    visibleMonth,
    startDateValue,
    endDateValue,
    calendarMonths,
    range,
    setSelectionSide,
    shiftMonth,
    canShiftMonth,
    isCellDisabled,
    selectCell,
    cellClasses,
    reset,
    focusVisibleMonthAroundStart,
  }
}
