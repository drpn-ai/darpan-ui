// DAR-UI-048. A run is a tree of yes/no questions (spec: docs/superpowers/specs/2026-10-01-run-flowchart-design.md).
export type FlowchartBranch = 'YES' | 'NO'

export interface FlowchartRun {
  reconciliationId: string
  reconciliationName?: string | null
  description?: string | null
  defaultTimeWindow?: string | null
  isActive?: string | null
  isArchived?: string | null
  companyUserGroupId?: string | null
  questionCount?: number
}

export interface FlowchartQuestion {
  reconciliationRunId: string
  parentReconciliationRunId?: string | null
  parentBranch?: FlowchartBranch | null
  questionRole?: 'START' | null
  runSequence?: number | null
  isActive?: string | null
  runName?: string | null
  noOutcomeLabel?: string | null
  ruleSetId: string
  scopeMode?: 'COMPARE' | 'EVALUATE'
}

export interface FlowchartExecutionRow {
  reconciliationRunResultId: string
  reconciliationRunId?: string | null
  parentRunResultId?: string | null
  statusEnumId?: string | null
  yesCount?: number | null
  noCount?: number | null
  unaskedCount?: number | null
  differenceCount?: number | null
  errorMessage?: string | null
  resultDataManagerPath?: string | null
}

export interface SaveFlowchartRunPayload {
  reconciliationId?: string
  reconciliationName?: string
  description?: string
  defaultTimeWindow?: string
  isActive?: string
  isArchived?: string
}

export interface SaveFlowchartQuestionPayload {
  reconciliationId: string
  reconciliationRunId?: string
  ruleSetId: string
  runName?: string
  questionRole?: 'START'
  parentReconciliationRunId?: string
  parentBranch?: FlowchartBranch
  noOutcomeLabel?: string
  runSequence?: number
  isActive?: string
}

export interface RunFlowchartPayload {
  reconciliationId: string
  windowStartDate: string
  windowEndDate: string
  windowStartLocalDate?: string
  windowEndLocalDate?: string
}

export interface ListFlowchartRunsResponse { reconciliations: FlowchartRun[] }
export interface SaveFlowchartRunResponse { reconciliation: FlowchartRun }
export interface GetFlowchartRunResponse { reconciliation: FlowchartRun; questions: FlowchartQuestion[] }
export interface SaveFlowchartQuestionResponse { question: FlowchartQuestion }
export interface RunFlowchartResponse { reconciliationExecutionId: string }
export interface GetFlowchartExecutionResponse { results: FlowchartExecutionRow[] }
