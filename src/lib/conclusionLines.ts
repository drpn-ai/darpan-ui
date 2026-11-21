import type { RunConclusionCondition, RunConclusionNode } from './api/authoringTypes'

export interface LineContext {
  file1: string
  file2: string
  /** Evaluate runs read one side at a time, so lines omit the side name. */
  evaluate: boolean
  firstKeyField: string | null
  /** First path segments known to be lists (schema arrays, `many` lookups). */
  listPaths: ReadonlySet<string>
}

export const OUTCOME_GLOSS: Record<string, string> = {
  '': 'a finding you see',
  EXPECTED: 'not a finding; counted as expected',
  HIDE: 'not a finding; left out of counts',
}

const ELLIPSIS = '…'

function sideName(c: RunConclusionCondition, ctx: LineContext): string {
  if (ctx.evaluate) return ''
  return c.subject === 'FILE_1' ? ctx.file1 : ctx.file2
}

function join(...parts: Array<string | null | undefined>): string {
  return parts.filter((p) => p).join(' ')
}

function operatorText(c: RunConclusionCondition, negatedByQuantifier: boolean): string {
  const values = c.values.map((v) => v.trim()).filter((v) => v)
  const list = values.length ? values.join(', ') : ELLIPSIS
  const num = values[0] ?? ELLIPSIS
  switch (c.operator) {
    case 'IN':
      return `is one of ${list}`
    case 'NOT_IN':
      return negatedByQuantifier ? `is one of ${list}` : `is not one of ${list}`
    case 'GT':
      return `is more than ${num}`
    case 'LT':
      return `is less than ${num}`
    case 'GT_ZERO':
      return 'is more than 0'
    case 'WITHIN_HOURS':
      return `is within ${num} hours`
    case 'BLANK':
      return 'is empty'
    case 'NOT_BLANK':
      return 'is not empty'
    default:
      return ''
  }
}

/** The field phrase, e.g. `billing_status is one of X` or `any line's status is one of X`. `owner` precedes a plain path. */
function fieldClause(c: RunConclusionCondition, ctx: LineContext, owner: string): string {
  const field = (c.field ?? '').trim() || ELLIPSIS
  const dot = field.indexOf('.')
  const seg = dot > 0 ? field.slice(0, dot) : ''
  const rest = dot > 0 ? field.slice(dot + 1) : ''
  if (seg && ctx.listPaths.has(seg)) {
    const quantifier = c.quantifier ?? 'ALL'
    const negated = quantifier === 'ALL' && c.operator === 'NOT_IN'
    const word = quantifier === 'ANY' ? 'any' : negated ? 'no' : 'every'
    const singular = seg.endsWith('s') ? `${seg.slice(0, -1)}'s` : `${seg}'s`
    return join(word, owner, `${singular} ${rest}`, operatorText(c, negated))
  }
  return join(owner, field, operatorText(c, false))
}

export function describeCondition(c: RunConclusionCondition, ctx: LineContext): string {
  const side = sideName(c, ctx)
  const presence = c.presence ?? 'ANY'
  const firstField = c.keyScope === 'FIRST_FIELD' ? ctx.firstKeyField : null
  const hasTest = Boolean(c.operator)
  const record = join('the', side, firstField, 'record')

  if (!hasTest) {
    const state = presence === 'ABSENT' ? 'is missing' : presence === 'EXCLUDED' ? 'was set aside' : 'is there'
    return join(record, state)
  }
  if (presence === 'ANY') {
    return fieldClause(c, ctx, firstField ? join(side, firstField, "record's") : side)
  }
  const state = presence === 'ABSENT' ? 'is missing' : presence === 'EXCLUDED' ? 'was set aside' : 'is there'
  return `${join(record, state)} and ${fieldClause(c, ctx, 'its').replace(/^(any|every|no) its /, '$1 ')}`
}

export function explainsLabel(bucket: string | null | undefined, ctx: LineContext): string {
  switch (bucket) {
    case 'MISSING_FROM_FILE_2':
      return `In ${ctx.file2}`
    case 'MISSING_FROM_FILE_1':
      return `In ${ctx.file1}`
    case 'RULE':
      return 'the rules hold'
    case '':
    case null:
    case undefined:
      return 'any check'
    case 'FINDING':
      return ctx.evaluate ? 'every finding' : 'every finding (single-sided only)'
    default:
      return bucket
  }
}

export function flattenConclusionTree(nodes: RunConclusionNode[]): RunConclusionNode[] {
  const children = new Map<string, RunConclusionNode[]>()
  for (const n of nodes) {
    if (n.parent) children.set(n.parent, [...(children.get(n.parent) ?? []), n])
  }
  const out: RunConclusionNode[] = []
  const walk = (n: RunConclusionNode, inherited: RunConclusionCondition[], bucket: RunConclusionNode['bucket']) => {
    const conditions = [...inherited, ...n.conditions]
    for (const k of children.get(n.key) ?? []) walk(k, conditions, bucket)
    out.push({ ...n, parent: null, bucket, conditions })
  }
  for (const root of nodes.filter((n) => !n.parent)) walk(root, [], root.bucket)
  return out
}

function norm(v: string | null | undefined, fallback: string): string {
  return v ? v : fallback
}

export function conditionChanged(before: RunConclusionCondition, after: RunConclusionCondition): boolean {
  const vals = (c: RunConclusionCondition) => c.values.map((v) => v.trim())
  const a = vals(before)
  const b = vals(after)
  return (
    before.subject !== after.subject ||
    norm(before.presence, 'ANY') !== norm(after.presence, 'ANY') ||
    norm(before.keyScope, 'FULL') !== norm(after.keyScope, 'FULL') ||
    norm(before.quantifier, 'ALL') !== norm(after.quantifier, 'ALL') ||
    (before.field ?? '').trim() !== (after.field ?? '').trim() ||
    (before.operator ?? '') !== (after.operator ?? '') ||
    a.length !== b.length ||
    a.some((v, i) => v !== b[i])
  )
}

export function withCheckLabel(
  c: RunConclusionCondition,
  loaded: RunConclusionCondition | null,
  ctx: LineContext,
): RunConclusionCondition {
  if (loaded && !conditionChanged(c, loaded)) return { ...c, checkLabel: loaded.checkLabel }
  return { ...c, checkLabel: describeCondition(c, ctx) }
}

export function conditionIncomplete(c: RunConclusionCondition): boolean {
  if (!c.operator) return false
  if (!(c.field ?? '').trim()) return true
  const values = c.values.map((v) => v.trim()).filter((v) => v)
  if (c.operator === 'IN' || c.operator === 'NOT_IN') return values.length === 0
  if (c.operator === 'GT' || c.operator === 'LT' || c.operator === 'WITHIN_HOURS') {
    return values[0] === undefined || !Number.isFinite(Number(values[0]))
  }
  return false
}
