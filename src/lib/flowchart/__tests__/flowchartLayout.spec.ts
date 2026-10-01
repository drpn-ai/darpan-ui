import { describe, expect, it } from 'vitest'
import type { FlowchartQuestion } from '../../api/flowchartTypes'
import { layoutFlowchart, walkableQuestionIds, type FlowchartBox } from '../flowchartLayout'

function q(id: string, extra: Partial<FlowchartQuestion> = {}): FlowchartQuestion {
  return { reconciliationRunId: id, ruleSetId: `${id}_RS`, ...extra }
}
const chain = (): FlowchartQuestion[] => [
  q('S', { questionRole: 'START' }),
  q('A', { parentReconciliationRunId: 'S', parentBranch: 'YES', runSequence: 1 }),
  q('A1', { parentReconciliationRunId: 'A', parentBranch: 'YES' }),
  q('W', { parentReconciliationRunId: 'A', parentBranch: 'NO' }),
  q('B', { parentReconciliationRunId: 'S', parentBranch: 'YES', runSequence: 2 }),
]
const overlap = (a: FlowchartBox, b: FlowchartBox) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

describe('layoutFlowchart', () => {
  it('reads top to bottom: a child sits one row below its parent', () => {
    const { boxes } = layoutFlowchart(chain(), { narrow: false })
    const at = (id: string) => boxes.find((b) => b.id === id)!
    expect(at('A').y).toBeGreaterThan(at('S').y)
    expect(at('A1').y).toBeGreaterThan(at('A').y)
    expect(at('A1').x).toBe(at('A').x)
  })

  it('every question but the start has its finding to the right in wide mode', () => {
    const { boxes } = layoutFlowchart(chain(), { narrow: false })
    expect(boxes.find((b) => b.id === 'finding:S')).toBeUndefined()
    const a = boxes.find((b) => b.id === 'A')!
    const finding = boxes.find((b) => b.id === 'finding:A')!
    expect(finding.y).toBe(a.y + (a.height - finding.height) / 2)
    expect(finding.x).toBeGreaterThan(a.x + a.width)
  })

  it('a "why" question hangs under its finding, not under its question', () => {
    const { boxes } = layoutFlowchart(chain(), { narrow: false })
    const finding = boxes.find((b) => b.id === 'finding:A')!
    const why = boxes.find((b) => b.id === 'W')!
    expect(why.x).toBeGreaterThanOrEqual(finding.x)
  })

  it('narrow mode puts the finding under its question', () => {
    const { boxes } = layoutFlowchart(chain(), { narrow: true })
    const a = boxes.find((b) => b.id === 'A')!
    const finding = boxes.find((b) => b.id === 'finding:A')!
    expect(finding.x).toBe(a.x)
    expect(finding.y).toBeGreaterThan(a.y + a.height)
  })

  it('no two boxes overlap in a wide and deep tree', () => {
    const qs: FlowchartQuestion[] = [q('S', { questionRole: 'START' })]
    for (let i = 0; i < 8; i++) qs.push(q(`T${i}`, { parentReconciliationRunId: 'S', parentBranch: 'YES', runSequence: i }))
    let parent = 'T0'
    for (let d = 0; d < 6; d++) {
      qs.push(q(`D${d}`, { parentReconciliationRunId: parent, parentBranch: d % 2 ? 'NO' : 'YES' }))
      parent = `D${d}`
    }
    for (const narrow of [false, true]) {
      const { boxes } = layoutFlowchart(qs, { narrow })
      for (let i = 0; i < boxes.length; i++)
        for (let j = i + 1; j < boxes.length; j++)
          expect(overlap(boxes[i]!, boxes[j]!), `${boxes[i]!.id} overlaps ${boxes[j]!.id}`).toBe(false)
    }
  })

  it('draws a yes edge to each yes child, a no edge to each finding, a why edge from finding to its child', () => {
    const { edges } = layoutFlowchart(chain(), { narrow: false })
    expect(edges.find((e) => e.kind === 'yes' && e.fromId === 'A' && e.toId === 'A1')).toBeTruthy()
    expect(edges.find((e) => e.kind === 'no' && e.fromId === 'A' && e.toId === 'finding:A')).toBeTruthy()
    expect(edges.find((e) => e.kind === 'why' && e.fromId === 'finding:A' && e.toId === 'W')).toBeTruthy()
    expect(edges.every((e) => e.d.startsWith('M '))).toBe(true)
  })

  it('leaves out an inactive question and everything under it', () => {
    const qs = chain()
    qs.find((x) => x.reconciliationRunId === 'A')!.isActive = 'N'
    const ids = layoutFlowchart(qs, { narrow: false }).boxes.map((b) => b.id)
    expect(ids).not.toContain('A')
    expect(ids).not.toContain('A1')
    expect(ids).toContain('B')
  })

  it('the size covers every box', () => {
    const layout = layoutFlowchart(chain(), { narrow: false })
    for (const b of layout.boxes) {
      expect(b.x + b.width).toBeLessThanOrEqual(layout.width)
      expect(b.y + b.height).toBeLessThanOrEqual(layout.height)
    }
  })
})

describe('arrows and labels (plan 2 review I2)', () => {
  for (const narrow of [false, true]) {
    it(`${narrow ? 'narrow' : 'wide'}: a yes arrow clears its question's finding and no label sits inside a box`, () => {
      const { boxes, edges } = layoutFlowchart(chain(), { narrow })
      for (const e of edges.filter((x) => x.kind === 'yes')) {
        const x1 = Number(e.d.replace(/[MCL]/g, ' ').trim().split(/\s+/)[0])
        const finding = boxes.find((b) => b.id === `finding:${e.fromId}`)
        if (finding && narrow) expect(x1, e.id).toBeGreaterThan(finding.x + finding.width)
      }
      for (const e of edges)
        for (const b of boxes)
          expect(e.labelX >= b.x && e.labelX <= b.x + b.width && e.labelY >= b.y && e.labelY <= b.y + b.height,
            `${e.id} label inside ${b.id}`).toBe(false)
    })
  }
})

describe('walkableQuestionIds', () => {
  it('matches the backend walk order', () => {
    expect(walkableQuestionIds(chain())).toEqual(['S', 'A', 'A1', 'W', 'B'])
  })
})
