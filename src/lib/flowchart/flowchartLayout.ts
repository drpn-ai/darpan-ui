import type { FlowchartQuestion } from '../api/flowchartTypes'

// DAR-UI-048. The run flowchart's geometry, decided here and only here, so the board is a renderer and
// every layout rule is a unit test. Top to bottom (spec D3): a question's children sit one row down; in
// wide mode its finding sits to its right and "why" questions hang under the finding.
export const QUESTION_WIDTH = 240
export const QUESTION_HEIGHT = 64
export const FINDING_WIDTH = 200
export const FINDING_HEIGHT = 48
export const COLUMN_GAP = 48
export const ROW_GAP = 72

const COLUMN_WIDTH = QUESTION_WIDTH + COLUMN_GAP
// Narrow mode's yes lane: right of the finding below the question, inside the question's own width.
export const YES_LANE = QUESTION_WIDTH - 12
const PAD = 16

export interface FlowchartBox {
  id: string
  kind: 'question' | 'start' | 'finding'
  questionId: string
  x: number
  y: number
  width: number
  height: number
}

export interface FlowchartEdge {
  id: string
  kind: 'yes' | 'no' | 'why'
  fromId: string
  toId: string
  d: string
  labelX: number
  labelY: number
}

export interface FlowchartLayout {
  boxes: FlowchartBox[]
  edges: FlowchartEdge[]
  width: number
  height: number
}

function childrenOf(questions: FlowchartQuestion[]) {
  const map = new Map<string, FlowchartQuestion[]>()
  for (const q of questions) {
    if (q.isActive === 'N') continue
    const key = q.parentReconciliationRunId || ''
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(q)
  }
  for (const list of map.values()) {
    list.sort((a, b) =>
      (a.questionRole === 'START' ? 0 : 1) - (b.questionRole === 'START' ? 0 : 1)
      || (a.runSequence ?? Number.MAX_SAFE_INTEGER) - (b.runSequence ?? Number.MAX_SAFE_INTEGER)
      || a.reconciliationRunId.localeCompare(b.reconciliationRunId))
  }
  return map
}

export function walkableQuestionIds(questions: FlowchartQuestion[]): string[] {
  const kids = childrenOf(questions)
  const out: string[] = []
  const visit = (key: string) => {
    for (const q of kids.get(key) ?? []) {
      out.push(q.reconciliationRunId)
      visit(q.reconciliationRunId)
    }
  }
  visit('')
  return out
}

function vertical(x1: number, y1: number, x2: number, y2: number): string {
  const mid = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`
}

export function layoutFlowchart(questions: FlowchartQuestion[], options: { narrow: boolean }): FlowchartLayout {
  const { narrow } = options
  const kids = childrenOf(questions)
  const rowHeight = narrow ? QUESTION_HEIGHT + 24 + FINDING_HEIGHT + ROW_GAP : QUESTION_HEIGHT + ROW_GAP
  const boxes: FlowchartBox[] = []
  const edges: FlowchartEdge[] = []

  // Places q's subtree with its question at column `col`, row `row`; returns the columns it spans.
  const place = (q: FlowchartQuestion, col: number, row: number): number => {
    const isStart = q.questionRole === 'START'
    const x = PAD + col * COLUMN_WIDTH
    const y = PAD + row * rowHeight
    const id = q.reconciliationRunId
    boxes.push({ id, kind: isStart ? 'start' : 'question', questionId: id, x, y, width: QUESTION_WIDTH, height: QUESTION_HEIGHT })
    let finding: FlowchartBox | null = null
    if (!isStart) {
      finding = narrow
        ? { id: `finding:${id}`, kind: 'finding', questionId: id, x, y: y + QUESTION_HEIGHT + 24, width: FINDING_WIDTH, height: FINDING_HEIGHT }
        : { id: `finding:${id}`, kind: 'finding', questionId: id, x: x + COLUMN_WIDTH, y: y + (QUESTION_HEIGHT - FINDING_HEIGHT) / 2, width: FINDING_WIDTH, height: FINDING_HEIGHT }
      boxes.push(finding)
      edges.push(narrow
        ? { id: `no:${id}`, kind: 'no', fromId: id, toId: finding.id, d: vertical(x + 24, y + QUESTION_HEIGHT, x + 24, finding.y), labelX: x + 32, labelY: y + QUESTION_HEIGHT + 14 }
        : { id: `no:${id}`, kind: 'no', fromId: id, toId: finding.id, d: `M ${x + QUESTION_WIDTH} ${y + QUESTION_HEIGHT / 2} L ${finding.x} ${y + QUESTION_HEIGHT / 2}`, labelX: x + QUESTION_WIDTH + 8, labelY: y + QUESTION_HEIGHT / 2 - 8 })
    }
    const own = isStart || narrow ? 1 : 2
    let cursor = col
    for (const child of (kids.get(id) ?? []).filter((c) => c.parentBranch !== 'NO')) {
      const childX = PAD + cursor * COLUMN_WIDTH
      const childY = PAD + (row + 1) * rowHeight
      // Narrow: the finding sits under the question, so the yes arrow leaves from the question's right
      // side, clear of the finding (FINDING_WIDTH < YES_LANE), or it would read as a "why" link.
      const lane = narrow ? YES_LANE : QUESTION_WIDTH / 2
      edges.push({ id: `yes:${child.reconciliationRunId}`, kind: 'yes', fromId: id, toId: child.reconciliationRunId,
        d: vertical(x + lane, y + QUESTION_HEIGHT, childX + lane, childY),
        labelX: (x + childX) / 2 + lane + 6, labelY: y + QUESTION_HEIGHT + (narrow ? 40 : ROW_GAP / 2) })
      cursor += place(child, cursor, row + 1)
    }
    if (finding) {
      cursor = Math.max(cursor, narrow ? col : col + 1)
      for (const child of (kids.get(id) ?? []).filter((c) => c.parentBranch === 'NO')) {
        const childX = PAD + cursor * COLUMN_WIDTH
        const childY = PAD + (row + 1) * rowHeight
        edges.push({ id: `why:${child.reconciliationRunId}`, kind: 'why', fromId: finding.id, toId: child.reconciliationRunId,
          d: vertical(finding.x + finding.width / 2, finding.y + finding.height, childX + QUESTION_WIDTH / 2, childY),
          labelX: childX + QUESTION_WIDTH / 2 + 6, labelY: childY - 12 })
        cursor += place(child, cursor, row + 1)
      }
    }
    return Math.max(own, cursor - col)
  }

  let col = 0
  for (const top of kids.get('') ?? []) col += place(top, col, 0)

  const width = boxes.reduce((m, b) => Math.max(m, b.x + b.width), 0) + PAD
  const height = boxes.reduce((m, b) => Math.max(m, b.y + b.height), 0) + PAD
  return { boxes, edges, width, height }
}
