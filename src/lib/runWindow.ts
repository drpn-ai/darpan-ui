import type { WorkflowShortcutChoiceOption } from '../components/workflow/WorkflowShortcutChoiceCards.vue'
import type { CalendarRange, UseCalendarWidget } from '../composables/useCalendarWidget'
import { addDays } from './utils/date'

// The days a run looks at, asked as a Sync run asks them: Previous Day / Previous Week / Month to Date cards, each
// naming its dates, and Custom Dates for the calendar. DAR-UI-060 shares it with a lifecycle's start page, which
// anchors it lateAfterDays back; a Sync run anchors it today.
export type RunWindowPreset = 'previous-day' | 'previous-week' | 'month-to-date' | 'custom'

export interface RunWindowPresetOption extends WorkflowShortcutChoiceOption {
  value: RunWindowPreset
}

export interface RunWindowRange extends CalendarRange {
  summary: string
}

export function isRunWindowPreset(value: string): value is RunWindowPreset {
  return ['previous-day', 'previous-week', 'month-to-date', 'custom'].includes(value)
}

export function presetWindowRange(preset: Exclude<RunWindowPreset, 'custom'>, today: Date): RunWindowRange {
  if (preset === 'previous-day') {
    const previousDay = addDays(today, -1)
    return {
      startDate: previousDay,
      endExclusiveDate: today,
      summary: formatWindowDateLabel(previousDay),
    }
  }
  // Previous week: the seven days ending yesterday.
  if (preset === 'previous-week') {
    const startDate = addDays(today, -7)
    const endDate = addDays(today, -1)
    return {
      startDate,
      endExclusiveDate: today,
      summary: formatWindowRangeLabel(startDate, endDate),
    }
  }

  // Month to date: the 1st of yesterday's month through yesterday, so on the 1st it is the whole month just ended
  // rather than no days at all.
  const lastDay = addDays(today, -1)
  const monthStart = new Date(lastDay.getFullYear(), lastDay.getMonth(), 1)
  return {
    startDate: monthStart,
    endExclusiveDate: today,
    summary: monthStart.getTime() === lastDay.getTime()
      ? formatWindowDateLabel(lastDay)
      : formatWindowRangeLabel(monthStart, lastDay),
  }
}

export function customWindowRange(calendar: UseCalendarWidget): RunWindowRange | null {
  const calendarRange = calendar.range.value
  if (!calendarRange) return null

  const inclusiveEndDate = calendar.endDateValue.value ?? calendarRange.endExclusiveDate
  return {
    ...calendarRange,
    summary: formatWindowRangeLabel(calendarRange.startDate, inclusiveEndDate),
  }
}

export function runWindowPresetOptions(today: Date): RunWindowPresetOption[] {
  return [
    { value: 'previous-day', label: `Previous Day, ${presetWindowRange('previous-day', today).summary}`, shortcutKey: 'A' },
    { value: 'previous-week', label: `Previous Week, ${presetWindowRange('previous-week', today).summary}`, shortcutKey: 'B' },
    { value: 'month-to-date', label: `Month to Date, ${presetWindowRange('month-to-date', today).summary}`, shortcutKey: 'C' },
    { value: 'custom', label: 'Custom Dates, select start and end dates', shortcutKey: 'D' },
  ]
}

export function formatWindowDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(date)
}

export function formatWindowRangeLabel(startDate: Date, endDate: Date): string {
  return `${formatWindowDateLabel(startDate)} to ${formatWindowDateLabel(endDate)}`
}
