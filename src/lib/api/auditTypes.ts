// DAR-UI-058. The audit run's JSON (darpan.audit.report/v1, darpan.audit.finding/v1) as the backend assembler writes
// it and facade.AuditFacadeServices hands it over unchanged: keyed objects, codes not ids. The contract and every
// key's meaning: darpan-master docs/superpowers/specs/2026-10-21-audit-run-json-contract.md.

export type AuditFindingState = 'open' | 'pending' | 'fixed'
export type AuditCheckStatus = 'ran' | 'partial' | 'notRun'
export type AuditSourceRead = 'complete' | 'partial' | 'failed'
export type AuditCategoryId = 'orders' | 'refundsAndCredits' | 'returns' | 'exchangesAndWarranty'

export interface AuditMoney {
  amount: string
  currency: string
}

export interface AuditMoneySource extends AuditMoney {
  source: string | null
}

/** records.<System>.<recordType>: [{ id, internalId, status }] */
export interface AuditRecord {
  id: string
  internalId: string | null
  status: string | null
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
    extendedThru: string | null
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

export interface SaveAuditSettingsPayload {
  audit: string
  name?: string
  statements?: Array<{ id: string; text?: string; active?: boolean }>
  schedule?: { active: boolean; time: string; timeZone: string }
}

export type SaveAuditSettingsResponse = GetAuditSettingsResponse

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
