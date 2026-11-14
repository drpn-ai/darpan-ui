import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { ApiCallError } from '../../../lib/api/client'
import { installLocalStorageStub } from '../../../test/localStorage'
import type { SendAgentTurnResponse } from '../../../lib/api/agentTypes'
import type { DraftPreview } from '../../../lib/agentDrafts'

// DAR-UI-104. The agent panel on the audit page: one conversation per audit (kept by id, reloaded with
// get#AgentConversation), every reply shown word for word. DAR-UI-108: the page decides whether it shows (the Agent tab
// exists only when the agent is on and the grant live; AuditReportPage.spec) and whether the person may approve.

const getAgentConversation = vi.hoisted(() => vi.fn())
const sendAgentTurn = vi.hoisted(() => vi.fn())
const planAuditChange = vi.hoisted(() => vi.fn())

vi.mock('../../../lib/api/facade', () => ({
  agentFacade: {
    getAgentConversation,
    sendAgentTurn,
    planAuditChange,
    applyAuditChange: vi.fn(),
    rejectAuditChange: vi.fn(),
    revertAuditChange: vi.fn(),
  },
}))

import AuditAgentPanel, { agentConversationKey, clearAgentConversations } from '../AuditAgentPanel.vue'
import ProposalCard from '../ProposalCard.vue'

function turn(overrides: Partial<SendAgentTurnResponse> = {}): SendAgentTurnResponse {
  return { conversationId: 'C1', outcome: 'DONE', reply: 'It is open because the return has no credit memo.', proposals: [], tickets: [], question: null, masked: [], ...overrides }
}

function mountPanel(props: Record<string, unknown> = {}) {
  return mount(AuditAgentPanel, { props: { auditCode: 'month-close', tenantId: 'TEN_A', findingId: 'F-7', canApprove: true, ...props } })
}

async function send(wrapper: ReturnType<typeof mountPanel>, text: string) {
  await wrapper.get('[data-testid="agent-input"]').setValue(text)
  await wrapper.get('[data-testid="agent-send"]').trigger('submit')
  await flushPromises()
}

