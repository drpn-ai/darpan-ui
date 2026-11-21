import { describe, expect, it } from 'vitest'
import type { RunConclusionCondition, RunConclusionNode } from '../api/authoringTypes'
import {
  OUTCOME_GLOSS,
  conditionChanged,
  conditionIncomplete,
  describeCondition,
  explainsLabel,
  flattenConclusionTree,
  withCheckLabel,
  type LineContext,
} from '../conclusionLines'

const ctx: LineContext = {
  file1: 'HotWax',
  file2: 'NetSuite',
  evaluate: false,
  firstKeyField: 'order_name',
  listPaths: new Set(['lines']),
}

function cond(over: Partial<RunConclusionCondition>): RunConclusionCondition {
  return { subject: 'FILE_2', field: 'billing_status', operator: 'IN', values: ['Pending Billing'], checkLabel: '', ...over }
}

describe('describeCondition', () => {
  it('reads IN', () => {
    expect(describeCondition(cond({}), ctx)).toBe('NetSuite billing_status is one of Pending Billing')
  })
  it('reads the other operators', () => {
    expect(describeCondition(cond({ operator: 'NOT_IN' }), ctx)).toBe('NetSuite billing_status is not one of Pending Billing')
    expect(describeCondition(cond({ operator: 'GT', values: ['5'] }), ctx)).toBe('NetSuite billing_status is more than 5')
    expect(describeCondition(cond({ operator: 'LT', values: ['5'] }), ctx)).toBe('NetSuite billing_status is less than 5')
    expect(describeCondition(cond({ operator: 'GT_ZERO', values: [] }), ctx)).toBe('NetSuite billing_status is more than 0')
    expect(describeCondition(cond({ operator: 'BLANK', values: [] }), ctx)).toBe('NetSuite billing_status is empty')
    expect(describeCondition(cond({ operator: 'NOT_BLANK', values: [] }), ctx)).toBe('NetSuite billing_status is not empty')
  })
  it('reads WITHIN_HOURS', () => {
    expect(describeCondition(cond({ subject: 'FILE_1', field: 'shipped_date', operator: 'WITHIN_HOURS', values: ['24'] }), ctx)).toBe(
      'HotWax shipped_date is within 24 hours',
    )
  })
  it('omits the side when evaluating', () => {
    expect(describeCondition(cond({}), { ...ctx, evaluate: true })).toBe('billing_status is one of Pending Billing')
  })
  it('reads list paths with quantifiers', () => {
    const l = { field: 'lines.status', values: ['Backordered'] }
    expect(describeCondition(cond({ ...l, quantifier: 'ANY' }), ctx)).toBe("any NetSuite line's status is one of Backordered")
    expect(describeCondition(cond({ ...l, quantifier: 'ALL' }), ctx)).toBe("every NetSuite line's status is one of Backordered")
    expect(describeCondition(cond({ ...l, quantifier: 'ALL', operator: 'NOT_IN' }), ctx)).toBe(
      "no NetSuite line's status is one of Backordered",
    )
    expect(describeCondition(cond({ field: 'data.x', quantifier: 'ANY', values: ['a'] }), { ...ctx, listPaths: new Set(['data']) })).toBe(
      "any NetSuite data's x is one of a",
    )
  })
  it('reads a stored any on a list path the catalogue does not know', () => {
    expect(describeCondition(
      cond({ subject: 'FILE_1', field: 'items.statusId', quantifier: 'ANY', values: ['ITEM_CANCELLED'] }),
      { ...ctx, listPaths: new Set() },
    )).toBe("any HotWax item's statusId is one of ITEM_CANCELLED")
  })
  it('gives a non-list dotted path no quantifier word', () => {
    expect(describeCondition(cond({ field: 'orderInNetsuite.tranId', values: ['A'] }), ctx)).toBe(
      'NetSuite orderInNetsuite.tranId is one of A',
    )
  })
  it('reads presence-only lines', () => {
    const p = { field: null, operator: null, values: [] }
    expect(describeCondition(cond({ ...p, presence: 'KEPT' }), ctx)).toBe('the NetSuite record is there')
    expect(describeCondition(cond({ ...p, presence: 'ABSENT' }), ctx)).toBe('the NetSuite record is missing')
    expect(describeCondition(cond({ ...p, presence: 'EXCLUDED' }), ctx)).toBe('the NetSuite record was set aside')
    expect(describeCondition(cond({ ...p, presence: 'ABSENT', keyScope: 'FIRST_FIELD' }), ctx)).toBe(
      'the NetSuite order_name record is missing',
    )
  })
  it('joins presence with a field test', () => {
    expect(describeCondition(cond({ presence: 'KEPT' }), ctx)).toBe(
      'the NetSuite record is there and its billing_status is one of Pending Billing',
    )
  })
  it('reads FIRST_FIELD with a field test', () => {
    expect(describeCondition(cond({ keyScope: 'FIRST_FIELD', field: 'status', values: ['x'] }), ctx)).toBe(
      "NetSuite order_name record's status is one of x",
    )
  })
  it('uses an ellipsis for missing values', () => {
    expect(describeCondition(cond({ values: [] }), ctx)).toBe('NetSuite billing_status is one of …')
    expect(describeCondition(cond({ operator: 'GT', values: [] }), ctx)).toBe('NetSuite billing_status is more than …')
  })
})

