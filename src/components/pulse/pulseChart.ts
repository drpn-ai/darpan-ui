// DAR-BE-328. What the two Today charts on a sync pair's page share: today's pulses as one reading per clock hour of
// the tenant's day, and the x positions both charts draw them at, so an hour sits in the same place on each.
import { computed } from 'vue'
import type { SyncSample } from '../../lib/api/pulseTypes'
import { durationWords } from '../../lib/pulseWords'
import { getDefaultDisplayTimeZone } from '../../lib/utils/date'

export interface PulseHour {
  /** "09": the hour of the day on the chart's clock. */
  hour: string
  /** Hours since the first drawn hour: the hour's slot on the x axis, so a missing hour leaves its slot empty. */
  slot: number
  waitingCount: number
  /** 0 when nothing was waiting. */
  oldestMinutes: number
  pastAllowanceCount: number
}

/** The SVG box both charts draw in: the plot between left/right and top/bottom, hour ticks under it. */
export const CHART = { width: 840, height: 220, left: 44, right: 824, top: 16, bottom: 184, tickY: 204 } as const

const OK = 'SPS_OK'
const HOUR_MS = 3_600_000

/** The start of the clock hour an instant falls in, in `timeZone`, and that hour as "HH". Half-hour zones included. */
function clockHour(at: number, timeZone: string | undefined): { start: number; hour: string } | null {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23', timeZone })
      .formatToParts(new Date(at))
  } catch {
    return null
  }
  const part = (type: string) => Number(parts.find((item) => item.type === type)?.value ?? NaN)
  const [hour, minute, second] = [part('hour'), part('minute'), part('second')]
  if ([hour, minute, second].some(Number.isNaN)) return null
  return { start: at - (minute * 60 + second) * 1000 - (((at % 1000) + 1000) % 1000), hour: String(hour).padStart(2, '0') }
}

/**
 * One reading per clock hour that has one: the hour's last pulse that read the systems. A failed or skipped pulse
 * counted nothing, so an hour with only those is not drawn and leaves a gap. Hours are read on `timeZone` (the
 * display zone, which is the tenant's whenever the tenant has one) and kept in time order, so a day that crosses
 * midnight on that clock still runs left to right.
 */
export function pulseHours(samples: readonly SyncSample[], timeZone: string | undefined = getDefaultDisplayTimeZone()): PulseHour[] {
  const latest = new Map<number, { at: number; hour: string; sample: SyncSample }>()
  for (const sample of samples) {
    if (sample.statusEnumId !== OK) continue
    const at = new Date(sample.sampleStamp).getTime()
    if (Number.isNaN(at)) continue
    const clock = clockHour(at, timeZone)
    if (!clock) continue
    const kept = latest.get(clock.start)
    if (!kept || at >= kept.at) latest.set(clock.start, { at, hour: clock.hour, sample })
  }
  const starts = [...latest.keys()].sort((a, b) => a - b)
  const first = starts[0] ?? 0
  return starts.map((start) => {
    const { hour, sample } = latest.get(start)!
    return {
      hour,
      slot: Math.round((start - first) / HOUR_MS),
      waitingCount: sample.waitingCount ?? 0,
      oldestMinutes: sample.oldestWaitingMinutes ?? 0,
      pastAllowanceCount: sample.pastAllowanceCount ?? 0,
    }
  })
}

/** Every clock hour from the first drawn one to the last, drawn or not. */
export function slotCount(hours: readonly PulseHour[]): number {
  return (hours[hours.length - 1]?.slot ?? -1) + 1
}

/** The width each clock hour gets. */
export function slotWidth(hours: readonly PulseHour[]): number {
  return (CHART.right - CHART.left) / Math.max(slotCount(hours), 1)
}

/** The centre of each drawn hour's slot, the same on both charts. */
export function hourXs(hours: readonly PulseHour[]): number[] {
  const width = slotWidth(hours)
  return hours.map((hour) => CHART.left + width * (hour.slot + 0.5))
}

/** The drawn hours as runs of consecutive clock hours (indexes into `hours`): a line never bridges a missing hour. */
export function consecutiveRuns(hours: readonly PulseHour[]): number[][] {
  const runs: number[][] = []
  hours.forEach((hour, index) => {
    const run = runs[runs.length - 1]
    const previous = hours[index - 1]
    if (run && previous && hour.slot === previous.slot + 1) run.push(index)
    else runs.push([index])
  })
  return runs
}

/** y for a value on a 0..max scale. */
export function yFor(value: number, max: number): number {
  const share = max > 0 ? Math.min(value / max, 1) : 0
  return CHART.bottom - share * (CHART.bottom - CHART.top)
}

/** The hour a readout or highlight is about: the one pointed at, else the latest. */
export function activeIndex(count: number, active: number | null | undefined): number {
  if (!count) return -1
  return active != null && active >= 0 && active < count ? active : count - 1
}

/** "11:00 · oldest 6h 40m · 1,240 waiting · 12 past allowance". */
export function hourReadout(hour: PulseHour): string {
  return `${hour.hour}:00 · oldest ${durationWords(hour.oldestMinutes)} · ${hour.waitingCount.toLocaleString('en-US')} waiting · ${hour.pastAllowanceCount.toLocaleString('en-US')} past allowance`
}

/**
 * The day for a screen reader, on one figure: "40 at 08:00, 1,240 at 11:00, highest 1,610 at 09:00" (the first hour, the
 * last, and the first hour with the most). Null with no hours.
 */
export function daySpanWords(hours: readonly PulseHour[], value: (hour: PulseHour) => number, words: (n: number) => string): string | null {
  const first = hours[0]
  const last = hours[hours.length - 1]
  if (!first || !last) return null
  const highest = hours.reduce((top, hour) => (value(hour) > value(top) ? hour : top), first)
  const at = (hour: PulseHour) => `${words(value(hour))} at ${hour.hour}:00`
  return `${first === last ? at(first) : `${at(first)}, ${at(last)}`}, highest ${at(highest)}`
}

/** The next hour a key moves to on a focused chart, or null when the key is not one of ours. */
export function steppedIndex(key: string, current: number, count: number): number | null {
  if (!count) return null
  if (key === 'ArrowLeft') return Math.max(0, current - 1)
  if (key === 'ArrowRight') return Math.min(count - 1, current + 1)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}

/**
 * What both Today charts read from their props: the drawn hours, where each sits, the hour the readout names, and the
 * keys that move it. `moveTo` is the chart's update:active emit.
 */
export function usePulseChart(
  props: { samples: readonly SyncSample[]; active?: number | null; timeZone?: string },
  moveTo: (index: number | null) => void,
) {
  const hours = computed(() => pulseHours(props.samples, props.timeZone))
  const xs = computed(() => hourXs(hours.value))
  const slot = computed(() => slotWidth(hours.value))
  const currentIndex = computed(() => activeIndex(hours.value.length, props.active))
  function onKey(event: KeyboardEvent): void {
    const next = steppedIndex(event.key, currentIndex.value, hours.value.length)
    if (next === null) return
    event.preventDefault()
    moveTo(next)
  }
  return { hours, xs, slot, currentIndex, onKey }
}
