import type {
  AuditCheckStatus,
  AuditFindingState,
  AuditRecords,
  AuditReport,
  AuditSourceRead,
  AuditStatement,
} from './api/auditTypes'

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

export function healthBadge(report: AuditReport): Badge {
  return report.health.complete ? { label: 'Complete', tone: 'success' } : { label: 'Not complete', tone: 'warning' }
}

/** The JSON names systems by key; the page says HotWax for the OMS, as every other page does. */
export function systemLabel(system: string): string {
  return system === 'OMS' ? 'HotWax' : system
}

export interface SourceRow {
  system: string
  badge: Badge
  records: string
  reason: string | null
}

export function sourceRows(report: AuditReport): SourceRow[] {
  return Object.entries(report.health.sources ?? {}).map(([system, source]) => ({
    system: systemLabel(system),
    badge: sourceReadBadge(source.read),
    records: source.records == null ? '' : source.records.toLocaleString('en-US'),
    reason: source.reason,
  }))
}

export interface RecordRow {
  key: string
  system: string
  recordType: string
  id: string
  internalId: string
  status: string
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

/** "M1137118, INV8440371": a finding's record ids, for a one-line cell. */
export function recordIds(records: AuditRecords | null | undefined): string {
  return [...new Set(recordRows(records).map((row) => row.id))].join(', ')
}

export interface StatementRow {
  id: string
  text: string
  badge: Badge
  open: number
  pending: number
  statement: AuditStatement
}

export function statementRows(statements: Record<string, AuditStatement> | null | undefined): StatementRow[] {
  return Object.values(statements ?? {}).map((statement) => ({
    id: statement.id,
    text: statement.text,
    badge: checkStatusBadge(statement.status),
    open: statement.counts?.open ?? 0,
    pending: statement.counts?.pending ?? 0,
    statement,
  }))
}

/** "2026-10-21T23:44:35-07:00" -> "2026-10-21 23:44 -07:00", wherever such an instant sits in the text; the offset
 *  stays, since the document's times are in the tenant's zone, not the reader's. */
export function instantLabel(text: string | null | undefined): string {
  return (text ?? '').replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(Z|[+-]\d{2}:\d{2})?/g,
    (_, day: string, time: string, offset?: string) => `${day} ${time}${offset ? ` ${offset}` : ''}`)
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
export function periodOptions(period: string | null | undefined): string[] {
  const match = /^(\d{4})-(\d{2})$/.exec(period ?? '')
  if (!match) return period ? [period] : []
  const year = Number(match[1])
  const month = Number(match[2])
  return [0, 1, 2].map((back) => {
    const index = year * 12 + (month - 1) - back
    return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`
  })
}
