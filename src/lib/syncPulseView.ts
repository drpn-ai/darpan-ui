// DAR-UI-153. Which sync pairs pulse, and what each pair compares, for the Sync pulse page and the Tenant Settings row.
// A pair also carries the start allowance a peak period sets on its check (DAR-BE-328), so most pairs never pulse:
// those sit apart. The label comes from the check's own sides (the pair form's upstream options), not list#SyncPairs'
// "<up> → <target> orders", which says "Target" for a one-sided check and "orders" for returns.
import { peakFacade, pulseFacade } from './api/facade'
import type { PeakSyncRow, PeakPeriodSummary } from './api/peakTypes'
import type { SyncAutomationOption, SyncPair, SyncPairSummary, SyncPastOrder, SyncSample } from './api/pulseTypes'
import { allowanceWords, durationWords, pulseCadence, pulseEveryWords } from './pulseWords'

export interface SyncPulseRow {
  syncPairId: string
  /** "HotWax returns → NetSuite SuiteQL"; the check's name when its sides are unknown. */
  label: string
  /** The check the pair belongs to. */
  checkName: string
  /** "Every 1h", "Every 1h in peak periods", or "Off". */
  cadence: string
  counts: string
  pulses: boolean
}

export interface SyncPulseView {
  pulsing: SyncPulseRow[]
  allowanceOnly: SyncPulseRow[]
}

/**
 * "<upstream side> → <other side>" from the check's own sides; "<side> only" for a one-sided check. list#SyncPairs has no
 * upstreamSide, so the upstream is the side whose label starts with the system the backend label names first
 * ("Shopify → …" picks the "Shopify" side), FILE_1 when none does.
 */
export function pairSidesLabel(pair: Pick<SyncPairSummary, 'automationId' | 'automationName' | 'label'> & { upstreamSide?: string | null },
  automations: SyncAutomationOption[]): string {
  const options = automations.find((a) => a.automationId === pair.automationId)?.upstreamOptions ?? []
  const named = (pair.label ?? '').split(' → ')[0]?.trim().toLowerCase() ?? ''
  const side = pair.upstreamSide
    ?? options.find((o) => named && o.label.toLowerCase().startsWith(named))?.upstreamSide
    ?? 'FILE_1'
  const up = options.find((o) => o.upstreamSide === side)
  const other = options.find((o) => o.upstreamSide !== side)
  if (up && other) return `${up.label} → ${other.label}`
  if (up) return `${up.label} only`
  return pair.automationName || pair.label
}

/** The pairs that pulse in a peak period that has not ended, from each period's sync rows. */
export function periodPulseMinutes(periodRows: PeakSyncRow[][]): Map<string, number> {
  const out = new Map<string, number>()
  for (const rows of periodRows) {
    for (const row of rows) {
      if (!row.periodPulseMinutes) continue
      const seen = out.get(row.syncPairId)
      if (seen === undefined || row.periodPulseMinutes < seen) out.set(row.syncPairId, row.periodPulseMinutes)
    }
  }
  return out
}

/** The first coming (not yet on) period whose sync rows turn the pulse on, by pair: "PEAK Nov 27". */
export function nextPulsePeriods(periods: PeakPeriodSummary[], periodRows: PeakSyncRow[][]): Map<string, string> {
  const out = new Map<string, string>()
  periods
    .map((period, i) => ({ period, rows: periodRows[i] ?? [] }))
    .filter(({ period }) => period.state === 'upcoming')
    .sort((a, b) => a.period.fromDate.localeCompare(b.period.fromDate))
    .forEach(({ period, rows }) => {
      for (const row of rows) {
        if (row.periodPulseMinutes && !out.has(row.syncPairId)) out.set(row.syncPairId, period.periodName)
      }
    })
  return out
}

/** Pairs that pulse (normally, or in a coming or current peak period) first; the allowance-only pairs apart. */
export function buildSyncPulseView(pairs: SyncPairSummary[], automations: SyncAutomationOption[],
  periodPulse: Map<string, number>): SyncPulseView {
  const rows = pairs.map((pair): SyncPulseRow => {
    const inPeriods = periodPulse.get(pair.syncPairId)
    const pulses = Boolean(pair.pulseEveryMinutes) || inPeriods !== undefined
    const cadence = pair.pulseEveryMinutes
      ? pulseCadence(pair.pulseEveryMinutes)
      : inPeriods !== undefined ? `${pulseCadence(inPeriods)} in peak periods` : pulseCadence(null)
    return {
      syncPairId: pair.syncPairId,
      label: pairSidesLabel(pair, automations),
      checkName: pair.automationName || pair.label,
      cadence,
      counts: `${pair.waitingCount} waiting · ${pair.pastAllowanceCount} past`,
      pulses,
    }
  })
  return { pulsing: rows.filter((r) => r.pulses), allowanceOnly: rows.filter((r) => !r.pulses) }
}

/** "Shopify → HotWax orders · every 1h · 1 more" over the pulsing pairs, or "None". */
export function syncPulseSettingsValue(view: SyncPulseView): string {
  const first = view.pulsing[0]
  if (!first) return 'None'
  const more = view.pulsing.length > 1 ? ` · ${view.pulsing.length - 1} more` : ''
  return `${first.label} · ${first.cadence.toLowerCase()}${more}`
}

