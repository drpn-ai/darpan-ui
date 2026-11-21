// DAR-BE-328. What the two Today charts on a sync pair's page share: today's pulses as one reading per hour of the
// tenant's day, and the x positions both charts draw them at, so an hour sits in the same place on each.
import type { SyncSample } from '../../lib/api/pulseTypes'
import { durationWords } from '../../lib/pulseWords'
import { formatClockTime } from '../../lib/utils/date'

export interface PulseHour {
  /** "09": the hour of the tenant's day. */
  hour: string
  waitingCount: number
  /** 0 when nothing was waiting. */
  oldestMinutes: number
  pastAllowanceCount: number
}

/** The SVG box both charts draw in: the plot between left/right and top/bottom, hour ticks under it. */
export const CHART = { width: 840, height: 220, left: 44, right: 824, top: 16, bottom: 184, tickY: 204 } as const

const OK = 'SPS_OK'

/**
 * One reading per hour that has one: the hour's last pulse that read the systems. A failed or skipped pulse counted
 * nothing, so an hour with only those is not drawn. The hour is read on the display clock, the tenant's zone.
 */
export function pulseHours(samples: readonly SyncSample[]): PulseHour[] {
  const latest = new Map<string, { at: number; sample: SyncSample }>()
  for (const sample of samples) {
    if (sample.statusEnumId !== OK) continue
    const at = new Date(sample.sampleStamp).getTime()
    const hour = formatClockTime(sample.sampleStamp).slice(0, 2)
    if (!hour || Number.isNaN(at)) continue
    const kept = latest.get(hour)
    if (!kept || at >= kept.at) latest.set(hour, { at, sample })
  }
  return [...latest.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, { sample }]) => ({
      hour,
      waitingCount: sample.waitingCount ?? 0,
      oldestMinutes: sample.oldestWaitingMinutes ?? 0,
      pastAllowanceCount: sample.pastAllowanceCount ?? 0,
    }))
}

/** The width each hour gets: drawn hours share the plot evenly. */
export function slotWidth(count: number): number {
  return (CHART.right - CHART.left) / Math.max(count, 1)
}

/** The centre of each hour's slot, the same on both charts. */
export function hourXs(count: number): number[] {
  const slot = slotWidth(count)
  return Array.from({ length: count }, (_, index) => CHART.left + slot * (index + 0.5))
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

/** The next hour a key moves to on a focused chart, or null when the key is not one of ours. */
export function steppedIndex(key: string, current: number, count: number): number | null {
  if (!count) return null
  if (key === 'ArrowLeft') return Math.max(0, current - 1)
  if (key === 'ArrowRight') return Math.min(count - 1, current + 1)
  if (key === 'Home') return 0
  if (key === 'End') return count - 1
  return null
}
