import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import LifecycleBoard from '../LifecycleBoard.vue'
import { lifecycleBoard, type LifecyclePlace } from '../../../lib/lifecycleBoard'
import type { FlowchartExecutionRow, FlowchartQuestion } from '../../../lib/api/flowchartTypes'

// A lifecycle chain reads in dependency order: each record is made from the one before it (KB
// darpan/lifecycle-chain-ordering; worked example exchange-return-chain-order: return, RMA, credit memo, exchange order).
// The questions arrive shuffled, with run sequences that would sort them wrong, so only the chain itself
// (each stage hangs on the previous stage's "yes") can put them in order.
const questions: FlowchartQuestion[] = [
  { reconciliationRunId: 'X', ruleSetId: 'XO', parentReconciliationRunId: 'C', parentBranch: 'YES', runSequence: 1,
    runName: 'Exchange order', noOutcomeLabel: 'Credited, never exchanged', yesOutcomeLabel: 'Exchanged' },
  { reconciliationRunId: 'C', ruleSetId: 'CM', parentReconciliationRunId: 'R', parentBranch: 'YES', runSequence: 2,
    runName: 'Credit memo', noOutcomeLabel: 'Authorised, never credited' },
  { reconciliationRunId: 'S', ruleSetId: 'RET', questionRole: 'START', runSequence: 4, runName: 'Exchange returns' },
  { reconciliationRunId: 'R', ruleSetId: 'RMA', parentReconciliationRunId: 'S', parentBranch: 'YES', runSequence: 3,
    runName: 'RMA', noOutcomeLabel: 'Returned, no RMA' },
]
const rows: FlowchartExecutionRow[] = [
  { reconciliationRunResultId: '1', reconciliationRunId: 'S', yesCount: 120 },
  { reconciliationRunResultId: '2', reconciliationRunId: 'R', yesCount: 110, noCount: 10 },
  { reconciliationRunResultId: '3', reconciliationRunId: 'C', yesCount: 104, noCount: 6 },
  { reconciliationRunResultId: '4', reconciliationRunId: 'X', yesCount: 104, noCount: 0 },
]

function mountBoard(canOpen: (place: LifecyclePlace) => boolean = () => false, notFinding: string[] = []) {
  return mount(LifecycleBoard, { props: { board: lifecycleBoard(questions, rows), canOpen, notFinding } })
}

describe('LifecycleBoard', () => {
  it('draws the chain in dependency order: start, each stage after the one it is made from, complete last', () => {
    const w = mountBoard()
    const nodes = w.findAll('.lifecycle-line-node').map((n) => n.get('.lifecycle-line-name').text())
    expect(nodes).toEqual(['Exchange returns', 'RMA', 'Credit memo', 'Exchange order', 'Exchanged'])
    expect(w.get('[data-testid="lifecycle-start"]').text()).toContain('120')
    expect(w.get('[data-testid="lifecycle-stage-R"]').text()).toContain('110')
    expect(w.get('[data-testid="lifecycle-complete"]').text()).toContain('104')
  })

  it('lists each place once, under the stage where its records stopped', () => {
    const w = mountBoard()
    const groups = w.findAll('.lifecycle-line-group')
    const placesUnder = (stageId: string) => groups
      .find((g) => g.find(`[data-testid="lifecycle-stage-${stageId}"]`).exists())
      ?.findAll('.lifecycle-line-place-label').map((p) => p.text())
    expect(placesUnder('R')).toEqual(['Returned, no RMA'])
    expect(placesUnder('C')).toEqual(['Authorised, never credited'])
    expect(placesUnder('X')).toEqual(['Credited, never exchanged'])
    expect(w.findAll('.lifecycle-line-place')).toHaveLength(3)
  })

  it('dims an empty place, opens only what canOpen allows, and marks a place that is not a finding', async () => {
    const w = mountBoard((place) => place.questionId === 'R', ['Authorised, never credited'])
    expect(w.get('[data-testid="lifecycle-place-X-NO"]').classes()).toContain('lifecycle-line-place--empty')

    const open = w.get('[data-testid="lifecycle-place-R-NO"]')
    expect(open.element.tagName).toBe('BUTTON')
    expect(open.attributes('aria-label')).toBe('Open Returned, no RMA')
    expect(w.get('[data-testid="lifecycle-place-C-NO"]').element.tagName).toBe('DIV')
    await open.trigger('click')
    await w.get('[data-testid="lifecycle-place-C-NO"]').trigger('click')
    expect(w.emitted('open')?.map(([place]) => (place as LifecyclePlace).questionId)).toEqual(['R'])

    const quiet = w.get('[data-testid="lifecycle-place-C-NO"]')
    expect(quiet.find('[data-testid="lifecycle-place-not-finding"]').exists()).toBe(true)
    expect(quiet.classes()).toContain('lifecycle-line-place--empty')
  })
})
