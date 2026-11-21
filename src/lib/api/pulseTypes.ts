// DAR-BE-328. Sync pulse (facade.SyncPulseFacadeServices): a pair is one daily check whose upstream side (HotWax) is
// watched for orders still waiting to reach the other system, with an allowance (minutes) before one counts as late.

interface PulseEnvelope {
  ok: boolean
  messages: string[]
  errors: string[]
}

export interface SyncPairSummary {
  syncPairId: string
  label: string
  automationId: string
  automationName: string
  allowanceMinutes: number
  /** Minutes between pulses; null when the pulse is off. */
  pulseEveryMinutes: number | null
  /** 'Y' or 'N'. */
  isActive: string
  lastPulseStamp: string | null
  waitingCount: number
  pastAllowanceCount: number
}

/** The pair as get#SyncPair returns it: allowance and pulse are the effective ones today. */
export interface SyncPair extends SyncPairSummary {
  /** The peak period that overrides allowance or pulse today, when one does. */
  periodName?: string | null
  upstreamSide?: string | null
  chatSpaceId?: string | null
  /** 'Y' or 'N'. */
  hourlySummary?: string | null
}

export interface SyncSample {
  sampleStamp: string
  waitingCount: number
  oldestWaitingMinutes: number | null
  pastAllowanceCount: number
  statusEnumId: string
}

export interface SyncPastOrder {
  recordKey: string
  orderName: string | null
  otherSystemId: string | null
  sourceCreatedStamp: string | null
  waitingMinutes: number
  /** The newest run of the pair's daily check that started after the order went past allowance; null if none yet. */
  reportedInRunId: string | null
}

export interface SyncUpstreamOption {
  /** FILE_1 or FILE_2. */
  upstreamSide: string
  label: string
}

export interface SyncAutomationOption {
  automationId: string
  label: string
  upstreamOptions: SyncUpstreamOption[]
}

export interface SyncChatSpaceOption {
  chatSpaceId: string
  label: string
}

export interface ListSyncPairsResponse extends PulseEnvelope {
  syncPairs: SyncPairSummary[]
}

export interface GetSyncPairResponse extends PulseEnvelope {
  /** Absent when asked without a syncPairId: then only the pickers (automations, chatSpaces) come back. */
  syncPair?: SyncPair | null
  samplesToday: SyncSample[]
  pastOrders: SyncPastOrder[]
  automations: SyncAutomationOption[]
  chatSpaces: SyncChatSpaceOption[]
}

/** No syncPairId creates. Pulse is every 1, 2, 3, 4 or 6 hours (pulseEveryMinutes 60..360), or off. */
export interface SaveSyncPairPayload {
  syncPairId?: string
  automationId: string
  upstreamSide: string
  allowanceMinutes: number
  pulseEveryMinutes?: number | null
  chatSpaceId?: string | null
  hourlySummary?: boolean
  isActive?: boolean
}

export interface SaveSyncPairResponse extends PulseEnvelope {
  syncPairId: string
}

export type DeleteSyncPairResponse = PulseEnvelope

export interface GetRunPulseFlagsResponse extends PulseEnvelope {
  syncPairId?: string | null
  /** recordKey to the ISO stamp the order first went past allowance. */
  flags: Record<string, string>
}
