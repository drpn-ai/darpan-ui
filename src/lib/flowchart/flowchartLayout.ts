import type { FlowchartQuestion } from '../api/flowchartTypes'

// DAR-UI-048. The run flowchart's geometry, decided here and only here, so the board is a renderer and
// every layout rule is a unit test. Top to bottom (spec D3): a question's children sit one row down; in
// wide mode its finding sits to its right and "why" questions hang under the finding.
//
// Sizes follow the design system's shipped board nodes: a question is a single-line pill like the
// rules board's field pill (min-height 2.75rem), a finding a small box, and each "+" is an
// app-icon-action (2.8rem). The "+" positions are part of the layout so they are tested for overlap too.
export const QUESTION_WIDTH = 300
// Narrow mode must fit a phone's board (about 230px inside the static panel's padding at 420px wide).
const QUESTION_WIDTH_NARROW = 216
export const QUESTION_HEIGHT = 44
export const FINDING_WIDTH = 200
const FINDING_WIDTH_NARROW = 140
export const FINDING_HEIGHT = 36
export const ADD_SIZE = 45
export const COLUMN_GAP = 48
export const ROW_GAP = 96

// Narrow mode's yes lane: right of the finding below the question, inside the question's own width.
const YES_LANE_INSET = 12
const PAD = 16
const NARROW_FINDING_OFFSET = 16
const ADD_OFFSET = 8

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

/** Where a "+" action sits: `next` adds a question on the yes branch, `why` one on the no branch. */
export interface FlowchartAffordance {
  kind: 'next' | 'why'
  questionId: string
  x: number
  y: number
}

export interface FlowchartLayout {
  boxes: FlowchartBox[]
  edges: FlowchartEdge[]
  affordances: FlowchartAffordance[]
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
  const findingWidth = narrow ? FINDING_WIDTH_NARROW : FINDING_WIDTH
  const questionWidth = narrow ? QUESTION_WIDTH_NARROW : QUESTION_WIDTH
  const columnWidth = questionWidth + COLUMN_GAP
  // Narrow: question, finding under it, then the "+ next" on the yes lane, then the next row.
  const narrowNextTop = QUESTION_HEIGHT + NARROW_FINDING_OFFSET + FINDING_HEIGHT + ADD_OFFSET
  const rowHeight = narrow ? narrowNextTop + ADD_SIZE + 40 : QUESTION_HEIGHT + ROW_GAP
  const boxes: FlowchartBox[] = []
  const edges: FlowchartEdge[] = []
  const affordances: FlowchartAffordance[] = []

  // Places q's subtree with its question at column `col`, row `row`; returns the columns it spans.
  const place = (q: FlowchartQuestion, col: number, row: number): number => {
    const isStart = q.questionRole === 'START'
    const x = PAD + col * columnWidth
    const y = PAD + row * rowHeight
    const id = q.reconciliationRunId
    const lane = narrow ? questionWidth - YES_LANE_INSET : questionWidth / 2
    boxes.push({ id, kind: isStart ? 'start' : 'question', questionId: id, x, y, width: questionWidth, height: QUESTION_HEIGHT })
    // "+ next" sits on the yes lane just under the question (wide) or under the finding (narrow); the
    // yes arrow runs behind it, so it reads as "insert a question here".
    affordances.push({ kind: 'next', questionId: id, x: x + lane - ADD_SIZE / 2,
      y: y + (narrow && !isStart ? narrowNextTop : QUESTION_HEIGHT + ADD_OFFSET) })

    let finding: FlowchartBox | null = null
    if (!isStart) {
      finding = narrow
        ? { id: `finding:${id}`, kind: 'finding', questionId: id, x, y: y + QUESTION_HEIGHT + NARROW_FINDING_OFFSET, width: findingWidth, height: FINDING_HEIGHT }
        : { id: `finding:${id}`, kind: 'finding', questionId: id, x: x + columnWidth, y: y + (QUESTION_HEIGHT - FINDING_HEIGHT) / 2, width: findingWidth, height: FINDING_HEIGHT }
      boxes.push(finding)
      affordances.push(narrow
        ? { kind: 'why', questionId: id, x: finding.x + finding.width + ADD_OFFSET, y: finding.y + (FINDING_HEIGHT - ADD_SIZE) / 2 }
        : { kind: 'why', questionId: id, x: finding.x + finding.width / 2 - ADD_SIZE / 2, y: finding.y + FINDING_HEIGHT + ADD_OFFSET })
      edges.push(narrow
        ? { id: `no:${id}`, kind: 'no', fromId: id, toId: finding.id, d: vertical(x + 24, y + QUESTION_HEIGHT, x + 24, finding.y), labelX: x + 32, labelY: y + QUESTION_HEIGHT + 12 }
        : { id: `no:${id}`, kind: 'no', fromId: id, toId: finding.id, d: `M ${x + questionWidth} ${y + QUESTION_HEIGHT / 2} L ${finding.x} ${y + QUESTION_HEIGHT / 2}`, labelX: x + questionWidth + 8, labelY: y + QUESTION_HEIGHT / 2 - 8 })
    }
    const own = isStart || narrow ? 1 : 2
    let cursor = col
    const yesLabelY = narrow ? y + narrowNextTop + ADD_SIZE + 14 : y + QUESTION_HEIGHT + ADD_OFFSET + ADD_SIZE + 22
    for (const child of (kids.get(id) ?? []).filter((c) => c.parentBranch !== 'NO')) {
      const childX = PAD + cursor * columnWidth
      const childY = PAD + (row + 1) * rowHeight
      edges.push({ id: `yes:${child.reconciliationRunId}`, kind: 'yes', fromId: id, toId: child.reconciliationRunId,
        d: vertical(x + lane, y + QUESTION_HEIGHT, childX + lane, childY),
        labelX: (x + childX) / 2 + lane + 6, labelY: yesLabelY })
      cursor += place(child, cursor, row + 1)
    }
    if (finding) {
      cursor = Math.max(cursor, narrow ? col : col + 1)
      for (const child of (kids.get(id) ?? []).filter((c) => c.parentBranch === 'NO')) {
        const childX = PAD + cursor * columnWidth
        const childY = PAD + (row + 1) * rowHeight
        edges.push({ id: `why:${child.reconciliationRunId}`, kind: 'why', fromId: finding.id, toId: child.reconciliationRunId,
          d: vertical(finding.x + finding.width / 2, finding.y + finding.height, childX + questionWidth / 2, childY),
          labelX: childX + questionWidth / 2 + 6, labelY: childY - 12 })
        cursor += place(child, cursor, row + 1)
      }
    }
    return Math.max(own, cursor - col)
  }

  let col = 0
  for (const top of kids.get('') ?? []) col += place(top, col, 0)

  const right = Math.max(...boxes.map((b) => b.x + b.width), ...affordances.map((a) => a.x + ADD_SIZE), 0)
  const bottom = Math.max(...boxes.map((b) => b.y + b.height), ...affordances.map((a) => a.y + ADD_SIZE), 0)
  return { boxes, edges, affordances, width: right + PAD, height: bottom + PAD }
}
