import type { AuditCheckStatus, AuditFindingState, AuditMoney, AuditRecordLine, AuditRecords, AuditSourceRead } from './api/auditTypes'
import type { StaticFact } from '../components/ui/StaticFactStrip.vue'

// DAR-UI-058. What the audit view derives from the report JSON: words and tones for its codes, rows for its keyed
// objects. Pure, so the page carries no logic of its own.

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

export interface Badge {
  label: string
  tone: Tone
}

const FINDING_STATES: Record<AuditFindingState, Badge> = {
  open: { label: 'Open', tone: 'danger' },
  fixed: { label: 'Fixed', tone: 'success' },
}

const CHECK_STATUSES: Record<AuditCheckStatus, Badge> = {
  ran: { label: 'Ran', tone: 'success' },
  partial: { label: 'Partial', tone: 'warning' },
  notRun: { label: 'Not run', tone: 'neutral' },
}

const SOURCE_READS: Record<AuditSourceRead, Badge> = {
  complete: { label: 'Complete', tone: 'success' },
  partial: { label: 'Partial', tone: 'warning' },
  failed: { label: 'Failed', tone: 'danger' },
}

export function findingStateBadge(state: string): Badge {
  return FINDING_STATES[state as AuditFindingState] ?? { label: state, tone: 'neutral' }
}

export function checkStatusBadge(status: string): Badge {
  return CHECK_STATUSES[status as AuditCheckStatus] ?? { label: status, tone: 'neutral' }
}

export function sourceReadBadge(read: string): Badge {
  return SOURCE_READS[read as AuditSourceRead] ?? { label: read, tone: 'neutral' }
}

/** The JSON names systems by key; the page says HotWax for the OMS, as every other page does. */
export function systemLabel(system: string): string {
  return system === 'OMS' ? 'HotWax' : system
}

/** A finding's fix.where is a system code, named as every page names systems. */
export const FIX_WHERE_LABELS: Record<string, string> = { OMS: 'HotWax', NETSUITE: 'NetSuite', SHOPIFY: 'Shopify' }

/** The morning an audit page shows (?period, ?date), carried to its run and settings pages and back. */
export function auditMorningQuery(query: Record<string, unknown> | undefined): Record<string, string> {
  return Object.fromEntries(['period', 'date'].flatMap((key) => {
    const value = query?.[key]
    return typeof value === 'string' && value ? [[key, value]] : []
  }))
}

/** DAR-BE-117. creditMemo -> "credit memo", rma -> "RMA": a record type as the tile says it. */
export function recordTypeLabel(recordType: string): string {
  return recordType === 'rma' ? 'RMA' : recordType.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
}

export interface RecordRow {
  key: string
  system: string
  recordType: string
  id: string
  internalId: string
  status: string
  orderName: string
  orderStatus: string
  customer: string
  salesChannel: string
  shipMethod: string
  sku: string
  location: string
  orderDate: string
  returnDate: string
  channel: string
  warrantyId: string
  orderTotal: string
  returnTotal: string
  paymentStatus: string
  deposits: { id: string; amount: string; status: string }[]
  heldBy: { id: string; status: string } | null
  exchange: { id: string; netsuiteId: string } | null
  lines: AuditRecordLine[]
}

/** DAR-UI-071. A record by its system; its type too only when another record shares the system. */
export function recordLabel(row: RecordRow, rows: RecordRow[]): string {
  const shared = rows.some((other) => other !== row && other.system === row.system)
  return shared ? `${row.system} ${recordTypeLabel(row.recordType)}` : row.system
}

export interface RecordFact {
  key: string
  label: string
  value: string
  status: string
}

/** DAR-UI-081. The order a finding is about, by name: a record's order name, else a HotWax order's own. */
export function orderNameOf(rows: RecordRow[]): string {
  return rows.find((row) => row.orderName)?.orderName
    ?? rows.find((row) => row.recordType === 'order' && row.system === 'HotWax' && row.internalId)?.id ?? ''
}

/**
 * DAR-UI-080 / DAR-UI-081. What explains the finding beyond each card's id and status, as label and value lines: the
 * customer, the order's and a return's date, its sales channel and ship method, a return's channel and warranty, totals
 * and customer deposits, when known.
 * Its order's name leads the panel and an order's status sits on its card; a fact the records repeat is listed once.
 */
