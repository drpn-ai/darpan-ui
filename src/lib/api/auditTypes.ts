// DAR-UI-058. The audit run's JSON (darpan.audit.report/v1, darpan.audit.finding/v1) as the backend assembler writes
// it and facade.AuditFacadeServices hands it over unchanged: keyed objects, codes not ids. The contract and every
// key's meaning: darpan-master docs/superpowers/specs/2026-10-21-audit-run-json-contract.md.

export type AuditFindingState = 'open' | 'pending' | 'fixed'
export type AuditCheckStatus = 'ran' | 'partial' | 'notRun'
export type AuditSourceRead = 'complete' | 'partial' | 'failed'

export interface AuditMoney {
  amount: string
  currency: string
}

export interface AuditMoneySource extends AuditMoney {
  source: string | null
}

/**
 * records.<System>.<recordType>: [{ id, internalId, status }]. DAR-UI-080: the few facts that explain a finding when the
 * record's read gave them, and, in a finding's own document, `data`: every field that read gave.
 */
export interface AuditRecord {
  id: string
  internalId: string | null
  status: string | null
  orderName?: string
  orderStatus?: string
  /** DAR-UI-081. The order's bill-to customer, an item's SKU and location, the order's and a return's day (YYYY-MM-DD). */
  customer?: string
  sku?: string
  location?: string
  locationName?: string
  /** DAR-UI-081. The order's sales channel and shipping method; a NetSuite line's item fulfillments (IF numbers). */
  salesChannel?: string
  shipMethod?: string
  fulfillments?: string[]
  orderDate?: string
  returnDate?: string
  channel?: string
  warrantyId?: string
  /** The order's total (its own, or the one its item or return carries) and a return's own. */
  orderTotal?: AuditMoney
  returnTotal?: AuditMoney
  deposits?: { id: string; amount: string | null; status: string | null }[]
  /** DAR-UI-081. A return held behind another: the return holding it, and its exchange order (netsuiteId null: not there). */
  heldBy?: { id: string; status: string | null }
  exchange?: { id: string; netsuiteId: string | null }
  data?: Record<string, unknown>
}
export type AuditRecords = Record<string, Record<string, AuditRecord[]>>

export interface AuditFindingCounts {
  open: number
  pending: number
  newToday: number
  fixedToday: number
}

export interface AuditRef {
  id: string
  name: string
  period?: string
}

export interface AuditSourceHealth {
  read: AuditSourceRead
  records: number | null
  readAt: string | null
  reason: string | null
  affects: string[]
}

export interface AuditHealth {
  complete: boolean
  summary: string
  sources: Record<string, AuditSourceHealth>
  checks: { ran: number; partial: number; notRun: number }
  notCovered: string[]
}

export interface AuditStatementCheck {
  id: string
  label: string
  status: AuditCheckStatus
  reason: string | null
  matchedBy: string | null
  graceDays: number | null
  compared: Record<string, number> | null
  /** DAR-UI-063. The days this morning's run read: the period to date, or the days a person played. */
  window?: { from: string; thru: string } | null
}

export interface AuditFindingSummary {
  id: string
  headline: string
  state: AuditFindingState
  firstFound: string
  ageDays: number
  records: AuditRecords
  difference: AuditMoney | null
  next: string
  /** DAR-UI-075. An order's lines as one finding: id is the order, the lines sit under it, stuck names the line(s)
   *  holding it up (their cause is their own while the others' is held by it). Absent on a lone line. */
  kind?: 'order'
  order?: string
  cause?: string | null
  stuck?: string[]
  lines?: AuditFindingLine[]
}

export interface AuditFindingLine extends AuditFindingSummary {
  cause: string | null
  /** Held by another line's cause (e.g. "another line of its order is backordered"). */
  held: boolean
}

export interface AuditStatement {
  id: string
  text: string
  weight: 'firm' | 'derived'
  status: AuditCheckStatus
  reason: string | null
  checks: AuditStatementCheck[]
  counts: AuditFindingCounts
  findings: AuditFindingSummary[]
  findingsOmitted: number
}

export interface AuditCategory {
  label: string
  counts: AuditFindingCounts
  statements: Record<string, AuditStatement>
}

export interface AuditReport {
  schema: 'darpan.audit.report/v1'
  about: string
  report: {
    tenant: { id: string; name: string; timeZone: string }
    audit: AuditRef
    date: string
    window: { from: string; thru: string }
    running: boolean
    period: string
    generatedAt: string
  }
  health: AuditHealth
  summary: AuditFindingCounts & {
    oldestOpen: { id: string; statement: string; firstFound: string; ageDays: number } | null
    byCategory: Record<string, AuditFindingCounts>
  }
  categories: Record<string, AuditCategory>
}

export interface AuditFindingEvent {
  at: string
  event: string
  by: { type: string; id: string | null; label: string | null }
}

export interface AuditFindingDocument {
  schema: 'darpan.audit.finding/v1'
  finding: {
    id: string
    headline: string
    audit: AuditRef
    period: string
    category: { id: string; label: string }
    statement: { id: string; text: string; weight: 'firm' | 'derived' }
    check: { id: string; label: string; matchedBy: string | null }
    status: {
      state: AuditFindingState
      firstFound: string
      lastSeen: string
      lastChecked: string | null
      ageDays: number
      timesSeen: number
      pendingUntil: string | null
      closedAt: string | null
      closedBy: { type: string; id: string | null; label: string | null } | null
    }
    records: AuditRecords
    evidence: {
      rule: string | null
      expected: AuditMoneySource | null
      actual: AuditMoneySource | null
      difference: AuditMoney | null
      checks: { label: string; passed: boolean; value: string | null }[]
    }
    diagnosis: { conclusion: { code: string; label: string } | null; explanation: string | null }
    fix: {
      owner: string | null
      where: string | null
      action: string | null
      verify: { by: string; nextCheck: string | null; passesWhen: string | null }
      darpanChanges: string
    }
    history: AuditFindingEvent[]
  }
  access: { mode: string; note: string }
}

