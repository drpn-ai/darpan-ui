import { describe, expect, it } from 'vitest'
import { defaultLateAfter, lateAfterOptions, orderedStages, stageOptionLabel } from '../lifecycleOptions'
import { lifecycleBoard } from '../lifecycleBoard'
import type { FlowchartExecutionRow, FlowchartQuestion, LifecycleStageOption } from '../api/flowchartTypes'

const invoice: LifecycleStageOption = {
  recordType: 'CustInvc', label: 'Invoice', past: 'Billed', reached: 960, rate: 96, typicalDays: 0,
  coverage: [{ days: 0, percent: 73 }, { days: 1, percent: 94 }, { days: 2, percent: 97 }],
}
const ship: LifecycleStageOption = {
  recordType: 'ItemShip', label: 'Fulfillment', past: 'Shipped', reached: 970, rate: 97, typicalDays: 1,
  coverage: [{ days: 0, percent: 10 }, { days: 1, percent: 80 }, { days: 2, percent: 91 }, { days: 5, percent: 99 }],
}

describe('lifecycle options', () => {
  it('labels a stage by its name alone', () => {
    expect(stageOptionLabel(invoice)).toBe('Invoice')
    expect(stageOptionLabel(ship)).toBe('Fulfillment')
  })

  it('keeps the data order, not the click order', () => {
    expect(orderedStages([invoice, ship], ['ItemShip', 'CustInvc']).map((s) => s.recordType)).toEqual(['CustInvc', 'ItemShip'])
  })

  it('offers late-after days from the last stage, defaulting to the first past 90%', () => {
    const opts = lateAfterOptions([invoice, ship])
    expect(opts.map((o) => o.label)).toEqual(['Same day', '1 day', '2 days', '5 days'])
    expect(defaultLateAfter([invoice, ship])).toBe('2')
    expect(defaultLateAfter([])).toBe('')
  })
})

const q = (id: string, m: Partial<FlowchartQuestion> = {}): FlowchartQuestion => ({ reconciliationRunId: id, ruleSetId: `${id}_RS`, ...m })
// save#Lifecycle's tree for Sales orders → Fulfillment → Invoice.
const tree: FlowchartQuestion[] = [
  q('S', { questionRole: 'START', runName: 'Sales orders' }),
  q('A', { parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Fulfillment' }),
  q('B', { parentReconciliationRunId: 'A', parentBranch: 'YES', runName: 'Invoice', noOutcomeLabel: 'Shipped, never billed', yesOutcomeLabel: 'Shipped and billed' }),
  q('W', { parentReconciliationRunId: 'A', parentBranch: 'NO', runName: 'Invoice', yesOutcomeLabel: 'Billed, never shipped', noOutcomeLabel: 'Never shipped, never billed' }),
]

describe('lifecycle board', () => {
  it('lists stages down the spine and puts each ending beside the stage where the record stopped', () => {
    const board = lifecycleBoard(tree, [])
    expect(board.start?.label).toBe('Sales orders')
    expect(board.stages.map((s) => s.label)).toEqual(['Fulfillment', 'Invoice'])
    expect(board.stages[0]!.places.map((p) => p.label)).toEqual(['Billed, never shipped', 'Never shipped, never billed'])
    expect(board.stages[1]!.places.map((p) => p.label)).toEqual(['Shipped, never billed'])
    expect(board.complete?.label).toBe('Shipped and billed')
    expect(board.complete?.count).toBeNull()
  })

  it('reads every count from the run, and a "no" place opens its records', () => {
    const rows: FlowchartExecutionRow[] = [
      { reconciliationRunResultId: 'r1', reconciliationRunId: 'S', yesCount: 5000 },
      { reconciliationRunResultId: 'r2', reconciliationRunId: 'A', yesCount: 2040, noCount: 2960 },
      { reconciliationRunResultId: 'r3', reconciliationRunId: 'B', yesCount: 1266, noCount: 774, resultDataManagerPath: 'x/B.json' },
      { reconciliationRunResultId: 'r4', reconciliationRunId: 'W', yesCount: 1621, noCount: 1339, resultDataManagerPath: 'x/W.json' },
    ]
    const board = lifecycleBoard(tree, rows)
    expect(board.start?.count).toBe(5000)
    expect(board.stages[0]!.count).toBe(2040)
    expect(board.stages[0]!.places.map((p) => [p.label, p.count, Boolean(p.row && p.branch === 'NO')]))
      .toEqual([['Billed, never shipped', 1621, false], ['Never shipped, never billed', 1339, true]])
    expect(board.stages[1]!.places[0]!.count).toBe(774)
    expect(board.complete?.count).toBe(1266)
    expect(board.largest).toBe(1621)
  })
})

// save#Lifecycle's tree since every place became its own question: Sales orders → Invoice → Fulfillment.
const perPlace: FlowchartQuestion[] = [
  q('S', { questionRole: 'START', runName: 'Sales orders', runSequence: 1 }),
  q('I', { parentReconciliationRunId: 'S', parentBranch: 'YES', runName: 'Invoice', runSequence: 2 }),
  q('F', { parentReconciliationRunId: 'I', parentBranch: 'YES', runName: 'Fulfillment', noOutcomeLabel: 'Billed, never shipped', runSequence: 3 }),
  q('D', { parentReconciliationRunId: 'I', parentBranch: 'YES', runName: 'Fulfillment', noOutcomeLabel: 'Billed and shipped', runSequence: 4 }),
  q('H', { parentReconciliationRunId: 'I', parentBranch: 'NO', runName: 'Fulfillment', noOutcomeLabel: 'Shipped, never billed', runSequence: 5 }),
  q('N', { parentReconciliationRunId: 'I', parentBranch: 'NO', runName: 'Fulfillment', noOutcomeLabel: 'Never billed, never shipped', runSequence: 6 }),
]

describe('lifecycle board, one question per place', () => {
  it('every place, complete included, is a question\'s findings, so every one can open', () => {
    const rows: FlowchartExecutionRow[] = [
      { reconciliationRunResultId: 'r1', reconciliationRunId: 'S', yesCount: 10585 },
      { reconciliationRunResultId: 'r2', reconciliationRunId: 'I', yesCount: 9848, noCount: 737 },
      { reconciliationRunResultId: 'r3', reconciliationRunId: 'F', yesCount: 9716, noCount: 132 },
      { reconciliationRunResultId: 'r4', reconciliationRunId: 'D', yesCount: 132, noCount: 9716 },
      { reconciliationRunResultId: 'r5', reconciliationRunId: 'H', yesCount: 381, noCount: 356 },
      { reconciliationRunResultId: 'r6', reconciliationRunId: 'N', yesCount: 356, noCount: 381 },
    ]
    const board = lifecycleBoard(perPlace, rows)
    expect(board.stages.map((st) => [st.label, st.count])).toEqual([['Invoice', 9848], ['Fulfillment', 9716]])
    expect(board.stages[0]!.places.map((p) => [p.label, p.count, p.branch])).toEqual([
      ['Shipped, never billed', 356, 'NO'], ['Never billed, never shipped', 381, 'NO']])
    expect(board.stages[1]!.places.map((p) => [p.label, p.count, p.branch])).toEqual([['Billed, never shipped', 132, 'NO']])
    expect([board.complete?.label, board.complete?.count, board.complete?.branch]).toEqual(['Billed and shipped', 9716, 'NO'])
  })
})

