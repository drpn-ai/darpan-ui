import type { AuditCheckStatus, AuditFindingState, AuditMoney, AuditRecords, AuditSourceRead } from './api/auditTypes'

// DAR-UI-058. What the audit view derives from the report JSON: words and tones for its codes, rows for its keyed
// objects. Pure, so the page carries no logic of its own.

type Tone = 'neutral' | 'success' | 'warning' | 'danger'

export interface Badge {
  label: string
  tone: Tone
}

const FINDING_STATES: Record<AuditFindingState, Badge> = {
  open: { label: 'Open', tone: 'danger' },
  pending: { label: 'Pending', tone: 'warning' },
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
  deposits: { id: string; amount: string; status: string }[]
  heldBy: { id: string; status: string } | null
  exchange: { id: string; netsuiteId: string } | null
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

/**
 * DAR-UI-081 (Aditi: "group the boxes by system and order, and show item as a subheading with SKU"). One card per system
 * and order: its id and status (an item's order's status, else the record's), the system the fix is in outlined
 * (attention), no status read shown as such; a HotWax order lists its items under it, each by SKU. DAR-BE-125: a HotWax
 * order reads by its name, its HotWax id under it. DAR-UI-088 (Aditi: "for all ids add a subheading to show what they
 * are"): each card says what its id is, so two cards of one system tell apart.
 */
export interface SystemCardItem {
  key: string
  sku: string
  id: string
  status: string
}

export interface SystemCard {
  key: string
  label: string
  kind: string
  id: string
  sub: string
  status: string
  attention: boolean
  items: SystemCardItem[]
}

/** DAR-UI-088. What a card's id is: an order's or return's id, a HotWax order's name, else its record type. */
export function cardKind(row: RecordRow): string {
  if (row.recordType === 'order') return row.system === 'HotWax' && row.internalId ? 'Order name' : 'Order ID'
  if (row.recordType === 'orderItem') return 'Order ID'
  if (row.recordType === 'return') return 'Return ID'
  if (row.recordType === 'salesOrderLine') return 'Sales order'
  const type = recordTypeLabel(row.recordType)
  return type.charAt(0).toUpperCase() + type.slice(1)
}

export function systemCards(rows: RecordRow[], fixWhere: string): SystemCard[] {
  const cards = new Map<string, SystemCard>()
  rows.forEach((row) => {
    const item = row.recordType === 'orderItem'
    const id = item ? (row.id.split('/')[0] ?? row.id) : row.id
    const key = `${row.system}|${id}`
    let card = cards.get(key)
    if (!card) {
      card = {
        key,
        label: row.system,
        kind: cardKind(row),
        id,
        sub: row.recordType === 'order' && row.system === 'HotWax' && row.internalId ? `Order ID ${row.internalId}` : '',
        status: item ? row.orderStatus : row.status,
        attention: Boolean(fixWhere) && row.system === fixWhere,
        items: [],
      }
      cards.set(key, card)
    }
    if (item) card.items.push({ key: row.key, sku: row.sku, id: row.id, status: row.status })
  })
  // A SKU on two items of one order names each item too (gorjana M1168149: one product on three lines).
  cards.forEach((card) => {
    const repeated = new Set(card.items.map((item) => item.sku).filter((sku, index, skus) => sku && skus.indexOf(sku) !== index))
    card.items.forEach((item) => { if (repeated.has(item.sku)) item.sku = `${item.sku} · ${item.id.split('/').pop() ?? item.id}` })
  })
  return [...cards.values()]
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

export interface ChainStep {
  key: string
  label: string
  sub: string
  status: string
  /** The step holding the others: the fix acts on it. */
  cause: boolean
}

/**
 * DAR-UI-081. Where a return held behind another stopped (R8 "Exchange held by open return"): the open return holding it,
 * its exchange order, the return itself, then NetSuite, which has none of it yet. Empty for any other finding.
 */
export function heldChain(rows: RecordRow[]): ChainStep[] {
  const row = rows.find((candidate) => candidate.heldBy)
  if (!row?.heldBy) return []
  const steps: ChainStep[] = [
    { key: 'held-by', label: `Return ${row.heldBy.id}`, sub: `${row.system} · same order`, status: row.heldBy.status || 'Open', cause: true },
  ]
  if (row.exchange) {
    steps.push({ key: 'exchange', label: `Exchange ${row.exchange.id}`, sub: `${row.system} exchange order`,
      status: row.exchange.netsuiteId ? 'In NetSuite' : 'Not in NetSuite', cause: false })
  }
  steps.push({ key: 'return', label: `Return ${row.id}`, sub: 'this finding', status: row.exchange ? 'Waits for the exchange' : 'Waiting', cause: false })
  steps.push({ key: 'netsuite', label: 'NetSuite RMA', sub: `for ${row.id}`, status: 'None yet', cause: false })
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
          deposits: (record.deposits ?? []).map((d) => ({ id: d.id, amount: d.amount ?? '', status: d.status ?? '' })),
          heldBy: record.heldBy ? { id: record.heldBy.id, status: record.heldBy.status ?? '' } : null,
          exchange: record.exchange ? { id: record.exchange.id, netsuiteId: record.exchange.netsuiteId ?? '' } : null,
        })
      })
    })
  })
  return rows
}

/** "1 day", "12 days". */
export function ageLabel(days: number | null | undefined): string {
  if (days == null) return ''
  return days === 1 ? '1 day' : `${days} days`
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
