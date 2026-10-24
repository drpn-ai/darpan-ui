import type { AuditCheckStatus, AuditFindingState, AuditRecords, AuditSourceRead } from './api/auditTypes'

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
 * DAR-BE-125. A record as label and value lines: an order reads as Order ID (Shopify's id), Order Name and HotWax Order ID
 * (HotWax's name and id); every other record by recordLabel.
 */
export function recordFacts(rows: RecordRow[]): RecordFact[] {
  return rows.flatMap((row): RecordFact[] => {
    const fact = (label: string, value: string, suffix = '') => ({ key: row.key + suffix, label, value, status: suffix ? '' : row.status })
    if (row.recordType === 'order' && row.system === 'Shopify') return [fact('Order ID', row.id)]
    if (row.recordType === 'order' && row.system === 'HotWax' && row.internalId) {
      return [fact('Order Name', row.id), fact('HotWax Order ID', row.internalId, '|hc')]
    }
    return [fact(recordLabel(row, rows), row.id)]
  })
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
