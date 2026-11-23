// DAR-BE-334. The active tenant's queries (facade.TenantScriptFacadeServices) on moqui-jexl: a read over what its audits
// already keep (kept datasets, saved runs' newest differences, audit findings) and a JEXL script over it that returns a
// summary and up to five CSV files. A schedule sends the answer by email and/or chat; whoever saves it owns it.

export interface TenantQuery {
  tenantQueryId: string
  queryName: string
  description: string | null
  readSpecJson: string | null
  /** The read in words ("Reads dataset D1, last 30 days, status = B, 2 fields"); null when there is no read. */
  readText: string | null
  scriptBody: string
  sampleInputJson: string | null
  isActive: boolean
  ownerUserId: string | null
}

export interface ScriptLibraryFunction {
  name: string
  help: string
}

export interface QueryLimits {
  maxReadRows?: number
  units?: number
  timeoutMs?: number
  [limit: string]: number | undefined
}

export interface ListTenantQueriesResponse {
  queries: TenantQuery[]
  library: ScriptLibraryFunction[]
  limits: QueryLimits
}

export interface SaveTenantQueryPayload {
  tenantQueryId?: string
  queryName: string
  description?: string
  readSpecJson?: string
  scriptBody: string
  sampleInputJson?: string
  isActive?: boolean
}

export interface SaveTenantQueryResponse {
  query: TenantQuery
  notes?: string[]
}

export interface QueryError {
  kind: string
  message: string
  line?: number
  column?: number
}

export interface QueryFile {
  name: string
  columns: string[]
  rowCount: number
  /** The first 20 rows. */
  previewRows: unknown[][]
}

export interface QueryRun {
  ok: boolean
  summary: string | null
  files: QueryFile[]
  data: unknown
  /** The script returned nothing: nothing would be sent. */
  nothing: boolean
  /** Why the result is not a summary/files result, when it is not. */
  invalid: string | null
  readCounts: Record<string, number> | null
  units: number | null
  elapsedMs: number | null
  logs: string[] | null
  error: QueryError | null
  readText: string | null
}

export interface RunTenantQueryPayload {
  tenantQueryId?: string
  readSpecJson?: string
  scriptBody?: string
}

export interface RunTenantQueryResponse {
  result: QueryRun
}

/** moqui-jexl's run statuses ("Contract as built"). */
export type QueryRunStatus =
  | 'OK' | 'NOTHING_TO_SEND' | 'PREVIEW' | 'HELD' | 'DISABLED' | 'OWNER_LOST' | 'READ_ERROR' | 'READ_NOT_ALLOWED'
  | 'READ_TOO_LARGE' | 'SCRIPT_ERROR' | 'RESULT_INVALID' | 'DELIVERY_PARTIAL' | 'DELIVERY_FAILED' | 'STUCK'
  | 'SCRIPT_MISSING' | 'NO_INPUT' | 'WAITING' | 'EXPIRED'

export interface QueryDeliveryOutcome {
  kind: 'email' | 'chat'
  lastOutcome: string | null
  lastMessage: string | null
}

export interface TenantQuerySchedule {
  scheduleId: string
  tenantQueryId: string
  cronExpression: string
  timeZone: string | null
  isActive: boolean | 'Y' | 'N'
  ownerUserId: string | null
  ownerName: string | null
  /** Comma-separated addresses. */
  emailTo: string | null
  emailCc: string | null
  chatSpaceId: string | null
  recipientCount: number
  nextRunDate: string | number | null
  lastRunDate: string | number | null
  lastRunStatus: QueryRunStatus | string | null
  lastRunMessage: string | null
  deliveries: QueryDeliveryOutcome[]
}

export interface ListTenantQuerySchedulesResponse {
  schedules: TenantQuerySchedule[]
  timeZone: string
}

export interface SaveTenantQuerySchedulePayload {
  scheduleId?: string
  tenantQueryId: string
  dailyAt?: string
  cronExpression?: string
  isActive: boolean
  emailTo?: string
  emailCc?: string
  chatSpaceId?: string
}

export interface SaveTenantQueryScheduleResponse {
  schedule: TenantQuerySchedule
}

export interface QueryScheduleOutcome {
  status: QueryRunStatus | string
  message: string | null
  result?: { summary?: string | null; files?: { name: string; rows?: unknown[][] }[] } | null
  readCounts?: Record<string, number> | null
}

export interface RunTenantQueryScheduleResponse {
  outcome: QueryScheduleOutcome
}

// The queries page's agent (send#AgentQueryTurn): it proposes one query that has already run; nothing is saved.

export interface QueryProposal {
  proposal: { queryName: string; description: string | null; readSpecJson: string | null; scriptBody: string; readText: string | null }
  preview: QueryRun
}

export interface SendAgentQueryTurnResponse {
  conversationId: string | null
  outcome: string
  reply: string | null
  queryProposal: QueryProposal | null
  question: { text: string; options?: string[]; from?: string } | null
  masked: string[] | null
}
