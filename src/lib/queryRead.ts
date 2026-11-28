// DAR-UI-138. A query's read (readSpecJson) as the query page and its Data popup hold it: parsed into inputs, each kept
// as its raw map so keys this page does not know round-trip untouched; written back as stable, pretty JSON; and told in
// words by name (an audit's name, a saved run's name, a dataset's system), never by id unless the catalog lacks it.
// The shapes mirror moqui-jexl ReadSpec / ReadConditions and darpan's query sources (AuditFindingQuerySource,
// RunResultQuerySource, DatasetQuerySource): a window is {field, lastDays}; findings window on firstFoundDate, a
// dataset on its own windowField.
import type { GetTenantQueryCatalogResponse } from './api/scriptTypes'

export type QueryCatalog = GetTenantQueryCatalogResponse
/** One input exactly as written; the script sees it as input.<name>. */
export type ReadInput = Record<string, unknown>
export type ReadSourceKind = 'auditFindings' | 'runResult' | 'dataset'

export interface ParsedRead {
  /** The whole document, so top-level keys other than inputs survive a write. */
  doc: Record<string, unknown>
  inputs: ReadInput[]
}

export type ReadParse = { ok: true; read: ParsedRead } | { ok: false; error: string }

export interface ReadCondition {
  field: string
  op: string
  value?: unknown
  [key: string]: unknown
}

export type ReadPartRole = 'text' | 'kind' | 'source' | 'where' | 'window' | 'field'

/** One piece of an input's sentence; every role but text is something the Data popup changes. */
export interface ReadPart {
  role: ReadPartRole
  text: string
}

export const MAX_INPUTS = 10
export const MAX_LAST_DAYS = 3_660
export const INPUT_NAME = /^[a-z][A-Za-z0-9]{0,39}$/
export const FIELD_NAME = /^[A-Za-z_][A-Za-z0-9_.]{0,99}$/
const FINDING_WINDOW_FIELD = 'firstFoundDate'
/** AuditFindingQuerySource.FIELDS: every audit's findings have these, so they stand in when the catalog is missing. */
const FINDING_FIELDS: readonly string[] = ['statement', 'check', 'recordKey', 'period', 'state', 'headline',
  'firstFoundDate', 'lastSeenDate', 'timesSeen', 'expectedAmount', 'actualAmount', 'differenceAmount', 'currencyUomId',
  'conclusion', 'closedStamp']

const SOURCE_KINDS: readonly ReadSourceKind[] = ['auditFindings', 'runResult', 'dataset']
export const SOURCE_ID_KEY: Record<ReadSourceKind, 'auditId' | 'savedRunId' | 'datasetId'> = {
  auditFindings: 'auditId',
  runResult: 'savedRunId',
  dataset: 'datasetId',
}
const KIND_WORDS: Record<ReadSourceKind, string> = {
  auditFindings: 'Open findings of',
  runResult: 'The latest result of',
  dataset: 'Records of',
}

/** ReadConditions.OPS, each in words. */
export const CONDITION_OPS: ReadonlyArray<{ op: string; words: string }> = [
  { op: 'equals', words: 'is' },
  { op: 'not-equals', words: 'is not' },
  { op: 'less', words: 'is less than' },
  { op: 'greater', words: 'is more than' },
  { op: 'less-equals', words: 'is at most' },
  { op: 'greater-equals', words: 'is at least' },
  { op: 'in', words: 'is one of' },
  { op: 'not-in', words: 'is none of' },
  { op: 'between', words: 'is between' },
  { op: 'like', words: 'is like' },
  { op: 'not-like', words: 'is not like' },
  { op: 'is-null', words: 'is empty' },
  { op: 'is-not-null', words: 'is set' },
]
export const NO_VALUE_OPS = new Set(['is-null', 'is-not-null'])
export const LIST_VALUE_OPS = new Set(['in', 'not-in', 'between'])

function isMap(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : []
}

export function isSourceKind(source: unknown): source is ReadSourceKind {
  return typeof source === 'string' && (SOURCE_KINDS as readonly string[]).includes(source)
}

// ---- parse and write

