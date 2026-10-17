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
  /** DAR-UI-050. STAGES = built by the lifecycle builder; the run page shows where records stopped. */
  buildMode?: 'STAGES' | null
  /** DAR-UI-050. Records younger than this many days are not judged yet. */
  lateAfterDays?: number | null
}

export interface FlowchartQuestion {
  reconciliationRunId: string
  parentReconciliationRunId?: string | null
  parentBranch?: FlowchartBranch | null
  /** START heads a chart; EXCUSED (DAR-UI-050) sets a lifecycle stage's excused records apart and is not a stage. */
  questionRole?: 'START' | 'EXCUSED' | null
  runSequence?: number | null
  isActive?: string | null
  runName?: string | null
  noOutcomeLabel?: string | null
  /** DAR-UI-050. The place's name when nothing hangs on this question's "yes". */
  yesOutcomeLabel?: string | null
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
  /** DAR-UI-050. A lifecycle built from stages: records younger than this are not judged yet. */
  lateAfterDays?: number
  isActive?: string
  isArchived?: string
}

export interface SaveFlowchartQuestionPayload {
  reconciliationId: string
  reconciliationRunId?: string
  ruleSetId: string
  runName?: string
  questionRole?: 'START' | 'EXCUSED'
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
export interface GetFlowchartRunResponse {
  reconciliation: FlowchartRun
  questions: FlowchartQuestion[]
  /** DAR-UI-050. A lifecycle built from stages: the records its rules leave out. */
  rules?: LifecycleRule[] | null
  /** DAR-UI-050. A lifecycle built from stages: its stages in order, and the records a stage is not expected of. */
  stages?: { recordType: string; label: string }[] | null
  exceptions?: LifecycleStageException[] | null
  /** DAR-UI-050. A lifecycle built from stages: what its start reads, for the rule dropdowns. */
  lifecycle?: { nsAuthConfigId: string; recordType: string; recordLabel: string } | null
  /** DAR-UI-050. The custom fields a lifecycle's records show beside the standard columns, in order. */
  details?: LifecycleDetail[] | null
}

/** DAR-UI-050. A custom field a lifecycle's records show, and its key on each record. */
export interface LifecycleDetail { fieldId: string; key?: string }
export interface SaveFlowchartQuestionResponse { question: FlowchartQuestion }
export interface RunFlowchartResponse { reconciliationExecutionId: string }
export interface GetFlowchartExecutionResponse { results: FlowchartExecutionRow[] }

/** One press of Run, rolled up across its questions' result rows (list#ReconciliationExecutions). */
export interface FlowchartExecutionSummary {
  reconciliationExecutionId: string
  startedDate?: string | number | null
  windowStartDate?: string | number | null
  windowEndDate?: string | number | null
  statusEnumId?: string | null
  questionCount?: number
}

export interface ListFlowchartExecutionsResponse { executions: FlowchartExecutionSummary[] }

export interface ImportedFlowchartRun { reconciliationId: string; reconciliationName: string; questionCount: number }
export interface ImportNetSuiteChecksResponse {
  runs: ImportedFlowchartRun[]
  imported: number
  skipped: number
  /** One sentence per skipped check, naming it and why (NetSuiteCheckImportSupport). */
  messages?: string[]
}

// DAR-UI-050. The lifecycle builder: every input is a dropdown filled from the account's own data.
export interface LifecycleRecordTypeOption { recordType: string; label: string; count: number }
export interface LifecycleStageOption {
  recordType: string
  label: string
  past: string
  /** Records in the sample that reached this stage, and that as a share of the sample. */
  reached: number
  rate: number
  /** Median days from the record to its first follower of this type. */
  typicalDays: number
  /** Share of those that reached it that had done so by each day. */
  coverage: { days: number; percent: number }[]
}
export interface GetLifecycleOptionsResponse {
  recordTypes: LifecycleRecordTypeOption[]
  stages: LifecycleStageOption[]
  sampleSize?: number | null
  sampleFrom?: string | null
  sampleThru?: string | null
}
export interface SaveLifecyclePayload {
  nsAuthConfigId: string
  recordType: string
  stageRecordTypes: string[]
  lateAfterDays?: number
  rules?: { fieldId: string; fieldLabel: string; value: string }[]
}
export interface SaveLifecycleResponse { reconciliationId: string; reconciliationName: string }

/** One rule: leave out the start's records whose field has this value (NO_VALUE = has no value). */
export interface LifecycleRule { fieldId: string; fieldLabel: string; value: string; valueLabel: string }
export interface LifecycleRuleOptionsResponse {
  fields: { fieldId: string; label: string }[]
  values?: { value: string; label: string }[]
}
export interface LifecycleRulesResponse { rules: LifecycleRule[] }
/** A stage not expected of a record whose field has this value, e.g. Fulfillment when Shipping Method is Store Pickup. */
export interface LifecycleStageException { stageRecordType: string; stageLabel: string; fieldId: string; fieldLabel: string; value: string }
export interface LifecycleStageExceptionsResponse { exceptions: LifecycleStageException[] }
