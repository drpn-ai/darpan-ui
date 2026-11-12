// DAR-BE-159 / DAR-BE-223. The embedded agent's panel (facade.AgentTurnFacadeServices, in the darpan-agent component)
// and the drafted changes it proposes (facade.AgentChangeFacadeServices). The tenant is always the session's active
// tenant; no call names one. A draft changes nothing until a person who may save the audit's checks plans and applies it.

/** Whether the agent can run for the person now. */
export type AgentState = 'ON' | 'AGENT_OFF' | 'AGENT_UNAVAILABLE' | 'AGENT_REFUSED'

/** The person's AI access in the active tenant. */
export type AgentGrantState = 'LIVE' | 'NOT_GRANTED' | 'EXPIRED' | 'PAUSED'

/** How a turn ended. */
export type AgentTurnOutcome =
  | 'AGENT_OFF'
  | 'AGENT_UNAVAILABLE'
  | 'RATE_LIMITED'
  | 'OVER_BUDGET'
  | 'DECLINED'
  | 'QUESTION'
  | 'DONE'
  | 'INCOMPLETE'
  | 'TENANT_CHANGED'
  | 'ERROR'

export type AuditChangeKind =
  | 'EXCLUSION_FILTER'
  | 'STATEMENT_NARROWING'
  | 'EXPECTED_CAUSES'
  | 'FIX_TEXT'
  | 'CONCLUSION_ROWS'
  | 'AUDIT_SETTINGS'
  | 'ADD_STATEMENT'
  | 'ADD_CHECK'

/** A drafted change as the panel lists it; status moves DRAFT -> PLANNED -> APPLIED (or REJECTED, STALE, INVALID, REVERTED). */
export interface AgentProposal {
  proposalId: string
  kind: AuditChangeKind
  status: string
  statusMessage: string | null
  provenanceStatus: string | null
  /** Identifiers the proposal names that nothing the person said or the agent read supports. */
  blockedIds: string[] | null
  backtest: Record<string, unknown> | null
}

export interface AgentTicket {
  ticketId: string
  category: string
  duplicate: boolean
}

/** A question the agent needs the person to answer before it can go on. */
export interface AgentQuestion {
  text: string
  options: string[] | null
  from: string | null
}

export interface GetAgentStatusResponse {
  state: AgentState
  grantState: AgentGrantState
  /** True only for someone allowed to save the audit's checks, so allowed to approve a draft. */
  canApprove: boolean
}

export interface SendAgentTurnPayload {
  /** Continue this conversation; leave it out to start one. */
  conversationId?: string
  /** The audit's row id; or name it by auditCode. Exactly one of the two. */
  auditId?: string
  /** The audit's code (the report's audit id, e.g. month-close), looked up in the active tenant. */
  auditCode?: string
  /** The finding the panel is open on. */
  findingId?: string
  text: string
}

export interface SendAgentTurnResponse {
  conversationId: string
  outcome: AgentTurnOutcome
  reply: string | null
  proposals: AgentProposal[] | null
  tickets: AgentTicket[] | null
  question: AgentQuestion | null
  /** The kinds of secret or personal data masked in the text, never the values. */
  masked: string[] | null
}

export interface AgentMessage {
  messageId: string
  kind: 'USER' | 'ASSISTANT'
  text: string
  question: AgentQuestion | null
}

export interface GetAgentConversationResponse {
  auditId: string | null
  findingId: string | null
  messages: AgentMessage[]
  proposals: AgentProposal[]
}

export interface PlanAuditChangeResponse {
  planHash: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  backtest: Record<string, unknown> | null
  status: string
  statusMessage: string | null
}

export interface ApplyAuditChangeResponse {
  appliedVersionId: string | null
  status: string
  statusMessage: string | null
}

export interface RejectAuditChangeResponse {
  status: string
}

export interface RevertAuditChangeResponse {
  /** The revert is itself a proposal, planned and waiting for approval. */
  newProposalId: string | null
  status: string
  statusMessage: string | null
  planHash: string | null
}
