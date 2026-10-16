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
  it('puts the evidence in the option label', () => {
    expect(stageOptionLabel(invoice)).toBe('Invoice · 96% · usually the same day')
    expect(stageOptionLabel(ship)).toBe('Fulfillment · 97% · usually 1 day later')
    expect(stageOptionLabel({ ...ship, typicalDays: 18 })).toBe('Fulfillment · 97% · usually 18 days later')
  })

  it('keeps the data order, not the click order', () => {
    expect(orderedStages([invoice, ship], ['ItemShip', 'CustInvc']).map((s) => s.recordType)).toEqual(['CustInvc', 'ItemShip'])
  })

  it('offers late-after days from the last stage, defaulting to the first past 90%', () => {
    const opts = lateAfterOptions([invoice, ship])
    expect(opts.map((o) => o.label)).toEqual([
      'Same day · 10% done by then', '1 day · 80% done by then', '2 days · 91% done by then', '5 days · 99% done by then',
    ])
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
