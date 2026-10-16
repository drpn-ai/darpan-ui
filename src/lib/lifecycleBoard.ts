import type { FlowchartBranch, FlowchartExecutionRow, FlowchartQuestion } from './api/flowchartTypes'

// DAR-UI-050. A lifecycle built from stages, read back as places: the stages run down the spine (each on the
// previous one's "yes"), and every named ending under a stage's "no" is a place beside that stage. The last
// stage's "yes" is the complete place. Counts come from one execution's rows; with none, counts are null.

export interface LifecyclePlace {
  label: string
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

export function lifecycleBoard(questions: FlowchartQuestion[], rows: FlowchartExecutionRow[]): LifecycleBoard {
  const active = questions.filter((q) => q.isActive !== 'N')
  const rowOf = (id: string) => rows.find((r) => r.reconciliationRunId === id) ?? null
  const childrenOf = (id: string, branch: FlowchartBranch) => active
    .filter((q) => q.parentReconciliationRunId === id && q.parentBranch === branch)
    .sort((a, b) => (a.runSequence ?? 0) - (b.runSequence ?? 0))
  const place = (q: FlowchartQuestion, branch: FlowchartBranch, label: string): LifecyclePlace => {
    const row = rowOf(q.reconciliationRunId)
    const count = row ? (branch === 'YES' ? row.yesCount : row.noCount) ?? null : null
    return { label, questionId: q.reconciliationRunId, branch, count, row }
  }
  // Every named ending at or under q, yes before no, the way the skip-ahead chain reads.
  const endings = (q: FlowchartQuestion): LifecyclePlace[] => [
    ...(q.yesOutcomeLabel ? [place(q, 'YES', q.yesOutcomeLabel)] : childrenOf(q.reconciliationRunId, 'YES').flatMap(endings)),
    ...(q.noOutcomeLabel ? [place(q, 'NO', q.noOutcomeLabel)] : childrenOf(q.reconciliationRunId, 'NO').flatMap(endings)),
  ]

  const startQ = active.find((q) => q.questionRole === 'START') ?? null
  const stages: LifecycleStage[] = []
  let complete: LifecyclePlace | null = null
  let current = startQ ? childrenOf(startQ.reconciliationRunId, 'YES')[0] : undefined
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
    current = childrenOf(here.reconciliationRunId, 'YES')[0]
  }
  const counts = stages.flatMap((s) => s.places.map((p) => p.count ?? 0))
  return {
    start: startQ ? { questionId: startQ.reconciliationRunId, label: startQ.runName ?? '', count: rowOf(startQ.reconciliationRunId)?.yesCount ?? null } : null,
    stages,
    complete,
    largest: Math.max(0, ...counts),
  }
}