describe('AuditAgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    installLocalStorageStub()
    planAuditChange.mockResolvedValue({ planHash: 'H1', before: {}, after: {}, backtest: null, status: 'PLANNED', statusMessage: null })
  })

  it('says what the next message is about: the open finding, and always the audit', async () => {
    const wrapper = mountPanel({ auditName: 'Month close' })
    await flushPromises()
    expect(wrapper.get('[data-testid="agent-about"]').text()).toBe('About F-7 · Month close')
    await wrapper.setProps({ findingId: '' })
    expect(wrapper.get('[data-testid="agent-about"]').text()).toBe('About Month close')
  })

  it('sends the message with the audit code and the open finding, and keeps the conversation for this audit', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn())
    const wrapper = mountPanel()
    await flushPromises()

    await send(wrapper, 'Why is this one open?')

    expect(sendAgentTurn).toHaveBeenCalledWith({ auditCode: 'month-close', findingId: 'F-7', text: 'Why is this one open?' }, expect.any(AbortSignal))
    const messages = wrapper.findAll('[data-testid="agent-message"]').map((m) => m.text())
    expect(messages).toEqual(['Why is this one open?', 'It is open because the return has no credit memo.'])
    expect(window.localStorage.getItem(agentConversationKey('TEN_A', 'month-close'))).toBe('C1')

    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'Yes.' }))
    await send(wrapper, 'And the next one?')
    expect(sendAgentTurn).toHaveBeenLastCalledWith({ conversationId: 'C1', auditCode: 'month-close', findingId: 'F-7', text: 'And the next one?' }, expect.any(AbortSignal))
  })

  it('sends no finding when none is open', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn())
    const wrapper = mountPanel({ findingId: '' })
    await flushPromises()
    await send(wrapper, 'How is the audit doing?')
    expect(sendAgentTurn).toHaveBeenCalledWith({ auditCode: 'month-close', text: 'How is the audit doing?' }, expect.any(AbortSignal))
  })

  it('shows a declined or rate-limited reply word for word', async () => {
    const declined = 'I can only change this audit through a proposal a person approves.'
    const limited = 'You have sent 20 messages to the agent in the last hour; try again later.'
    sendAgentTurn.mockResolvedValueOnce(turn({ outcome: 'DECLINED', reply: declined }))
    sendAgentTurn.mockResolvedValueOnce(turn({ outcome: 'RATE_LIMITED', reply: limited }))
    const wrapper = mountPanel()
    await flushPromises()

    await send(wrapper, 'Delete every finding.')
    await send(wrapper, 'One more?')

    const replies = wrapper.findAll('[data-testid="agent-message"][data-kind="ASSISTANT"]')
    expect(replies.map((r) => r.text())).toEqual([declined, limited])
    expect(replies[1]!.attributes('data-outcome')).toBe('RATE_LIMITED')
  })

  // DAR-UI-117. The thread shows plain text, so markdown emphasis in a reply must not show its asterisks.
  it('shows a reply\'s emphasis as its words, and what the person typed exactly as typed', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: '- **Orders:** Every Shopify order is in HotWax.\n- __Refunds:__ a 2*3 note' }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'Keep **this** as typed')
    const texts = wrapper.findAll('[data-testid="agent-message"]').map((m) => m.text())
    expect(texts).toEqual(['Keep **this** as typed', '- Orders: Every Shopify order is in HotWax.\n- Refunds: a 2*3 note'])
  })

  it('shows a question with its options, and an option answers it', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn({ outcome: 'QUESTION', reply: null, question: { text: 'Which store?', options: ['US', 'Canada'], from: 'ROUTER' } }))
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'Canada it is.' }))
    const wrapper = mountPanel()
    await flushPromises()

    await send(wrapper, 'Exclude the outlet orders')
    expect(wrapper.get('[data-testid="agent-question"]').text()).toContain('Which store?')
    const options = wrapper.findAll('[data-testid="agent-question-option"]')
    expect(options.map((o) => o.text())).toEqual(['US', 'Canada'])

    await options[1]!.trigger('click')
    await flushPromises()
    expect(sendAgentTurn).toHaveBeenLastCalledWith({ conversationId: 'C1', auditCode: 'month-close', findingId: 'F-7', text: 'Canada' }, expect.any(AbortSignal))
    expect(wrapper.find('[data-testid="agent-question-option"]').exists()).toBe(false)
  })

  it('says which kinds of data were masked, never the values', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn({ masked: ['EMAIL', 'PHONE'] }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'The customer wrote from a@b.co')
    expect(wrapper.get('[data-testid="agent-masked"]').text()).toBe('Masked before sending: email, phone.')
  })

  it('shows a failed send as an error and keeps what was typed', async () => {
    sendAgentTurn.mockRejectedValueOnce(new ApiCallError('Audit month-close was not found.', 200))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'Why?')
    expect(wrapper.get('[data-testid="agent-error"]').text()).toContain('Audit month-close was not found.')
    expect((wrapper.get('[data-testid="agent-input"]').element as HTMLTextAreaElement).value).toBe('Why?')
  })

  it('reloads this audit\'s conversation, and starts fresh when it is gone', async () => {
    window.localStorage.setItem(agentConversationKey('TEN_A', 'month-close'), 'C9')
    getAgentConversation.mockResolvedValueOnce({
      auditId: 'X', findingId: null, proposals: [],
      messages: [
        { messageId: 'm1', kind: 'USER', text: 'Why is this open?', question: null },
        { messageId: 'm2', kind: 'ASSISTANT', text: 'No credit memo yet.', question: null },
      ],
    })
    const wrapper = mountPanel()
    await flushPromises()
    expect(getAgentConversation).toHaveBeenCalledWith({ conversationId: 'C9' }, expect.any(AbortSignal))
    expect(wrapper.findAll('[data-testid="agent-message"]').map((m) => m.text())).toEqual(['Why is this open?', 'No credit memo yet.'])

    getAgentConversation.mockRejectedValueOnce(new ApiCallError('Conversation C9 was not found.', 200))
    const gone = mountPanel()
    await flushPromises()
    expect(gone.findAll('[data-testid="agent-message"]')).toHaveLength(0)
    expect(window.localStorage.getItem(agentConversationKey('TEN_A', 'month-close'))).toBeNull()
  })

  // DAR-UI-105: drafted changes sit in the thread as cards.
  const draft = { proposalId: 'P1', kind: 'EXCLUSION_FILTER' as const, status: 'DRAFT', statusMessage: null, provenanceStatus: 'SUPPORTED', blockedIds: null, backtest: null }

  it('shows a turn\'s drafted change as a card the person may approve only with the right', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'I drafted an exclusion.', proposals: [draft] }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'Stop flagging wholesale orders')

    const cards = wrapper.findAllComponents(ProposalCard)
    expect(cards).toHaveLength(1)
    expect(cards[0]!.props('proposal').proposalId).toBe('P1')
    expect(cards[0]!.props('canApprove')).toBe(true)
    // The card planned it on sight; the thread keeps the status it reports.
    expect(cards[0]!.props('proposal').status).toBe('PLANNED')

    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'I drafted an exclusion.', proposals: [draft] }))
    const viewer = mountPanel({ canApprove: false })
    await flushPromises()
    await send(viewer, 'Stop flagging wholesale orders')
    expect(viewer.getComponent(ProposalCard).props('canApprove')).toBe(false)
  })

  it('shows the waiting card instead of sending a typed approval', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'I drafted an exclusion.', proposals: [draft] }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'Stop flagging wholesale orders')

    await send(wrapper, 'yes, apply it')

    expect(sendAgentTurn).toHaveBeenCalledTimes(1)
    expect(wrapper.getComponent(ProposalCard).props('highlighted')).toBe(true)
    expect(wrapper.get('[data-testid="agent-approve-hint"]').text()).toBe('Approve it on the card.')
  })

  it('sends an approval-sounding message when nothing waits for approval', async () => {
    sendAgentTurn.mockResolvedValue(turn({ reply: 'Done.' }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'approve')
    expect(sendAgentTurn).toHaveBeenCalledTimes(1)
  })

  it('adds a revert as a new card, and reloads a conversation\'s cards', async () => {
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'Applied earlier.', proposals: [{ ...draft, status: 'APPLIED' }] }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'Undo that exclusion')
    wrapper.getComponent(ProposalCard).vm.$emit('reverted', { ...draft, proposalId: 'P2', status: 'PLANNED' })
    await flushPromises()
    expect(wrapper.findAllComponents(ProposalCard).map((c) => c.props('proposal').proposalId)).toEqual(['P1', 'P2'])

    window.localStorage.setItem(agentConversationKey('TEN_A', 'weekly'), 'C3')
    getAgentConversation.mockResolvedValueOnce({ auditId: 'X', findingId: null, messages: [], proposals: [draft] })
    const reloaded = mountPanel({ auditCode: 'weekly' })
    await flushPromises()
    expect(reloaded.findAllComponents(ProposalCard)).toHaveLength(1)
  })

  // DAR-UI-109: the board marks what a waiting draft would change, from the plan its card fetched.
  it('hands the board the plans of the drafts still waiting, and drops one once it is decided', async () => {
    const plan = { planHash: 'H1', before: { statements: [] }, after: { statements: [] }, backtest: { closed: ['F-7'] }, status: 'PLANNED', statusMessage: null }
    planAuditChange.mockResolvedValue(plan)
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'Drafted.', proposals: [{ ...draft, kind: 'EXPECTED_CAUSES' as const }] }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'These are expected')

    const sent = wrapper.emitted('preview') as DraftPreview[][][]
    expect(sent.at(-1)![0]).toEqual([{ proposalId: 'P1', kind: 'EXPECTED_CAUSES', before: plan.before, after: plan.after, backtest: { closed: ['F-7'] } }])

    wrapper.getComponent(ProposalCard).vm.$emit('changed', { proposalId: 'P1', status: 'REJECTED' })
    await flushPromises()
    expect((wrapper.emitted('preview') as DraftPreview[][][]).at(-1)![0]).toEqual([])
    expect(wrapper.emitted('applied')).toBeUndefined()
  })

  // DAR-UI-117. An approved change moves the audit; the board must reload or the new statement never shows.
  it('tells the page when a change is applied, so the board reloads', async () => {
    planAuditChange.mockResolvedValue({ planHash: 'H1', before: { statements: [] }, after: { statements: [] }, backtest: null, status: 'PLANNED', statusMessage: null })
    sendAgentTurn.mockResolvedValueOnce(turn({ reply: 'Drafted.', proposals: [{ ...draft, kind: 'ADD_STATEMENT' as const }] }))
    const wrapper = mountPanel()
    await flushPromises()
    await send(wrapper, 'Every order is billed')
    wrapper.getComponent(ProposalCard).vm.$emit('changed', { proposalId: 'P1', status: 'APPLIED' })
    await flushPromises()
    expect(wrapper.emitted('applied')).toHaveLength(1)
  })

  it('keeps a conversation per tenant and audit, and a reset forgets them all', () => {
    expect(agentConversationKey('TEN_A', 'month-close')).not.toBe(agentConversationKey('TEN_B', 'month-close'))
    window.localStorage.setItem(agentConversationKey('TEN_A', 'month-close'), 'C1')
    window.localStorage.setItem(agentConversationKey('TEN_B', 'weekly'), 'C2')
    window.localStorage.setItem('darpan-ui-theme', 'dark')
    clearAgentConversations()
    expect(window.localStorage.length).toBe(1)
    expect(window.localStorage.getItem('darpan-ui-theme')).toBe('dark')
  })
})
