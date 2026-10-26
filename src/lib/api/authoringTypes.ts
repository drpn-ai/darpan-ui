// DAR-UI-064. Audit authoring: the SuiteQL query a NetSuite run side reads, and a run side's extract options. Spec:
// darpan-master docs/superpowers/specs/2026-10-22-audit-authoring-ui-design.md.
import type { ApiEnvelope } from './types'

/** RECORDS_MATCHING conditions. STARTS_WITH takes letters, digits, # and -; NOT_EMPTY takes no values; GT one number. */
export type NsMatchOp = 'IN' | 'GT' | 'NOT_EMPTY' | 'STARTS_WITH'

export interface NsMatchRule {
  fieldId: string
  op: NsMatchOp
  values: string[]
}

/** One projected column: the record field a run reads, and the SuiteQL column (or one aliased function / macro). */
export interface NsQueryField {
  recordFieldName: string
  sourceColumn: string
  sequenceNum?: number
}

export interface NsSuiteQlQuery {
  /** Left out on save to create one: the server mints it (DAR-BE-135). */
  nsSuiteQlSourceQueryId?: string
  nsAuthConfigId: string
  description?: string | null
  recordType: string
  fromTable?: string | null
  dateColumn?: string | null
  queryTemplate?: string | null
  /** Stored JSON of NsMatchRule[] on read; a list or its JSON on save. */
  matchRules?: string | NsMatchRule[] | null
  joinKeyFieldName?: string | null
  originFieldName?: string | null
  isActive?: string | boolean | null
  fields: NsQueryField[]
}

export interface NsSuiteQlQueryOptions {
  templates: string[]
  dateColumns: string[]
  recordTypes: string[]
  /** Fields a match rule may ask about; any custbody_ field is accepted besides. */
  matchFields: string[]
  matchOps: NsMatchOp[]
  customFieldPattern: string
  accounts: Array<{ nsAuthConfigId: string; description?: string | null }>
}

export interface GetNsSuiteQlQueryOptionsResponse extends ApiEnvelope {
  options?: NsSuiteQlQueryOptions
}

export interface GetNsSuiteQlQueryResponse extends ApiEnvelope {
  query?: NsSuiteQlQuery
}

export interface SaveNsSuiteQlQueryResponse extends ApiEnvelope {
  savedQuery?: NsSuiteQlQuery
}

export interface NsSuiteQlQueryPreview {
  day: string
  sql: string
  records: Array<Record<string, unknown>>
  more: boolean
}

export interface PreviewNsSuiteQlQueryPayload extends Omit<NsSuiteQlQuery, 'isActive'> {
  /** YYYY-MM-DD; default yesterday in the tenant's zone. */
  day?: string
}

export interface PreviewNsSuiteQlQueryResponse extends ApiEnvelope {
  preview?: NsSuiteQlQueryPreview | null
}

/** An extract option a run side's connector declares (SourceSystemConnector.extractOptionsJson). */
export interface SourceExtractOption {
  name: string
  label: string
  type: 'boolean' | 'text'
}

/** A run side's chosen options: only declared names; false / blank are not sent. */
export type SourceExtractOptions = Record<string, boolean | string>

// S3 — a run's conclusion tree (facade.RunConclusionFacadeServices).
export type ConclusionBucket = 'MISSING_FROM_FILE_1' | 'MISSING_FROM_FILE_2' | 'RULE' | 'FINDING'
export type ConclusionOperator = 'IN' | 'NOT_IN' | 'GT' | 'GT_ZERO' | 'WITHIN_HOURS' | 'BLANK' | 'NOT_BLANK'

export interface RunConclusionCondition {
  subject: 'FILE_1' | 'FILE_2'
  /** ANY, KEPT (in the extract), EXCLUDED (screened out by a source filter), ABSENT. */
  presence?: string
  /** FULL or FIRST_FIELD (the first key field only). */
  keyScope?: string
  /** ALL or ANY of the values the field yields. */
  quantifier?: string
  /** A record field; a dotted path walks nested maps. Blank with a blank operator = presence only. */
  field?: string | null
  operator?: ConclusionOperator | null
  values: string[]
  checkLabel: string
}

