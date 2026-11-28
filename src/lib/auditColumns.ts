import type {
  AuditAcknowledgement,
  AuditCategory,
  AuditCheckStatus,
  AuditFindingCounts,
  AuditFindingListItem,
  AuditFindingSummary,
  AuditLevel,
  AuditOrderLine,
  AuditProgress,
  AuditProgressRun,
  AuditProgressStep,
  AuditReport,
  AuditStatement,
  AuditStatementCheck,
} from './api/auditTypes'
import { AUDIT_LEVELS, LEVEL_LABEL, LEVEL_WORD } from './api/auditTypes'
import { splitHeadline, systemLabel } from './auditReport'
import { formatRunStepDuration, reconciliationStageLabel } from './reconciliationDisplay'

// DAR-UI-065. The audit page as drill-down columns: what each column lists and what is picked when the URL does not
// say. Pure, so the page and its component carry no rules of their own.

export const HEALTH = 'health'
export const SOURCE_CHECKS = 'checks'
export const SOURCE_NOT_COVERED = 'notCovered'
/** DAR-UI-085. Under Run health while checks are in flight. */
export const SOURCE_RUNNING = 'running'

// DAR-UI-144. 'acknowledged': rows a person has taken, listed apart from open (open excludes them).
export type AuditFilter = 'all' | 'open' | 'acknowledged' | 'notChecked'
export const AUDIT_FILTERS: AuditFilter[] = ['open', 'acknowledged', 'notChecked', 'all']

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
  /** DAR-UI-073. What the picked pill counts: the rail's number. */
  count: number
  attention: boolean
  /** DAR-UI-085. Run health only: checks are in flight right now. */
  running: boolean
}

