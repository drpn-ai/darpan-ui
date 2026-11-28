import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { ApiCallError } from '../../lib/api/client'

const sendAgentQueryTurn = vi.hoisted(() => vi.fn())
vi.mock('../../lib/api/facade', () => ({ scriptFacade: { sendAgentQueryTurn } }))

import { useQueryAsk, type AskableDraft } from '../useQueryAsk'

function setup() {
  const draft = ref<AskableDraft | null>({ queryName: '', description: '', readSpecJson: '{}', scriptBody: 'x' })
  const errors: string[] = []
  const ask = useQueryAsk({ draft, isBusy: () => false, onRun: vi.fn(), setError: (message) => errors.push(message) })
  return { ask, errors }
}

describe('useQueryAsk', () => {
  beforeEach(() => {
    sendAgentQueryTurn.mockReset()
  })

  // DAR-OPS-029 U18: the ask box reads a refusal the way every other page does (serviceErrors).
  it('shows every sentence a refusal gave, not only the first', async () => {
    sendAgentQueryTurn.mockRejectedValue(new ApiCallError('No audit keeps that field.', 200, {
      result: { ok: false, errors: ['No audit keeps that field.', 'Ask for a field one of your audits reads.'] },
    }))
    const { ask, errors } = setup()
    ask.askText.value = 'refunds by store'
    await ask.ask()
    expect(errors.at(-1)).toBe('No audit keeps that field. Ask for a field one of your audits reads.')
  })

  it('shows its own line, never the raw text, for a failure the client did not throw', async () => {
    sendAgentQueryTurn.mockRejectedValue(new TypeError("Cannot read properties of undefined (reading 'proposal')"))
    const { ask, errors } = setup()
    ask.askText.value = 'refunds by store'
    await ask.ask()
    expect(errors.at(-1)).toBe('Could not ask the agent.')
  })

  it('starts a new conversation after the old one is not found', async () => {
    sendAgentQueryTurn.mockResolvedValueOnce({ conversationId: 'CV1', reply: 'Which store?' })
    sendAgentQueryTurn.mockRejectedValueOnce(new ApiCallError('Conversation CV1 was not found.', 200))
    sendAgentQueryTurn.mockResolvedValueOnce({ conversationId: 'CV2', reply: 'Done.' })
    const { ask } = setup()
    for (const text of ['refunds', 'store 12', 'refunds again']) {
      ask.askText.value = text
      await ask.ask()
    }
    expect(sendAgentQueryTurn.mock.calls[1]?.[0]).toMatchObject({ conversationId: 'CV1' })
    expect(sendAgentQueryTurn.mock.calls[2]?.[0]).not.toHaveProperty('conversationId')
  })
})