/** An empty read is a script-only query: no inputs. */
export function parseRead(json: string | null | undefined): ReadParse {
  if (!json?.trim()) return { ok: true, read: { doc: {}, inputs: [] } }
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch (error) {
    return { ok: false, error: `The read is not valid JSON: ${error instanceof Error ? error.message : String(error)}` }
  }
  if (!isMap(parsed) || !Array.isArray(parsed.inputs)) return { ok: false, error: 'The read needs an inputs list.' }
  if (!parsed.inputs.every(isMap)) return { ok: false, error: 'Each input in the read must be a map.' }
  return { ok: true, read: { doc: parsed, inputs: parsed.inputs as ReadInput[] } }
}

/** The read with these inputs, pretty-printed; no inputs is the empty read (script only). */
export function serializeRead(read: ParsedRead, inputs: ReadInput[]): string {
  if (!inputs.length) return ''
  // Spreading keeps inputs where the document had it; a new document gets it as its only key.
  return JSON.stringify({ ...read.doc, inputs }, null, 2)
}

// ---- one input's parts

export function inputName(input: ReadInput): string {
  return typeof input.name === 'string' ? input.name : ''
}

export function inputSourceId(input: ReadInput): string {
  if (!isSourceKind(input.source)) return ''
  const id = input[SOURCE_ID_KEY[input.source]]
  return id == null ? '' : String(id)
}

export function inputFields(input: ReadInput): string[] {
  return stringList(input.fields)
}

export function windowDays(input: ReadInput): number | null {
  const window = input.window
  if (!isMap(window) || typeof window.lastDays !== 'number') return null
  return window.lastDays
}

/** The date field a window applies to for this source, or null when it takes none (a run's result). */
export function windowFieldFor(source: ReadSourceKind, sourceId: string, catalog: QueryCatalog | null): string | null {
  if (source === 'auditFindings') return FINDING_WINDOW_FIELD
  if (source === 'dataset') return catalog?.datasets.find((dataset) => dataset.datasetId === sourceId)?.windowField ?? null
  return null
}

/** The fields the catalog lists for a source: null when it lists none (whole records) or does not know the source. */
export function catalogFields(source: ReadSourceKind, sourceId: string, catalog: QueryCatalog | null): string[] | null {
  if (source === 'auditFindings') return catalog?.audits.find((audit) => audit.auditId === sourceId)?.fields ?? [...FINDING_FIELDS]
  if (source === 'runResult') return catalog?.savedRuns.find((run) => run.savedRunId === sourceId)?.fields ?? null
  return catalog?.datasets.find((dataset) => dataset.datasetId === sourceId)?.fields ?? null
}

/** The source by name, or its id when the catalog does not have it. */
function sourceLabel(input: ReadInput, catalog: QueryCatalog | null): string {
  const source = input.source
  const id = inputSourceId(input)
  if (source === 'auditFindings') {
    const audit = catalog?.audits.find((item) => item.auditId === id)
    return audit?.auditName || audit?.auditCode || id || 'an audit'
  }
  if (source === 'runResult') return catalog?.savedRuns.find((run) => run.savedRunId === id)?.runName || id || 'a saved run'
  if (source === 'dataset') {
    const dataset = catalog?.datasets.find((item) => item.datasetId === id)
    return dataset ? `${dataset.system} ${dataset.datasetId}` : id || 'a dataset'
  }
  return typeof input.entityName === 'string' ? `${String(source)} ${input.entityName}` : String(source ?? 'nothing')
}

// ---- conditions

function opWords(op: string): string {
  return CONDITION_OPS.find((item) => item.op === op)?.words ?? op
}

function isLeaf(where: Record<string, unknown>): boolean {
  return !('and' in where) && !('or' in where)
}

/** The where as a flat list of leaf conditions (all must hold), or null when it has or / nested groups. */
export function conditionsOf(input: ReadInput): ReadCondition[] | null {
  const where = input.where
  if (where == null) return []
  if (!isMap(where)) return null
  if (isLeaf(where)) return [where as ReadCondition]
  if ('or' in where || !Array.isArray(where.and)) return null
  const items = where.and as unknown[]
  if (!items.every((item) => isMap(item) && isLeaf(item))) return null
  return items as ReadCondition[]
}

/** The where for a list of conditions: none, the one, or all of them. */
export function whereFrom(conditions: ReadCondition[]): Record<string, unknown> | undefined {
  if (!conditions.length) return undefined
  if (conditions.length === 1) return conditions[0]
  return { and: conditions }
}

export function valueText(value: unknown): string {
  if (value == null) return ''
  return Array.isArray(value) ? value.map((item) => String(item)).join(', ') : String(value)
}