export interface StatementItem {
  id: string
  text: string
  open: number
  /** What the row's count shows: its findings under the filter, whether or not its check ran today (DAR-UI-149). */
  badge: string
  tone: 'open' | 'clean'
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

/** "5 open", or "nothing found" when nothing is open (DAR-UI-087: was "holds"). */
export function countsLine(counts: AuditFindingCounts | null | undefined): string {
  return counts?.open ? `${counts.open} open` : 'nothing found'
}

function statementsOf(category: AuditCategory | null | undefined): AuditStatement[] {
  return Object.values(category?.statements ?? {})
}

function notCheckedCount(category: AuditCategory | null | undefined): number {
  return statementsOf(category).filter((statement) => statement.status === 'notRun').length
}

/** Column 1: the run's health first, then the report's categories in the document's order. */
// DAR-UI-073 / DAR-BE-206. Every column counts and lists open findings (a finding is open or fixed), so the rail, a
// statement's badge, the findings heading and the rows listed always agree. DAR-UI-144: what the picked pill keeps of
// them. Open leaves acknowledged rows out, acknowledged counts only those, all counts both.
export function countFor(counts: AuditFindingCounts | null | undefined, filter: AuditFilter = 'open'): number {
  const acknowledged = counts?.acknowledged ?? 0
  if (filter === 'acknowledged') return acknowledged
  return (counts?.open ?? 0) + (filter === 'all' ? acknowledged : 0)
}

/** DAR-UI-085. True while any check of the audit is running or queued. */
function isPlaying(progress: AuditProgress | null | undefined): progress is AuditProgress {
  return Boolean(progress && progress.activeChecks > 0)
}

function anyUnhealthy(progress: AuditProgress): boolean {
  return progress.active.some((run) => run.health === 'stuck' || run.health === 'slow')
}

/** DAR-UI-140. The most urgent level with an open finding, and how many sit there; null when none (or a report before priorities). */
export function topLevel(counts: AuditFindingCounts | null | undefined): { level: AuditLevel; count: number } | null {
  for (const level of AUDIT_LEVELS) {
    const count = counts?.byPriority?.[level] ?? 0
    if (count > 0) return { level, count }
  }
  return null
}

function healthItem(report: AuditReport, progress?: AuditProgress | null): CategoryItem {
  // DAR-UI-085. While checks are in flight the report still reads them as not run (their ledger rows land when each
  // window ends), so Run health says what is happening instead, and only a slow or stuck run asks for attention.
  const playing = isPlaying(progress)
  const health: CategoryItem = {
    id: HEALTH,
    label: 'Run health',
    short: 'Health',
    sub: playing
      ? `running · ${progress.activeChecks} of ${progress.checks} checks`
      : [
          report.health.complete ? 'complete' : 'not complete',
          report.health.notCovered.length ? `${report.health.notCovered.length} not covered` : '',
        ].filter(Boolean).join(' · '),
    open: 0,
    count: 0,
    attention: playing ? anyUnhealthy(progress) : !report.health.complete,
    running: playing,
  }
  return health
}

export function categoryItems(report: AuditReport, progress?: AuditProgress | null, filter: AuditFilter = 'open'): CategoryItem[] {
  const health = healthItem(report, progress)
  return [health, ...Object.entries(report.categories ?? {}).map(([id, category]) => {
    const unchecked = notCheckedCount(category)
    // DAR-UI-087. Nothing found is said only of a category something checked.
    const found = unchecked && unchecked === statementsOf(category).length && !countFor(category.counts) ? '' : countsLine(category.counts)
    const top = topLevel(category.counts)
    return {
      id,
      label: category.label,
      short: category.label.split(' ')[0] ?? category.label,
      sub: [top ? `${top.count} at ${LEVEL_LABEL[top.level]}` : found, unchecked ? `${unchecked} not checked` : ''].filter(Boolean).join(' · '),
      open: category.counts?.open ?? 0,
      count: countFor(category.counts, filter),
      attention: (category.counts?.open ?? 0) > 0,
      running: false,
    }
  })]
}

/** DAR-UI-140. Column 1 in priority mode: Run health, then one item per level, counted from the report's summary. */
export function priorityItems(report: AuditReport, progress?: AuditProgress | null): CategoryItem[] {
  return [healthItem(report, progress), ...AUDIT_LEVELS.map((level) => {
    const count = report.summary.byPriority?.[level] ?? 0
    return {
      id: level,
      label: LEVEL_LABEL[level],
      short: LEVEL_LABEL[level],
      sub: LEVEL_WORD[level],
      open: count,
      count,
      attention: count > 0 && (level === 'P0' || level === 'P1'),
      running: false,
    }
  })]
}

export function keepStatement(statement: AuditStatement, filter: AuditFilter): boolean {
  if (filter === 'open') return (statement.counts?.open ?? 0) > 0
  if (filter === 'acknowledged') return (statement.counts?.acknowledged ?? 0) > 0
  if (filter === 'notChecked') return statement.status === 'notRun'
  return true
}

/** Column 2: a category's statements that the filter keeps. */
export function statementItems(category: AuditCategory | null | undefined, filter: AuditFilter): StatementItem[] {
  return statementsOf(category).filter((statement) => keepStatement(statement, filter)).map((statement) => {
    // DAR-UI-144. What the pill keeps: under acknowledged its acknowledged rows, under all its open and acknowledged.
    const open = countFor(statement.counts, filter)
    return { id: statement.id, text: statement.text, open, badge: String(open), tone: open ? 'open' : 'clean' }
  })
}

/** DAR-UI-140. Column 2 in priority mode: statements across categories, each counted at the level. A statement with
 *  findings at two levels is listed under both. 'open' and 'all' keep only those with findings there (a level lists what
 *  is at it); 'notChecked' keeps the not-run statements whose own level it is. */
export function statementItemsByPriority(report: AuditReport, level: AuditLevel, filter: AuditFilter): StatementItem[] {
  return Object.values(report.categories ?? {}).flatMap(statementsOf).map((statement) => {
    const open = statement.counts?.byPriority?.[level] ?? 0
    return {
      statement,
      item: { id: statement.id, text: statement.text, open, badge: String(open), tone: open ? 'open' : 'clean' } satisfies StatementItem,
    }
  }).filter(({ statement, item }) => filter === 'notChecked'
    ? statement.status === 'notRun' && (statement.priority ?? 'P2') === level
    : item.open > 0)
    .sort((a, b) => b.item.open - a.item.open || (a.item.id < b.item.id ? -1 : a.item.id > b.item.id ? 1 : 0))
    .map(({ item }) => item)
}

/** The numbers on the filter pills: findings for open and all, statements for not checked. */
export function filterCounts(report: AuditReport): Record<AuditFilter, number> {
  const statements = Object.values(report.categories ?? {}).flatMap(statementsOf)
  return {
    open: report.summary.open,
    acknowledged: report.summary.acknowledged ?? 0,
    notChecked: statements.filter((statement) => statement.status === 'notRun').length,
    all: countFor(report.summary, 'all'),
  }
}

/** Where the page opens when the URL names no category: the most open findings, else the first. */
export function defaultCategory(report: AuditReport, filter: AuditFilter): string {
  const entries = Object.entries(report.categories ?? {})
  const kept = entries.filter(([, category]) => statementsOf(category).some((statement) => keepStatement(statement, filter)))
  const pool = kept.length ? kept : entries
  let best = pool[0]
  for (const entry of pool) {
    if (countFor(entry[1].counts, filter) > (best ? countFor(best[1].counts, filter) : 0)) best = entry
  }
  return best?.[0] ?? HEALTH
}

/** The statement a category opens on: the first the filter keeps that has findings, else the first it keeps. */
export function defaultStatement(category: AuditCategory | null | undefined, filter: AuditFilter): string {
  const items = statementItems(category, filter)
  return (items.find((item) => item.open) ?? items[0])?.id ?? ''
}

/** Column 2 under Run health: each system read, then the checks, then the statements nothing checks. */
export function sourceItems(report: AuditReport, progress?: AuditProgress | null): SourceItem[] {
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
    sub: isPlaying(progress)
      ? [`${checks.ran} ran`, checks.partial ? `${checks.partial} partial` : '', `${progress.activeChecks} running`]
          .filter(Boolean).join(' · ')
      : [`${checks.ran} ran`, checks.partial ? `${checks.partial} partial` : '', checks.notRun ? `${checks.notRun} not run` : '']
          .filter(Boolean).join(' · '),
    tag: String(checks.ran + checks.partial + checks.notRun),
    attention: checks.partial > 0 || checks.notRun > 0,
  }]
  if (isPlaying(progress)) {
    const running = progress.active.filter((run) => run.state === 'running').length
    const queued = progress.active.length - running
    items.unshift({
      key: SOURCE_RUNNING,
      label: 'Running now',
      sub: [running ? `${running} running` : '', queued ? `${queued} queued` : ''].filter(Boolean).join(' · '),
      tag: String(progress.activeChecks),
      attention: anyUnhealthy(progress),
    })
  }
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

