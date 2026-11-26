// DAR-UI-153. Which sync pairs pulse, and what each pair compares, for the Sync pulse page and the Tenant Settings row.
// A pair also carries the start allowance a peak period sets on its check (DAR-BE-328), so most pairs never pulse:
// those sit apart. The label comes from the check's own sides (the pair form's upstream options), not list#SyncPairs'
// "<up> → <target> orders", which says "Target" for a one-sided check and "orders" for returns.
import { peakFacade, pulseFacade } from './api/facade'
import type { PeakSyncRow, PeakPeriodSummary } from './api/peakTypes'
import type { SyncAutomationOption, SyncPairSummary } from './api/pulseTypes'
import { pulseCadence } from './pulseWords'

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
export async function loadSyncPulseView(signal?: AbortSignal): Promise<{ pairs: SyncPairSummary[], view: SyncPulseView }> {
  const response = await pulseFacade.listSyncPairs(signal)
  if (response.ok === false) throw new Error(response.errors?.[0] ?? 'Could not load the sync pairs.')
  const pairs = response.syncPairs ?? []
  if (pairs.length === 0) return { pairs, view: { pulsing: [], allowanceOnly: [] } }
  const [form, periods] = await Promise.allSettled([
    (async () => (await pulseFacade.getSyncPair({}, signal)).automations ?? [])(),
    (async () => {
      const list = (await peakFacade.listPeakPeriods(signal)).peakPeriods ?? []
      const live = list.filter((p) => p.isActive !== 'N' && LIVE_STATES.has(p.state))
      const details = await Promise.all(live.map((p) => peakFacade.getPeakPeriod({ peakPeriodId: p.peakPeriodId }, signal)))
      return details.map((d) => d.syncRows ?? [])
    })(),
  ])
  const automations = form.status === 'fulfilled' ? form.value : []
  const periodPulse = periodPulseMinutes(periods.status === 'fulfilled' ? periods.value : [])
  return { pairs, view: buildSyncPulseView(pairs, automations, periodPulse) }
}
