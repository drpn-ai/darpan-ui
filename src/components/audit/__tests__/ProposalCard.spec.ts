import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import type { AgentProposal } from '../../../lib/api/agentTypes'

// DAR-UI-105. A drafted change in the agent thread: what it changes, what the backtest found and where it came from; a
// person who may save the audit's checks approves exactly the plan they saw.

const planAuditChange = vi.hoisted(() => vi.fn())
const applyAuditChange = vi.hoisted(() => vi.fn())
const rejectAuditChange = vi.hoisted(() => vi.fn())
const revertAuditChange = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  agentFacade: { planAuditChange, applyAuditChange, rejectAuditChange, revertAuditChange },
}))

import ProposalCard from '../ProposalCard.vue'

function proposal(overrides: Partial<AgentProposal> = {}): AgentProposal {
  return {
    proposalId: 'P1',
    kind: 'EXCLUSION_FILTER',
    status: 'DRAFT',
    statusMessage: null,
    provenanceStatus: 'SUPPORTED',
    blockedIds: null,
    backtest: null,
    ...overrides,
  }
}

const PLAN = {
  planHash: 'H1',
  before: { excludes: 'none' },
  after: { excludes: 'orders tagged wholesale' },
  backtest: { findingsBefore: 12, findingsAfter: 9 },
  status: 'PLANNED',
  statusMessage: null,
}

function mountCard(props: Record<string, unknown> = {}) {
  return mount(ProposalCard, { props: { proposal: proposal(), canApprove: true, ...props } })
}