/** DAR-UI-085. "45m", "2h 5m", "<1m". */
function minutesText(ms: number): string {
  const minutes = Math.floor(ms / 60000)
  if (minutes < 1) return '<1m'
  if (minutes < 60) return `${minutes}m`
  return minutes % 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${Math.floor(minutes / 60)}h`
}

/** DAR-UI-085. One run of a play in words: its stage and progress and time against its usual, or that it waits. */
export function progressLine(run: AuditProgressRun): string {
  if (run.state === 'queued') return run.attempt > 1 ? `Queued · retry, attempt ${run.attempt}` : 'Queued'
  const elapsed = run.elapsedMs == null ? '' :
    run.usualDurationMs ? `${minutesText(run.elapsedMs)}, usually ${minutesText(run.usualDurationMs)}` : minutesText(run.elapsedMs)
  return [reconciliationStageLabel(run.stage) || 'Starting', run.progressPercent == null ? '' : `${run.progressPercent}%`, elapsed]
    .filter(Boolean).join(' · ')
}

/** DAR-UI-096. One step of a running run as the Running now card lists it. */
export interface ProgressStepRow {
  key: string
  label: string
  /** running, done or failed (any other backend status as it came). */
  status: string
  /** A live count while running; count and time when done; "Failed". */
  detail: string
}

const STEP_COUNT = new Intl.NumberFormat('en-US')

/**
 * DAR-UI-096. A run's steps (DAR-BE-173), in the order the run took them: a read named by its system ("Reading NetSuite",
 * "Read HotWax" once done), any other step by its stage. Empty when the run sends no steps, so the card keeps its one line.
 */
export function progressSteps(run: AuditProgressRun, asOf?: string | number | null): ProgressStepRow[] {
  return (run.steps ?? []).map((step, i) => {
    const read = step.stage === 'EXTRACT_FILE1' || step.stage === 'EXTRACT_FILE2'
    const status = (step.status ?? '').toLowerCase()
    const label = read && step.system ? `${status === 'running' ? 'Reading' : 'Read'} ${step.system}` : reconciliationStageLabel(step.stage) || step.stage
    const count = step.records == null ? '' : STEP_COUNT.format(step.records)
    const detail = status === 'failed' ? 'Failed'
      : status === 'done' ? [count, formatRunStepDuration(step.startedDate, step.completedDate)].filter(Boolean).join(' · ')
        : status === 'running' && read ? movingLine(step, asOf)
          : count
    return { key: `${step.stage}-${i}`, label, status, detail }
  })
}

/** DAR-BE-350. A running read proves it moves: its count against its last run, when its last page landed, its rate. */
function movingLine(step: AuditProgressStep, asOf?: string | number | null): string {
  const records = step.records ?? null
  const expected = step.expectedRecords ?? null
  const count = records == null ? ''
    : expected == null ? STEP_COUNT.format(records)
      : records > expected ? `${STEP_COUNT.format(records)} · last run ${STEP_COUNT.format(expected)}`
        : `${STEP_COUNT.format(records)} of ~${STEP_COUNT.format(expected)}`
  const now = timeOf(asOf)
  const moved = timeOf(step.movedDate)
  const started = timeOf(step.startedDate)
  const ago = now != null && moved != null ? `moved ${agoText(Math.max(0, now - moved))} ago` : ''
  // A rate only beside "moved", and after a minute of reading, so a first page does not read as a burst.
  const rate = records && now != null && moved != null && started != null && moved - started >= 60000
    ? `${STEP_COUNT.format(Math.round(records / ((moved - started) / 60000)))}/min` : ''
  return [count, ago, rate].filter(Boolean).join(' · ')
}

function timeOf(value?: string | number | null): number | null {
  if (value == null || value === '') return null
  const ms = typeof value === 'number' ? value : Date.parse(value)
  return Number.isFinite(ms) ? ms : null
}

function agoText(ms: number): string {
  return ms < 60000 ? `${Math.floor(ms / 1000)}s` : minutesText(ms)
}

/** DAR-BE-350. A peak period's limits on the tenant's reads, so a slow run says why; empty outside one. */
export function peakLine(run: AuditProgressRun): string {
  const parts = [
    run.limits?.hotwaxSharePct != null ? `HotWax at ${run.limits.hotwaxSharePct}%` : '',
    run.limits?.netsuiteSerial ? 'NetSuite one read at a time' : '',
  ].filter(Boolean)
  return parts.length ? `Peak period: ${parts.join(', ')}` : ''
}

/** DAR-UI-096. How long the run has been going, against its usual only when one is known; empty without a time. */
export function elapsedLine(run: AuditProgressRun): string {
  if (run.elapsedMs == null) return ''
  return run.usualDurationMs ? `${minutesText(run.elapsedMs)}, usually ${minutesText(run.usualDurationMs)}` : minutesText(run.elapsedMs)
}

/** Health opens on what needs a look: a play in progress, else a read that is not complete, else the checks. */
export function defaultSource(report: AuditReport, progress?: AuditProgress | null): string {
  if (isPlaying(progress)) return SOURCE_RUNNING
  const items = sourceItems(report)
  return (items.find((item) => item.attention) ?? items.find((item) => item.key === SOURCE_CHECKS))?.key ?? ''
}

/** DAR-UI-087. Run health › Checks: one row per check, or per family of a statement's per-store checks. */
export interface CheckRow {
  /** The check's id, or the family's shared stem ("shopify-orders-not-in-hotwax"). */
  id: string
  /** The check's own label; for a family, the words its members' labels share ('' when they cannot be compared). */
  label: string
  category: string
  /** The statement the row's first check sits under, where its detail and retry live. */
  statement: string
  checks: AuditStatementCheck[]
  /** The stores a family covers, as its labels name them ("US", "EU"; the id suffix without labels); empty for a lone check. */
  variants: string[]
  /** The row's worst: not run, else partial, else ran. */
  status: AuditCheckStatus
  ran: number
}

export interface CheckGroup {
  id: string
  label: string
  rows: CheckRow[]
}

const CHECK_ORDER: Record<AuditCheckStatus, number> = { notRun: 0, partial: 1, ran: 2 }

function splitCheckId(id: string): [stem: string, suffix: string] {
  const at = id.lastIndexOf('-')
  return at > 0 ? [id.slice(0, at), id.slice(at + 1)] : [id, '']
}

/**
 * A family's readable name and each member's: the words every member's label shares, and the words where they differ
 * ("Rails US Shopify orders HotWax does not have" and "Rails EU ..." give "Rails Shopify orders HotWax does not have",
 * "US", "EU"). Without labels to compare, the id stem and the id suffixes stand in.
 */
function familyNames(stem: string, members: AuditStatementCheck[]): { label: string; variants: string[] } {
  const words = members.map((member) => (member.label ?? '').trim().split(/\s+/).filter(Boolean))
  const shortest = Math.min(...words.map((w) => w.length))
  let head = 0
  while (head < shortest && words.every((w) => w[head] === words[0]![head])) head++
  let tail = 0
  while (tail < shortest - head && words.every((w) => w[w.length - 1 - tail] === words[0]![words[0]!.length - 1 - tail])) tail++
  const variants = words.map((w) => w.slice(head, w.length - tail).join(' '))
  if (!shortest || variants.some((variant) => !variant)) {
    return { label: '', variants: members.map((member) => splitCheckId(member.id)[1]) }
  }
  const shared = [...words[0]!.slice(0, head), ...words[0]!.slice(words[0]!.length - tail)].join(' ')
  return { label: shared || stem, variants }
}

/**
 * DAR-UI-087 (Aditi: "i dont like how this looks"). Every check under its category, listed once, the ones that did not run
 * first. A statement's checks that differ only in a last segment that also ends another check's id (usa, eu, uk recur
 * across RAILS' per-store statements) are one row naming the stores; two checks that merely share a prefix stay apart.
 */
export function checkGroups(report: AuditReport): CheckGroup[] {
  const categories = Object.entries(report.categories ?? {})
  const stemsBySuffix = new Map<string, Set<string>>()
  for (const [, category] of categories) {
    for (const check of statementsOf(category).flatMap((statement) => statement.checks ?? [])) {
      const [stem, suffix] = splitCheckId(check.id)
      if (suffix) stemsBySuffix.set(suffix, (stemsBySuffix.get(suffix) ?? new Set()).add(stem))
    }
  }
  const recurs = (suffix: string) => (stemsBySuffix.get(suffix)?.size ?? 0) > 1

  return categories.map(([categoryId, category]) => {
    const seen = new Set<string>()
    const rows: CheckRow[] = []
    for (const statement of statementsOf(category)) {
      const checks = (statement.checks ?? []).filter((check) => !seen.has(check.id) && seen.add(check.id))
      const byStem = new Map<string, AuditStatementCheck[]>()
      for (const check of checks) {
        const stem = splitCheckId(check.id)[0]
        byStem.set(stem, [...(byStem.get(stem) ?? []), check])
      }
      for (const check of checks) {
        const [stem] = splitCheckId(check.id)
        const family = byStem.get(stem) ?? []
        const isFamily = family.length > 1 && family.filter((member) => recurs(splitCheckId(member.id)[1])).length > 1
        if (isFamily && family[0] !== check) continue
        const members = isFamily ? family : [check]
        const names = isFamily ? familyNames(stem, members) : { label: check.label, variants: [] }
        rows.push({
          id: isFamily ? stem : check.id,
          label: names.label,
          category: categoryId,
          statement: statement.id,
          checks: members,
          variants: names.variants,
          status: members.reduce<AuditCheckStatus>((worst, member) =>
            CHECK_ORDER[member.status] < CHECK_ORDER[worst] ? member.status : worst, 'ran'),
          ran: members.filter((member) => member.status === 'ran').length,
        })
      }
    }
    // Stable: within a status the report's order holds.
    rows.sort((a, b) => CHECK_ORDER[a.status] - CHECK_ORDER[b.status])
    return { id: categoryId, label: category.label, rows }
  }).filter((group) => group.rows.length)
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

/** DAR-UI-144. A row the pill lists: an open row taken with a note (not yet reminded) shows under acknowledged only; a
 *  reminded one is open again. All lists every open row. */
export function showsUnder(item: AuditFindingSummary, filter: AuditFilter): boolean {
  if (item.state !== 'open') return false
  const taken = Boolean(item.acknowledgement && !item.acknowledgement.reminded)
  if (filter === 'open') return !taken
  if (filter === 'acknowledged') return taken
  return true
}

// DAR-UI-069. A fixed finding stays in the report for the day's "fixed today" only; the board lists what is still wrong.
// DAR-UI-070. The report lists 50 a statement; the pages "N more" fetched follow them, each finding once.
// DAR-UI-144. The report lists every open row of a statement, acknowledged ones too, so the pill is applied here.
export function statementFindings(statement: AuditStatement | null | undefined, more: AuditFindingSummary[],
  filter: AuditFilter = 'all'): AuditFindingSummary[] {
  const listed = (statement?.findings ?? []).filter((item) => showsUnder(item, filter))
  const seen = new Set(listed.map((item) => item.id))
  return [...listed, ...more.filter((item) => showsUnder(item, filter) && !seen.has(item.id))]
}

/** DAR-UI-144. The tenant's calendar day today (YYYY-MM-DD); the browser's own day when the zone is unknown. */
export function tenantToday(timeZone: string | null | undefined, now: Date = new Date()): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timeZone || undefined, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(now)
  }
}

/** DAR-UI-144. Whole days from an acknowledgement (its stamp is in the tenant's zone) to the tenant's today, never below 0. */
export function acknowledgedDaysAgo(at: string, timeZone: string | null | undefined, now: Date = new Date()): number {
  const day = (text: string) => Date.UTC(Number(text.slice(0, 4)), Number(text.slice(5, 7)) - 1, Number(text.slice(8, 10)))
  return Math.max(0, Math.round((day(tenantToday(timeZone, now)) - day(at)) / 86_400_000))
}

// DAR-BE-125. A finding's heading: its cause in the catalog's words (renamed since the finding was written, it still reads
// in the new ones), else what its headline says after the record.
export function causeHeading(item: AuditFindingSummary): string {
  return item.cause || splitHeadline(item.headline).rest
}

/** DAR-UI-098. One row of the findings column: a finding under its one cause heading. */
export interface FindingRow<T extends AuditFindingSummary = AuditFindingSummary> {
  item: T
  /** The cause heading this row sits under. */
  cause: string
  /** An order's other causes, with how many of its lines each covers (none for a finding that is not an order). */
  also: { cause: string; lines: number }[]
  key: string
}

// DAR-UI-098 (Aditi: "order findings in a few named categories, so 3,000 R1 findings read at a glance"). An order's causes
// are its lines' own causes (a line held by another one's cause is not a cause of its own), each with how many of its lines
// it covers; an order whose lines name none falls back to its own cause, then what its headline says. Never a "no cause".
// The heading cause comes first: the stuck line's (what holds the order up), else the one on most lines, a tie to the first.
// When every line naming a cause is held, no line holding them is listed: their cause is the order's only one (the backend
// heads the order by it too, AuditReportAssembler.unitFinding), so it counts.
function lineCauseCounts(item: AuditFindingSummary): Map<string, number> {
  const lines = item.kind === 'order' ? (item.lines ?? []) : []
  const own = lines.filter((line) => !line.held && line.cause)
  const counts = new Map<string, number>()
  ;(own.length ? own : lines.filter((line) => line.cause)).forEach((line) => counts.set(line.cause!, (counts.get(line.cause!) ?? 0) + 1))
  return counts
}

export function orderCauses(item: AuditFindingSummary): { cause: string; lines: number }[] {
  const lines = item.kind === 'order' ? (item.lines ?? []) : []
  const counts = lineCauseCounts(item)
  if (!counts.size) return [{ cause: causeHeading(item), lines: lines.length }]
  const stuck = lines.find((line) => item.stuck?.includes(line.id) && line.cause && counts.has(line.cause))?.cause
  return [...counts].map(([cause, n]) => ({ cause, lines: n }))
    .sort((a, b) => Number(b.cause === stuck) - Number(a.cause === stuck) || b.lines - a.lines)
}

// DAR-UI-098. The findings column as rows under cause headings: causes in the order their first finding came, findings in
// their own order within a cause. 2026-11-04 (Aditi: "the numbers dont add up here"): each finding once, under its heading
// cause, or under the toolbar's picked cause when it has that one, so the headings sum to the column's count.
export function findingRows<T extends AuditFindingSummary>(items: T[], picked = '', level?: AuditLevel): FindingRow<T>[] {
  const groups = new Map<string, FindingRow<T>[]>()
  // DAR-UI-140. A level keeps the units at it: an order's own level, never its lines'; no priority reads P2.
  items.filter((item) => !level || (item.priority ?? 'P2') === level).forEach((item) => {
    const causes = orderCauses(item)
    // DAR-UI-140. Else an order sits under the cause of the line that sets its level, so its heading carries that level.
    const levelCause = item.priorityLine ? item.lines?.find((line) => line.id === item.priorityLine)?.cause : undefined
    const head = causes.find((c) => c.cause === picked) ?? causes.find((c) => c.cause === levelCause) ?? causes[0]!
    const row = { item, cause: head.cause, also: item.kind === 'order' ? causes.filter((c) => c !== head) : [], key: item.id }
    groups.set(head.cause, [...(groups.get(head.cause) ?? []), row])
  })
  return [...groups.values()].flat()
}

// DAR-UI-098. What an order's row says under its heading: its other causes only (Aditi: "the 3 of 4 is also confusing").
export function rowAlsoLabel(row: FindingRow): string {
  return row.also.map(({ cause, lines }) => `Also ${cause} · ${lines} ${lines === 1 ? 'line' : 'lines'}`).join('; ')
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

// DAR-UI-098. The causes the board can head the finding by (findingRows): an order's lines' own, a held line's only when no
// line holding it is listed, so a picked cause never lists a row under another heading.
function findingCauses(item: AuditFindingListItem): string[] {
  const lines = [...lineCauseCounts(item).keys()]
  return lines.length ? lines : item.cause ? [item.cause] : []
}

/**
 * "Line 1" for item M1168785/01 of order M1168785, as the report's order headline names it; the item id itself when it is
 * not under the order's key (R10 keys an order by its NetSuite sales order). DAR-BE-372 rule 5: never the finding id; the
 * item is the HotWax item record's, else the one the line's own headline names ("Line M1230020/01 is open ..."); a line
 * nothing names reads "Line".
 * DAR-UI-081 (Aditi: "show SKU instead of line 1, line 2"): an item is named by its SKU when its read gave one, and by its
 * line too when another of the order's lines carries the same SKU (gorjana M1168149: one product on three lines).
 */
export function lineLabel(order: string, line: AuditFindingSummary, lines: AuditFindingSummary[] = []): string {
  const item = line.records?.OMS?.orderItem?.[0]
  const itemId = item?.id || /^(?:Line|Item) (\S+)/.exec(line.headline ?? '')?.[1] || ''
  const number = lineNumber(order, itemId)
  if (item?.sku) {
    const twin = lines.some((other) => other !== line && other.records?.OMS?.orderItem?.[0]?.sku === item.sku)
    return twin && number ? `${item.sku} · ${number.toLowerCase()}` : item.sku
  }
  return number || itemId || 'Line'
}

/** DAR-UI-099 (Aditi: "always make sure all lines are present within the order"). The order's lines with no finding of
 *  their own, after its finding lines: an item the check set aside or found in order, a line only NetSuite has. */
export function otherOrderLines(unit: Pick<AuditFindingSummary, 'orderLines'> | null | undefined): AuditOrderLine[] {
  return (unit?.orderLines ?? []).filter((line) => !line.finding)
}

/** A line with no finding, named as the finding lines are: its SKU (with its number when another line has the same SKU),
 *  else its number; a line only NetSuite has by its item. */
export function otherLineLabel(order: string, line: AuditOrderLine, lines: AuditOrderLine[] = []): string {
  if (!line.line) return line.item
  const number = lineNumber(order, line.item)
  if (line.sku) {
    const twin = lines.some((other) => other !== line && other.sku === line.sku)
    return twin && number ? `${line.sku} · ${number.toLowerCase()}` : line.sku
  }
  return number || line.item
}

/** What such a line is: its status and units ("Approved · 2 units"), or the system, type and amount of a NetSuite-only
 *  line ("NetSuite · Payment · -89.30"). */
export function otherLineWhy(line: AuditOrderLine): string {
  if (!line.line) return [line.system, line.itemType, line.amount?.amount].filter(Boolean).join(' · ')
  return [line.status, line.quantity && line.quantity > 1 ? `${line.quantity} units` : ''].filter(Boolean).join(' · ')
}

function lineNumber(order: string, itemId: string): string {
  if (!itemId.startsWith(order) || itemId.length <= order.length) return ''
  const suffix = itemId.slice(order.length).replace(/^[/\-_ ]+/, '')
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

/** How many findings the pill counts that the board has not shown yet; none once the last page is in. */
export function findingsLeft(statement: AuditStatement | null | undefined, shown: number, hasNextPage: boolean | null,
  filter: AuditFilter = 'open'): number {
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

/** DAR-UI-155. An acknowledgement saved (or changed, or reopened) on screen before the backend has: the board shows it at
 *  once and the backend saves behind it. Keyed by the finding id acknowledged (a lone row's, or an order's stuck line).
 *  `was` and `base` let the counts move before any reload: once a report arrives the row as that report has it is
 *  the starting point instead, so a reload that already carries the acknowledgement is not counted twice. */
export interface AckPatch {
  statement: string
  acknowledgement: AuditAcknowledgement | null
  /** The row's acknowledgement in `base`, before the person acted. */
  was: AuditAcknowledgement | null
  /** The row's level, for byPriority; the statement's when absent. */
  priority: AuditLevel | null
  base: AuditReport
}
export type AckPatches = ReadonlyMap<string, AckPatch>

/** The row that lists a finding: the finding's own, or the order whose line it is. */
export function holdsFinding(item: AuditFindingSummary, id: string): boolean {
  return item.id === id || Boolean(item.lines?.some((line) => line.id === id))
}

function taken(state: string, ack: AuditAcknowledgement | null | undefined): boolean {
  return state === 'open' && Boolean(ack && !ack.reminded)
}

/** DAR-UI-155. Rows with their pending acknowledgement in place of the listed one. */
export function withAckRows<T extends AuditFindingSummary>(items: T[], patches: AckPatches): T[] {
  if (!patches.size) return items
  return items.map((item) => {
    for (const [id, patch] of patches) if (holdsFinding(item, id)) return { ...item, acknowledgement: patch.acknowledgement }
    return item
  })
}

/** Moves `shift` rows from open to acknowledged (negative: back), never below 0. */
function shiftCounts<T extends AuditFindingCounts>(counts: T, shift: number, level: AuditLevel): T {
  const byPriority = counts.byPriority ? { ...counts.byPriority, [level]: Math.max(0, (counts.byPriority[level] ?? 0) - shift) } : undefined
  return {
    ...counts,
    open: Math.max(0, counts.open - shift),
    acknowledged: Math.max(0, (counts.acknowledged ?? 0) + shift),
    ...(byPriority ? { byPriority } : {}),
  }
}

/** DAR-UI-155. The report with every pending acknowledgement on its row and in the counts (statement, category, summary). */
export function withAckPatches(report: AuditReport, patches: AckPatches): AuditReport {
  if (!patches.size) return report
  let next = report
  for (const [id, patch] of patches) {
    const home = findStatement(next, patch.statement)
    if (!home) continue
    const { categoryId, statement } = home
    const row = statement.findings.find((item) => holdsFinding(item, id))
    // The row this report lists is the truth to move from; one past the report's 50 only while the report is the one acted on.
    const before = row ? taken(row.state, row.acknowledgement) : report === patch.base ? taken('open', patch.was) : null
    const after = taken(row?.state ?? 'open', patch.acknowledgement)
    const shift = before === null || before === after ? 0 : after ? 1 : -1
    const level = row?.priority ?? patch.priority ?? statement.priority ?? 'P2'
    const category = next.categories[categoryId]!
    next = {
      ...next,
      summary: shift ? shiftCounts(next.summary, shift, level) : next.summary,
      categories: {
        ...next.categories,
        [categoryId]: {
          ...category,
          counts: shift ? shiftCounts(category.counts, shift, level) : category.counts,
          statements: {
            ...category.statements,
            [statement.id]: {
              ...statement,
              counts: shift ? shiftCounts(statement.counts, shift, level) : statement.counts,
              findings: row ? withAckRows(statement.findings, new Map([[id, patch]])) : statement.findings,
            },
          },
        },
      },
    }
  }
  return next
}

/** DAR-UI-155. What the board shows the moment a person acknowledges (or changes an acknowledgement), before the backend
 *  answers: their note, them and now (a change keeps who acknowledged first and when), and the remind day. Stamps are the
 *  tenant's wall clock, as the backend's are; the reload after the save brings the backend's own. */
export function pendingAcknowledgement(input: {
  note: string
  remind: boolean
  remindDays: number
  me: { id: string; label: string | null }
  timeZone: string | null | undefined
  initial: AuditAcknowledgement | null
  now?: Date
}): AuditAcknowledgement {
  const now = input.now ?? new Date()
  const today = tenantToday(input.timeZone, now)
  const remindOn = new Date(`${today}T00:00:00Z`)
  remindOn.setUTCDate(remindOn.getUTCDate() + input.remindDays)
  return {
    note: input.note || null,
    by: input.initial?.by ?? input.me,
    at: input.initial?.at ?? `${today}T${tenantClock(input.timeZone, now)}`,
    remindOn: input.remind ? remindOn.toISOString().slice(0, 10) : null,
    reminded: false,
  }
}

function tenantClock(timeZone: string | null | undefined, now: Date): string {
  const options: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }
  try {
    return new Intl.DateTimeFormat('en-GB', { ...options, timeZone: timeZone || undefined }).format(now)
  } catch {
    return new Intl.DateTimeFormat('en-GB', options).format(now)
  }
}