describe('explainsLabel', () => {
  it('maps buckets', () => {
    expect(explainsLabel('MISSING_FROM_FILE_2', ctx)).toBe('In NetSuite')
    expect(explainsLabel('MISSING_FROM_FILE_1', ctx)).toBe('In HotWax')
    expect(explainsLabel('RULE', ctx)).toBe('the rules hold')
    expect(explainsLabel('', ctx)).toBe('any check')
    expect(explainsLabel(null, ctx)).toBe('any check')
    expect(explainsLabel('FINDING', { ...ctx, evaluate: true })).toBe('every finding')
    expect(explainsLabel('FINDING', ctx)).toBe('every finding (single-sided only)')
    expect(explainsLabel('OTHER', ctx)).toBe('OTHER')
  })
})

describe('withCheckLabel', () => {
  it('keeps a hand label when untouched and regenerates after a change', () => {
    const loaded = cond({ checkLabel: 'my label' })
    expect(withCheckLabel({ ...loaded }, loaded, ctx).checkLabel).toBe('my label')
    expect(withCheckLabel({ ...loaded, values: ['Other'] }, loaded, ctx).checkLabel).toBe('NetSuite billing_status is one of Other')
    expect(withCheckLabel({ ...loaded }, null, ctx).checkLabel).toBe('NetSuite billing_status is one of Pending Billing')
  })
  it('treats absent and default values as equal', () => {
    const a = cond({ checkLabel: 'x' })
    const b = { ...a, presence: 'ANY', keyScope: 'FULL', quantifier: 'ALL' }
    expect(conditionChanged(a, b)).toBe(false)
    expect(conditionChanged({ ...a, field: null }, { ...a, field: '' })).toBe(false)
    expect(conditionChanged({ ...a, values: ['a', 'b'] }, { ...a, values: ['b', 'a'] })).toBe(true)
    expect(conditionChanged({ ...a, values: [' a '] }, { ...a, values: ['a'] })).toBe(false)
  })
  it('caps a generated label at the column by shortening the value list', () => {
    const values = Array.from({ length: 30 }, (_, i) => `A long billing status value number ${i}`)
    const label = withCheckLabel(cond({ values }), null, ctx).checkLabel
    expect(label.length).toBeLessThanOrEqual(255)
    expect(label.startsWith('NetSuite billing_status is one of A long billing status value number 0, ')).toBe(true)
    expect(label.endsWith(', …')).toBe(true)
    // A kept loaded label is never touched, however long.
    const loaded = cond({ values, checkLabel: 'x'.repeat(300) })
    expect(withCheckLabel({ ...loaded }, loaded, ctx).checkLabel).toBe('x'.repeat(300))
  })
  it('round-trips untouched conditions', () => {
    const cs = [
      cond({ keyScope: 'FIRST_FIELD', checkLabel: 'hand 1' }),
      cond({ presence: 'KEPT', checkLabel: 'hand 2' }),
      cond({ operator: 'GT_ZERO', values: [], checkLabel: 'hand 3' }),
      cond({ field: 'weird.unknown.path', checkLabel: 'hand 4' }),
    ]
    for (const c of cs) expect(withCheckLabel(c, c, ctx)).toEqual(c)
  })
})