/** Typed text as a condition's value: a list for in / not-in / between, else the text. */
export function valueFrom(text: string, op: string): unknown {
  if (NO_VALUE_OPS.has(op)) return undefined
  if (LIST_VALUE_OPS.has(op)) return text.split(',').map((item) => item.trim()).filter(Boolean)
  return text.trim()
}

function conditionWords(condition: ReadCondition): string {
  const field = String(condition.field ?? '')
  if (NO_VALUE_OPS.has(condition.op)) return `${field} ${opWords(condition.op)}`
  if (condition.op === 'between' && Array.isArray(condition.value)) {
    return `${field} is between ${valueText(condition.value[0])} and ${valueText(condition.value[1])}`
  }
  return `${field} ${opWords(condition.op)} ${valueText(condition.value)}`
}

function whereWords(where: Record<string, unknown>, nested = false): string {
  if (Array.isArray(where.and)) {
    const text = where.and.filter(isMap).map((item) => whereWords(item, true)).join(' and ')
    return nested ? `(${text})` : text
  }
  if (Array.isArray(where.or)) {
    const text = where.or.filter(isMap).map((item) => whereWords(item, true)).join(' or ')
    return `(${text})`
  }
  return conditionWords(where as ReadCondition)
}

// ---- what the popup cannot change

/** Why the Data popup cannot change this input in full (each a short phrase); empty when it can. */
export function editLimits(input: ReadInput): string[] {
  const limits: string[] = []
  if (!isSourceKind(input.source)) limits.push(`it reads ${String(input.source ?? 'no source')}`)
  if (input.where != null && conditionsOf(input) == null) {
    const where = input.where
    limits.push(isMap(where) && 'or' in where ? 'or conditions' : 'nested conditions')
  }
  if (stringList(input.groupBy).length) limits.push('groups')
  if (Array.isArray(input.measures) && input.measures.length) limits.push('measures')
  if (stringList(input.orderBy).length) limits.push('an order')
  return limits
}

// ---- the sentence

function daysWords(days: number): string {
  return `in the last ${days} day${days === 1 ? '' : 's'}`
}

/** The input as a sentence: "Open findings of Month-close audit, where statement is R5, first found in the last 30 days.
 *  Keeps recordKey headline". */
export function describeInput(input: ReadInput, catalog: QueryCatalog | null): ReadPart[] {
  const parts: ReadPart[] = []
  const text = (value: string) => parts.push({ role: 'text', text: value })
  const source = input.source
  const known = isSourceKind(source)

  // Findings are the open ones unless the input says includeClosed (AuditFindingQuerySource).
  const kind = !known ? 'Reads' : source === 'auditFindings' && input.includeClosed ? 'All findings of' : KIND_WORDS[source]
  parts.push({ role: 'kind', text: kind })
  text(' ')
  parts.push({ role: 'source', text: sourceLabel(input, catalog) })

  if (isMap(input.where)) {
    text(', where ')
    parts.push({ role: 'where', text: whereWords(input.where) })
  }

  const days = windowDays(input)
  if (days != null) {
    const window = input.window as Record<string, unknown>
    const lead = source === 'auditFindings'
      ? 'first found'
      : (known ? windowFieldFor(source, inputSourceId(input), catalog) : null) ?? String(window.field ?? 'date')
    text(`, ${lead} `)
    parts.push({ role: 'window', text: daysWords(days) })
  }

  const groupBy = stringList(input.groupBy)
  if (groupBy.length) text(`, by ${groupBy.join(', ')}`)
  if (Array.isArray(input.measures) && input.measures.length) {
    const measures = input.measures.filter(isMap).map((measure) => {
      const of = measure.field ? ` of ${String(measure.field)}` : ''
      return `${String(measure.fn)}${of} as ${String(measure.as)}`
    })
    text(`, ${measures.join(', ')}`)
  }
  const orderBy = stringList(input.orderBy)
  if (orderBy.length) {
    text(`, ordered by ${orderBy.map((entry) => (entry.startsWith('-') ? `${entry.slice(1)} descending` : entry)).join(', ')}`)
  }

  const fields = inputFields(input)
  if (fields.length) {
    text('. Keeps ')
    fields.forEach((field, index) => {
      if (index) text(' ')
      parts.push({ role: 'field', text: field })
    })
  }
  return parts
}

/** A name for a new input that no other input has: findings, findings2, … */
export function freshName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base
  for (let n = 2; ; n += 1) {
    if (!taken.includes(`${base}${n}`)) return `${base}${n}`
  }
}
