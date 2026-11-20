// DAR-BE-328. Peak periods (facade.PeakPeriodFacadeServices): a tenant's busy windows, with the run-time moves that
// keep automations and audits out of them. Dates are "YYYY-MM-DD" and times "HH:mm", both in the tenant's time zone.

export type PeakPeriodState = 'upcoming' | 'on' | 'off' | 'ended'

export interface PeakPeriodSummary {
  peakPeriodId: string
  periodName: string
  fromDate: string
  thruDate: string
  /** 'Y' or 'N'. */
  isActive: string
  state: PeakPeriodState
}

export interface PeakPeriod extends PeakPeriodSummary {
  peakHoursStart: string | null
  peakHoursEnd: string | null
  hotwaxReadSharePct: number | null
  /** 'Y' or 'N'. */
  netsuiteSerial: string
  /** The tenant's IANA zone the dates and times are read in. */
  timeZone: string
  createdByUserId: string | null
  lastUpdatedDate: string | number | null
}

/** A run (an automation or an audit) moved to runTime on onDate, or on every day of the period when onDate is null. */
export interface PeakRunTime {
  runTimeId: string
  automationId: string | null
  auditId: string | null
  targetLabel: string
  onDate: string | null
  runTime: string
  /** The target's usual start, when it has a schedule. */
  normalTime: string | null
}

/** A scheduled run that falls inside peak hours and so starts later. */
export interface PeakHeldRun {
  targetLabel: string
  normalTime: string
  startsAt: string
  reason: string
}

/** One run that can be moved: an automation or an audit. */
export interface PeakTarget {
  automationId?: string | null
  auditId?: string | null
  label: string
}

interface PeakEnvelope {
  ok: boolean
  messages: string[]
  errors: string[]
}

export interface ListPeakPeriodsResponse extends PeakEnvelope {
  peakPeriods: PeakPeriodSummary[]
}

export interface GetPeakPeriodResponse extends PeakEnvelope {
  peakPeriod: PeakPeriod
  runTimes: PeakRunTime[]
  heldRuns: PeakHeldRun[]
  targets: PeakTarget[]
}

/** No peakPeriodId creates. isActive left out keeps the stored value. */
export interface SavePeakPeriodPayload {
  peakPeriodId?: string
  periodName?: string
  fromDate?: string
  thruDate?: string
  peakHoursStart?: string
  peakHoursEnd?: string
  /** 1 to 100; null (Normal) clears it. */
  hotwaxReadSharePct?: number | null
  netsuiteSerial?: boolean
  isActive?: boolean
}

export interface SavePeakPeriodResponse extends PeakEnvelope {
  peakPeriodId: string
}

export type DeletePeakPeriodResponse = PeakEnvelope

/** No runTimeId creates. Set automationId or auditId; a blank onDate means every day of the period. */
export interface SavePeakRunTimePayload {
  runTimeId?: string
  peakPeriodId: string
  automationId?: string
  auditId?: string
  onDate?: string
  runTime?: string
}

export interface SavePeakRunTimeResponse extends PeakEnvelope {
  runTimeId: string
}

export type DeletePeakRunTimeResponse = PeakEnvelope
