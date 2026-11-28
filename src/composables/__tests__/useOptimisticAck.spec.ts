import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import type { AuditAcknowledgement } from '../../lib/api/auditTypes'

// DAR-UI-155 / DAR-OPS-029 U05b. The open finding's acknowledgement, shown at once and saved behind: what is on screen
// while the saves queue, and what a refusal puts back.

const acknowledgeFinding = vi.hoisted(() => vi.fn())
const updateAcknowledgement = vi.hoisted(() => vi.fn())
const reopenAcknowledgement = vi.hoisted(() => vi.fn())

vi.mock('../../lib/api/facade', () => ({
  auditFacade: { acknowledgeFinding, updateAcknowledgement, reopenAcknowledgement },
}))

import { useOptimisticAck } from '../useOptimisticAck'

const SAVED: AuditAcknowledgement = { note: 'Refunded', by: { id: 'U1', label: 'Sam R.' }, at: '2026-10-03T09:00:00-07:00', remindOn: null, reminded: false }

function setup(held: AuditAcknowledgement | null = null) {
  const finding = ref('F-1')
  const read = ref<AuditAcknowledgement | null>(held)
  const on = { shown: vi.fn(), saved: vi.fn(), refused: vi.fn() }
  const ack = useOptimisticAck({
    finding: () => finding.value,
    target: () => finding.value,
    held: () => read.value,
    remindDays: () => 5,
    me: () => ({ id: 'U9', label: 'Aditi P.' }),
    timeZone: () => 'America/Los_Angeles',
    on,
  })
  return { ack, finding, read, on }
}

beforeEach(() => {
  acknowledgeFinding.mockReset()
  updateAcknowledgement.mockReset()
  reopenAcknowledgement.mockReset()
})

describe('useOptimisticAck', () => {
  it('shows the acknowledgement before the save answers, then the backend\'s own record', async () => {
    let answer: (value: unknown) => void = () => {}
    acknowledgeFinding.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const { ack, on } = setup()
    ack.acknowledge('Refunded', true)
    expect(ack.acknowledgement.value).toMatchObject({ note: 'Refunded', by: { id: 'U9' } })
    expect(on.shown).toHaveBeenCalledWith('F-1', expect.objectContaining({ note: 'Refunded' }), null, 1)
    expect(on.saved).not.toHaveBeenCalled()
    answer({ ok: true, acknowledgement: SAVED })
    await flushPromises()
    expect(ack.acknowledgement.value).toEqual(SAVED)
    expect(on.saved).toHaveBeenCalledWith('F-1', 1)
  })

  // A refusal puts back what the backend holds, never the value an earlier queued save showed but the backend never kept.
  it('puts back what the backend holds when both queued saves are refused', async () => {
    let answerFirst: (value: unknown) => void = () => {}
    acknowledgeFinding.mockReturnValue(new Promise((resolve) => { answerFirst = resolve }))
    updateAcknowledgement.mockResolvedValue({ ok: false, errors: ['Nothing to change'] })
    const { ack, on } = setup()
    ack.acknowledge('First', true)
    ack.change('Second', true)
    answerFirst({ ok: false, errors: ['Finding F-1 is fixed'] })
    await flushPromises()
    expect(ack.acknowledgement.value).toBeNull()
    expect(ack.error.value).toBe('Nothing to change')
    expect(on.refused.mock.calls.map((call) => [call[1], call[3], call[4]])).toEqual([['Finding F-1 is fixed', null, 1], ['Nothing to change', null, 2]])
  })

  it('leaves a refusal to the page once the person has moved on, and a new finding starts clean', async () => {
    let answer: (value: unknown) => void = () => {}
    reopenAcknowledgement.mockReturnValue(new Promise((resolve) => { answer = resolve }))
    const { ack, finding, on } = setup(SAVED)
    ack.reopen()
    expect(ack.acknowledgement.value).toBeNull()
    finding.value = 'F-2'
    await flushPromises()
    answer({ ok: false, errors: ['Finding F-1 was not found'] })
    await flushPromises()
    expect(on.refused).toHaveBeenCalledWith('F-1', 'Finding F-1 was not found', false, SAVED, 1)
    expect(ack.error.value).toBe('')
  })

  it('lets a reload\'s different word replace what was just shown', async () => {
    acknowledgeFinding.mockReturnValue(new Promise(() => {}))
    const { ack, read } = setup()
    ack.acknowledge('Refunded', true)
    read.value = { ...SAVED, note: 'Changed elsewhere' }
    await flushPromises()
    expect(ack.acknowledgement.value?.note).toBe('Changed elsewhere')
  })
})
