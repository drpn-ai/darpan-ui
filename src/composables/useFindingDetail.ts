import { computed, type ComputedRef } from 'vue'
import type { StaticFact } from '../components/ui/StaticFactStrip.vue'
import type {
  AuditAcknowledgement,
  AuditFindingDocument,
  AuditFindingSummary,
  AuditLevel,
  AuditMoney,
  AuditOrderLine,
  AuditStatement,
} from '../lib/api/auditTypes'
import { LEVEL_LABEL } from '../lib/api/auditTypes'
import {
  basicFacts,
  FIX_WHERE_LABELS,
  findingStateBadge,
  heldChain,
  orderLineRows,
  orderNameOf,
  recordKind,
  recordRows,
  shortDate,
  splitHeadline,
  systemLabel,
  typeDetails,
  type RecordRow,
} from '../lib/auditReport'
import { acknowledgedDaysAgo, lineLabel, otherOrderLines } from '../lib/auditColumns'

/**
 * DAR-UI-065/081 / DAR-OPS-029 U05b. What the audit board's finding detail shows, read from the open finding: verdict first
 * (the statement and record, what is wrong), then the record's facts, what it is stuck on and what to do, its lines, its
 * evidence. The markup stays in AuditColumns: the mascot reads a route's anchors only from the routed page and the files it
 * imports, so the detail's test ids must stay there.
 */
export interface FindingDetailOptions {
  findingDoc: () => AuditFindingDocument | null
  /** DAR-UI-075. The order open in the detail; findingDoc is then its stuck line's (its fix and history). */
  orderUnit: () => AuditFindingSummary | null | undefined
  /** The statement open on the board (e.g. R2), and its document. */
  statement: () => string
  statementDoc: () => AuditStatement | null | undefined
  /** The finding's row in the findings column, for its level while the order carries none. */
  row: () => AuditFindingSummary | null | undefined
  /** DAR-UI-144/155. The row's acknowledgement as the board shows it (useOptimisticAck). */
  acknowledgement: () => AuditAcknowledgement | null
  /** The tenant's zone, for how long ago a reminded acknowledgement was. */
  timeZone: () => string | null | undefined
}

type OrderLineFinding = NonNullable<AuditFindingSummary['lines']>[number]
type Badge = { label: string; tone: 'neutral' | 'success' | 'warning' | 'danger' }

export interface FindingDetail {
  records: ComputedRef<RecordRow[]>
  /** DAR-UI-139. The systems the finding's check compares (DAR-BE-371: named whether or not it ran today). */
  comparedSystems: ComputedRef<string[]>
  /** DAR-UI-081. The headline after its record ("Order M1168800"), which moves up into the eyebrow. */
  lead: ComputedRef<string>
  eyebrow: ComputedRef<string>
  /** DAR-UI-140. Where the level came from: its statement, or the cause it was set on. */
  levelLine: ComputedRef<string>
  /** DAR-UI-139. The same cells on every finding: each compared system and its status, the amount, the day. */
  basics: ComputedRef<StaticFact[]>
  money: ComputedRef<{ label: string; value: string }[]>
  kind: ComputedRef<string>
  details: ComputedRef<ReturnType<typeof typeDetails>>
  recordLines: ComputedRef<ReturnType<typeof orderLineRows>>
  chain: ComputedRef<ReturnType<typeof heldChain>>
  stuckOn: ComputedRef<string>
  fixOwner: ComputedRef<string>
  whyLine: ComputedRef<string>
  sinceLine: ComputedRef<string>
  evidenceFailed: ComputedRef<boolean>
  evidenceLine: ComputedRef<string>
  /** DAR-UI-099. The open order's lines with no finding of their own (an item set aside, a NetSuite store-credit line). */
  otherLines: ComputedRef<AuditOrderLine[]>
  /** DAR-UI-144. A sent note's record when the reply names none (pre-d5ceeff1 servers only; S99-104). */
  feedbackRecord: ComputedRef<string | null>
  /** DAR-UI-144. Acknowledge an open row with none, or one its reminder brought back. */
  canAcknowledge: ComputedRef<boolean>
  detailBadge: ComputedRef<Badge>
  ackCardLine: ComputedRef<string>
}

