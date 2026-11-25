// DAR-UI-058. The audit run's JSON (darpan.audit.report/v1, darpan.audit.finding/v1) as the backend assembler writes
// it and facade.AuditFacadeServices hands it over unchanged: keyed objects, codes not ids. The contract and every
// key's meaning: darpan-master docs/superpowers/specs/2026-10-21-audit-run-json-contract.md.

export type AuditFindingState = 'open' | 'fixed'
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
  /** DAR-BE-360. The record's payment status in its system's words (Paid, Settled, Refunded, Fully Applied). */
  paymentStatus?: string | null
  deposits?: { id: string; amount: string | null; status: string | null }[]
  /** DAR-UI-081. A return held behind another: the return holding it, and its exchange order (netsuiteId null: not there). */
  heldBy?: { id: string; status: string | null }
  exchange?: { id: string; netsuiteId: string | null }
  /** DAR-BE-368. An order's lines as its read gave them; id is the Shopify line id on both Shopify and HotWax. */
  lines?: AuditRecordLine[]
  data?: Record<string, unknown>
}
export interface AuditRecordLine {
  id: string | null
  sku: string | null
  name: string | null
  quantity: number | string | null
  status: string | null
}
export type AuditRecords = Record<string, Record<string, AuditRecord[]>>

// DAR-UI-140 (DAR-BE-348). How soon a broken statement must be fixed, in urgency order; KNOWN is owned, not urgent.
export type AuditLevel = 'P0' | 'P1' | 'P2' | 'KNOWN'
export const AUDIT_LEVELS: readonly AuditLevel[] = ['P0', 'P1', 'P2', 'KNOWN']
export const LEVEL_LABEL: Record<AuditLevel, string> = { P0: 'P0', P1: 'P1', P2: 'P2', KNOWN: 'Known' }
export const LEVEL_WORD: Record<AuditLevel, string> = { P0: 'today', P1: 'this week', P2: 'later', KNOWN: 'owned' }

export interface AuditFindingCounts {
  open: number
  newToday: number
  fixedToday: number
  /** DAR-BE-348. Open findings by level; absent on reports before it. */
  byPriority?: Record<AuditLevel, number>
  /** DAR-UI-144. Rows a person acknowledged; open and byPriority exclude them. Absent on older reports. */
  acknowledged?: number
}

/** DAR-UI-144. A row taken with a note; reminded once remindOn has passed and the row reads open again. */
export interface AuditAcknowledgement {
  note: string
  by: { id: string; label: string | null }
  at: string
  remindOn: string | null
  reminded: boolean
}

/** DAR-UI-144. A note sent to Darpan about a finding group. */
export interface AuditFeedbackNote {
  feedbackId: string
  note: string
  sentAt: string
  by: { id: string; label: string | null }
  record: string | null
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
  /** DAR-UI-099. Every line of the order, in line order: those with a finding (finding, cause, state) and those without, as
   *  the run read them; then lines only another system has with no line of its own (NetSuite's store-credit payment). */
  orderLines?: AuditOrderLine[]
  /** DAR-BE-250. Earliest step wins: the later steps' findings on the same order, listed here and not counted there.
   *  Absent when nothing waits. */
  waiting?: AuditWaitingFinding[]
  /** DAR-BE-348. The unit's level, where it came from (its statement or its cause) and the cause's name when
   *  prioritySource is 'reason'. priorityLine: an order unit's level line. All absent on reports before it. */
  priority?: AuditLevel
  /** DAR-UI-144. Null or absent when the row is open. */
  acknowledgement?: AuditAcknowledgement | null
  prioritySource?: 'statement' | 'reason'
  priorityReason?: string | null
  priorityLine?: string
}

/**
 * DAR-BE-250. A finding on an order an earlier step already reports: its statement, id, headline and cause. DAR-BE-254:
 * item names what it is about (the SKU, or the line when the record has none), so the row reads as the thing, not a code.
 */
export interface AuditWaitingFinding {
  statement: string
  id: string
  headline: string
  cause: string | null
  item?: string | null
  /** DAR-BE-348. Its own level. */
  priority?: AuditLevel
}

