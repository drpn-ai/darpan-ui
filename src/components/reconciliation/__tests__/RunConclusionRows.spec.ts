import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { ref } from 'vue'
import RunConclusionRows from '../RunConclusionRows.vue'
import { RUN_CONCLUSIONS_KEY, type ConclusionDraft, type RunConclusionsState } from '../../../composables/useRunConclusions'
import { flattenConclusionTree, type LineContext } from '../../../lib/conclusionLines'
import type { RunConclusionNode } from '../../../lib/api/authoringTypes'

const lineContext: LineContext = { file1: 'NetSuite', file2: 'HotWax', evaluate: false, firstKeyField: null, listPaths: new Set() }

function draft(key: string, outcome: ConclusionDraft['outcome'], extra: Partial<ConclusionDraft> = {}): ConclusionDraft {
  return { uid: `c${key}`, key, conclusion: `CONC_${key}`, bucket: 'MISSING_FROM_FILE_2', question: `Question ${key}?`, fix: null, outcome, suggestsFilter: false, lines: [], ...extra }
}

function mountRows(list: ConclusionDraft[], unexplained: '' | 'EXPECTED' = '') {
  const state = {
    loading: ref(false),
    loaded: ref(true),
    errors: ref<string[]>([]),
    list: ref(list),
    unexplained: ref(unexplained),
    lineContext: ref(lineContext),
    conclusionLabel: (node: ConclusionDraft) => `Label ${node.key}`,
    describeLines: (node: ConclusionDraft) => `lines of ${node.key}`,
  } as unknown as RunConclusionsState
  return mount(RunConclusionRows, { global: { provide: { [RUN_CONCLUSIONS_KEY as symbol]: state } } })
}

describe('RunConclusionRows', () => {
  it('shows each conclusion once, ranked, each with exactly one outcome, and Unexplained last', () => {
    const w = mountRows([draft('10', ''), draft('20', 'HIDE'), draft('30', 'EXPECTED')], 'EXPECTED')
    const rows = w.findAll('.run-conclusion')
    expect(rows).toHaveLength(4)
    expect(w.findAll('[data-testid="run-conclusions-node"]').map((r) => r.attributes('data-key'))).toEqual(['10', '20', '30'])
    expect(w.findAll('[data-testid="run-conclusions-number"]').map((n) => n.text())).toEqual(['1', '2', '3'])
    // One outcome per row, never two and never none.
    expect(rows.map((r) => r.findAll('[data-testid="run-conclusions-outcome"]').length)).toEqual([1, 1, 1, 1])
    expect(rows.map((r) => r.get('[data-testid="run-conclusions-outcome"]').text())).toEqual(['Shown', 'Hidden', 'Expected', 'Expected'])
    expect(rows.at(-1)?.attributes('data-testid')).toBe('run-conclusions-unexplained')
    expect(w.findAll('[data-testid="run-conclusions-unexplained"]')).toHaveLength(1)
  })

  it('reads Shown solid and a changed outcome dashed', () => {
    const w = mountRows([draft('10', ''), draft('20', 'HIDE')])
    const outcomes = w.findAll('[data-testid="run-conclusions-outcome"]')
    expect(outcomes.map((o) => o.classes().includes('run-conclusion__outcome--quiet'))).toEqual([false, true, false])
  })

  it('a stored tree reads flattened, each conclusion exactly once', () => {
    // A child is tried before its parent and carries the parent's lines; the tree must not repeat or drop either.
    const tree: RunConclusionNode[] = [
      { key: '10', conclusion: 'PARENT', bucket: 'RULE', conditions: [] },
      { key: '20', parent: '10', conclusion: 'CHILD', conditions: [] },
      { key: '30', conclusion: 'OTHER', bucket: 'MISSING_FROM_FILE_1', conditions: [] },
    ] as RunConclusionNode[]
    const list = flattenConclusionTree(tree).map((node) => draft(node.key, '', { bucket: node.bucket ?? '' }))
    const w = mountRows(list)
    expect(w.findAll('[data-testid="run-conclusions-node"]').map((r) => r.attributes('data-key'))).toEqual(['20', '10', '30'])
    expect(w.findAll('[data-testid="run-conclusions-explains"]').map((e) => e.text())).toEqual([
      'explains the rules hold', 'explains the rules hold', 'explains In NetSuite',
    ])
  })

  it('flags a conclusion that suggests a filter', () => {
    const w = mountRows([draft('10', '', { suggestsFilter: true })])
    expect(w.get('[data-testid="run-conclusions-suggests"]').text()).toBe('suggests a filter')
  })
})