const LIVE_STATES = new Set<PeakPeriodSummary['state']>(['upcoming', 'on'])

/**
 * list#SyncPairs plus the pair form's checks (for the sides) and the coming and current peak periods (for a pulse only
 * a period turns on). The sides and periods are best effort: when they fail the backend label and the pair's own cadence
 * are used. The pairs list failing throws.
 */
export interface LoadedSyncPulseView {
  pairs: SyncPairSummary[]
  view: SyncPulseView
  /** The coming and current peak periods; empty when they failed to load. */
  periods: PeakPeriodSummary[]
  /** By pair: the next coming period that turns its pulse on. */
  nextPulse: Map<string, string>
}

export async function loadSyncPulseView(signal?: AbortSignal): Promise<LoadedSyncPulseView> {
  const response = await pulseFacade.listSyncPairs(signal)
  if (response.ok === false) throw new Error(response.errors?.[0] ?? 'Could not load the sync pairs.')
  const pairs = response.syncPairs ?? []
  if (pairs.length === 0) return { pairs, view: { pulsing: [], allowanceOnly: [] }, periods: [], nextPulse: new Map() }
  const [form, periods] = await Promise.allSettled([
    (async () => (await pulseFacade.getSyncPair({}, signal)).automations ?? [])(),
    (async () => {
      const list = (await peakFacade.listPeakPeriods(signal)).peakPeriods ?? []
      const live = list.filter((p) => p.isActive !== 'N' && LIVE_STATES.has(p.state))
      const details = await Promise.all(live.map((p) => peakFacade.getPeakPeriod({ peakPeriodId: p.peakPeriodId }, signal)))
      return { live, rows: details.map((d) => d.syncRows ?? []) }
    })(),
  ])
  const automations = form.status === 'fulfilled' ? form.value : []
  const live = periods.status === 'fulfilled' ? periods.value.live : []
  const rows = periods.status === 'fulfilled' ? periods.value.rows : []
  return { pairs, view: buildSyncPulseView(pairs, automations, periodPulseMinutes(rows)), periods: live,
    nextPulse: nextPulsePeriods(live, rows) }
}

/** "last 18:17", "last pulse skipped 18:17", "last pulse failed 18:17", or "no pulse yet". */
export function lastPulseWords(stamp: string | null | undefined, statusEnumId: string | null | undefined,
  clock: (value: string) => string): string {
  if (!stamp) return 'no pulse yet'
  const at = clock(stamp)
  if (statusEnumId === 'SPS_SKIPPED') return `last pulse skipped ${at}`
  if (statusEnumId === 'SPS_FAILED') return `last pulse failed ${at}`
  return `last ${at}`
}

export interface PulseWatchFact {
  key: string
  label: string
  value: string
  sub: string
  explain: string
}

/**
 * DAR-UI-154. One pulse on the Pulses page, from get#SyncPair: how often and how late it is allowed today (a peak
 * period's values when one overrides), when it last pulsed and how that ended, and what the last read pulse found.
 */
export function pulseWatchFacts(pair: SyncPair, samples: SyncSample[], pastOrders: SyncPastOrder[],
  clock: (value: string) => string, nextPulsePeriod?: string): PulseWatchFact[] {
  const at = (s: SyncSample) => new Date(s.sampleStamp).getTime()
  const latestRead = samples.filter((s) => s.statusEnumId === 'SPS_OK')
    .reduce<SyncSample | null>((last, s) => (!last || at(s) >= at(last) ? s : last), null)
  const oldest = latestRead?.oldestWaitingMinutes ?? pastOrders[0]?.waitingMinutes ?? null
  const period = pair.periodName ?? ''
  const allowanceFromPeriod = Boolean(period && pair.normalAllowanceMinutes != null && pair.allowanceMinutes !== pair.normalAllowanceMinutes)
  return [
    // A pulse that only peak periods turn on reads "Off today · next: PEAK Nov 27" on the days between them.
    pair.pulseEveryMinutes
      ? { key: 'every', label: 'Every', value: pulseEveryWords(pair.pulseEveryMinutes),
        sub: lastPulseWords(pair.lastPulseStamp, pair.lastPulseStatusEnumId, clock), explain: 'syncPairEvery' }
      : { key: 'every', label: 'Every', value: 'Off today',
        sub: nextPulsePeriod ? `next: ${nextPulsePeriod}` : lastPulseWords(pair.lastPulseStamp, pair.lastPulseStatusEnumId, clock),
        explain: 'syncPairEvery' },
    { key: 'allowance', label: 'Allowance', value: allowanceWords(pair.allowanceMinutes),
      sub: allowanceFromPeriod ? period : 'normal', explain: 'syncPairAllowance' },
    { key: 'waiting', label: 'Waiting', value: (pair.waitingCount ?? 0).toLocaleString('en-US'), sub: 'orders', explain: 'syncPairWaiting' },
    { key: 'oldest', label: 'Oldest', value: oldest ? durationWords(oldest) : 'None',
      sub: oldest ? pastOrders[0]?.orderName ?? '' : '', explain: 'syncPairOldest' },
    { key: 'past', label: 'Past allowance', value: (pair.pastAllowanceCount ?? 0).toLocaleString('en-US'),
      sub: 'findings', explain: 'syncPairPastAllowance' },
  ]
}