export function recordDetails(rows: RecordRow[]): RecordFact[] {
  const seen = new Set<string>()
  return rows.flatMap((row): (RecordFact | null)[] => {
    const fact = (label: string, value: string, suffix: string, status = '') => ({ key: row.key + suffix, label, value, status })
    return [
      row.customer ? fact('Customer', row.customer, '|customer') : null,
      row.orderDate ? fact('Order date', shortDate(row.orderDate), '|orderDate') : null,
      row.returnDate ? fact('Return date', shortDate(row.returnDate), '|returnDate') : null,
      row.salesChannel ? fact('Sales channel', row.salesChannel, '|salesChannel') : null,
      row.shipMethod ? fact('Ship method', row.shipMethod, '|shipMethod') : null,
      row.channel ? fact('Channel', row.channel, '|channel') : null,
      row.warrantyId ? fact('Warranty ID', row.warrantyId, '|warranty') : null,
      row.orderTotal ? fact('Order total', row.orderTotal, '|orderTotal') : null,
      row.returnTotal ? fact('Return total', row.returnTotal, '|returnTotal') : null,
      ...row.deposits.map((deposit, index) =>
        fact('Deposit', deposit.amount ? `${deposit.id} · ${deposit.amount}` : deposit.id, `|deposit|${index}`, deposit.status)),
    ]
  }).filter((detail): detail is RecordFact => {
    if (!detail || seen.has(`${detail.label}|${detail.value}`)) return false
    seen.add(`${detail.label}|${detail.value}`)
    return true
  }).sort((a, b) => DETAIL_ORDER.indexOf(a.label) - DETAIL_ORDER.indexOf(b.label))
}

/** DAR-UI-081 (Aditi: "maintain some consistency"): every finding lists its order, then its return, then deposits. */
const DETAIL_ORDER = ['Customer', 'Order date', 'Sales channel', 'Ship method', 'Order total',
  'Return date', 'Channel', 'Warranty ID', 'Return total', 'Deposit']

/**
 * DAR-UI-139 (Aditi: "all finding have the basix details row"). The same four cells on every finding: each of the two
 * systems the check compared (report keys, in read order) and its record's status, "None" when that system holds no
 * record of it, with its payment status beside (DAR-BE-360); the amount (a return's total, else its order's); the day (a return's, else its order's). The
 * check names its systems whether or not it ran (DAR-BE-371). A fact nobody read is a dash, so every row is even.
 */
export function basicFacts(rows: RecordRow[], compared: string[]): StaticFact[] {
  // DAR-BE-371 (Aditi: "if we are looking at HW to NS then the info should be HW to NS"): only the compared systems; a
  // one-system check gets one cell. The records' own systems stand in only when the check names none.
  const systems = compared.length ? [...new Set(compared.map(systemLabel))].slice(0, 2)
    : [...new Set(rows.map((row) => row.system))].slice(0, 2)
  const side = (index: number): StaticFact => {
    const system = systems[index]
    if (!system) return { key: `system${index}`, label: 'Other system', value: '—' }
    const row = rows.find((candidate) => candidate.system === system)
    const status = row ? (row.recordType === 'orderItem' ? row.orderStatus || row.status : row.status) : ''
    // DAR-BE-360: and its payment status, from another of its records when this one has none (an item's order).
    const paid = row ? row.paymentStatus || rows.find((candidate) => candidate.system === system && candidate.paymentStatus)?.paymentStatus : ''
    const value = [status, paid].filter(Boolean).join(' · ')
    return { key: `system${index}`, label: system, value: row ? value || '—' : 'None' }
  }
  const returned = rows.find((row) => row.returnTotal || row.returnDate)
  const total = rows.find((row) => row.returnTotal)?.returnTotal
  const orderTotal = rows.find((row) => row.orderTotal)?.orderTotal
  const ordered = rows.find((row) => row.orderDate)?.orderDate
  return [
    side(0),
    ...(compared.length && systems.length === 1 ? [] : [side(1)]),
    total ? { key: 'amount', label: 'Return total', value: total }
      : orderTotal ? { key: 'amount', label: 'Order total', value: orderTotal } : { key: 'amount', label: 'Total', value: '—' },
    returned?.returnDate ? { key: 'day', label: 'Returned', value: shortDate(returned.returnDate) }
      : ordered ? { key: 'day', label: 'Ordered', value: shortDate(ordered) } : { key: 'day', label: 'Day', value: '—' },
  ]
}