export interface RunConclusionNode {
  /** Stable within one save; a child names its parent's key. Read back as the stored sequence ("10", "20"). */
  key: string
  parent?: string | null
  /** A DarpanConclusion id. */
  conclusion: string
  label?: string
  /** Roots only; blank = any row. */
  bucket?: ConclusionBucket | null
  question?: string | null
  /** DAR-BE-120: what to do when this is the cause, e.g. "Fulfil {orderInNetsuite.tranId} in NetSuite". */
  fix?: string | null
  conditions: RunConclusionCondition[]
}

export interface RunConclusions {
  savedRunId: string
  scopeMode: string
  conclusions: RunConclusionNode[]
  /** Shared codes plus the tenant's own (own: true); another tenant's codes never appear. */
  catalog: Array<{ id: string; label: string; own?: boolean }>
  buckets: ConclusionBucket[]
  operators: ConclusionOperator[]
  presence: string[]
  keyScopes: string[]
  quantifiers: string[]
}

export interface GetRunConclusionsResponse extends ApiEnvelope {
  conclusions?: RunConclusions | null
}

export interface CreateRunConclusionCodeResponse extends ApiEnvelope {
  conclusionCode?: { id: string; label: string; own: boolean } | null
}

export interface SaveRunConclusionsResponse extends ApiEnvelope {
  savedConclusions?: RunConclusions | null
}

// S4 — a check on an audit (facade.AuditFacadeServices, DAR-UI-064 services).
export type AuditDiffType =
  | 'MISSING_IN_FILE_1'
  | 'MISSING_IN_FILE_2'
  | 'FIELD_MISMATCH'
  | 'FINDING'
  | 'DUPLICATE_IN_FILE_1'
  | 'DUPLICATE_IN_FILE_2'

/** Which of the run's rows break one statement: blank lists = any. */
export interface AuditCheckStatementLink {
  /** The statement's code, e.g. R4. */
  id: string
  diffTypes: AuditDiffType[]
  conclusionCodes: string[]
  ruleIds: string[]
}

export interface AuditCheckDraft {
  /** The check's code: lower-case words joined by hyphens. */
  id: string
  /** True on a new check: the save is refused if the code is already used anywhere in the tenant. */
  create?: boolean
  label: string
  savedRunId?: string | null
  file1RecordType?: string | null
  file2RecordType?: string | null
  graceDays?: number | string | null
  matchedBy?: string | null
  fixOwner?: string | null
  /** OMS, NETSUITE or SHOPIFY. */
  fixWhereEnumId?: string | null
  expectedSource?: string | null
  actualSource?: string | null
  amountCurrencyUomId?: string | null
  headlineTemplate?: string | null
  fixActionTemplate?: string | null
  passesWhenTemplate?: string | null
}

export interface AuditCheckDetail extends AuditCheckDraft {
  automationId?: string | null
  statements: AuditCheckStatementLink[]
}

export interface AuditCheckOptions {
  audit: { id: string; name: string }
  statements: Array<{ id: string; text: string }>
  runs: Array<{
    savedRunId: string
    runName: string
    scopeMode: string
    rules: Array<{ ruleId: string; ruleText: string }>
    conclusions: Array<{ code: string; label: string }>
    /** DAR-UI-078. The run's object as a finding's record type (return, order), and each side's root system and key. */
    recordType?: string | null
    sides?: Array<{ side: 'FILE_1' | 'FILE_2'; system: string; key: string }>
  }>
  diffTypes: AuditDiffType[]
  fixWhere: string[]
  checks: Array<{ id: string; label: string }>
}

export interface GetAuditCheckOptionsResponse extends ApiEnvelope {
  options?: AuditCheckOptions | null
}

export interface SaveAuditCheckResponse extends ApiEnvelope {
  savedCheck?: AuditCheckDetail | null
}
