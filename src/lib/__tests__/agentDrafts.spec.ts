import { describe, expect, it } from 'vitest'
import { boardDrafts, statementDraftTag, type DraftPreview } from '../agentDrafts'

// DAR-UI-109. What waiting drafts would change, read from their plans for the board.

const statement = (id: string, text: string, active = true) => ({ id, text, active, checks: 1, findings: 0 })

function preview(overrides: Partial<DraftPreview>): DraftPreview {
  return { proposalId: 'P1', kind: 'STATEMENT_EDIT', before: null, after: null, backtest: null, ...overrides }
}

describe('boardDrafts', () => {
  it('names only what moved: wording, on/off, or both, never an untouched statement', () => {
    const drafts = boardDrafts([preview({
      before: { statements: [statement('R1', 'One'), statement('R2', 'Two'), statement('R3', 'Three')] },
      after: { statements: [statement('R1', 'One'), statement('R2', 'Two, sooner'), statement('R3', 'Three', false)] },
    })])
    expect(drafts.changed).toEqual({ R2: { text: 'Two, sooner' }, R3: { active: false } })
    expect(drafts.added).toEqual([])
    expect(statementDraftTag(drafts.changed.R2)).toBe('reworded')
    expect(statementDraftTag(drafts.changed.R3)).toBe('off')
    expect(statementDraftTag(undefined)).toBe('')
  })

  it('adds a new statement under the category its plan names', () => {
    const drafts = boardDrafts([preview({ kind: 'ADD_STATEMENT', before: { statements: [statement('R1', 'One')] },
      after: { statements: [statement('R1', 'One'), statement('R2', 'Two')], add: { text: 'Two', category: 'returns' } } })])
    expect(drafts.added).toEqual([{ id: 'R2', text: 'Two', category: 'returns' }])
  })

  it('reads statements only from statement drafts, and collects closed findings once across drafts', () => {
    const drafts = boardDrafts([
      preview({ kind: 'EXPECTED_CAUSES', before: { statements: [] }, after: { statements: [statement('R9', 'Not a statement draft')] },
        backtest: { closed: ['F-1', 'F-2'] } }),
      preview({ proposalId: 'P2', kind: 'CONCLUSION_ROWS', backtest: { closed: ['F-2', 3, 'F-3'] } }),
    ])
    expect(drafts.added).toEqual([])
    expect(drafts.closing).toEqual(['F-1', 'F-2', 'F-3'])
  })

  it('tolerates a plan with no statements or a malformed one', () => {
    expect(boardDrafts([preview({ before: { statements: 'x' }, after: { statements: [null, { text: 'no id' }] } })]))
      .toEqual({ changed: {}, added: [], closing: [] })
  })
})