// DAR-UI-075. Why a line is in its order's finding: its own cause, or held by the line holding the order up.
// DAR-UI-081 (Aditi: "removed 'held by' and just put item fulfillment status"): a line held by the order's stuck line reads
// as its own item's status in HotWax (Completed); the stuck line keeps its cause (Backordered).
export function lineWhy(line: OrderLineFinding): string {
  const itemStatus = line.records?.OMS?.orderItem?.[0]?.status
  if (line.held && itemStatus) return itemStatus
  return line.cause ?? findingStateBadge(line.state).label
}

// DAR-UI-081 (Aditi: "add location ID to the line box", "with location ID, show the location name"). An order line's
// location, from its HotWax item: "Chicago · 58".
export function lineLocation(line: OrderLineFinding): string {
  const item = line.records?.OMS?.orderItem?.[0]
  if (!item?.location) return ''
  return item.locationName ? `${item.locationName} · ${item.location}` : `Location ${item.location}`
}

// DAR-UI-081 (Aditi: "add the IF id here too"). The NetSuite item fulfillments that shipped the line.
export function lineFulfillments(line: OrderLineFinding): string {
  return (line.records?.NetSuite?.salesOrderLine?.[0]?.fulfillments ?? []).join(', ')
}

/** Who an acknowledgement is by: their name, else their id. */
export function ackWho(ack: AuditAcknowledgement): string {
  return ack.by.label || ack.by.id
}

// DAR-UI-066. Fewer words: what is said once is not said again.
function sameText(a: string, b: string): boolean {
  const norm = (text: string) => text.trim().replace(/\.$/, '').toLowerCase()
  return norm(a) === norm(b)
}

function moneyLabel(money: AuditMoney | null | undefined): string {
  return money ? `${money.amount} ${money.currency}` : ''
}

