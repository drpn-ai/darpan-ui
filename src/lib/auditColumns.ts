import type { AuditCategory, AuditFindingCounts, AuditReport, AuditStatement, AuditStatementCheck } from './api/auditTypes'
import { systemLabel } from './auditReport'

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
  attention: boolean
}

export interface StatementItem {
  id: string
  text: string
  open: number
  pending: number
  notChecked: boolean
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
export function categoryItems(report: AuditReport): CategoryItem[] {
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
      notChecked,
      badge: notChecked ? '–' : String(open || pending || 0),
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
    all: statements.length,
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

/** A statement found by id in any category, with the category it sits in. */
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
