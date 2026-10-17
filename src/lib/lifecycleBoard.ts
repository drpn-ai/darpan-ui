import type { FlowchartBranch, FlowchartExecutionRow, FlowchartQuestion } from './api/flowchartTypes'

// DAR-UI-050. A lifecycle built from stages, read back as places: the stages run down the spine (each the first
// question on the previous one's "yes"), and every named ending under a stage's "no" is a place beside that stage.
// The complete place is the named question beside the last stage (or, in the first shape, the last stage's named
// "yes"). Counts come from one execution's rows; with none, counts are null.

export interface LifecyclePlace {
  label: string
  /** The place's stored name, which stays put when its label is reworded: what "not a finding" is kept by. */
  key: string
  /** check: a finding a person wrote (records that reached the stage and match), not a place records stop at. */
  kind?: 'check'
  questionId: string
  branch: FlowchartBranch
  count: number | null
  /** The question's result row; a "no" place opens its records from it. */
  row: FlowchartExecutionRow | null
}

export interface LifecycleStage {
  questionId: string
  label: string
  /** Records that reached this stage. */
  count: number | null
  places: LifecyclePlace[]
}

export interface LifecycleBoard {
  start: { questionId: string; label: string; count: number | null } | null
  stages: LifecycleStage[]
  complete: LifecyclePlace | null
  /** The biggest place count, for scaling each place's meter. */
  largest: number
}

/** DAR-UI-050. The places a lifecycle says are not findings, from its stored JSON list; anything unreadable is none. */
export function notFindingPlacesOf(stored?: string | null): string[] {
  if (!stored) return []
  try {
    const parsed: unknown = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

/**
 * @param excusedNames what each stage's exceptions excuse, by stage label ("Fulfillment" -> "Store Pickup or GFT-CP"),
 *   so an excused place reads in a person's own words: "Store Pickup or GFT-CP, never billed".
 */
export function lifecycleBoard(questions: FlowchartQuestion[], rows: FlowchartExecutionRow[], excusedNames: Record<string, string> = {}): LifecycleBoard {
  const active = questions.filter((q) => q.isActive !== 'N')
  const rowOf = (id: string) => rows.find((r) => r.reconciliationRunId === id) ?? null
  // Written findings hang beside the spine; they are never a stage, a stop, or the complete place.
  const checks = active.filter((q) => q.questionRole === 'FINDING')
  const childrenOf = (id: string, branch: FlowchartBranch) => active
    .filter((q) => q.parentReconciliationRunId === id && q.parentBranch === branch && q.questionRole !== 'FINDING')
    .sort((a, b) => (a.runSequence ?? 0) - (b.runSequence ?? 0))
  const place = (q: FlowchartQuestion, branch: FlowchartBranch, label: string): LifecyclePlace => {
    const row = rowOf(q.reconciliationRunId)
    const count = row ? (branch === 'YES' ? row.yesCount : row.noCount) ?? null : null
    const key = (branch === 'YES' ? q.yesOutcomeLabel : q.noOutcomeLabel) ?? label
    return { label, key, questionId: q.reconciliationRunId, branch, count, row }
  }
  // Every named ending at or under q, yes before no, the way the skip-ahead chain reads.
  const endings = (q: FlowchartQuestion): LifecyclePlace[] => [
    ...(q.yesOutcomeLabel ? [place(q, 'YES', q.yesOutcomeLabel)] : childrenOf(q.reconciliationRunId, 'YES').flatMap(endings)),
    ...(q.noOutcomeLabel ? [place(q, 'NO', q.noOutcomeLabel)] : childrenOf(q.reconciliationRunId, 'NO').flatMap(endings)),
  ]

  // DAR-UI-050. Records an exception let past a stage without it take their own track: the excused check sits on the
  // spine between two stages, and each place on its track belongs to the stage the records stopped at.
  const excused: { stageLabel: string; place: LifecyclePlace }[] = []
  const stepOverExcused = (q: FlowchartQuestion) => {
    const name = excusedNames[q.runName ?? '']
    const track = (e: FlowchartQuestion): void => {
      if (e.noOutcomeLabel) {
        const rest = e.noOutcomeLabel.includes(', ') ? e.noOutcomeLabel.slice(e.noOutcomeLabel.indexOf(', ')) : ''
        excused.push({ stageLabel: e.runName ?? '', place: place(e, 'NO', name ? `${name}${rest}` : e.noOutcomeLabel) })
      }
      childrenOf(e.reconciliationRunId, 'YES').forEach(track)
    }
    childrenOf(q.reconciliationRunId, 'NO').forEach(track)
  }

  const startQ = active.find((q) => q.questionRole === 'START') ?? null
  const stages: LifecycleStage[] = []
  let complete: LifecyclePlace | null = null
  let current = startQ ? childrenOf(startQ.reconciliationRunId, 'YES')[0] : undefined
  let parentOfCurrent = startQ
  while (current) {
    const here = current
    const row = rowOf(here.reconciliationRunId)
    stages.push({
      questionId: here.reconciliationRunId,
      label: here.runName ?? '',
      count: row?.yesCount ?? null,
      places: here.noOutcomeLabel ? [place(here, 'NO', here.noOutcomeLabel)] : childrenOf(here.reconciliationRunId, 'NO').flatMap(endings),
    })
    if (here.yesOutcomeLabel) complete = place(here, 'YES', here.yesOutcomeLabel)
    let next = childrenOf(here.reconciliationRunId, 'YES')[0]
    let parentOfNext: FlowchartQuestion = here
    if (next?.questionRole === 'EXCUSED') {
      stepOverExcused(next)
      parentOfNext = next
      next = childrenOf(next.reconciliationRunId, 'YES')[0]
    }
    if (!next && parentOfCurrent) {
      const beside = childrenOf(parentOfCurrent.reconciliationRunId, 'YES').find((q) => q !== here && q.noOutcomeLabel)
      if (beside) complete = place(beside, 'NO', beside.noOutcomeLabel!)
    }
    parentOfCurrent = parentOfNext
    current = next
  }
  for (const { stageLabel, place: p } of excused) {
    const stage = stages.find((st) => st.label === stageLabel)
    if (stage) stage.places.push(p)
  }
  for (const q of [...checks].sort((a, b) => (a.runSequence ?? 0) - (b.runSequence ?? 0))) {
    const stage = stages.find((st) => st.label === q.runName)
    if (stage && q.noOutcomeLabel) stage.places.push({ ...place(q, 'NO', q.noOutcomeLabel), kind: 'check' })
  }
  const counts = stages.flatMap((s) => s.places.map((p) => p.count ?? 0))
  return {
    start: startQ ? { questionId: startQ.reconciliationRunId, label: startQ.runName ?? '', count: rowOf(startQ.reconciliationRunId)?.yesCount ?? null } : null,
    stages,
    complete,
    largest: Math.max(0, ...counts),
  }
}
