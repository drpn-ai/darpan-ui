// DAR-BE-160. Plain words for a tenant's config versions and a restore plan (TenantConfigHistoryPage).

import { addDays, displayCalendarDayOf, formatDateInputValue, getDefaultDisplayTimeZone } from './utils/date'
import type { ConfigRestorePlan, ConfigVersion, ConfigVersionCounts } from './api/configTypes'

const SOURCE_LABEL: Record<string, string> = {
  MANUAL: 'Kept by hand',
  SETTINGS_SAVE: 'Saved',
  RESTORE: 'Restore',
  AGENT_APPLY: 'Agent',
  IMPORT: 'Imported',
}

const KIND_LABEL: Record<string, string> = {
  AUDIT: 'Audit',
  STATEMENT: 'Statement',
  CHECK: 'Check',
  RUN: 'Run',
  RULE: 'Rule',
  CONC: 'Conclusion',
  NETSUITE_SUITEQL: 'NetSuite query',
  NETSUITE_AUTH: 'Connection',
  NETSUITE_RESTLET: 'Connection',
  SHOPIFY_AUTH: 'Connection',
  HOTWAX_OMS_REST: 'Connection',
  AUTOMATION: 'Automation',
  LIFECYCLE: 'Lifecycle',
  QUESTION: 'Question',
}

const COUNTED: { key: keyof ConfigVersionCounts; one: string; many: string }[] = [
  { key: 'audits', one: 'audit', many: 'audits' },
  { key: 'statements', one: 'statement', many: 'statements' },
  { key: 'checks', one: 'check', many: 'checks' },
  { key: 'runs', one: 'run', many: 'runs' },
  { key: 'queries', one: 'query', many: 'queries' },
  { key: 'connections', one: 'connection', many: 'connections' },
  { key: 'automations', one: 'automation', many: 'automations' },
  { key: 'lifecycles', one: 'lifecycle', many: 'lifecycles' },
]

const MAX_ITEMS = 12
const MAX_VALUE = 60
const WRITES = new Set(['CREATE', 'UPDATE', 'NEEDS_CREDENTIALS'])

export interface RestoreSection {
  title: string
  items: string[]
}

/** The words for what kept a version: Saved, Kept by hand, Restore, Agent, Imported. */
export function sourceLabel(version: ConfigVersion): string {
  return SOURCE_LABEL[version.changeSource] ?? version.changeSource
}

/**
 * What changed against the version before, from the counts alone, in Holds order: "−1 statement · +2 checks" (U+2212).
 * No previous version: "First version" for seq 1; empty when the one before is older than the page loaded.
 */
export function countsDelta(version: ConfigVersion, previous: ConfigVersion | null | undefined): string {
  if (!previous) return version.seq <= 1 ? 'First version' : ''
  const parts = COUNTED
    .map(({ key, one, many }) => ({ d: Number(version.counts?.[key] ?? 0) - Number(previous.counts?.[key] ?? 0), one, many }))
    .filter(({ d }) => d !== 0)
    .map(({ d, one, many }) => `${d > 0 ? '+' : '\u2212'}${Math.abs(d)} ${Math.abs(d) === 1 ? one : many}`)
  return parts.length ? parts.join(' · ') : 'Settings changed, counts the same'
}

export interface VersionDayGroup {
  key: string
  label: string
  versions: ConfigVersion[]
}

/** Earlier versions under one heading per day in the display time zone: Today, Yesterday, else "12 Nov". */
export function groupVersionsByDay(versions: readonly ConfigVersion[], timeZone?: string, now: Date = new Date()): VersionDayGroup[] {
  const zone = timeZone?.trim() || getDefaultDisplayTimeZone()
  const today = displayCalendarDayOf(now, zone)
  const todayKey = formatDateInputValue(today)
  const yesterdayKey = formatDateInputValue(addDays(today, -1))
  const groups: VersionDayGroup[] = []
  for (const version of versions) {
    const at = instantOf(version.createdDate)
    const day = at ? displayCalendarDayOf(at, zone) : null
    const key = day ? formatDateInputValue(day) : ''
    let group = groups[groups.length - 1]
    if (!group || group.key !== key) {
      const label = !day ? 'Undated'
        : key === todayKey ? 'Today'
          : key === yesterdayKey ? 'Yesterday'
            : new Intl.DateTimeFormat('en-GB', {
              day: 'numeric',
              month: 'short',
              year: day.getFullYear() === today.getFullYear() ? undefined : 'numeric',
            }).format(day)
      group = { key, label, versions: [] }
      groups.push(group)
    }
    group.versions.push(version)
  }
  return groups
}

/** The time of day a version was kept, in the display time zone; its day heading carries the date. */
export function versionTime(value: ConfigVersion['createdDate'], timeZone?: string): string {
  const at = instantOf(value)
  if (!at) return '-'
  return new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone: timeZone?.trim() || getDefaultDisplayTimeZone() }).format(at)
}

function instantOf(value: ConfigVersion['createdDate']): Date | null {
  if (value === null || value === undefined || value === '') return null
  const at = new Date(value)
  return Number.isNaN(at.getTime()) ? null : at
}

export function countsSummary(counts: Partial<ConfigVersionCounts> | null | undefined): string {
  const parts = COUNTED
    .map(({ key, one, many }) => ({ n: Number(counts?.[key] ?? 0), one, many }))
    .filter(({ n }) => n > 0)
    .map(({ n, one, many }) => `${n} ${n === 1 ? one : many}`)
  return parts.length ? parts.join(' · ') : 'Empty'
}

export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind
}

export function restoreSections(plan: ConfigRestorePlan): RestoreSection[] {
  const back = (plan.lines ?? [])
    .filter((line) => WRITES.has(line.action))
    .map((line) => {
      const name = `${kindLabel(line.kind)} ${line.label ?? line.ref}`
      if (line.action !== 'UPDATE') return `${name} comes back`
      const changes = (line.changes ?? []).map((c) => `${c.field} ${quote(c.from)} → ${quote(c.to)}`)
      return changes.length ? `${name}: ${changes.join('; ')}` : name
    })
  const sections: RestoreSection[] = [
    { title: 'Goes back', items: back },
    { title: 'Switched off', items: (plan.switchOff ?? []).map((s) => `Statement ${s.statement} in ${s.audit ?? 'an audit'}`) },
    { title: 'Unlinked', items: (plan.unlink ?? []).map((u) => `${u.check} no longer checks ${u.statement}`) },
    { title: 'Kept as they are', items: (plan.kept ?? []).map((k) => `${kindLabel(k.kind)} ${k.label}`) },
  ]
  return sections.filter((s) => s.items.length).map((s) => ({ title: s.title, items: capped(s.items) }))
}

/** True when restoring writes nothing: no record goes back, none is switched off or unlinked. */
export function restoreChangesNothing(plan: ConfigRestorePlan): boolean {
  return !(plan.lines ?? []).some((line) => WRITES.has(line.action)) && !(plan.switchOff ?? []).length && !(plan.unlink ?? []).length
}

function quote(value: string | null | undefined): string {
  if (value == null || value === '') return 'empty'
  const text = value.length > MAX_VALUE ? `${value.slice(0, MAX_VALUE - 1)}…` : value
  return `"${text}"`
}

function capped(items: string[]): string[] {
  if (items.length <= MAX_ITEMS + 1) return items
  return [...items.slice(0, MAX_ITEMS), `and ${items.length - MAX_ITEMS} more`]
}