describe('ProposalCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    planAuditChange.mockResolvedValue(PLAN)
  })

  // DAR-UI-109 / DAR-BE-242. A statement draft's plan holds every statement of the audit; the card names only what moves.
  it('shows only the statement a statement change moves, and hands its plan to the board', async () => {
    const statements = (r2: string, active: boolean) => [{ id: 'R1', text: 'Every order is invoiced.', active: true, checks: 1, findings: 0 },
      { id: 'R2', text: r2, active, checks: 1, findings: 4 }]
    const plan = { ...PLAN, before: { audit: 'month-close', statements: statements('Returns are received.', true) },
      after: { audit: 'month-close', statements: statements('Returns are received within 5 days.', false) }, backtest: null }
    planAuditChange.mockResolvedValueOnce(plan)
    const wrapper = mountCard({ proposal: proposal({ kind: 'STATEMENT_EDIT' }) })
    await flushPromises()
    expect(wrapper.text()).toContain('Statement change')
    expect(wrapper.get('[data-testid="proposal-before"] dd').text()).toBe('R2: Returns are received.')
    expect(wrapper.get('[data-testid="proposal-after"] dd').text()).toBe('R2: Returns are received within 5 days. (off)')
    expect(wrapper.emitted('planned')).toEqual([[{ proposalId: 'P1', plan }]])
  })

  // DAR-UI-117. A new statement's code is known only once approved, and a backtest that cannot apply has nothing to show.
  it('shows a new statement as its sentence alone, with no backtest when none applies', async () => {
    const plan = { ...PLAN, before: { audit: 'daily-close', statements: [] },
      after: { audit: 'daily-close', statements: [{ id: 'R1', text: 'Every exchange Shopify makes is in NetSuite.', active: true, checks: 0, findings: 0 }],
        add: { text: 'Every exchange Shopify makes is in NetSuite.', category: 'exchangesAndWarranty' } },
      backtest: { supported: false, reason: 'NOT_APPLICABLE', basisExecutionId: null, closed: [], opened: [], unchanged: 0, limits: [] } }
    planAuditChange.mockResolvedValueOnce(plan)
    const wrapper = mountCard({ proposal: proposal({ kind: 'ADD_STATEMENT' }) })
    await flushPromises()
    expect(wrapper.get('[data-testid="proposal-after"] dd').text()).toBe('Every exchange Shopify makes is in NetSuite.')
    expect(wrapper.find('[data-testid="proposal-backtest"]').exists()).toBe(false)
  })

  // DAR-UI-117. A new check and a schedule say what they mean, never the plan's raw state map.
  it('shows a new check as its statement and name, and a schedule as when it runs', async () => {
    planAuditChange.mockResolvedValueOnce({ ...PLAN, before: { audit: 'o2c', checks: [] }, backtest: null,
      after: { audit: 'o2c', checks: [{ id: 'x', savedRunId: 'RS_1' }], add: { id: 'x', label: 'Shopify vs HotWax payments', savedRunId: 'RS_1', statementCode: 'R2', diffTypes: [] } } })
    const check = mountCard({ proposal: proposal({ kind: 'ADD_CHECK' }) })
    await flushPromises()
    expect(check.get('[data-testid="proposal-after"] dd').text()).toBe('R2: Shopify vs HotWax payments (reads RS_1)')
    planAuditChange.mockResolvedValueOnce({ ...PLAN, backtest: null,
      before: { schedule: { active: false, time: '06:00', timeZone: 'America/New_York' }, automations: [] },
      after: { schedule: { active: true, time: '06:00', timeZone: 'America/New_York' }, automations: [] } })
    const settings = mountCard({ proposal: proposal({ proposalId: 'P2', kind: 'AUDIT_SETTINGS' }) })
    await flushPromises()
    expect(settings.get('[data-testid="proposal-before"] dd').text()).toBe('Off (06:00, America/New_York)')
    expect(settings.get('[data-testid="proposal-after"] dd').text()).toBe('Every day at 06:00, America/New_York')
  })

  // DAR-UI-117. Approving one of several drafts moves the audit; the others plan again before anyone presses Approve.
  it('plans again when another card was applied, only while it is open', async () => {
    const wrapper = mountCard({ replanKey: 0 })
    await flushPromises()
    expect(planAuditChange).toHaveBeenCalledTimes(1)
    await wrapper.setProps({ replanKey: 1 })
    await flushPromises()
    expect(planAuditChange).toHaveBeenCalledTimes(2)
    const applied = mountCard({ proposal: proposal({ status: 'APPLIED' }), replanKey: 0 })
    await flushPromises()
    await applied.setProps({ replanKey: 1 })
    await flushPromises()
    expect(planAuditChange).toHaveBeenCalledTimes(2)
  })

  it('plans an open proposal and shows before, after, the backtest and where it came from', async () => {
    const wrapper = mountCard({ proposal: proposal({ blockedIds: ['F-99'] }) })
    await flushPromises()

    expect(planAuditChange).toHaveBeenCalledWith({ proposalId: 'P1' }, expect.any(AbortSignal))
    expect(wrapper.get('[data-testid="proposal-before"]').text()).toContain('none')
    expect(wrapper.get('[data-testid="proposal-after"]').text()).toContain('orders tagged wholesale')
    expect(wrapper.get('[data-testid="proposal-backtest"]').text()).toContain('findingsAfter')
    expect(wrapper.get('[data-testid="proposal-provenance"]').text()).toContain('F-99')
  })

  it('approves with the hash of the plan shown', async () => {
    applyAuditChange.mockResolvedValueOnce({ appliedVersionId: 'V7', status: 'APPLIED', statusMessage: null })
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.get('[data-testid="proposal-approve"]').trigger('click')
    await flushPromises()

    expect(applyAuditChange).toHaveBeenCalledWith({ proposalId: 'P1', planHash: 'H1' }, expect.any(AbortSignal))
    expect(wrapper.get('[data-testid="proposal-status"]').text()).toContain('Applied')
    expect(wrapper.emitted('changed')?.at(-1)).toEqual([{ proposalId: 'P1', status: 'APPLIED' }])
  })

  it('plans again when the audit changed since the plan, and approves nothing', async () => {
    applyAuditChange.mockResolvedValueOnce({ appliedVersionId: null, status: 'STALE', statusMessage: 'The audit changed since this plan.' })
    planAuditChange.mockResolvedValueOnce(PLAN).mockResolvedValueOnce({ ...PLAN, planHash: 'H2', after: { excludes: 'orders tagged b2b' } })
    const wrapper = mountCard()
    await flushPromises()

    await wrapper.get('[data-testid="proposal-approve"]').trigger('click')
    await flushPromises()

    expect(planAuditChange).toHaveBeenCalledTimes(2)
    expect(wrapper.get('[data-testid="proposal-after"]').text()).toContain('orders tagged b2b')
    expect(wrapper.get('[data-testid="proposal-note"]').text()).toContain('The audit changed since this plan.')

    applyAuditChange.mockResolvedValueOnce({ appliedVersionId: 'V8', status: 'APPLIED', statusMessage: null })
    await wrapper.get('[data-testid="proposal-approve"]').trigger('click')
    await flushPromises()
    expect(applyAuditChange).toHaveBeenLastCalledWith({ proposalId: 'P1', planHash: 'H2' }, expect.any(AbortSignal))
  })

  it('shows a viewer the card with no buttons', async () => {
    const wrapper = mountCard({ canApprove: false })
    await flushPromises()
    expect(wrapper.find('[data-testid="proposal-after"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="proposal-approve"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="proposal-reject"]').exists()).toBe(false)

    const applied = mountCard({ canApprove: false, proposal: proposal({ status: 'APPLIED' }) })
    await flushPromises()
    expect(applied.find('[data-testid="proposal-revert"]').exists()).toBe(false)
  })

  it('rejects an open proposal', async () => {
    rejectAuditChange.mockResolvedValueOnce({ status: 'REJECTED' })
    const wrapper = mountCard()
    await flushPromises()
    await wrapper.get('[data-testid="proposal-reject"]').trigger('click')
    await flushPromises()
    expect(rejectAuditChange).toHaveBeenCalledWith({ proposalId: 'P1' }, expect.any(AbortSignal))
    expect(wrapper.find('[data-testid="proposal-approve"]').exists()).toBe(false)
  })

  it('offers Revert on an applied card, and the revert arrives as a new proposal', async () => {
    revertAuditChange.mockResolvedValueOnce({ newProposalId: 'P2', status: 'PLANNED', statusMessage: null, planHash: 'H9' })
    const wrapper = mountCard({ proposal: proposal({ status: 'APPLIED' }) })
    await flushPromises()

    expect(planAuditChange).not.toHaveBeenCalled()
    expect(wrapper.find('[data-testid="proposal-approve"]').exists()).toBe(false)
    await wrapper.get('[data-testid="proposal-revert"]').trigger('click')
    await flushPromises()

    expect(revertAuditChange).toHaveBeenCalledWith({ proposalId: 'P1' }, expect.any(AbortSignal))
    expect(wrapper.emitted('reverted')?.[0]?.[0]).toMatchObject({ proposalId: 'P2', kind: 'EXCLUSION_FILTER', status: 'PLANNED' })
  })

  it('says why an approval was refused', async () => {
    applyAuditChange.mockRejectedValueOnce(new ApiCallError('You cannot save this audit\'s checks.', 200))
    const wrapper = mountCard()
    await flushPromises()
    await wrapper.get('[data-testid="proposal-approve"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('[data-testid="proposal-error"]').text()).toContain('You cannot save this audit\'s checks.')
  })
})