/** DAR-UI-099. One line of an order finding's order. */
export interface AuditOrderLine {
  /** "2" for item M1132010/02; absent on a line only another system has. */
  line?: string
  item: string
  sku?: string
  status?: string
  /** Units the read held of the line, when more than its finding shows. */
  quantity?: number
  /** The check's filter set it aside (e.g. an item not yet completed): read, not checked. */
  setAside?: boolean
  /** The line's finding id; absent when the line has none. */
  finding?: string
  cause?: string | null
  state?: AuditFindingState
  /** The system of a line only it has (NetSuite), with its item type and amount. */
  system?: string
  itemType?: string
  /** A NetSuite line carries no currency of its own, so currency may be null. */
  amount?: { amount: string; currency: string | null }
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
  /** DAR-BE-250. The statement's place in the order's story (sequenceNum); absent on reports before it. */
  step?: number | null
  /** DAR-BE-250. Its findings on orders an earlier step already reports: listed under that finding, not counted here. */
  waiting?: number
  /** DAR-BE-348. The statement's level; absent on reports before it. */
  priority?: AuditLevel
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
    /** DAR-UI-144. Days before an acknowledged row is raised again. */
    acknowledgeRemindDays?: number
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
    /** DAR-BE-348. */
    priority?: { level: AuditLevel; source: 'statement' | 'reason'; reason: string | null }
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
    /** DAR-UI-144. */
    acknowledgement?: AuditAcknowledgement | null
    feedback?: { recentCount: number }
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

// DAR-UI-075. Every open finding of an audit and period, one per order (get#AuditFindingsByOrder).
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

/** DAR-BE-348. A cause under a statement: its own level (null: the statement's), and whether fixing it closes the finding. */
export interface AuditSettingsReason {
  conclusion: string
  label: string
  priority: AuditLevel | null
  closes: 'all' | 'some' | 'none'
  closesOn: number
  checks: number
}

export interface AuditSettingsStatement {
  id: string
  code: string
  text: string
  active: boolean
  checks: AuditSettingsCheck[]
  priority?: AuditLevel
  reasons?: AuditSettingsReason[]
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

// DAR-BE-207. The email after each run: to everyone with access to the tenant (Darpan admins included), plus alsoSendTo.
export interface RunEmailSettings {
  active: boolean
  /** Addresses beyond the members: group mailboxes, people without an account. */
  alsoSendTo: string[]
  /** How many people with access it goes to, Darpan admins included; read only. */
  members: number
  /** Of those, how many are Darpan admins; absent on older backends. */
  admins?: number
  /** False: the viewer may not change it (not a tenant admin); absent on older backends means true. */
  canEdit?: boolean
  chatSpaceId: string | null
}

export interface AuditSettings {
  audit: { id: string; name: string; period: string | null }
  /** The earliest day a play can record today, YYYY-MM-DD. */
  playableFrom?: string | null
  /** DAR-BE-328. When peak hours end, an ISO instant; present only while now is inside them. */
  peakHoursUntil?: string | null
  schedule: AuditSchedule
  /** Absent from a backend before DAR-BE-207; the page then shows no email section. */
  runEmail?: RunEmailSettings | null
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
  /** DAR-BE-173. The run's steps in run order; both extracts run at once when the sides are read in parallel. */
  steps?: AuditProgressStep[] | null
  /** DAR-BE-350. A peak period's limits on the tenant's reads; absent outside one. */
  limits?: { hotwaxSharePct?: number | null; netsuiteSerial?: boolean } | null
}

/** DAR-BE-173. One step of a running run (AuditSettingsSupport.steps). */
export interface AuditProgressStep {
  /** The run stage code: EXTRACT_FILE1, EXTRACT_FILE2, COMPARE, ... */
  stage: string
  /** running, done or failed; any other backend status arrives lower-cased. */
  status: string
  /** Records so far; while an extract runs, its page heartbeat. */
  records?: number | null
  startedDate?: string | number | null
  completedDate?: string | number | null
  /** An extract's system, as its source is labelled; absent on other stages. */
  system?: string | null
  /** DAR-BE-350. A read's last page heartbeat (server time); absent for a read that never heartbeats. */
  movedDate?: string | number | null
  /** DAR-BE-350. The page count the same read heartbeated on its automation's last success; absent without one. */
  expectedRecords?: number | null
}

export interface AuditProgress {
  checks: number
  /** DAR-BE-350. Server time of the answer: "moved N ago" is asOf minus a step's movedDate, no client clock. */
  asOf?: string | number | null
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
  statements?: Array<{ id: string; text?: string; active?: boolean; priority?: AuditLevel | null }>
  /** DAR-BE-348. A reason's own level; null clears it back to the statement's. */
  reasons?: Array<{ statement: string; conclusion: string; priority: AuditLevel | null }>
  schedule?: { active: boolean; time: string; timeZone: string }
  /** Omitted: no change. */
  runEmail?: Omit<RunEmailSettings, 'members' | 'admins' | 'canEdit'>
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

// DAR-BE-369. Re-check all: every open finding of a statement (or of the audit) re-checked in the background, one run per
// automation; get#AuditRecheckProgress counts the ones checked since checkedSince.
export interface VerifyAuditFindingsResponse extends AuditEnvelope {
  findings?: number
  runs?: number
  skipped?: number
  checkedSince?: string
}

export interface GetAuditRecheckProgressResponse extends AuditEnvelope {
  checked?: number
  closed?: number
}