/** DAR-UI-139. What the finding is about, from its category (report enum code), else its records. */
export type RecordKind = 'Order' | 'Return' | 'Exchange'
export function recordKind(category: string, rows: RecordRow[]): RecordKind {
  if (category === 'orders') return 'Order'
  if (category === 'returns') return 'Return'
  if (category === 'exchangesAndWarranty') return 'Exchange'
  if (rows.some((row) => row.exchange)) return 'Exchange'
  if (rows.some((row) => ['return', 'rma', 'creditMemo'].includes(row.recordType))) return 'Return'
  return 'Order'
}

/** DAR-UI-139. The record's facts under its kind, less what the basics already say (its total and day). */
const BASIC_LABELS = ['Order date', 'Return date', 'Order total', 'Return total']
/** DAR-UI-151 (Aditi: "can we standardize this info across all finding detail cards"). The rows every finding of a kind
 *  shows, in this order, a dash when its reads gave none; anything else known (a deposit) follows. */
const KIND_DETAILS: Record<RecordKind, string[]> = {
  Order: ['Customer', 'Sales channel', 'Ship method'],
  Return: ['Customer', 'Sales channel', 'Channel'],
  Exchange: ['Customer', 'Sales channel', 'Warranty ID'],
}
export function typeDetails(rows: RecordRow[], kind: RecordKind): RecordFact[] {
  const known = recordDetails(rows).filter((fact) => !BASIC_LABELS.includes(fact.label))
  const standard = KIND_DETAILS[kind].map((label) =>
    known.find((fact) => fact.label === label) ?? { key: `standard|${label}`, label, value: '—', status: '' })
  return [...standard, ...known.filter((fact) => !KIND_DETAILS[kind].includes(fact.label))]
}

/** DAR-BE-368. One line of the order across its systems: what it is, how many, and each system's word for it. */
export interface OrderLineRow {
  key: string
  label: string
  quantity: string
  statuses: { system: string; status: string }[]
}

/**
 * DAR-BE-368 (Aditi: "include the line item details, expecially the SKU", "show both shopify and HW"). The order's lines
 * from every record that carries them, one row per line: a Shopify line and the HotWax item that keeps its id pair into
 * one, labelled by SKU (else its name, else its id), each system's status in record order.
 */
export function orderLineRows(rows: RecordRow[], compared: string[] = []): OrderLineRow[] {
  // DAR-BE-371. Only the compared systems' lines, when the check names them.
  const inContext = compared.map(systemLabel)
  if (inContext.length) rows = rows.filter((row) => inContext.includes(row.system))
  const byKey = new Map<string, OrderLineRow & { sku: string; name: string }>()
  rows.forEach((row) => row.lines.forEach((line, index) => {
    const key = line.id ?? `${row.key}#${index}`
    const at = byKey.get(key) ?? { key, label: '', quantity: '', statuses: [], sku: '', name: '' }
    at.sku ||= line.sku ?? ''
    at.name ||= line.name ?? ''
    at.quantity ||= line.quantity == null ? '' : String(line.quantity)
    if (line.status) at.statuses.push({ system: row.system, status: line.status })
    byKey.set(key, at)
  }))
  return [...byKey.values()].map(({ sku, name, ...line }) => ({ ...line, label: sku || name || line.key }))
}

export interface ChainStep {
  key: string
  label: string
  sub: string
  status: string
  /** The record exists; a missing one draws dashed. */
  present: boolean
  /** The record holding this step back (the fix acts on it), on the first missing step. */
  heldBy: { label: string; sub: string; status: string } | null
}

/**
 * DAR-UI-081. Where a return held behind another stopped (R2 "Exchange held by open return"). Empty for any other finding.
 * DAR-UI-092 (Aditi: "the order looks like a lifecycle"; 2026-11-10: "the RMA wouldnt come after the exchange"): one
 * record in one system per step, each after the record it is made from. HotWax makes the return and its exchange order;
 * NetSuite then takes the return's RMA, and only after it the exchange's sales order. The open return holds the first
 * missing record, the RMA, so it sits on that step.
 */
export function heldChain(rows: RecordRow[]): ChainStep[] {
  const row = rows.find((candidate) => candidate.heldBy)
  if (!row?.heldBy) return []
  const steps: ChainStep[] = [
    { key: 'return', label: `Return ${row.id}`, sub: `${row.system} · this finding`, status: row.status || 'Open', present: true, heldBy: null },
  ]
  if (row.exchange) {
    steps.push({ key: 'exchange', label: `Exchange ${row.exchange.id}`, sub: `${row.system} · from ${row.id}`, status: 'Created', present: true, heldBy: null })
  }
  steps.push({ key: 'rma', label: `RMA for ${row.id}`, sub: 'NetSuite · the return', status: 'Not created', present: false,
    heldBy: { label: `Return ${row.heldBy.id}`, sub: `${row.system} · open on the same order`, status: row.heldBy.status || 'Open' } })
  if (row.exchange) {
    const sent = row.exchange.netsuiteId
    steps.push({ key: 'exchange-netsuite', label: 'Exchange in NetSuite', sub: sent ? `NetSuite · ${sent}` : 'NetSuite · after the RMA',
      status: sent ? 'Sent' : 'Not sent', present: Boolean(sent), heldBy: null })
  }
  return steps
}

