import type {
  AuditCategory,
  AuditFindingCounts,
  AuditFindingListItem,
  AuditFindingSummary,
  AuditReport,
  AuditStatement,
  AuditStatementCheck,
} from './api/auditTypes'
import { splitHeadline, systemLabel } from './auditReport'

// DAR-UI-065. The audit page as drill-down columns: what each column lists and what is picked when the URL does not
// say. Pure, so the page and its component carry no rules of their own.

export const HEALTH = 'health'
export const SOURCE_CHECKS = 'checks'
export const SOURCE_NOT_COVERED = 'notCovered'

export type AuditFilter = 'all' | 'open' | 'pending' | 'notChecked'
export const AUDIT_FILTERS: AuditFilter[] = ['open', 'pending', 'notChecked', 'all']

export function isAuditFilter(value: unknown): value is AuditFilter {
  return typeof value === 'string' && (AUDIT_FILTERS as string[]).includes(value)
}

export interface CategoryItem {
  id: string
  label: string
  /** The first word, for the rail column 1 folds to while a finding is open. */
  short: string
  sub: string
  open: number
  pending: number
  /** DAR-UI-073. What the picked pill counts: the rail's number. */
  count: number
  attention: boolean
}

export interface StatementItem {
  id: string
  text: string
  open: number
  pending: number
  /** What the row's count shows: open, else pending, else 0; a dash when nothing checked it. */
  badge: string
  tone: 'open' | 'pending' | 'clean' | 'notChecked'
}

export interface SourceItem {
  key: string
  label: string
  sub: string
  tag: string
  attention: boolean
}