export interface AuditListItem {
  id: string
  name: string
  period: string | null
}

interface AuditEnvelope {
  ok?: boolean
  messages?: string[]
  errors?: string[]
}

export interface GetAuditsResponse extends AuditEnvelope {
  audits?: AuditListItem[]
}

export interface GetAuditReportResponse extends AuditEnvelope {
  report?: AuditReport | null
}

export interface GetAuditFindingResponse extends AuditEnvelope {
  finding?: AuditFindingDocument | null
}

// DAR-UI-075. Every open and pending finding of an audit and period, one per order (get#AuditFindingsByOrder).
export interface GetAuditFindingsByOrderResponse extends AuditEnvelope {
  findings?: AuditFindingListItem[]
}

// DAR-UI-072. What each system's read wrote for a check's morning (get#AuditCheckExtracts); read via get#GeneratedOutput.
export interface AuditCheckExtract {
  system: string | null
  records: number | null
  filePath: string
}

export interface GetAuditCheckExtractsResponse extends AuditEnvelope {
  extracts?: AuditCheckExtract[]
}

// A findings row (get#AuditFindingsByOrder): the report's summary plus where it sits and, DAR-UI-073, its cause in words.
export interface AuditFindingListItem extends AuditFindingSummary {
  audit?: string
  period?: string
  statement: string
  category: string
  cause: string | null
}

// DAR-UI-063. The audit's settings gear and play button (facade.AuditFacadeServices get#/save#AuditSettings, run#Audit).
export interface AuditSettingsCheck {
  id: string
  label: string
  savedRunId: string | null
  runName: string | null
}

export interface AuditSettingsStatement {
  id: string
  code: string
  text: string
  active: boolean
  checks: AuditSettingsCheck[]
}

export interface AuditSchedule {
  active: boolean
  /** HH:mm, 24-hour. */
  time: string
  timeZone: string
  /** The checks' automations do not agree on time, zone or on/off; saving sets them all. */
  mixed: boolean
  automations: number
  checksWithoutRun: number
}

export interface AuditSettings {
  audit: { id: string; name: string; period: string | null }
  /** The earliest day a play can record today, YYYY-MM-DD. */
  playableFrom?: string | null
  schedule: AuditSchedule
  statements: AuditSettingsStatement[]
}

export interface GetAuditSettingsResponse extends AuditEnvelope {
  settings?: AuditSettings | null
}

// DAR-UI-085. What the audit's checks are doing right now (facade.AuditFacadeServices get#AuditProgress), for Run health
// while a play or the morning run is going. Health is the backend's call (RunHealth); the page never re-derives it.
export interface AuditProgressRun {
  /** The run the automation reads, by name. */
  run: string
  /** The check codes this run feeds. */
  checks: string[]
  state: 'running' | 'queued'
  attempt: number
  retryAt?: string | number | null
  stage?: string | null
  progressPercent?: number | null
  elapsedMs?: number | null
  /** How long the same run took the last time it succeeded; absent without history. */
  usualDurationMs?: number | null
  health?: 'healthy' | 'slow' | 'stuck' | null
  healthReason?: string | null
}

export interface AuditProgress {
  checks: number
  activeChecks: number
  active: AuditProgressRun[]
}

export interface GetAuditProgressResponse extends AuditEnvelope {
  progress?: AuditProgress | null
}

// DAR-UI-086. "Retry from last read" (facade.AuditFacadeServices retry#AuditCheck): the check's failed run of that morning
// runs again from the extracts it read; a refusal arrives as an error, in words.
export interface RetryAuditCheckResponse extends AuditEnvelope {
  submitted?: boolean
  extracts?: { side: string; fileName: string; recordCount: number | null }[]
}

export interface SaveAuditSettingsPayload {
  audit: string
  name?: string
  statements?: Array<{ id: string; text?: string; active?: boolean }>
  schedule?: { active: boolean; time: string; timeZone: string }
}

export type SaveAuditSettingsResponse = GetAuditSettingsResponse

// DAR-UI-078. An audit made in the app, and a statement added to one (saved at once, so a check can be added to it).
export interface CreateAuditPayload {
  name: string
  period: 'day' | 'month' | 'quarter'
}

export interface CreateAuditResponse extends AuditEnvelope {
  audit?: AuditListItem | null
}

export interface AddAuditStatementPayload {
  audit: string
  text: string
  category: string
  weight?: 'firm' | 'derived'
}

export interface AddAuditStatementResponse extends AuditEnvelope {
  statement?: AuditSettingsStatement | null
}

export interface RunAuditPayload {
  audit: string
  /** First day, YYYY-MM-DD. */
  fromDate: string
  /** Last day, YYYY-MM-DD, inclusive. */
  thruDate: string
}

export interface RunAuditResponse extends AuditEnvelope {
  runs?: Array<{ automationId: string | null; savedRunId: string | null; submitted: boolean; error: string | null }>
}

// DAR-BE-123. Resolve: one finding re-checked in the background; get#AuditFinding shows it once lastChecked moves.
export interface VerifyAuditFindingResponse extends AuditEnvelope {
  submitted?: boolean
}