export function useFindingDetail(options: FindingDetailOptions): FindingDetail {
  const finding = () => options.findingDoc()?.finding

  const records = computed(() => recordRows(options.orderUnit()?.records ?? finding()?.records))
  const comparedSystems = computed(() => {
    const check = options.statementDoc()?.checks?.find((item) => item.id === finding()?.check.id)
    return check?.systems?.length ? check.systems : Object.keys(check?.compared ?? {})
  })
  const headline = computed(() => options.orderUnit()?.headline ?? finding()?.headline ?? '')
  const lead = computed(() => {
    const rest = splitHeadline(headline.value).rest
    return rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : headline.value
  })
  const eyebrow = computed(() => {
    const split = splitHeadline(headline.value)
    return [options.statement(), split.rest ? split.subject : '', orderNameOf(records.value)].filter(Boolean).join(' · ')
  })
  // DAR-UI-140. The open finding's level: the order's (never its line's), else its row's, else its document's.
  const findingLevel = computed<{ level: AuditLevel; source: 'statement' | 'reason'; reason: string | null } | null>(() => {
    const order = options.orderUnit()
    const unit = order?.priority ? order : options.row()
    if (unit?.priority) return { level: unit.priority, source: unit.prioritySource ?? 'statement', reason: unit.priorityReason ?? null }
    return finding()?.priority ?? null
  })
  const levelLine = computed(() => {
    const at = findingLevel.value
    if (!at) return ''
    if (at.source === 'reason' && at.reason) return `${LEVEL_LABEL[at.level]} set on "${at.reason}"`
    return `${LEVEL_LABEL[at.level]} from ${options.statement() || finding()?.statement.id || ''}`
  })
  const basics = computed(() => basicFacts(records.value, comparedSystems.value))

  const money = computed(() => {
    const evidence = finding()?.evidence
    if (!evidence) return []
    return [
      { label: evidence.expected?.source ? systemLabel(evidence.expected.source) : 'Expected', value: moneyLabel(evidence.expected) },
      { label: evidence.actual?.source ? systemLabel(evidence.actual.source) : 'Actual', value: moneyLabel(evidence.actual) },
      { label: 'Gap', value: moneyLabel(evidence.difference) },
    ].filter((item) => item.value)
  })

  const kind = computed(() => recordKind(finding()?.category.id ?? '', records.value))
  const details = computed(() => typeDetails(records.value, kind.value))
  // DAR-BE-368. The order's lines across its systems, from the records that carry them.
  const recordLines = computed(() => orderLineRows(records.value, comparedSystems.value))
  const chain = computed(() => heldChain(records.value))

  const fixWhere = computed(() => {
    const where = finding()?.fix.where
    return where ? (FIX_WHERE_LABELS[where] ?? where) : ''
  })
  const fixOwner = computed(() => finding()?.fix.owner || fixWhere.value)

  // What the finding is stuck on, only where it adds to the headline (DAR-UI-071, said once): the return holding it, or the
  // order's line holding it up and that line's cause, in the fix's system.
  const stuckOn = computed(() => {
    const held = records.value.find((row) => row.heldBy)
    if (held?.heldBy) return `Return ${held.heldBy.id} is still ${(held.heldBy.status || 'open').toLowerCase()} in ${held.system}.`
    const unit = options.orderUnit()
    const lines = unit?.lines ?? []
    // A one-line order names no line as holding it up: its line is the one.
    const holding = unit?.stuck?.length ? unit.stuck : lines.length === 1 ? [lines[0]!.id] : []
    return lines.filter((line) => holding.includes(line.id) && line.cause)
      .map((line) => {
        const where = fixWhere.value && !line.cause?.includes(fixWhere.value) ? ` in ${fixWhere.value}` : ''
        return `${lineLabel(unit?.order ?? unit?.id ?? '', line, lines)}: ${line.cause}${where}`
      })
      .join('; ')
  })

  // The conclusion's label and its explanation are often the headline again; say only what is new.
  const whyLine = computed(() => {
    const diagnosis = finding()?.diagnosis
    const said = [finding()?.headline ?? '', splitHeadline(finding()?.headline ?? '').rest]
    const parts = [diagnosis?.conclusion?.label, diagnosis?.explanation]
      .map((part) => (part ?? '').trim().replace(/\.$/, ''))
      .filter((part) => part && !said.some((text) => sameText(text, part)))
    return [...new Set(parts)].map((part) => `${part}.`).join(' ')
  })

  const sinceLine = computed(() => {
    const status = finding()?.status
    if (!status) return ''
    const next = finding()?.fix.verify?.nextCheck
    return [`since ${shortDate(status.firstFound)}`, next ? `next ${shortDate(next)}` : ''].filter(Boolean).join(' · ')
  })
  const evidenceFailed = computed(() => (finding()?.evidence.checks ?? []).some((item) => !item.passed))
  const evidenceLine = computed(() => {
    const checks = finding()?.evidence.checks ?? []
    return `${checks.filter((item) => item.passed).length}/${checks.length}`
  })

  const otherLines = computed(() => otherOrderLines(options.orderUnit()))
  const feedbackRecord = computed(() => options.orderUnit()?.order ?? options.orderUnit()?.headline ?? finding()?.headline ?? null)

  const findingOpen = computed(() => finding()?.status.state === 'open')
  const acknowledged = computed(() => {
    const ack = options.acknowledgement()
    return findingOpen.value && Boolean(ack && !ack.reminded)
  })
  const canAcknowledge = computed(() => {
    const ack = options.acknowledgement()
    return findingOpen.value && (!ack || ack.reminded)
  })
  const detailBadge = computed<Badge>(() => acknowledged.value
    ? { label: 'Acknowledged', tone: 'neutral' }
    : findingStateBadge(finding()?.status.state ?? ''))
  const ackCardLine = computed(() => {
    const ack = options.acknowledgement()
    if (!ack) return ''
    if (!ack.reminded) return `${ackWho(ack)} · ${shortDate(ack.at.slice(0, 10))}`
    // Counted to the tenant's today, not the report's morning (yesterday's until today's run lands).
    const days = acknowledgedDaysAgo(ack.at, options.timeZone())
    return `Acknowledged ${days} ${days === 1 ? 'day' : 'days'} ago by ${ackWho(ack)}, still open`
  })

  return {
    records, comparedSystems, lead, eyebrow, levelLine, basics, money, kind, details, recordLines, chain, stuckOn, fixOwner,
    whyLine, sinceLine, evidenceFailed, evidenceLine, otherLines, feedbackRecord, canAcknowledge, detailBadge, ackCardLine,
  }
}