export interface ComparedBar {
  /** The system as the JSON keys it (OMS), to ask for its extract. */
  key: string
  system: string
  count: string
  share: string
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`
}

/** "5 open · 2 pending", or "holds" when nothing is open or pending. */
export function countsLine(counts: AuditFindingCounts | null | undefined): string {
  const parts = [counts?.open ? `${counts.open} open` : '', counts?.pending ? `${counts.pending} pending` : ''].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'holds'
}

function statementsOf(category: AuditCategory | null | undefined): AuditStatement[] {
  return Object.values(category?.statements ?? {})
}

function notCheckedCount(category: AuditCategory | null | undefined): number {
  return statementsOf(category).filter((statement) => statement.status === 'notRun').length
}

/** Column 1: the run's health first, then the report's categories in the document's order. */
// DAR-UI-073. The pill decides what every column counts and lists: Open the open findings, Pending the pending, the rest
// both, so the rail, a statement's badge, the findings heading and the rows listed always agree.
export function countFor(counts: AuditFindingCounts | null | undefined, filter: AuditFilter): number {
  const open = counts?.open ?? 0
  const pending = counts?.pending ?? 0
  return filter === 'open' ? open : filter === 'pending' ? pending : open + pending
}

/** The finding states the picked pill lists. */
export function statesFor(filter: AuditFilter): AuditFindingSummary['state'][] {
  return filter === 'open' ? ['open'] : filter === 'pending' ? ['pending'] : ['open', 'pending']
}

export function categoryItems(report: AuditReport, filter: AuditFilter = 'all'): CategoryItem[] {
  const health: CategoryItem = {
    id: HEALTH,
    label: 'Run health',
    short: 'Health',
    sub: [
      report.health.complete ? 'complete' : 'not complete',
      report.health.notCovered.length ? `${report.health.notCovered.length} not covered` : '',
    ].filter(Boolean).join(' · '),
    open: 0,
    pending: 0,
    count: 0,
    attention: !report.health.complete,
  }
  return [health, ...Object.entries(report.categories ?? {}).map(([id, category]) => {
    const unchecked = notCheckedCount(category)
    return {
      id,
      label: category.label,
      short: category.label.split(' ')[0] ?? category.label,
      sub: [countsLine(category.counts), unchecked ? `${unchecked} not checked` : ''].filter(Boolean).join(' · '),
      open: category.counts?.open ?? 0,
      pending: category.counts?.pending ?? 0,
      count: countFor(category.counts, filter),
      attention: (category.counts?.open ?? 0) > 0,
    }
  })]
}

export function keepStatement(statement: AuditStatement, filter: AuditFilter): boolean {
  if (filter === 'open') return (statement.counts?.open ?? 0) > 0
  if (filter === 'pending') return (statement.counts?.pending ?? 0) > 0
  if (filter === 'notChecked') return statement.status === 'notRun'
  return true
}

/** Column 2: a category's statements that the filter keeps. */
export function statementItems(category: AuditCategory | null | undefined, filter: AuditFilter): StatementItem[] {
  return statementsOf(category).filter((statement) => keepStatement(statement, filter)).map((statement) => {
    const open = statement.counts?.open ?? 0
    const pending = statement.counts?.pending ?? 0
    const notChecked = statement.status === 'notRun'
    return {
      id: statement.id,
      text: statement.text,
      open,
      pending,
      badge: notChecked ? '–' : String(countFor(statement.counts, filter)),
      tone: notChecked ? 'notChecked' : open ? 'open' : pending ? 'pending' : 'clean',
    }
  })
}

/** The numbers on the filter pills: findings for open and pending, statements for the other two. */
export function filterCounts(report: AuditReport): Record<AuditFilter, number> {
  const statements = Object.values(report.categories ?? {}).flatMap(statementsOf)
  return {
    open: report.summary.open,
    pending: report.summary.pending,
    notChecked: statements.filter((statement) => statement.status === 'notRun').length,
    all: countFor(report.summary, 'all'),
  }
}

/** Where the page opens when the URL names no category: the most open findings, then the most pending, else the first. */
export function defaultCategory(report: AuditReport, filter: AuditFilter): string {
  const entries = Object.entries(report.categories ?? {})
  const kept = entries.filter(([, category]) => statementsOf(category).some((statement) => keepStatement(statement, filter)))
  const pool = kept.length ? kept : entries
  const weight = (category: AuditCategory) => [category.counts?.open ?? 0, category.counts?.pending ?? 0] as const
  let best = pool[0]
  for (const entry of pool) {
    const [open, pending] = weight(entry[1])
    const [bestOpen, bestPending] = best ? weight(best[1]) : [0, 0]
    if (open > bestOpen || (open === bestOpen && pending > bestPending)) best = entry
  }
  return best?.[0] ?? HEALTH
}

/** The statement a category opens on: the first the filter keeps that has findings, else the first it keeps. */
export function defaultStatement(category: AuditCategory | null | undefined, filter: AuditFilter): string {
  const items = statementItems(category, filter)
  return (items.find((item) => item.open || item.pending) ?? items[0])?.id ?? ''
}

/** Column 2 under Run health: each system read, then the checks, then the statements nothing checks. */
export function sourceItems(report: AuditReport): SourceItem[] {
  const sources = Object.entries(report.health.sources ?? {}).map(([key, source]) => ({
    key,
    label: systemLabel(key),
    sub: source.records == null ? '' : `${source.records.toLocaleString('en-US')} records`,
    tag: source.read,
    attention: source.read !== 'complete',
  }))
  const checks = report.health.checks
  const items: SourceItem[] = [...sources, {
    key: SOURCE_CHECKS,
    label: 'Checks',
    sub: [`${checks.ran} ran`, checks.partial ? `${checks.partial} partial` : '', checks.notRun ? `${checks.notRun} not run` : '']
      .filter(Boolean).join(' · '),
    tag: String(checks.ran + checks.partial + checks.notRun),
    attention: checks.partial > 0 || checks.notRun > 0,
  }]
  if (report.health.notCovered.length) {
    items.push({
      key: SOURCE_NOT_COVERED,
      label: 'Not covered',
      sub: report.health.notCovered.join(' · '),
      tag: String(report.health.notCovered.length),
      attention: false,
    })
  }
  return items
}

/** Health opens on what needs a look: a read that is not complete, else the checks. */
export function defaultSource(report: AuditReport): string {
  const items = sourceItems(report)
  return (items.find((item) => item.attention) ?? items.find((item) => item.key === SOURCE_CHECKS))?.key ?? ''
}

/** DAR-UI-070. What "N more" fetched for the statement on show; hasNextPage is null until it has. */
export interface FindingsMore {
  findings: AuditFindingSummary[]
  hasNextPage: boolean | null
  loading: boolean
  error: string
}

export function emptyFindingsMore(): FindingsMore {
  return { findings: [], hasNextPage: null, loading: false, error: '' }
}

// DAR-UI-069. A fixed finding stays in the report for the day's "fixed today" only; the board lists what is still wrong.
// DAR-UI-070. The report lists 50 a statement; the pages "N more" fetched follow them, each finding once.
export function statementFindings(statement: AuditStatement | null | undefined, more: AuditFindingSummary[],
  filter: AuditFilter = 'all'): AuditFindingSummary[] {
  const states = statesFor(filter)
  const listed = (statement?.findings ?? []).filter((item) => states.includes(item.state))
  const seen = new Set(listed.map((item) => item.id))
  return [...listed, ...more.filter((item) => states.includes(item.state) && !seen.has(item.id))]
}

// DAR-BE-125. A finding's heading: its cause in the catalog's words (renamed since the finding was written, it still reads
// in the new ones), else what its headline says after the record.
export function causeHeading(item: AuditFindingSummary): string {
  return item.cause || splitHeadline(item.headline).rest
}

// DAR-BE-125. Findings with the same cause together, so its heading is said once: causes in the order their first finding
// came, findings in their own order within a cause. An order unit says what holds it on its own row, so it stays alone.
export function causeGroups<T extends AuditFindingSummary>(items: T[]): T[] {
  const groups = new Map<string, T[]>()
  items.forEach((item) => {
    const key = item.kind === 'order' ? `order|${item.id}` : `cause|${causeHeading(item)}`
    groups.set(key, [...(groups.get(key) ?? []), item])
  })
  return [...groups.values()].flat()
}

// DAR-UI-072. The order a finding is about, as a person searches it: HotWax's order (an item's id before its "/"),
// else Shopify's, else NetSuite's sales order; blank when the finding names no order.
const ORDER_RECORDS: [string, string, (id: string) => string][] = [
  ['OMS', 'order', (id) => id],
  ['OMS', 'orderItem', (id) => id.split('/')[0] ?? id],
  ['Shopify', 'order', (id) => id],
  ['NetSuite', 'salesOrder', (id) => id],
  ['NetSuite', 'salesOrderLine', (id) => id],
]

export function orderKey(item: AuditFindingSummary): string {
  for (const [system, type, toOrder] of ORDER_RECORDS) {
    const id = item.records?.[system]?.[type]?.[0]?.id
    if (id) return toOrder(id)
  }
  return ''
}

// DAR-UI-073. The toolbar's filters over the whole board: a search over a finding's ids, its cause, its age in days.
export interface FindingFilters {
  q: string
  cause: string
  /** At least this many days old; 0 is any age. */
  age: number
}

export function hasFindingFilters(filters: FindingFilters): boolean {
  return Boolean(filters.q.trim() || filters.cause || filters.age > 0)
}

export function matchesFindingFilters(item: AuditFindingListItem, filters: FindingFilters): boolean {
  // DAR-UI-075. An order is one finding: its lines' causes and ids count as its own.
  const parts: AuditFindingSummary[] = [item, ...(item.lines ?? [])]
  if (filters.cause && !findingCauses(item).includes(filters.cause)) return false
  if (filters.age > 0 && (item.ageDays ?? 0) < filters.age) return false
  const q = filters.q.trim().toLowerCase()
  if (!q) return true
  const ids = parts.flatMap((part) => Object.values(part.records ?? {}).flatMap((byType) => Object.values(byType ?? {}).flat()))
    .flatMap((record) => [record.id, record.internalId ?? ''])
  return [...parts.flatMap((part) => [part.id, part.headline]), orderKey(item), ...ids]
    .some((text) => (text ?? '').toLowerCase().includes(q))
}

function findingCauses(item: AuditFindingListItem): string[] {
  return [item.cause, ...(item.lines ?? []).map((line) => line.cause)].filter((cause): cause is string => Boolean(cause))
}

/** "Line 1" for item M1168785/01 of order M1168785, as the report's order headline names it; else the line's finding id. */
export function lineLabel(order: string, line: AuditFindingSummary): string {
  const item = line.records?.OMS?.orderItem?.[0]?.id ?? ''
  if (!item.startsWith(order) || item.length <= order.length) return line.id
  const suffix = item.slice(order.length).replace(/^[/\-_ ]+/, '')
  return `Line ${/^\d+$/.test(suffix) ? Number(suffix) : suffix}`
}

/** The causes the loaded findings carry, for the cause picker. */
export function causeOptions(items: AuditFindingListItem[]): string[] {
  return [...new Set(items.flatMap(findingCauses))].sort()
}

/** What the filters left, per category and per statement: the rail's numbers and the statements' badges. */
export function narrowedCounts(items: AuditFindingListItem[]): { byCategory: Map<string, number>; byStatement: Map<string, number> } {
  const byCategory = new Map<string, number>()
  const byStatement = new Map<string, number>()
  items.forEach((item) => {
    byCategory.set(item.category, (byCategory.get(item.category) ?? 0) + 1)
    byStatement.set(item.statement, (byStatement.get(item.statement) ?? 0) + 1)
  })
  return { byCategory, byStatement }
}

/** How many open and pending findings the board has not shown yet; none once the last page is in. */
export function findingsLeft(statement: AuditStatement | null | undefined, shown: number, hasNextPage: boolean | null,
  filter: AuditFilter = 'all'): number {
  if (!statement || hasNextPage === false || (hasNextPage === null && !statement.findingsOmitted)) return 0
  return Math.max(countFor(statement.counts, filter) - shown, 0)
}

export function findStatement(report: AuditReport, id: string): { categoryId: string; statement: AuditStatement } | null {
  for (const [categoryId, category] of Object.entries(report.categories ?? {})) {
    const statement = category.statements?.[id]
    if (statement) return { categoryId, statement }
  }
  return null
}

/** One bar per system a check compared, as a share of the largest, so a gap reads at a glance. */
export function comparedBars(check: AuditStatementCheck): ComparedBar[] {
  const entries = Object.entries(check.compared ?? {})
  const max = Math.max(1, ...entries.map(([, count]) => count))
  return entries.map(([system, count]) => ({
    key: system,
    system: systemLabel(system),
    count: count.toLocaleString('en-US'),
    share: `${Math.round((count / max) * 100)}%`,
  }))
}

/** "3 not matched" for a check that compared two systems that disagree; nothing otherwise. */
export function comparedGap(check: AuditStatementCheck): string {
  const counts = Object.values(check.compared ?? {})
  if (counts.length !== 2) return ''
  const gap = Math.abs(counts[0]! - counts[1]!)
  return gap ? `${plural(gap, 'record')} not matched` : 'every record matched'
}