/** "324.89 USD"; "324.89" when the read named no currency. */
function moneyText(money: AuditMoney | undefined): string {
  return money ? `${money.amount} ${money.currency ?? ''}`.trim() : ''
}

/** records.<System>.<recordType>[] as one row each, in the document's order. */
export function recordRows(records: AuditRecords | null | undefined): RecordRow[] {
  const rows: RecordRow[] = []
  Object.entries(records ?? {}).forEach(([system, byType]) => {
    Object.entries(byType ?? {}).forEach(([recordType, list]) => {
      ;(list ?? []).forEach((record, index) => {
        rows.push({
          key: `${system}|${recordType}|${record.id}|${index}`,
          system: systemLabel(system),
          recordType,
          id: record.id,
          internalId: record.internalId ?? '',
          status: record.status ?? '',
          orderName: record.orderName ?? '',
          orderStatus: record.orderStatus ?? '',
          customer: record.customer ?? '',
          salesChannel: record.salesChannel ?? '',
          shipMethod: record.shipMethod ?? '',
          sku: record.sku ?? '',
          location: record.location ?? '',
          orderDate: record.orderDate ?? '',
          returnDate: record.returnDate ?? '',
          channel: record.channel ?? '',
          warrantyId: record.warrantyId ?? '',
          orderTotal: moneyText(record.orderTotal),
          returnTotal: moneyText(record.returnTotal),
          paymentStatus: record.paymentStatus ?? '',
          deposits: (record.deposits ?? []).map((d) => ({ id: d.id, amount: d.amount ?? '', status: d.status ?? '' })),
          heldBy: record.heldBy ? { id: record.heldBy.id, status: record.heldBy.status ?? '' } : null,
          exchange: record.exchange ? { id: record.exchange.id, netsuiteId: record.exchange.netsuiteId ?? '' } : null,
          lines: record.lines ?? [],
        })
      })
    })
  })
  return rows
}

/**
 * The periods the filter offers: the report's own and the two before it, for a monthly audit (YYYY-MM). Other period
 * kinds get no filter yet; the report's period still shows on the page.
 */
export function periodOptions(period: string | null | undefined, date?: string | null): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? '')
  if (!match) return period ? [period] : []
  // DAR-UI-067. Count back from the report date's month, not the period on show, so an older pick can come back.
  const anchor = /^(\d{4})-(\d{2})/.exec(date ?? '') ?? match
  const year = Number(anchor[1])
  const month = Number(anchor[2])
  const options = [0, 1, 2].map((back) => {
    const index = year * 12 + (month - 1) - back
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
  })
  return options.includes(period as string) ? options : [...options, period as string]
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** DAR-UI-066. "Oct 22" for a day, "Oct 22, 07:28" for an instant: the tenant's wall clock as written, no offset. */
export function shortDate(text: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}:\d{2}))?/.exec(text ?? '')
  if (!match) return text ?? ''
  const day = `${MONTHS[Number(match[2]) - 1]} ${Number(match[3])}`
  return match[4] ? `${day}, ${match[4]}` : day
}

/** "Oct 1 – 22" inside a month, "Sep 28 – Oct 3" across one. */
export function shortRange(from: string | null | undefined, thru: string | null | undefined): string {
  const start = shortDate(from)
  const end = shortDate(thru)
  if (!start || !end) return start || end
  return start.split(' ')[0] === end.split(' ')[0] ? `${start} – ${end.split(' ')[1]}` : `${start} – ${end}`
}

/** "Return 630208: Completed return with no order" splits into the record and what is wrong with it. */
export function splitHeadline(headline: string | null | undefined): { subject: string; rest: string } {
  const text = (headline ?? '').trim()
  const at = text.indexOf(': ')
  return at > 0 ? { subject: text.slice(0, at), rest: text.slice(at + 2) } : { subject: text, rest: '' }
}

/** A history code in words: stillOpen -> "Still open". */
export function eventLabel(event: string | null | undefined): string {
  const words = (event ?? '').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}
