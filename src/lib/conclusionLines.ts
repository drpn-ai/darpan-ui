import type { RunConclusionCondition, RunConclusionNode } from './api/authoringTypes'

export interface LineContext {
  file1: string
  file2: string
  /** Evaluate runs read one side at a time, so lines omit the side name. */
  evaluate: boolean
  firstKeyField: string | null
  /** First path segments known to be lists (schema arrays, `many` lookups). */
  listPaths: ReadonlySet<string>
  /** First path segments known not to be lists (schema objects and plain fields, lookups that are not `many`). */
  nonListPaths?: ReadonlySet<string>
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
    case 'STARTS_WITH_ANY':
      return `starts with ${list}`
    case 'NOT_STARTS_WITH_ANY':
      return `does not start with ${list}`
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
  // A stored "any" says the path is a list even when the catalogue does not know it (an API side has no schema).
  if (seg && (ctx.listPaths.has(seg) || c.quantifier === 'ANY')) {
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

/**
 * Why a stored node cannot be placed in the tree: its parent key is missing, its parents form a cycle, or another node
 * already has its key. Only a data load can store one (save#RunConclusions refuses all three).
 */
export type ConclusionTreeProblem = 'ORPHAN' | 'CYCLE' | 'DUPLICATE_KEY'
export type FlatConclusion = RunConclusionNode & { problem?: ConclusionTreeProblem }

/**
 * The tree as a flat ranked list: each child above its parent, carrying its ancestors' lines and its root's check. Every
 * node is placed exactly once, because the save sends the whole list and would erase one left out. A node no root
 * reaches comes after the rest, with its subtree, flagged with the reason.
 */
export function flattenConclusionTree(nodes: RunConclusionNode[]): FlatConclusion[] {
  const byKey = new Map<string, RunConclusionNode>()
  const repeats = new Set<RunConclusionNode>()
  const children = new Map<string, RunConclusionNode[]>()
  for (const n of nodes) {
    if (byKey.has(n.key)) repeats.add(n)
    else byKey.set(n.key, n)
    if (n.parent) children.set(n.parent, [...(children.get(n.parent) ?? []), n])
  }
  const placed = new Set<RunConclusionNode>()
  const out: FlatConclusion[] = []
  const walk = (n: RunConclusionNode, inherited: RunConclusionCondition[], bucket: RunConclusionNode['bucket'], cut?: ConclusionTreeProblem) => {
    placed.add(n)
    const conditions = [...inherited, ...n.conditions]
    for (const k of children.get(n.key) ?? []) if (!placed.has(k)) walk(k, conditions, bucket, cut)
    const problem = cut ?? (repeats.has(n) ? 'DUPLICATE_KEY' : undefined)
    out.push({ ...n, parent: null, bucket, conditions, ...(problem ? { problem } : {}) })
  }
  for (const root of nodes) if (!root.parent && !placed.has(root)) walk(root, [], root.bucket)
  // What no root reached: climb to the top of its chain, a node whose parent is missing or the node a cycle comes back to.
  for (const n of nodes) {
    if (placed.has(n)) continue
    const climbed = new Set<RunConclusionNode>()
    let top = n
    let parent = top.parent ? byKey.get(top.parent) : undefined
    while (parent && !climbed.has(parent) && !placed.has(parent)) {
      climbed.add(top)
      top = parent
      parent = top.parent ? byKey.get(top.parent) : undefined
    }
    walk(top, [], top.bucket, parent ? 'CYCLE' : 'ORPHAN')
  }
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

/** The checkLabel column is text-medium (VARCHAR 255). */
export const CHECK_LABEL_MAX = 255

/** The line's sentence as a label, its value list shortened with "…" until it fits the column. */
function generatedLabel(c: RunConclusionCondition, ctx: LineContext): string {
  let label = describeCondition(c, ctx)
  const values = c.values.map((v) => v.trim()).filter((v) => v)
  for (let keep = values.length - 1; label.length > CHECK_LABEL_MAX && keep >= 0; keep -= 1) {
    label = describeCondition({ ...c, values: [...values.slice(0, keep), ELLIPSIS] }, ctx)
  }
  return label.length > CHECK_LABEL_MAX ? `${label.slice(0, CHECK_LABEL_MAX - 1)}${ELLIPSIS}` : label
}

export function withCheckLabel(
  c: RunConclusionCondition,
  loaded: RunConclusionCondition | null,
  ctx: LineContext,
): RunConclusionCondition {
  if (loaded && !conditionChanged(c, loaded)) return { ...c, checkLabel: loaded.checkLabel }
  return { ...c, checkLabel: generatedLabel(c, ctx) }
}

/** Tests that take a list of values: is (not) one of, starts (does not start) with. */
export function isListOperator(operator: RunConclusionCondition['operator']): boolean {
  return operator === 'IN' || operator === 'NOT_IN' || operator === 'STARTS_WITH_ANY' || operator === 'NOT_STARTS_WITH_ANY'
}

export function conditionIncomplete(c: RunConclusionCondition): boolean {
  if (!c.operator) return false
  if (!(c.field ?? '').trim()) return true
  const values = c.values.map((v) => v.trim()).filter((v) => v)
  if (isListOperator(c.operator)) return values.length === 0
  if (c.operator === 'GT' || c.operator === 'LT' || c.operator === 'WITHIN_HOURS') {
    return values[0] === undefined || !Number.isFinite(Number(values[0]))
  }
  return false
}