describe('conditionIncomplete', () => {
  it('flags unfinished conditions', () => {
    expect(conditionIncomplete(cond({ values: [] }))).toBe(true)
    expect(conditionIncomplete(cond({ operator: 'NOT_IN', values: [' '] }))).toBe(true)
    expect(conditionIncomplete(cond({ operator: 'GT', values: ['abc'] }))).toBe(true)
    expect(conditionIncomplete(cond({ operator: 'WITHIN_HOURS', values: [] }))).toBe(true)
    expect(conditionIncomplete(cond({ field: '' }))).toBe(true)
    expect(conditionIncomplete(cond({}))).toBe(false)
    expect(conditionIncomplete(cond({ operator: 'GT', values: ['5'] }))).toBe(false)
    expect(conditionIncomplete(cond({ field: null, operator: null, values: [], presence: 'ABSENT' }))).toBe(false)
    expect(conditionIncomplete(cond({ operator: 'BLANK', values: [] }))).toBe(false)
  })
})

describe('OUTCOME_GLOSS', () => {
  it('has the verbatim copy', () => {
    expect(OUTCOME_GLOSS['']).toBe('a finding you see')
    expect(OUTCOME_GLOSS.EXPECTED).toBe('not a finding; counted as expected')
    expect(OUTCOME_GLOSS.HIDE).toBe('not a finding; left out of counts')
  })
})

describe('flattenConclusionTree', () => {
  const c = (label: string): RunConclusionCondition => cond({ checkLabel: label })
  const node = (key: string, parent: string | null, label: string, extra: Partial<RunConclusionNode> = {}): RunConclusionNode => ({
    key,
    parent,
    conclusion: `C-${key}`,
    conditions: [c(label)],
    ...extra,
  })
  const tree: RunConclusionNode[] = [
    node('R1', null, 'a', { bucket: 'RULE', question: 'q' }),
    node('C1', 'R1', 'b'),
    node('G1', 'C1', 'c'),
    node('C2', 'R1', 'd'),
    node('R2', null, 'e', { bucket: 'FINDING' }),
  ]

  function treeFirstMatch(nodes: RunConclusionNode[], facts: Record<string, boolean>): string | null {
    const holds = (n: RunConclusionNode) => n.conditions.every((x) => facts[x.checkLabel])
    const kids = (n: RunConclusionNode) => nodes.filter((k) => k.parent === n.key)
    const refine = (n: RunConclusionNode): string => {
      const hit = kids(n).find(holds)
      return hit ? refine(hit) : n.conclusion
    }
    const root = nodes.filter((n) => !n.parent).find(holds)
    return root ? refine(root) : null
  }
  function flatFirstMatch(rows: RunConclusionNode[], facts: Record<string, boolean>): string | null {
    const row = rows.find((r) => r.conditions.every((x) => facts[x.checkLabel]))
    return row ? row.conclusion : null
  }

  it('flattening keeps first-match results', () => {
    const rows = flattenConclusionTree(tree)
    expect(rows.map((r) => r.key)).toEqual(['G1', 'C1', 'C2', 'R1', 'R2'])
    expect(rows.every((r) => r.parent === null)).toBe(true)
    expect(rows.every((r) => r.bucket === 'RULE' || r.bucket === 'FINDING')).toBe(true)
    expect(rows[0]?.conditions.map((x) => x.checkLabel)).toEqual(['a', 'b', 'c'])
    expect(rows[0]?.bucket).toBe('RULE')
    const labels = ['a', 'b', 'c', 'd', 'e']
    for (let m = 0; m < 32; m++) {
      const facts: Record<string, boolean> = {}
      labels.forEach((l, i) => (facts[l] = Boolean(m & (1 << i))))
      expect(flatFirstMatch(rows, facts)).toBe(treeFirstMatch(tree, facts))
    }
  })
})
