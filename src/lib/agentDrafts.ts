import type { AuditChangeKind } from './api/agentTypes'

// DAR-UI-109. What the agent's waiting drafts would change, read from the plans their cards already fetched
// (plan#AuditChange: before is the lever as it is, after as the draft would leave it, backtest what it would close).
// The board marks it before anyone approves; nothing here asks the server anything.

/** One waiting draft's plan, as the panel hands it to the board. */
export interface DraftPreview {
  proposalId: string
  kind: AuditChangeKind
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  backtest: Record<string, unknown> | null
}

export interface StatementDraft {
  /** New wording, when the draft rewords it. */
  text?: string
  /** On or off, when the draft switches it. */
  active?: boolean
}

export interface AddedStatement {
  id: string
  text: string
  /** The category the statement is added under (the board's category id); empty when the plan does not say. */
  category: string
}

export interface BoardDrafts {
  /** Existing statements a draft rewords or switches, by statement code. */
  changed: Record<string, StatementDraft>
  /** Statements a draft adds. */
  added: AddedStatement[]
  /** Open findings a draft would close (the backtest's closed finding ids). */
  closing: string[]
}

interface PlanStatement {
  id: string
  text: string
  active: boolean
}

const STATEMENT_KINDS: ReadonlySet<AuditChangeKind> = new Set(['ADD_STATEMENT', 'STATEMENT_EDIT'])

function statementsOf(state: Record<string, unknown> | null): PlanStatement[] {
  const list = state?.statements
  if (!Array.isArray(list)) return []
  return list.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const { id, text, active } = entry as Record<string, unknown>
    return typeof id === 'string' ? [{ id, text: typeof text === 'string' ? text : '', active: active !== false }] : []
  })
}

/** The statements a statement draft changes: before as they are, after as it would leave them, by code. */
export function statementChanges(preview: Pick<DraftPreview, 'kind' | 'before' | 'after'>): { before: PlanStatement[]; after: PlanStatement[] } {
  if (!STATEMENT_KINDS.has(preview.kind)) return { before: [], after: [] }
  const was = new Map(statementsOf(preview.before).map((statement) => [statement.id, statement]))
  const after = statementsOf(preview.after).filter((statement) => {
    const old = was.get(statement.id)
    return !old || old.text !== statement.text || old.active !== statement.active
  })
  return { before: after.flatMap((statement) => was.get(statement.id) ?? []), after }
}

function addedCategory(after: Record<string, unknown> | null): string {
  const add = after?.add
  const category = add && typeof add === 'object' ? (add as Record<string, unknown>).category : null
  return typeof category === 'string' ? category : ''
}

export function boardDrafts(previews: readonly DraftPreview[]): BoardDrafts {
  const drafts: BoardDrafts = { changed: {}, added: [], closing: [] }
  for (const preview of previews) {
    const { before, after } = statementChanges(preview)
    const was = new Map(before.map((statement) => [statement.id, statement]))
    for (const statement of after) {
      const old = was.get(statement.id)
      if (!old) {
        drafts.added.push({ id: statement.id, text: statement.text, category: addedCategory(preview.after) })
        continue
      }
      const change: StatementDraft = { ...drafts.changed[statement.id] }
      if (old.text !== statement.text) change.text = statement.text
      if (old.active !== statement.active) change.active = statement.active
      drafts.changed[statement.id] = change
    }
    const closed = preview.backtest?.closed
    if (Array.isArray(closed)) {
      for (const id of closed) if (typeof id === 'string' && !drafts.closing.includes(id)) drafts.closing.push(id)
    }
  }
  // Each plan numbers its new statement as if it were the only one (every draft reads R{top+1}); the server numbers them
  // in the order they are approved, so show them in that order after the highest code the audit already has.
  const top = Math.max(0, ...previews.flatMap((preview) => statementsOf(preview.before)).map((statement) => statementNumber(statement.id)))
  drafts.added = drafts.added.map((statement, index) => ({ ...statement, id: `R${top + index + 1}` }))
  return drafts
}

function statementNumber(id: string): number {
  const match = /^R(\d+)$/.exec(id)
  return match ? Number(match[1]) : 0
}

/** The mark a changed statement carries on the board: what the draft does to it. */
export function statementDraftTag(change: StatementDraft | undefined): string {
  if (!change) return ''
  const parts = [change.text !== undefined ? 'reworded' : '', change.active === false ? 'off' : change.active === true ? 'on' : '']
  return parts.filter(Boolean).join(', ')
}
