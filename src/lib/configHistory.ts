// DAR-BE-160. Plain words for a tenant's config versions and a restore plan (TenantConfigHistoryPage).

import { formatDateTime } from './utils/date'
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
}

const COUNTED: { key: keyof ConfigVersionCounts; one: string; many: string }[] = [
  { key: 'audits', one: 'audit', many: 'audits' },
  { key: 'statements', one: 'statement', many: 'statements' },
  { key: 'checks', one: 'check', many: 'checks' },
  { key: 'runs', one: 'run', many: 'runs' },
  { key: 'queries', one: 'query', many: 'queries' },
  { key: 'connections', one: 'connection', many: 'connections' },
]

const MAX_ITEMS = 12
const MAX_VALUE = 60
const WRITES = new Set(['CREATE', 'UPDATE', 'NEEDS_CREDENTIALS'])

export interface RestoreSection {
  title: string
  items: string[]
}

export function versionMeta(version: ConfigVersion, timeZone?: string): string {
  const when = formatDateTime(version.createdDate, { timeZone })
  const who = version.createdByName || 'Darpan'
  const what = SOURCE_LABEL[version.changeSource] ?? version.changeSource
  return `${when} · ${who} · ${what}`
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
