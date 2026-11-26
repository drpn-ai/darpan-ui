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

/** The record type a side reads when it is not orders: "returns", "order lines"; '' for orders or unknown. */
function recordTypeOf(endpointLabel: string | undefined): string {
  const words = (endpointLabel ?? '').toLowerCase()
  if (words.endsWith('order lines')) return 'order lines'
  if (words.endsWith('returns')) return 'returns'
  return ''
}

/**
 * Systems in list#SyncPairs' label: "<upstream> → <target> orders". The backend names each side's SYSTEM (HotWax,
 * NetSuite, Shopify; never the endpoint), but says "Target" for a one-sided check and "orders" for every record type.
 */
function backendSystems(label: string | undefined): { up: string, target: string } | null {
  const match = /^(.+?) → (.+?)(?: orders)?$/.exec((label ?? '').trim())
  if (!match) return null
  return { up: match[1]!.trim(), target: match[2]!.trim() }
}

/**
 * DAR-UI-153/154. A pair's label in product system names only, never an endpoint or protocol (no SuiteQL, no GraphQL):
 * "HotWax → NetSuite", "Shopify → HotWax", "HotWax → NetSuite returns" (a record type only when it is not orders),
 * "NetSuite only" for a one-sided check. The systems come from the backend label; one-sidedness and the record type
 * from the check's sides in the pair form (upstreamOptions), whose labels are endpoint names.
 */
export function pairSidesLabel(pair: Pick<SyncPairSummary, 'automationId' | 'automationName' | 'label'>,
  automations: SyncAutomationOption[]): string {
  const options = automations.find((a) => a.automationId === pair.automationId)?.upstreamOptions ?? []
  const systems = backendSystems(pair.label)
  if (!systems || systems.up === 'Source') return pair.automationName || pair.label
  const upKey = systems.up.toLowerCase()
  const upOption = options.find((o) => o.label.toLowerCase().startsWith(upKey)) ?? options[0]
  const otherOption = options.find((o) => o !== upOption)
  const oneSided = systems.target === 'Target' || (options.length === 1)
  const recordType = recordTypeOf(upOption?.label) || recordTypeOf(otherOption?.label)
  const suffix = recordType ? ` ${recordType}` : ''
  if (oneSided) return `${systems.up} only${suffix}`
  return `${systems.up} → ${systems.target}${suffix}`
}

/** The backend label in system names alone, where the check's sides are not at hand (a peak period's sync rows). */
export function plainPairLabel(label: string): string {
  const systems = backendSystems(label)
  if (!systems || systems.up === 'Source') return label
  return systems.target === 'Target' ? `${systems.up} only` : `${systems.up} → ${systems.target}`
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

/** The periods whose sync rows turn at least one pulse on: the ones worth naming on the Pulses page. */
export function pulsingPeriods(periods: PeakPeriodSummary[], periodRows: PeakSyncRow[][]): Set<string> {
  return new Set(periods.filter((_, i) => (periodRows[i] ?? []).some((row) => Boolean(row.periodPulseMinutes)))
    .map((p) => p.peakPeriodId))
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
  /** The live periods that turn at least one pulse on (a sale period with every pulse off is not one). */
  pulsingPeriodIds: Set<string>
}

export async function loadSyncPulseView(signal?: AbortSignal): Promise<LoadedSyncPulseView> {
  const response = await pulseFacade.listSyncPairs(signal)
  if (response.ok === false) throw new Error(response.errors?.[0] ?? 'Could not load the sync pairs.')
  const pairs = response.syncPairs ?? []
  if (pairs.length === 0) return { pairs, view: { pulsing: [], allowanceOnly: [] }, periods: [], nextPulse: new Map(), pulsingPeriodIds: new Set() }
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
    nextPulse: nextPulsePeriods(live, rows), pulsingPeriodIds: pulsingPeriods(live, rows) }
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
  // The period is named under Allowance when it changes the allowance (held: Aditi's pick on hiding it while the pulse is off).
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

/**
 * DAR-UI-154. When the Waiting / Oldest / Past allowance figures were read: "as of 18:32" (the last read pulse today, on
 * the display clock). With the pulse off today they are the last known ones: "Last known · as of 18:32", or
 * "Last known figures" when nothing was read today.
 */
export function pulseAsOfWords(pair: Pick<SyncPair, 'pulseEveryMinutes'>, samples: SyncSample[],
  clock: (value: string) => string): string {
  const at = (s: SyncSample) => new Date(s.sampleStamp).getTime()
  const latestRead = samples.filter((s) => s.statusEnumId === 'SPS_OK')
    .reduce<SyncSample | null>((last, s) => (!last || at(s) >= at(last) ? s : last), null)
  const asOf = latestRead ? `as of ${clock(latestRead.sampleStamp)}` : ''
  if (pair.pulseEveryMinutes) return asOf || 'No pulse read today yet'
  return asOf ? `Last known · ${asOf}` : 'Last known figures'
}
