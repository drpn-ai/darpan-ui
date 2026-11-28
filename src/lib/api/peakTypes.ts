// DAR-BE-328. Peak periods (facade.PeakPeriodFacadeServices): a tenant's busy windows, with the run-time moves that
// keep automations and audits out of them. Dates are "YYYY-MM-DD" and times "HH:mm", both in the tenant's time zone.
import type { ApiEnvelope } from './types'

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

/** A sync pair's allowance and pulse, normal and during this period. A null period value means no override. */
export interface PeakSyncRow {
  syncPairId: string
  label: string
  normalAllowanceMinutes: number
  periodAllowanceMinutes: number | null
  normalPulseMinutes: number | null
  periodPulseMinutes: number | null
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

export interface ListPeakPeriodsResponse extends ApiEnvelope {
  peakPeriods: PeakPeriodSummary[]
}

export interface GetPeakPeriodResponse extends ApiEnvelope {
  peakPeriod: PeakPeriod
  runTimes: PeakRunTime[]
  heldRuns: PeakHeldRun[]
  targets: PeakTarget[]
  /** One row for every active sync pair of the tenant. */
  syncRows: PeakSyncRow[]
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

export interface SavePeakPeriodResponse extends ApiEnvelope {
  peakPeriodId: string
}

export type DeletePeakPeriodResponse = ApiEnvelope

/** No runTimeId creates. Set automationId or auditId; a blank onDate means every day of the period. */
export interface SavePeakRunTimePayload {
  runTimeId?: string
  peakPeriodId: string
  automationId?: string
  auditId?: string
  onDate?: string
  runTime?: string
}

export interface SavePeakRunTimeResponse extends ApiEnvelope {
  runTimeId: string
}

export type DeletePeakRunTimeResponse = ApiEnvelope

/** Sets the pair's override for the period; a blank value clears that part. */
export interface SavePeakSyncPayload {
  peakPeriodId: string
  syncPairId: string
  allowanceMinutes?: number | null
  pulseEveryMinutes?: number | null
}

export type SavePeakSyncResponse = ApiEnvelope
export type DeletePeakSyncResponse = ApiEnvelope
