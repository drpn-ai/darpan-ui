import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../client')>()
  return { ...actual, callService: vi.fn() }
})

import { callService } from '../client'
import { agentFacade } from '../facade'
import { isIdempotentReadMethod } from '../retry'

const call = vi.mocked(callService)

// DAR-BE-159 / DAR-BE-223: the agent panel's client.
describe('agent facade methods', () => {
  beforeEach(() => call.mockReset().mockResolvedValue({}))

  it('names the seven services exactly and passes each payload as it is', async () => {
    await agentFacade.getAgentStatus()
    await agentFacade.getAgentConversation({ conversationId: 'C1' })
    await agentFacade.sendAgentTurn({ auditId: 'A1', findingId: 'F-1', text: 'Why is this open?' })
    await agentFacade.planAuditChange({ proposalId: 'P1' })
    await agentFacade.applyAuditChange({ proposalId: 'P1', planHash: 'h1' })
    await agentFacade.rejectAuditChange({ proposalId: 'P2', reason: 'not this one' })
    await agentFacade.revertAuditChange({ proposalId: 'P1' })
    expect(call.mock.calls.map((c) => [c[0], c[1]])).toEqual([
      ['facade.AgentTurnFacadeServices.get#AgentStatus', {}],
      ['facade.AgentTurnFacadeServices.get#AgentConversation', { conversationId: 'C1' }],
      ['facade.AgentTurnFacadeServices.send#AgentTurn', { auditId: 'A1', findingId: 'F-1', text: 'Why is this open?' }],
      ['facade.AgentChangeFacadeServices.plan#AuditChange', { proposalId: 'P1' }],
      ['facade.AgentChangeFacadeServices.apply#AuditChange', { proposalId: 'P1', planHash: 'h1' }],
      ['facade.AgentChangeFacadeServices.reject#AuditChange', { proposalId: 'P2', reason: 'not this one' }],
      ['facade.AgentChangeFacadeServices.revert#AuditChange', { proposalId: 'P1' }],
    ])
  })

  it('never retries a turn or an approval, and may retry the panel reads', () => {
    // A turn calls the model and is billed; an apply writes the audit. Neither may run twice on a network blip.
    expect(isIdempotentReadMethod('facade.AgentTurnFacadeServices.send#AgentTurn')).toBe(false)
    expect(isIdempotentReadMethod('facade.AgentChangeFacadeServices.apply#AuditChange')).toBe(false)
    expect(isIdempotentReadMethod('facade.AgentChangeFacadeServices.revert#AuditChange')).toBe(false)
    expect(isIdempotentReadMethod('facade.AgentTurnFacadeServices.get#AgentStatus')).toBe(true)
    expect(isIdempotentReadMethod('facade.AgentTurnFacadeServices.get#AgentConversation')).toBe(true)
  })
})
